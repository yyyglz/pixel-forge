package com.pixelforge;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

@Service
class TaskService {
    private final JdbcTemplate db; private final TemplateMapper templates; private final ThreadPoolTaskExecutor executor; private final TransactionTemplate tx;
    private static final Logger log = LoggerFactory.getLogger(TaskService.class);
    private final Path storage; private final boolean simulationEnabled;
    private record PendingFailure(String stage, String message, boolean refundRejected) {}
    private record PendingCleanup(String taskId, String resultUrl, Path path) {}
    private final ConcurrentMap<String, PendingFailure> pendingFailures = new ConcurrentHashMap<>();
    private final ConcurrentMap<Path, PendingCleanup> pendingCleanups = new ConcurrentHashMap<>();
    TaskService(JdbcTemplate db, TemplateMapper templates, ThreadPoolTaskExecutor executor, TransactionTemplate tx, @Value("${pixel.storage}") String storage, @Value("${pixel.simulation-enabled}") boolean simulationEnabled) {
        this.db=db; this.templates=templates; this.executor=executor; this.tx=tx; this.storage=Path.of(storage).toAbsolutePath().normalize(); this.simulationEnabled=simulationEnabled;
    }
    void user(long user) { if (db.queryForObject("SELECT COUNT(*) FROM users WHERE id=?", Integer.class,user)==0) throw new ApiException(HttpStatus.UNAUTHORIZED,"演示用户不存在"); }
    @Transactional
    String create(long user, CreateTask request) {
        user(user);
        Map<String,Object> template=templates.find(request.templateId());
        if(template==null) throw new ApiException(HttpStatus.NOT_FOUND,"模板不存在");
        List<String> assets=request.assetIds();
        int count=((Number)template.get("requiredImageCount")).intValue();
        if(assets==null || assets.size()!=count || new HashSet<>(assets).size()!=count) throw new ApiException(HttpStatus.BAD_REQUEST,"素材数量不符合模板要求");
        String fail=request.failAt()==null?"NONE":request.failAt(); int delay=request.stageDelayMs()==null?2000:request.stageDelayMs();
        if(!List.of("NONE","ASSET_CHECK","GENERATING","FINALIZING").contains(fail) || delay<500 || delay>10000) throw new ApiException(HttpStatus.BAD_REQUEST,"模拟参数不合法");
        if(!simulationEnabled && (!fail.equals("NONE") || request.stageDelayMs()!=null)) throw new ApiException(HttpStatus.FORBIDDEN,"模拟控制已关闭");
        for(String asset:assets) {
            List<Map<String,Object>> rows=db.queryForList("SELECT user_id,mime_type,file_size FROM assets WHERE id=?",asset);
            if(rows.isEmpty() || ((Number)rows.get(0).get("user_id")).longValue()!=user) throw new ApiException(HttpStatus.FORBIDDEN,"素材不存在或不属于当前用户");
            Map<String,Object> a=rows.get(0);
            if(!Arrays.asList(template.get("acceptedMimeTypes").toString().split(",")).contains(a.get("mime_type")) || ((Number)a.get("file_size")).longValue()>((Number)template.get("maxFileSizeBytes")).longValue()) throw new ApiException(HttpStatus.BAD_REQUEST,"素材不符合模板要求");
        }
        if(db.update("UPDATE demo_accounts SET credits=credits-100 WHERE user_id=? AND credits>=100",user)!=1) throw new ApiException(HttpStatus.CONFLICT,"演示额度不足，请先增加额度");
        String id=UUID.randomUUID().toString();
        db.update("INSERT INTO creation_tasks(id,user_id,template_id,status,fail_at,stage_delay_ms) VALUES (?,?,?,'QUEUED',?,?)",id,user,request.templateId(),fail,delay);
        for(int i=0;i<assets.size();i++) db.update("INSERT INTO task_assets(task_id,asset_id,position) VALUES (?,?,?)",id,assets.get(i),i);
        event(id,null,"QUEUED","任务已受理");
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() { @Override public void afterCommit() {
            try { executor.execute(() -> process(id)); } catch (RejectedExecutionException e) { failEventually(id,null,"任务队列已满，请稍后重试",true); }
        }});
        return id;
    }
    void process(String id) {
        String stage = null;
        PendingCleanup result = null;
        try {
            List<Map<String,Object>> rows=db.queryForList("SELECT * FROM creation_tasks WHERE id=?",id);
            if(rows.isEmpty()) return;
            Map<String,Object> task=rows.get(0);
            String failAt=(String)task.get("fail_at");
            int delay=((Number)task.get("stage_delay_ms")).intValue();
            for(String next:List.of("ASSET_CHECK","GENERATING","FINALIZING")) {
                stage=next;
                if(!begin(id,stage)) return;
                if(stage.equals("ASSET_CHECK")) {
                    List<String> paths=db.queryForList("SELECT a.storage_path FROM assets a JOIN task_assets ta ON ta.asset_id=a.id WHERE ta.task_id=? ORDER BY ta.position",String.class,id);
                    if(paths.isEmpty() || paths.stream().anyMatch(p -> !Files.isRegularFile(storage.resolve(p).normalize()))) throw new IllegalStateException("素材文件不存在");
                }
                Thread.sleep(delay);
                if(stage.equals(failAt)) throw new IllegalStateException("演示："+stage+" 阶段失败");
                if(stage.equals("FINALIZING")) {
                    String path=db.queryForObject("SELECT a.storage_path FROM assets a JOIN task_assets ta ON ta.asset_id=a.id WHERE ta.task_id=? ORDER BY ta.position LIMIT 1",String.class,id);
                    Path dir=storage.resolve("results"); Files.createDirectories(dir);
                    String ext=path.endsWith(".png")?".png":".jpg"; String name=id+ext;
                    String url="/api/media/results/"+name+"?userId="+task.get("user_id");
                    result=new PendingCleanup(id,url,dir.resolve(name));
                    Files.copy(storage.resolve(path),result.path(),StandardCopyOption.REPLACE_EXISTING);
                    Boolean completed=tx.execute(s -> { int changed=db.update("UPDATE creation_tasks SET status='SUCCEEDED',result_url=?,completed_at=NOW(3),updated_at=NOW(3) WHERE id=? AND status='RUNNING'",url,id); if(changed==1) event(id,"FINALIZING","SUCCEEDED","制作完成"); return changed==1; });
                    if(!Boolean.TRUE.equals(completed)) cleanupEventually(result);
                    result=null;
                }
            }
        } catch(InterruptedException e) {
            Thread.currentThread().interrupt(); failEventually(id,stage,"任务执行被中断");
            if(result!=null) cleanupEventually(result);
        } catch(Exception e) {
            log.warn("Task {} failed at {}; scheduling failure recording", id, stage, e);
            failEventually(id,stage,e.getMessage()==null?"任务执行失败":e.getMessage());
            if(result!=null) cleanupEventually(result);
        }
    }
    boolean begin(String id,String stage) {
        return Boolean.TRUE.equals(tx.execute(s -> { int n=db.update("UPDATE creation_tasks SET status='RUNNING',current_stage=?,started_at=COALESCE(started_at,NOW(3)),updated_at=NOW(3) WHERE id=? AND status IN ('QUEUED','RUNNING')",stage,id); if(n==1) event(id,stage,"STARTED","开始 "+stage); return n==1; }));
    }
    void fail(String id,String stage,String message,boolean refundRejected) {
        TransactionTemplate failureTx = new TransactionTemplate(Objects.requireNonNull(tx.getTransactionManager())); failureTx.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        failureTx.executeWithoutResult(s -> {
            int n=db.update("UPDATE creation_tasks SET status='FAILED',failed_stage=?,error_message=?,completed_at=NOW(3),updated_at=NOW(3) WHERE id=? AND status IN ('QUEUED','RUNNING')",stage,message,id);
            if(n==1) {
                if(refundRejected && db.update("UPDATE demo_accounts a JOIN creation_tasks t ON t.user_id=a.user_id SET a.credits=LEAST(a.credits+100,100000) WHERE t.id=?",id)!=1)
                    throw new IllegalStateException("无法返还演示额度");
                event(id,stage,"FAILED",message);
            }
        });
    }
    void event(String id,String stage,String type,String msg) { db.update("INSERT INTO task_events(task_id,stage,event_type,message) VALUES (?,?,?,?)",id,stage,type,msg); }
    Map<String,Object> task(long user,String id) { user(user); List<Map<String,Object>> rows=db.queryForList(select()+" WHERE t.id=? AND t.user_id=?",id,user); if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"任务不存在"); return rows.get(0); }
    private void failEventually(String id, String stage, String message) {
        failEventually(id, stage, message, false);
    }
    private void failEventually(String id, String stage, String message, boolean refundRejected) {
        PendingFailure pending = new PendingFailure(stage, message.length() > 500 ? message.substring(0, 500) : message, refundRejected);
        pendingFailures.put(id, pending);
        retryFailure(id, pending);
    }
    private void retryFailure(String id, PendingFailure pending) {
        try { fail(id, pending.stage(), pending.message(), pending.refundRejected()); pendingFailures.remove(id, pending); }
        catch (RuntimeException e) { log.warn("Could not persist failure for task {}; will retry while this process runs", id, e); }
    }
    private void cleanupEventually(PendingCleanup cleanup) {
        pendingCleanups.put(cleanup.path(), cleanup);
        retryCleanup(cleanup);
    }
    private void retryCleanup(PendingCleanup cleanup) {
        try {
            List<Map<String,Object>> rows=db.queryForList("SELECT result_url FROM creation_tasks WHERE id=?",cleanup.taskId());
            // A commit can fail ambiguously. Never delete a file still referenced by the committed row.
            if(rows.isEmpty() || !Objects.equals(rows.get(0).get("result_url"), cleanup.resultUrl())) Files.deleteIfExists(cleanup.path());
            pendingCleanups.remove(cleanup.path(), cleanup);
        } catch (Exception e) { log.warn("Could not reconcile result file for task {}; will retry while this process runs", cleanup.taskId(), e); }
    }
    @Scheduled(fixedDelayString = "${pixel.failure-retry-ms:5000}")
    void retryPending() {
        pendingFailures.forEach(this::retryFailure);
        pendingCleanups.values().forEach(this::retryCleanup);
    }
    void delete(long user,String id) {
        user(user);
        PendingFailure pending = pendingFailures.get(id);
        if(pending!=null && pending.refundRejected()) throw new ApiException(HttpStatus.CONFLICT,"额度返还处理中，请稍后删除");
        java.util.concurrent.atomic.AtomicReference<PendingCleanup> observed = new java.util.concurrent.atomic.AtomicReference<>();
        String resultUrl;
        try { resultUrl=tx.execute(s -> {
            List<Map<String,Object>> rows=db.queryForList("SELECT status,result_url FROM creation_tasks WHERE id=? AND user_id=? FOR UPDATE",id,user);
            if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"任务不存在");
            String url=(String)rows.get(0).get("result_url");
            PendingCleanup candidate=resultCleanup(id,url);
            if(candidate!=null) observed.set(candidate);
            db.update("DELETE FROM task_events WHERE task_id=?",id);
            db.update("DELETE FROM task_assets WHERE task_id=?",id);
            db.update("DELETE FROM creation_tasks WHERE id=? AND user_id=?",id,user);
            return url;
        }); } catch (RuntimeException e) {
            // The database may have committed even if the commit response was lost.
            if(observed.get()!=null) cleanupEventually(observed.get());
            throw e;
        }
        PendingCleanup cleanup=resultCleanup(id,resultUrl);
        if(cleanup!=null) cleanupEventually(cleanup);
    }
    private PendingCleanup resultCleanup(String id, String resultUrl) {
        if(resultUrl==null || !resultUrl.startsWith("/api/media/results/")) return null;
        String filename=resultUrl.substring("/api/media/results/".length()).split("\\?")[0];
        if(!filename.equals(id+".png") && !filename.equals(id+".jpg")) return null;
        if(!id.matches("[0-9a-f-]{36}")) return null;
        return new PendingCleanup(id,resultUrl,storage.resolve("results").resolve(filename).normalize());
    }
    List<Map<String,Object>> history(long user,Long template,int page) { user(user); if(page<0 || page>10000) throw new ApiException(HttpStatus.BAD_REQUEST,"页码不合法"); return template==null ? db.queryForList(select()+" WHERE t.user_id=? ORDER BY t.created_at DESC,t.id DESC LIMIT 20 OFFSET ?",user,page*20) : db.queryForList(select()+" WHERE t.user_id=? AND t.template_id=? ORDER BY t.created_at DESC,t.id DESC LIMIT 20 OFFSET ?",user,template,page*20); }
    private String select() { return "SELECT t.id,t.template_id AS templateId,p.title AS templateTitle,t.status,t.current_stage AS currentStage,t.failed_stage AS failedStage,t.error_message AS errorMessage,t.result_url AS resultUrl,t.created_at AS createdAt,t.started_at AS startedAt,t.completed_at AS completedAt,t.updated_at AS updatedAt FROM creation_tasks t JOIN templates p ON p.id=t.template_id"; }
    Path storage() { return storage; }
}
record CreateTask(long templateId, List<String> assetIds, String failAt, Integer stageDelayMs) {}

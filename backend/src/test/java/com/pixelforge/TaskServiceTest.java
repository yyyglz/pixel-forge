package com.pixelforge;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.nio.file.*;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionCallbackWithoutResult;
import org.springframework.transaction.support.TransactionTemplate;

class TaskServiceTest {
    @TempDir Path dir;
    JdbcTemplate db=mock(JdbcTemplate.class); TemplateMapper mapper=mock(TemplateMapper.class);
    ThreadPoolTaskExecutor executor=mock(ThreadPoolTaskExecutor.class); TransactionTemplate tx=mock(TransactionTemplate.class);
    TaskService service;
    @BeforeEach void setup() {
        when(tx.getTransactionManager()).thenReturn(mock(org.springframework.transaction.PlatformTransactionManager.class));
        when(tx.execute(any())).thenAnswer(inv -> ((TransactionCallback<?>)inv.getArgument(0)).doInTransaction(null));
        doAnswer(inv -> { ((java.util.function.Consumer<org.springframework.transaction.TransactionStatus>)inv.getArgument(0)).accept(null); return null; }).when(tx).executeWithoutResult(any());
        service=new TaskService(db,mapper,executor,tx,dir.toString(),true);
    }
    @Test void stagesRunInOrderAndProduceRealFile() throws Exception {
        Files.createDirectories(dir.resolve("uploads")); Files.writeString(dir.resolve("uploads/input.png"),"example");
        when(db.queryForList(contains("SELECT * FROM creation_tasks"),any(Object[].class))).thenReturn(List.of(Map.of("fail_at","NONE","stage_delay_ms",0,"user_id",1)));
        when(db.queryForList(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn(List.of("uploads/input.png"));
        when(db.queryForObject(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn("uploads/input.png");
        when(db.update(anyString(),any(Object[].class))).thenReturn(1);
        service.process("test-id");
        assertTrue(Files.exists(dir.resolve("results/test-id.png")));
        var order=inOrder(db);
        order.verify(db).update(contains("SET status='RUNNING'"),eq("ASSET_CHECK"),eq("test-id"));
        order.verify(db).update(contains("SET status='RUNNING'"),eq("GENERATING"),eq("test-id"));
        order.verify(db).update(contains("SET status='RUNNING'"),eq("FINALIZING"),eq("test-id"));
        verify(db).update(contains("SET status='SUCCEEDED'"),contains("/api/media/results/test-id.png"),eq("test-id"));
    }
    @Test void failureStopsLaterStagesAndPersistsCause() throws Exception {
        Files.createDirectories(dir.resolve("uploads")); Files.writeString(dir.resolve("uploads/input.png"),"x");
        when(db.queryForList(contains("SELECT * FROM creation_tasks"),any(Object[].class))).thenReturn(List.of(Map.of("fail_at","GENERATING","stage_delay_ms",0,"user_id",1)));
        when(db.queryForList(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn(List.of("uploads/input.png"));
        when(db.update(anyString(),any(Object[].class))).thenReturn(1);
        service.process("test-id");
        verify(db,never()).update(contains("SET status='RUNNING'"),eq("FINALIZING"),any());
        verify(db).update(contains("SET status='FAILED'"),eq("GENERATING"),contains("GENERATING"),eq("test-id"));
        assertFalse(Files.exists(dir.resolve("results")));
    }
    @Test void invalidAssetCountRejectedBeforeInsert() {
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(mapper.find(1)).thenReturn(Map.of("requiredImageCount",2));
        assertThrows(ApiException.class,()->service.create(1,new CreateTask(1,List.of("only-one"),"NONE",500)));
        verify(db,never()).update(contains("INSERT INTO creation_tasks"),any(Object[].class));
    }
    @Test void deleteOwnedTaskRemovesChildrenAndResultFile() throws Exception {
        Files.createDirectories(dir.resolve("results"));
        Path result=dir.resolve("results/11111111-1111-1111-1111-111111111111.jpg"); Files.writeString(result,"x");
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(db.queryForList(contains("SELECT status,result_url FROM creation_tasks"),any(Object[].class))).thenReturn(List.of(Map.of("status","SUCCEEDED","result_url","/api/media/results/11111111-1111-1111-1111-111111111111.jpg?userId=1")));
        service.delete(1,"11111111-1111-1111-1111-111111111111");
        verify(db).update(contains("DELETE FROM task_events"),eq("11111111-1111-1111-1111-111111111111"));
        verify(db).update(contains("DELETE FROM task_assets"),eq("11111111-1111-1111-1111-111111111111"));
        verify(db).update(contains("DELETE FROM creation_tasks"),eq("11111111-1111-1111-1111-111111111111"),eq(1L));
        assertFalse(Files.exists(result));
    }
    @Test void deleteMissingOrOtherUsersTaskIsRejected() {
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(db.queryForList(contains("SELECT status,result_url FROM creation_tasks"),any(Object[].class))).thenReturn(List.of());
        assertThrows(ApiException.class,()->service.delete(2,"missing-task"));
        verify(db,never()).update(contains("DELETE FROM"),any(Object[].class));
    }
    @Test void queryingAnotherUsersTaskIsNotFound() {
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(db.queryForList(contains("WHERE t.id=? AND t.user_id=?"),any(Object[].class))).thenReturn(List.of());
        assertThrows(ApiException.class,()->service.task(2,"other-user-task"));
        verify(db,never()).update(anyString(),any(Object[].class));
    }
    @Test void unavailableDatabaseAtFirstReadIsRetriedAsFailureAfterRecovery() {
        when(db.queryForList(contains("SELECT * FROM creation_tasks"),any(Object[].class)))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline"));
        when(db.update(contains("SET status='FAILED'"),any(Object[].class)))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline")).thenReturn(1);
        assertDoesNotThrow(() -> service.process("db-task"));
        service.retryPending();
        verify(db,times(2)).update(contains("SET status='FAILED'"),any(),any(),eq("db-task"));
    }
    @Test void deletedTaskDuringFinalizingDoesNotLeaveCopiedFile() throws Exception {
        Files.createDirectories(dir.resolve("uploads")); Files.writeString(dir.resolve("uploads/input.png"),"x");
        when(db.queryForList(contains("SELECT * FROM creation_tasks"),any(Object[].class)))
            .thenReturn(List.of(Map.of("fail_at","NONE","stage_delay_ms",0,"user_id",1)));
        when(db.queryForList(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn(List.of("uploads/input.png"));
        when(db.queryForObject(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn("uploads/input.png");
        when(db.update(anyString(),any(Object[].class))).thenReturn(1);
        when(db.update(contains("SET status='SUCCEEDED'"),any(Object[].class))).thenReturn(0);
        service.process("race-task");
        assertFalse(Files.exists(dir.resolve("results/race-task.png")));
    }

    @Test void ambiguousSuccessWriteKeepsFileIfDatabaseReferencesIt() throws Exception {
        Files.createDirectories(dir.resolve("uploads")); Files.writeString(dir.resolve("uploads/input.png"),"x");
        when(db.queryForList(contains("SELECT * FROM creation_tasks"),any(Object[].class)))
            .thenReturn(List.of(Map.of("fail_at","NONE","stage_delay_ms",0,"user_id",1)));
        when(db.queryForList(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn(List.of("uploads/input.png"));
        when(db.queryForObject(contains("SELECT a.storage_path"),eq(String.class),any(Object[].class))).thenReturn("uploads/input.png");
        when(db.update(anyString(),any(Object[].class))).thenReturn(1);
        when(db.update(contains("SET status='SUCCEEDED'"),any(Object[].class)))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("commit outcome unknown"));
        when(db.queryForList(contains("SELECT result_url FROM creation_tasks"),any(Object[].class)))
            .thenReturn(List.of(Map.of("result_url","/api/media/results/ambiguous-task.png?userId=1")));
        service.process("ambiguous-task");
        assertTrue(Files.exists(dir.resolve("results/ambiguous-task.png")));
    }

    @Test void failureAfterStageEntryRetriesRecordingWithoutContinuing() {
        when(db.queryForList(contains("SELECT * FROM creation_tasks"),any(Object[].class)))
            .thenReturn(List.of(Map.of("fail_at","NONE","stage_delay_ms",0,"user_id",1)));
        when(db.update(contains("SET status='RUNNING'"),any(Object[].class)))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline"));
        when(db.update(contains("SET status='FAILED'"),any(Object[].class)))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline")).thenReturn(1);
        service.process("stage-task");
        service.retryPending();
        verify(db,times(2)).update(contains("SET status='FAILED'"),eq("ASSET_CHECK"),any(),eq("stage-task"));
        verify(db,never()).update(contains("SET status='RUNNING'"),eq("GENERATING"),eq("stage-task"));
    }
    @Test void rejectedDispatchRefundsExactlyOnceAfterDatabaseRetry() {
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(mapper.find(1)).thenReturn(Map.of("requiredImageCount",1,"acceptedMimeTypes","image/png","maxFileSizeBytes",100));
        when(db.queryForList(contains("SELECT user_id,mime_type,file_size"),any(Object[].class)))
            .thenReturn(List.of(Map.of("user_id",1,"mime_type","image/png","file_size",1)));
        when(db.update(anyString(),any(Object[].class))).thenReturn(1);
        when(db.update(contains("SET a.credits"),any(Object[].class)))
            .thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline")).thenReturn(1);
        doThrow(new java.util.concurrent.RejectedExecutionException()).when(executor).execute(any(Runnable.class));
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            String id=service.create(1,new CreateTask(1,List.of("asset"),"NONE",500));
            var callback=org.springframework.transaction.support.TransactionSynchronizationManager.getSynchronizations().get(0);
            callback.afterCommit();
            service.retryPending();
            service.retryPending();
            verify(db,times(2)).update(contains("SET a.credits"),eq(id));
            verify(db,times(2)).update(contains("SET status='FAILED'"),isNull(),any(),eq(id));
        } finally { org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization(); }
    }
    @Test void resultFileDeletionFailureIsRetried() throws Exception {
        String id="22222222-2222-2222-2222-222222222222";
        Path path=dir.resolve("results").resolve(id+".jpg");
        Files.createDirectories(path); Files.writeString(path.resolve("locked"),"x");
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(db.queryForList(contains("SELECT status,result_url FROM creation_tasks"),any(Object[].class)))
            .thenReturn(List.of(Map.of("status","SUCCEEDED","result_url","/api/media/results/"+id+".jpg?userId=1")));
        service.delete(1,id);
        assertTrue(Files.exists(path));
        Files.delete(path.resolve("locked"));
        service.retryPending();
        assertFalse(Files.exists(path));
        verify(db).queryForList(contains("FOR UPDATE"),eq(id),eq(1L));
    }
    @Test void databaseFailureDuringDeleteDoesNotRemoveReferencedResult() throws Exception {
        String id="33333333-3333-3333-3333-333333333333";
        Path path=dir.resolve("results").resolve(id+".jpg"); Files.createDirectories(path.getParent()); Files.writeString(path,"x");
        String url="/api/media/results/"+id+".jpg?userId=1";
        when(db.queryForObject(contains("SELECT COUNT(*)"),eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(db.queryForList(contains("SELECT status,result_url"),any(Object[].class))).thenReturn(List.of(Map.of("result_url",url)));
        when(db.update(contains("DELETE FROM task_events"),any(Object[].class))).thenThrow(new org.springframework.dao.DataAccessResourceFailureException("offline"));
        when(db.queryForList(contains("SELECT result_url FROM creation_tasks"),any(Object[].class))).thenReturn(List.of(Map.of("result_url",url)));
        assertThrows(org.springframework.dao.DataAccessResourceFailureException.class,()->service.delete(1,id));
        assertTrue(Files.exists(path));
    }

}

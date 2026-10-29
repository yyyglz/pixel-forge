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
}

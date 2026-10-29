package com.pixelforge;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/demo/account")
class DemoAccountController {
    private final JdbcTemplate db;
    private final TaskService tasks;
    DemoAccountController(JdbcTemplate db, TaskService tasks) { this.db=db; this.tasks=tasks; }
    @GetMapping Object account(@RequestHeader("X-Demo-User-Id") long user) {
        tasks.user(user);
        List<Map<String,Object>> rows=db.queryForList("SELECT a.credits,a.plan,u.display_name AS displayName,u.username FROM demo_accounts a JOIN users u ON u.id=a.user_id WHERE a.user_id=?",user);
        if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"演示账户不存在");
        return Map.of("data",rows.get(0));
    }
    @PostMapping("/plan") @Transactional Object plan(@RequestHeader("X-Demo-User-Id") long user, @RequestBody PlanRequest request) {
        tasks.user(user);
        if(!"FREE".equals(request.plan()) && !"PRO".equals(request.plan())) throw new ApiException(HttpStatus.BAD_REQUEST,"无效的演示方案");
        db.update("UPDATE demo_accounts SET plan=? WHERE user_id=?",request.plan(),user);
        return account(user);
    }
    @PostMapping("/credits") @Transactional Object credits(@RequestHeader("X-Demo-User-Id") long user) {
        tasks.user(user);
        db.update("UPDATE demo_accounts SET credits=LEAST(credits+1000, 100000) WHERE user_id=?",user);
        return account(user);
    }
    record PlanRequest(String plan) {}
}

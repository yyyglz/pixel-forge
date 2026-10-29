package com.pixelforge;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import java.util.concurrent.ThreadPoolExecutor;

@Configuration
class TaskConfig {
    @Bean ThreadPoolTaskExecutor taskExecutor(@Value("${pixel.core-threads}") int core, @Value("${pixel.max-threads}") int max, @Value("${pixel.queue-capacity}") int capacity) {
        ThreadPoolTaskExecutor e = new ThreadPoolTaskExecutor(); e.setCorePoolSize(core); e.setMaxPoolSize(max); e.setQueueCapacity(capacity); e.setThreadNamePrefix("creation-"); e.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy()); e.initialize(); return e;
    }
}

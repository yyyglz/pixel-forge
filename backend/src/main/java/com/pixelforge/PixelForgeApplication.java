package com.pixelforge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class PixelForgeApplication {
    public static void main(String[] args) { SpringApplication.run(PixelForgeApplication.class, args); }
}

package com.pixelforge;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

class ApiException extends RuntimeException {
    final HttpStatus status;
    ApiException(HttpStatus status, String message) { super(message); this.status = status; }
}
@RestControllerAdvice
class ApiErrors {
    @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e) { return ResponseEntity.status(e.status).body(Map.of("error", Map.of("message", e.getMessage(), "code", e.status.value()))); }
    @ExceptionHandler({MethodArgumentNotValidException.class, MultipartException.class, IllegalArgumentException.class,
        MissingRequestHeaderException.class, MissingServletRequestParameterException.class,
        MissingServletRequestPartException.class, HttpMessageNotReadableException.class})
    ResponseEntity<?> bad(Exception e) { return ResponseEntity.badRequest().body(Map.of("error",Map.of("message","请求参数或文件不符合要求", "code",400))); }
    @ExceptionHandler(Exception.class) ResponseEntity<?> unexpected(Exception e) { return ResponseEntity.status(500).body(Map.of("error",Map.of("message","服务暂时不可用", "code",500))); }
}

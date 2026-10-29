package com.pixelforge;

import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
class ApiController {
    private final TaskService tasks; private final TemplateMapper templates; private final JdbcTemplate db;
    ApiController(TaskService tasks, TemplateMapper templates, JdbcTemplate db) { this.tasks=tasks; this.templates=templates; this.db=db; }
    @GetMapping("/templates") Object templates(@RequestParam(required=false) String category) { return Map.of("data",templates.list(category)); }
    @GetMapping("/templates/{id}") Object template(@PathVariable long id) { var t=templates.find(id); if(t==null) throw new ApiException(HttpStatus.NOT_FOUND,"模板不存在"); return Map.of("data",t); }
    @GetMapping("/demo/users") Object users() { return Map.of("data",db.queryForList("SELECT id,username,display_name AS displayName FROM users ORDER BY id")); }
    @PostMapping("/assets") Object upload(@RequestHeader("X-Demo-User-Id") long user,@RequestParam MultipartFile file) throws IOException {
        tasks.user(user); if(file.isEmpty() || file.getSize()>10485760) throw new ApiException(HttpStatus.BAD_REQUEST,"图片大小必须在 10 MB 以内");
        String type; try(ImageInputStream input=ImageIO.createImageInputStream(file.getInputStream())) {
            Iterator<ImageReader> readers=ImageIO.getImageReaders(input); if(!readers.hasNext()) throw new ApiException(HttpStatus.BAD_REQUEST,"请上传有效的 JPEG 或 PNG 图片");
            ImageReader reader=readers.next(); try { reader.setInput(input); String format=reader.getFormatName().toLowerCase(Locale.ROOT); if(!List.of("jpeg","jpg","png").contains(format)) throw new ApiException(HttpStatus.BAD_REQUEST,"仅支持 JPEG 或 PNG"); if((long)reader.getWidth(0)*reader.getHeight(0)>40000000L) throw new ApiException(HttpStatus.BAD_REQUEST,"图片像素过大"); BufferedImage image=reader.read(0); if(image==null) throw new ApiException(HttpStatus.BAD_REQUEST,"图片内容无效"); type=format.equals("png")?"image/png":"image/jpeg"; } finally { reader.dispose(); }
        } catch (IOException e) { throw new ApiException(HttpStatus.BAD_REQUEST,"图片内容无效"); }
        String id=UUID.randomUUID().toString(), ext=type.equals("image/png")?".png":".jpg", path="uploads/"+id+ext;
        Files.createDirectories(tasks.storage().resolve("uploads")); Path dest=tasks.storage().resolve(path); file.transferTo(dest);
        String original=Optional.ofNullable(file.getOriginalFilename()).orElse("image").replaceAll("[\\\\/\\p{Cntrl}]","_"); if(original.length()>255) original=original.substring(0,255);
        try { db.update("INSERT INTO assets(id,user_id,original_filename,mime_type,file_size,storage_path) VALUES (?,?,?,?,?,?)",id,user,original,type,file.getSize(),path); } catch(RuntimeException e) { Files.deleteIfExists(dest); throw e; }
        return Map.of("data",Map.of("assetId",id,"filename",original,"mimeType",type,"fileSize",file.getSize(),"previewUrl","/api/media/assets/"+id+"?userId="+user));
    }
    @PostMapping("/tasks") ResponseEntity<?> create(@RequestHeader("X-Demo-User-Id") long user,@RequestBody CreateTask request) { String id=tasks.create(user,request); return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("data",Map.of("taskId",id))); }
    @GetMapping("/tasks/{id}") Object task(@RequestHeader("X-Demo-User-Id") long user,@PathVariable String id) { return Map.of("data",tasks.task(user,id)); }
    @GetMapping("/tasks") Object history(@RequestHeader("X-Demo-User-Id") long user,@RequestParam(required=false) Long templateId,@RequestParam(defaultValue="0") int page) { return Map.of("data",tasks.history(user,templateId,page)); }
    @DeleteMapping("/tasks/{id}") Object deleteTask(@RequestHeader("X-Demo-User-Id") long user,@PathVariable String id) { tasks.delete(user,id); return Map.of("data",Map.of("deleted",true)); }
    @GetMapping("/media/assets/{id}") ResponseEntity<?> asset(@PathVariable String id,@RequestParam long userId) { tasks.user(userId); var rows=db.queryForList("SELECT storage_path,mime_type FROM assets WHERE id=? AND user_id=?",id,userId); if(rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND,"素材不存在"); return media((String)rows.get(0).get("storage_path"),(String)rows.get(0).get("mime_type")); }
    @GetMapping("/media/results/{filename:.+}") ResponseEntity<?> result(@PathVariable String filename,@RequestParam long userId) { tasks.user(userId); if(!filename.matches("[0-9a-f-]{36}\\.(png|jpg)")) throw new ApiException(HttpStatus.NOT_FOUND,"结果不存在"); String id=filename.substring(0,36); Map<String,Object> t=tasks.task(userId,id); if(!"SUCCEEDED".equals(t.get("status")) || !Objects.equals(t.get("resultUrl"),"/api/media/results/"+filename+"?userId="+userId)) throw new ApiException(HttpStatus.NOT_FOUND,"结果不存在"); return media("results/"+filename,filename.endsWith(".png")?"image/png":"image/jpeg"); }
    private ResponseEntity<?> media(String name,String type) { Path p=tasks.storage().resolve(name).normalize(); if(!p.startsWith(tasks.storage()) || !Files.isRegularFile(p)) throw new ApiException(HttpStatus.NOT_FOUND,"文件不存在"); return ResponseEntity.ok().contentType(MediaType.parseMediaType(type)).body(new FileSystemResource(p)); }
}

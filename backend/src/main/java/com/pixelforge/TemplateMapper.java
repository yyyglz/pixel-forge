package com.pixelforge;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface TemplateMapper {
    @Select("SELECT id,title,description,category,cover_url AS coverUrl,required_image_count AS requiredImageCount,accepted_mime_types AS acceptedMimeTypes,max_file_size_bytes AS maxFileSizeBytes FROM templates WHERE (#{category} IS NULL OR category=#{category}) ORDER BY id")
    List<Map<String,Object>> list(@Param("category") String category);
    @Select("SELECT id,title,description,category,cover_url AS coverUrl,required_image_count AS requiredImageCount,accepted_mime_types AS acceptedMimeTypes,max_file_size_bytes AS maxFileSizeBytes FROM templates WHERE id=#{id}")
    Map<String,Object> find(@Param("id") long id);
}

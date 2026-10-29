package com.pixelforge;
import javax.sql.DataSource;
import org.apache.ibatis.session.SqlSessionFactory;
import org.mybatis.spring.SqlSessionFactoryBean;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
@Configuration
@MapperScan(basePackageClasses=TemplateMapper.class, annotationClass=org.apache.ibatis.annotations.Mapper.class)
class MyBatisConfig {
    @Bean SqlSessionFactory sqlSessionFactory(DataSource source) throws Exception { SqlSessionFactoryBean factory=new SqlSessionFactoryBean(); factory.setDataSource(source); return factory.getObject(); }
}

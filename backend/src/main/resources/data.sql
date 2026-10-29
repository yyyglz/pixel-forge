INSERT IGNORE INTO users(id,username,display_name) VALUES (1,'alex','Alex Chen'),(2,'sam','Sam Lin');
INSERT IGNORE INTO templates(id,title,description,category,cover_url,required_image_count,accepted_mime_types,max_file_size_bytes) VALUES
(1,'光影肖像','让你的照片拥有柔和而富有电影感的光影。','人像','/covers/portrait.jpg',1,'image/jpeg,image/png',10485760),
(2,'城市漫游','把两个瞬间组合成一场城市里的小旅行。','生活','/covers/city.jpg',2,'image/jpeg,image/png',10485760),
(3,'自然来信','收集三个自然瞬间，留住季节的颜色。','自然','/covers/nature.jpg',3,'image/jpeg,image/png',10485760),
(4,'暖调日记','为平凡的一天加上一层温暖的滤镜。','生活','/covers/warm.jpg',1,'image/jpeg,image/png',10485760),
(5,'双人故事','用两张照片讲述属于你们的故事。','人像','/covers/duo.jpg',2,'image/jpeg,image/png',10485760),
(6,'山野之间','在山与云之间，重新发现宁静。','自然','/covers/mountain.jpg',1,'image/jpeg,image/png',10485760),
(7,'冬日毛孩','给你的宠物一张冬日明信片般的温暖写真。','生活','/covers/winter-friend.jpg',1,'image/jpeg,image/png',10485760),
(8,'静谧雪夜','两张夜色照片，拼成一段安静的雪夜记忆。','创意图片','/covers/snowy-night.jpg',2,'image/jpeg,image/png',10485760),
(9,'派对时刻','三张随手拍，拼成一张热闹的节日拼贴。','创意图片','/covers/party-time.jpg',3,'image/jpeg,image/png',10485760),
(10,'海边假日','两个夏日瞬间，拼成一次说走就走的海边旅行。','自然','/covers/seaside-holiday.jpg',2,'image/jpeg,image/png',10485760),
(11,'秋日人像','让黄金时刻的光，在照片里多停留一会。','人像','/covers/autumn-portrait.jpg',1,'image/jpeg,image/png',10485760),
(12,'城市云上','从高处安静地俯瞰城市与云层。','创意图片','/covers/city-above-clouds.jpg',1,'image/jpeg,image/png',10485760);
INSERT IGNORE INTO demo_accounts(user_id,credits,plan) SELECT id,5000,'FREE' FROM users;

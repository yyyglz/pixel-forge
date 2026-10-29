# 模板封面素材来源 / Cover Asset Sources

项目内 12 张模板封面均为本地文件（`frontend/public/covers/*.jpg`，9:16 竖版，640×1138，JPEG，单张 < 250 KB），运行时不依赖外部热链。预览图见 [covers-contact-sheet.jpg](covers-contact-sheet.jpg)。

## 1. 项目内既有 6 张（仅裁剪压缩）

由本项目此前通过 ImageGen 生成的本地示例图（原为 1024×1536 PNG），本次统一裁剪为 9:16 并压缩，未新增外部版权来源。

| 文件 | 原文件 | 说明 |
| --- | --- | --- |
| `portrait.jpg` | `portrait-photo.png` | ImageGen 本地示例图 |
| `city.jpg` | `city-photo.png` | ImageGen 本地示例图 |
| `nature.jpg` | `nature-photo.png` | ImageGen 本地示例图 |
| `warm.jpg` | `warm-photo.png` | ImageGen 本地示例图 |
| `duo.jpg` | `duo-photo.png` | ImageGen 本地示例图 |
| `mountain.jpg` | `mountain-photo.png` | ImageGen 本地示例图 |

## 2. 新增 6 张（来自 Lorem Picsum，图片源自 Unsplash）

| 模板 | 文件 | Picsum ID | 摄影师 | 原始尺寸 | 原始页面 |
| --- | --- | --- | --- | --- | --- |
| 7 冬日毛孩 | `winter-friend.jpg` | 1025 | Matthew Wiebe | 4951×3301 | https://unsplash.com/photos/U5rMrSI7Pn4 |
| 8 静谧雪夜 | `snowy-night.jpg` | 901 | Marcelo Quinan | 4016×4016 | https://unsplash.com/photos/R3pUGn5YiTg |
| 9 派对时刻 | `party-time.jpg` | 452 | Desi Mendoza | 4096×2722 | https://unsplash.com/photos/CuSHBGBdXc0 |
| 10 海边假日 | `seaside-holiday.jpg` | 638 | Kimberly Richards | 1774×2365 | https://unsplash.com/photos/gXSFnk2a9V4 |
| 11 秋日人像 | `autumn-portrait.jpg` | 64 | Alexander Shustov | 4326×2884 | https://unsplash.com/photos/AHBiSKaENwc |
| 12 城市云上 | `city-above-clouds.jpg` | 898 | Anthony DELANOIX | 3333×5000 | https://unsplash.com/photos/nF4lk-9IJH8 |

## 3. 授权说明

- 新增 6 张照片通过 [Lorem Picsum](https://picsum.photos) 的公开接口下载，Picsum 的图片均来自 [Unsplash](https://unsplash.com)。
- Unsplash 照片按 [Unsplash License](https://unsplash.com/license) 授权：可免费用于商业与非商业项目，无需署名（此处保留摄影师与原始链接以便追溯）；不得将照片原样转售或用于竞争性图库服务。
- 图片已下载、裁剪（9:16）并本地压缩，线上运行不依赖也不热链 Picsum / Unsplash 服务；下载接口形如 `https://picsum.photos/id/{id}/900/1600`。

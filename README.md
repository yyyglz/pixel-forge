# PixelForge

一个用于全栈开发笔试的素材制作平台：浏览模板、上传图片、提交异步制作任务，并在任务后台处理期间继续使用网站，最后查看个人历史记录与制作结果。Java（Spring Boot + MyBatis）负责业务、异步执行与 MySQL 持久化，Next.js App Router 负责界面与同源代理；**制作流程为本地模拟，不调用真实 AI 服务**。

> 交付状态：前后端源码、数据库初始化数据、CI、Docker Compose、单元测试与参考截图对齐均已完成；本 README 记录实际验证范围与已知限制。**未实现服务重启后的自动恢复、真实身份认证、真实支付与 AI 生成**，详见“已知限制”。
>
> UI 已按题目提供的四张参考截图（模板列表 UI-01、模板详情/上传 UI-02、制作中/历史 UI-03、账户设置）做布局与视觉对齐；页面文案、品牌与模板图片按题目允许的方式替换为本地素材，未逐像素复制品牌资源。

## 功能与目录

- 深色主题模板列表：顶部品牌栏 + 二级频道 chips、分类筛选（全部 / 人像 / 生活 / 自然 / 创意图片）、6 列 9:16 竖版模板卡片（标题覆盖、hover、骨架/错误/空状态）。
- 模板详情（studio 式全屏两栏）：返回、模板标题与描述、示例封面、素材要求、1～3 个图片上传位（选择、预览、替换、移除、上传中/失败反馈）、可折叠“演示控制”、提交按钮；提交后不阻塞页面。
- 历史面板与 `/history` 页：多任务独立状态、当前阶段、失败阶段与原因、成功结果预览、刷新恢复、删除记录、分页与用户隔离；**历史卡片代表一次“制作任务”，不是上传图片槽位**——详情页右栏只展示当前模板的创作记录（最新 3 条，标题旁不再显示范围说明文案），`/history` 展示该用户的全部作品。卡片左下角与参考图一致：刷新（仅等待/处理中出现，立即同步该任务）与删除（二次确认后清理任务记录；处理中删除等同取消，后台在下一阶段边界停止）。上传缩略图与制作结果均使用站内弹窗预览，不打开新页面。查询异常只提示“状态同步失败”，不会把后台任务改为失败。受理成功后先按返回的任务 ID 显示等待状态，再向服务端同步实际状态，避免列表刷新失败时丢失入口。
- 两个演示用户与持久化演示账户（额度、FREE/PRO 方案，均存 MySQL）；首次访问默认以演示用户 1 登录，登出状态会被记住；账户设置弹窗、切换用户、模拟增加额度。
- 中英文切换（界面与模板文案）；语言与演示用户选择保存在浏览器本地。
- 异步任务：提交接口返回任务 ID 后由 Java 有界线程池执行“素材检查 → 模拟生成 → 结果整理”；阶段与事件持久化，可指定阶段失败、调整阶段耗时。

```text
frontend/                    Next.js App Router 前端
  app/page.tsx               模板列表页 + page.module.css
  app/templates/[id]/        模板详情 studio 页 + detail.module.css
  app/history/               个人历史页
  app/globals.css            设计令牌、站点 header、账户/登录/计费弹窗样式
  components/providers.tsx   站点壳层、演示身份、语言、账户弹窗
  components/task-list.tsx   任务卡片 / 历史面板（轮询与异常处理）
  public/covers/             12 张本地模板封面（JPEG）
backend/src/main/            Spring Boot、MyBatis、JDBC、SQL 初始化
backend/src/test/            后端单元测试（阶段顺序、失败中断、参数与用户隔离）
docs/cover-sources.md        封面素材来源与授权
docs/development-log.md      开发过程和人工工时记录
.github/workflows/ci.yml     CI 配置
docker-compose.yml           MySQL、Java 后端、Next.js 前端
.env.example                 本地演示配置示例
```

## 业务定位与模拟边界

这是一个**全栈工程演示项目**：覆盖“浏览模板 → 上传素材 → 异步制作任务 → 查看历史结果”的完整业务闭环，重点在 Java 多步骤异步处理、MySQL 持久化、前端异步状态管理和参考 UI 还原，而不是图像算法本身。

- 模板的 `requiredImageCount` 是种子数据里的模板配置（1/2/3 张），用于演示不同模板的上传位数量、数量校验与多图任务；真实产品中它代表模板需要的素材槽数（例如单图套用、双图拼贴、多图合影等）。
- 制作流程是**可控制耗时/失败的本地模拟器**：素材检查校验文件存在与归属，模拟生成仅按阶段延迟并可选失败，结果整理把**第一张上传素材复制为结果文件**。因此像“人像模板 + 上传人脸”这样的操作在本演示中**不会做人脸替换、风格迁移或任何 AI 处理**，结果只是所传素材的副本，用于证明异步链路与结果预览可用。
- 真实产品接入 AI 时，模板会定义自己的生成参数与素材槽语义（换脸、风格化、视频化等），由生成服务替换本项目的模拟阶段；README“技术选型”中记录了该替换边界。

## 技术栈与版本

| 层 | 版本 / 方案 |
| --- | --- |
| 前端 | Node.js 22、Next.js 16.2.7（App Router，dev/build 均使用 Turbopack）、React 19.2.4、TypeScript 5.9.3 |
| 样式 | Tailwind CSS 4.3.0 + CSS Modules + 全局 CSS 设计令牌（颜色/间距对照参考截图实测值） |
| 客户端状态 / 异步 | TanStack Query 5.101.0（按用户与任务隔离查询、活动任务轮询、异常保留上次数据） |
| 图标 | lucide-react 1.17.0 |
| 测试 | Vitest 3.2.7、React Testing Library 16.3.2、jsdom 26.1.0 |
| 后端 | Java 21、Spring Boot 3.5.16、MyBatis 3.5.19 / MyBatis-Spring 3.0.4、MySQL Connector/J 8.0.28 |
| 数据库 | MySQL 8.4（Docker Compose） |
| 容器 | Node 22 Alpine、Eclipse Temurin 21、Maven 3.9.11 Wrapper |
| CI | GitHub Actions：前端 `npm ci` + lint + typecheck + test + build；后端 `./mvnw test` + package |

前端 `frontend/package-lock.json` 已生成并随仓库提交，`package.json` 直接依赖均为精确版本；原生依赖（SWC、Tailwind Oxide、lightningcss、esbuild、rollup）在锁文件中包含 macOS / Linux 各平台可选包，CI 与本机均使用 `npm ci` 安装。界面使用 Tailwind 与自定义 CSS/组件，未实际引入 shadcn/ui；上传与表单逻辑简单，未引入 React Hook Form / Zod。

## 架构与数据

```text
浏览器 → Next.js 同源 /api 代理 → Spring Boot → MySQL
                                          ↘ 有界线程池 → 本地文件卷（uploads / results）
```

表结构见 `backend/src/main/resources/schema.sql`，种子数据见 `data.sql`：

| 表 | 用途 |
| --- | --- |
| `users` / `demo_accounts` | 两个演示用户；额度、FREE/PRO 方案 |
| `templates` | 12 个模板：标题、描述、分类、封面、所需图片数、允许类型、大小上限 |
| `assets` | 上传素材：归属用户、MIME、大小、本地存储路径 |
| `creation_tasks` | 任务：状态、当前阶段、失败阶段/原因、结果地址、模拟参数、时间戳 |
| `task_assets` | 任务与素材的关联（含顺序） |
| `task_events` | 阶段事件（开始/失败等），便于观察后台执行边界 |

- `schema.sql` 使用 `CREATE TABLE IF NOT EXISTS`，`data.sql` 使用 `INSERT IGNORE`，由 Spring Boot 启动时执行（`spring.sql.init.mode=always`）。这适合首次启动与重复演示，**不是数据库迁移系统**：已有表结构/种子行的变更不会自动迁移（本次 12 个模板与封面路径以新 id 追加；旧数据卷中若仍存 `/covers/*.svg`，前端会映射到同名 `.jpg`）。
- 提交事务中校验用户、模板、素材数量/归属/类型/大小与模拟参数，原子扣减 100 演示额度并写入 `QUEUED` 与任务素材关联，提交完成后派发线程池。队列满时用独立事务记录失败，不静默丢失。
- 执行线程依次持久化 `ASSET_CHECK`、`GENERATING`、`FINALIZING`：每次先条件更新 `RUNNING + current_stage` 并记事件，阶段间按 `stageDelayMs` 延迟；某阶段失败即写入 `FAILED + failed_stage + error_message` 并停止后续阶段。成功任务把第一张素材复制为本地结果文件并记录 `result_url`。
- 查询接口只读数据库，不会驱动任务推进；状态更新受 `WHERE status IN ('QUEUED','RUNNING')` 约束，完成后的任务不会因后续查询回到处理中。

## 参考截图对齐说明

参考图为题目提供的四张截图（UI-01 模板列表、UI-02 详情与上传、UI-03 制作中与历史、账户设置弹窗；题目附件，不随源码提交）。对齐工作包括：

- 对参考图做像素采样，提取色板与几何：页面 `#0a0a0c`、面板 `#111115`、浮层 `#1c1c22`、边框 `#1e1e22`、橄榄绿按钮 `#3e4c15`、头像绿 `#6b8800`、logo 黄绿 `#cfff01`；55px 顶栏、30px chips、6 列 9:16 卡片（gap 8、左右 14～16px）、详情页 7～8px 外间距 + 两栏面板（左栏约 426px / 右栏自适应，gap 7～8px）、历史卡片约 257×501、账户弹窗 560px 宽。
- 列表页：subnav chips（模板 / 历史记录）、分类文字 tabs、6 列竖版封面卡片；顶栏由站点壳层渲染，账户设置入口在右上角额度按钮。
- 详情页：**保留与首页一致的站点 header**（logo、语言、额度、退出登录），下方为整页两栏 studio 布局（高度扣掉 55px 顶栏；参考图详情页本身无顶栏，本次按需求与首页统一，其余两栏几何不变）；左栏“返回 + 标题 + 齿轮演示控制 + 示例封面 + Upload 标题（含所需数量与 JPEG/PNG/10MB 要求）+ 虚线上传位 + 底部橄榄绿 Create Now + 100”；右栏 History + 刷新。上传槽填充后提供三个明确操作：点击缩略图或“预览”按钮→站内弹窗预览；“替换图片”→重新选择文件；右上 ×→移除。
- 任务卡片：深色卡、居中状态/阶段/失败原因、成功显示结果图、查询异常黄条；点击成功结果图在**站内弹窗**预览（不跳新标签页）。左下操作与参考图一致：**刷新**（仅等待/处理中的卡片出现，用于立即同步该任务）与**删除**（所有卡片都有，二次确认调用 DELETE 清理记录；处理中删除等同取消，后台在下一阶段边界停止）。详情右栏显示当前模板最新 3 条任务，`/history` 页显示全部并补模板标题/创建时间/状态与分页。
- 账户设置：标题 + 圆形关闭按钮、头像/昵称/邮箱/密码卡片、四行带图标的入口（账户与额度、切换演示用户、服务条款、隐私政策）、底部退出登录说明；登录/计费/条款弹窗使用同一套弹窗样式。
- 参考图首页顶部的 `Video` / `workflow` / `Test Channel Classification` 是原产品的内容频道/测试频道入口，不属于题目功能要求；本项目按“文案可替换”将其映射为「模板 / 历史记录」两个可用入口（账户设置不单独占频道，点击右上角额度/方案按钮打开），并保持相同的 chip 版式。
- 为便于控制模拟执行，演示控制收进详情页齿轮按钮弹出面板（默认折叠），不占用正式页面主体。

### 交付截图（由 `docker compose` 生产构建实拍）

| 页面 | 截图 |
| --- | --- |
| 模板列表（中文，默认） | [01-template-list.jpg](docs/screenshots/01-template-list.jpg) |
| 模板列表（英文） | [02-template-list-en.jpg](docs/screenshots/02-template-list-en.jpg) |
| 模板详情（保留站点顶栏）+ 该模板的制作中/失败/成功记录 | [03-template-detail-history.jpg](docs/screenshots/03-template-detail-history.jpg) |
| 上传后：预览 / 替换图片 / 移除 三个操作 | [07-detail-upload-actions.jpg](docs/screenshots/07-detail-upload-actions.jpg) |
| 站内弹窗预览（不打开新页面） | [08-in-app-preview.jpg](docs/screenshots/08-in-app-preview.jpg) |
| 删除记录二次确认（左下删除操作） | [09-delete-record-confirm.jpg](docs/screenshots/09-delete-record-confirm.jpg) |
| 个人历史页（全部作品） | [04-history.jpg](docs/screenshots/04-history.jpg) |
| 账户设置弹窗 | [05-account-settings.jpg](docs/screenshots/05-account-settings.jpg) |
| 小屏列表（390×844） | [06-mobile-list.jpg](docs/screenshots/06-mobile-list.jpg) |

截图使用 Compose 构建产物（非 Next dev），在 1280×706 / 1280×650 / 390×844 视口下拍摄；历史数据由演示任务接口真实生成。封面缩略图见 [covers-contact-sheet.jpg](docs/covers-contact-sheet.jpg)。

## 启动

### Docker Compose（推荐）

需要 Docker Engine、Compose 以及可以拉取镜像/依赖的网络。在项目根目录：

```bash
cp .env.example .env      # 按需修改本地演示密码
docker compose up --build
```

- 前端 <http://localhost:3000>，Java <http://localhost:8080>。
- MySQL 使用命名卷 `mysql_data`，素材与结果使用命名卷 `media_data`；后端等待 MySQL 健康后启动，前端构建时注入容器内后端地址并通过同源 `/api` 代理。
- 首次启动由 Spring Boot 执行 `schema.sql` + `data.sql` 初始化 2 个演示用户、12 个模板与演示账户。
- 停止：`docker compose down`（保留数据卷）；**不要使用 `-v`**，除非明确要删除数据库和上传素材。
- 未使用自定义 Compose 文件名时无需额外参数；若使用其他文件名，等价命令为 `docker compose -f <file> up --build`。

### 本机开发

准备 Java 21、Node 22、MySQL 8；创建 `pixelforge` 数据库及 `pixel` 用户（密码与 `.env.example` 一致），或设置 `DB_URL`、`DB_USER`、`DB_PASSWORD`。

```bash
cd backend
./mvnw spring-boot:run
```

另开终端：

```bash
cd frontend
npm ci
npm run dev
```

`BACKEND_URL` 默认 `http://localhost:8080`；`STORAGE_PATH` 默认 `backend/storage`；`SIMULATION_ENABLED=false` 可关闭指定失败与自定义耗时（默认开启，便于演示）；线程池可用 `TASK_CORE_THREADS`、`TASK_MAX_THREADS`、`TASK_QUEUE_CAPACITY` 调整。

### 配置项

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `DB_URL` / `DB_USER` / `DB_PASSWORD` | `jdbc:mysql://localhost:3306/pixelforge...` / `pixel` / `pixel_dev` | 数据库连接，Compose 中由 `.env` 注入 |
| `STORAGE_PATH` | `./storage`（Compose 为 `/data`） | 上传素材与结果文件目录 |
| `SIMULATION_ENABLED` | `true` | 是否允许指定阶段失败/自定义耗时 |
| `TASK_CORE_THREADS` / `TASK_MAX_THREADS` / `TASK_QUEUE_CAPACITY` | `2` / `4` / `20` | 后台任务线程池 |
| `BACKEND_URL` | `http://localhost:8080` | Next.js `/api` 代理目标（Compose 为 `http://backend:8080`） |

`.env.example` 只含本地演示密码，不含任何真实凭据。

## API

响应成功格式 `{"data": ...}`，错误 `{"error":{"message":"...","code":400}}`。除公开模板与演示用户列表外，请求使用 `X-Demo-User-Id` 标识演示用户；文件预览 URL 中带 `userId`，服务端按数据库归属校验。

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| GET | `/api/templates?category=人像` | 模板列表（可省略分类） |
| GET | `/api/templates/1` | 模板详情 |
| GET | `/api/demo/users` | 演示用户列表 |
| GET | `/api/demo/account` | 当前演示用户额度与方案 |
| POST | `/api/demo/account/plan` | 切换 `FREE` / `PRO` 演示方案 |
| POST | `/api/demo/account/credits` | 增加 1000 演示额度（上限 100000） |
| POST | `/api/assets` | multipart 字段 `file` 上传图片，返回 `assetId`、`filename`、`mimeType`、`fileSize`、`previewUrl` |
| POST | `/api/tasks` | 创建任务，返回 `taskId`（HTTP 202） |
| GET | `/api/tasks/{id}` | 读取单个任务（仅当前用户） |
| GET | `/api/tasks?page=0&templateId=1` | 历史任务，每页 20 条，模板参数可省略 |
| DELETE | `/api/tasks/{id}` | 删除当前用户的任务记录（含事件/素材关联；结果文件清理失败时进程内重试；处理中任务删除后在下一阶段边界停止） |
| GET | `/api/media/assets/{id}?userId=1` | 素材预览 |
| GET | `/api/media/results/{filename}?userId=1` | 成功结果预览 |

创建任务请求示例（`assetIds` 来自上传响应；`failAt` ∈ `NONE`/`ASSET_CHECK`/`GENERATING`/`FINALIZING`，`stageDelayMs` 500～10000，默认 2000）：

```bash
curl -H 'X-Demo-User-Id: 1' -F 'file=@photo.jpg' http://localhost:8080/api/assets
curl -X POST http://localhost:8080/api/tasks \
  -H 'X-Demo-User-Id: 1' -H 'Content-Type: application/json' \
  -d '{"templateId":1,"assetIds":["替换为上传返回的 assetId"],"failAt":"NONE","stageDelayMs":2000}'
```

任务字段：`id`、`templateId`、`templateTitle`、`status`（`QUEUED`/`RUNNING`/`SUCCEEDED`/`FAILED`）、`currentStage`、`failedStage`、`errorMessage`、`resultUrl`、`createdAt`、`updatedAt`。阶段为 `ASSET_CHECK`、`GENERATING`、`FINALIZING`；失败时保存失败阶段与原因，成功时提供可预览结果地址。

## 演示流程

1. 打开首页：默认以演示用户 Alex Chen 登录（顶部显示方案、额度、退出登录）。点击顶部额度可打开“账户设置”弹窗；其中可查看模拟邮箱/密码、进入“账户与额度”、切换演示用户、查看服务条款/隐私政策、退出登录。
2. 在模板列表切换分类（人像 / 生活 / 自然 / 创意图片），点击卡片进入详情。
3. 按模板要求选择 1～3 张 JPEG/PNG（每张 ≤ 10 MB），观察上传中；上传完成后点击缩略图或“预览”按钮在站内弹窗查看大图，点“替换图片”重新选择，点右上 × 移除；服务端会再次校验数量、类型、大小与归属。
4. 点击“开始制作 ✦ 100”：按钮短暂显示提交中，受理后恢复可点击，左侧提示“任务已受理”，右侧历史面板出现**该模板的**创作任务并自动更新等待/处理中/阶段/成功/失败（每张卡片对应一次提交，不是上传的图片）。处理中的卡片左下会出现刷新按钮（立即同步状态），所有卡片左下都有删除按钮（二次确认后删除记录；处理中删除等同取消）。可继续提交多个任务。
5. 指定阶段失败：详情页右上齿轮 → 选择“素材检查失败 / 模拟生成失败 / 结果整理失败”，再次提交；任务在该阶段停止并显示可读原因，后续阶段不再执行。选回“正常完成”恢复成功模式。
6. 调整耗时：齿轮面板中把每阶段耗时改为 500～10000 ms，便于观察处理中状态与多任务排队/并行。
7. 刷新/关闭页面后重新打开 `/history`（或详情页右栏，侧栏只显示当前模板的任务）：从 Java 后端恢复任务记录并继续跟踪未完成任务；终态任务停止轮询。点击成功结果图在站内弹窗预览。右上角刷新按钮用于**立即从服务端重新同步历史列表与所有任务状态**（不必等待 2 秒轮询，也用于同步异常后的手动恢复）；它不会重跑已失败任务。
8. 查询异常与业务失败区分：可临时断开后端或修改接口（或浏览器 DevTools 离线）观察“状态同步失败，保留上次状态”黄条与“重新查询”，任务不会被标记为失败。
9. 用户隔离：账户设置 → 切换演示用户（或退出后登录另一个用户），历史/任务/素材按用户隔离，切换时会清理旧查询。

## 测试、构建与验证记录

```bash
# 前端
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build

# 后端
cd backend
./mvnw -B -ntp test
./mvnw -B -ntp package -DskipTests

# 容器
docker compose config --quiet
docker compose up --build -d
```

测试重点：

- 后端（JUnit + Mockito，13 个用例）：三阶段顺序与真实结果文件、指定阶段失败后不执行后续阶段、素材数量参数校验、跨用户查询不可见、删除任务时清理关联与结果文件、删除他人/不存在任务被拒绝；数据库异常后的失败状态重试、删除与生成竞态、文件清理重试及提交结果不确定时保留仍被引用的文件、派发拒绝后额度返还与数据库失败后的重试。
- 前端（Vitest + RTL，21 个用例）：演示身份/语言/账户弹窗、任务查询异常保留最后业务状态且不显示为失败、多个任务互不串扰、终态不被旧轮询数据回退、成功结果在站内弹窗预览（不跳新窗口）、删除记录调用 DELETE、处理中出现刷新而终态只保留删除、模板维度历史过滤、历史分页/空/错误状态；切换用户后迟到的账户响应、列表先成功后同步失败、中英文模板描述、受理成功后历史查询失败仍显示任务、演示用户列表重试。

**此前实际执行结果（2026-10-29，macOS 本机 / Docker 容器）**：

- 前端依赖：`npm ci` 与锁文件同步校验通过；`npx tsc --noEmit` 通过；`npm run lint` 通过（仅 4 条 warning，其中 `next/no-img-element` 用于本地封面/媒体地址）；`npm test` 15/15 通过；`npm run build` 通过（Turbopack，静态 3 页 + 动态详情页）。
- 后端 Maven 测试在 `maven:3.9.11-eclipse-temurin-21` 容器内执行（本机沙箱无法写 `~/.m2/wrapper`）：`Tests run: 6, Failures: 0, Errors: 0`，`BUILD SUCCESS`；`package -DskipTests` 通过。
- `docker compose config --quiet` 通过；`docker compose build` 成功构建前端（`npm ci` + `next build`）与后端（Maven package）镜像；`docker compose up -d` 以全新 MySQL 数据卷启动三个服务，健康后首页 200、模板接口返回 12 条。
- 真实接口冒烟：分类筛选返回 3 个人像模板；方案切换 `FREE→PRO` 与模拟增加 1000 额度生效；非法图片上传 400；素材数量不符创建任务 400；用户 2 读取用户 1 的任务 404；删除任务后单查 404；`/`、`/history`、`/templates/1`、`/templates/9999` 页面 200。
- 在真实 MySQL 中验证了上传素材、提交成功/失败/进行中任务、结果预览、额度扣减、阶段失败中断与两个用户隔离。
- 使用无头 Chrome + CDP 在生产构建上以 1280×706 / 1280×650 / 390×844 截图（见上方“交付截图”），与 UI-01/02/03 参考图做像素级比对（文案、圆角、间距、卡片比例、状态卡）；同时验证上传/预览/替换/移除、提交后右侧出现任务、指定阶段失败、刷新恢复、查询异常提示、中英文切换。
- 卡片操作实测：处理中卡片显示刷新+删除，终态卡片只显示删除；点击删除弹出二次确认，确认后卡片消失、`DELETE /api/tasks/{id}` 返回 200、任务单查 404、结果文件删除；详情页右上刷新会同时请求历史列表（`/api/tasks?page=...`）与当前显示任务（`/api/tasks/{id}`）的状态。
- 已知环境限制：本机沙箱无法写 `~/.m2/wrapper` 与 `~/Library/Caches`，因此后端测试在容器内执行、前端依赖使用工作区缓存安装；`docker compose build` 需以工作区内 `DOCKER_CONFIG` 规避 buildx 缓存目录写入限制。以上均为本机沙箱限制，不影响仓库内标准命令。
- 未执行 GitHub Actions 本身（本仓库无远端）；CI 配置内的命令已在本地按相同顺序验证。

**本次审查修复验证（2026-10-30，北京时间）**：

- Node 22.19.0：前端 19 个测试通过；lint、typecheck 通过（lint 有既有警告）。
- Java 21 Maven 容器：后端 12 个测试通过，其中覆盖数据库暂时不可用、失败写入重试、删除与结果生成竞态、文件删除失败重试及提交结果不确定。
- 使用独立 Compose 项目和新建数据卷，标准前后端 Dockerfile 构建成功，MySQL 8.4 健康启动；上传图片、成功及 GENERATING 失败任务、结果访问、跨用户 404 和历史再次查询通过。隔离浏览器刷新历史页面后，成功与失败记录仍可见。
- 本机沙箱内 `npm run build` 失败：Turbopack 创建进程并绑定端口时返回 `Operation not permitted (os error 1)`；同一源码使用 Node 22 的前端 Dockerfile 构建成功。
- 以下进程内重试只在当前进程持续运行期间提供尽力而为的处理；测试不证明崩溃后的恢复、持久化投递或多实例可靠性。

**独立验收后续修复验证（2026-10-30，北京时间）**：

- Node 22 容器：前端 lint、typecheck、21 个测试通过；lint 有 5 条 warning。
- Java 21 Maven 容器：后端 13 个测试与打包通过；失败状态与派发拒绝额度返还在同一事务执行，状态条件避免重复返还。
- 独立 Compose + MySQL：缺失身份头、畸形 JSON、缺失 multipart 均返回 400；26 个 10 秒任务中 4 个运行、20 个排队、2 个因队列满失败，演示额度从 5000 变为 2600。
- `npm ci` 原提示锁文件损坏，npm 详细日志指向没有版本的根级 `jiti` 条目；补充已有 2.7.0 版本和完整性信息后，干净 Linux/Node 22 容器中警告消失。未验证所有其他系统平台。
- 队列拒绝补偿在数据库暂时不可用时依赖进程内重试，进程退出会丢失待处理项；删除此类尚待补偿的任务会暂时返回冲突，不能保证崩溃后的自动返还。

## 技术选型与工程取舍

| 决策 | 最终方案与原因 | 未采用的替代方案、限制及改进 |
| --- | --- | --- |
| 任务调度 | 单体内有界 Spring 线程池，部署简单、满足演示并发；提交后派发，拒绝可见 | 消息队列能持久化投递并支持多实例，但引入额外服务和运维；线程池排队仅在进程内，故障会丢失未完成调度。需要可靠性时引入持久化队列、幂等和重试 |
| 状态同步 | TanStack Query 每任务约 2 秒轮询，仅活动任务继续查询；按 user + task id 隔离 | SSE/WebSocket 减少空轮询并降低延迟，但连接管理复杂；当前有延迟和额外请求，规模增大后可考虑 SSE |
| 文件存储 | 本地目录和 Docker 卷简单直接，真实可预览 | 对象存储支持共享、弹性和签名访问，但需外部服务；本地卷不适合多副本，缺少生命周期管理和备份 |
| 用户身份 | 两个数据库演示用户，前端传 ID、后端按 ID 过滤；首次访问自动登录用户 1，登出状态记忆 | 完整登录、Session/JWT 需要认证流程和安全管理；**登录只是浏览器选择用户、用户 ID 可伪造，退出只清除本地选择，隔离仅为功能演示，不构成安全认证** |
| 额度与订阅 | MySQL 保存 `FREE`/`PRO` 和额度，受理任务时同一事务扣 100，账户弹窗可模拟增加 1000 | 未接入真实支付、账单和计费；方案仅表示演示状态；线程池拒绝派发时在失败状态事务内返还额度（上限 100000），其他执行失败不自动退还 |
| 中英文切换 | 前端静态词典 + 预置模板文案翻译，浏览器保存语言偏好 | 未采用翻译服务或完整 i18n 平台；新增文案需同步补翻译，后端中文错误在英文模式使用通用提示 |
| 模板封面 | 6 张项目内 ImageGen 示例图 + 6 张 Unsplash/Picsum 图片，统一裁剪为 9:16 本地 JPEG | 未直接复用参考截图中的照片；线上不热链外部服务；来源与授权见 `docs/cover-sources.md` |
| 任务故障与重启恢复 | 执行或首读遇到数据库错误时，在当前进程内重试写入失败状态；结果清理失败也在进程内重试，不扫描或重新执行任务 | 持久化队列或租约扫描可支持崩溃恢复，但需协调多实例、幂等及文件一致性；内存待处理项随进程退出丢失，长期故障可能积压；重启后遗留任务需人工处置 |
| 生成器 | 本地复制素材模拟三个阶段，可确定性触发失败，不依赖密钥和外部服务 | 真实 AI API 需处理成本、限流、外部故障、隐私和模型差异 |

## 部署与回滚

演示部署可在隔离环境准备 `.env`，执行 `docker compose up --build -d`，再按上述演示流程验证。升级前备份 `mysql_data` 与 `media_data` 卷并记录镜像版本；回滚时恢复先前镜像及与之兼容的数据库/媒体备份。当前 SQL 初始化不是迁移系统，不能自动处理结构升级或回滚；未验证生产部署、多副本或公网访问。`SIMULATION_ENABLED` 默认 `true`，正式环境应关闭。

## 实际投入与 AI 开发工作流

开发过程见 [docs/development-log.md](docs/development-log.md)。人工投入无法由工具推断，以下各阶段及总计需由本人填写真实时长（不把命令执行耗时当作人工工时）：

根据本人提供的信息，项目约于 **2026-10-29 13:00（北京时间）**开始，截至 **2026-10-30 11:22** 约历时 **22 小时 20 分钟**。这是起止时间的跨度，可能包含休息和等待，不能作为实际工作小时数；各阶段与净投入总计仍待本人核实。

| 阶段 | 实际投入（小时） |
| --- | --- |
| 需求分析与环境检查 | 待人工填写 |
| 基础工程和后端 | 待人工填写 |
| 前端实现 | 待人工填写 |
| 参考图首轮对齐、演示账户/额度/订阅扩展 | 待人工填写 |
| 参考图二次对齐（像素级 UI 重构、素材替换、异步状态复核） | 待人工填写 |
| 测试、修复及验证 | 待人工填写 |
| 本次 Code Review 问题修复及验证 | 待人工填写 |
| 独立验收问题后续修复 | 待人工填写 |
| 交付文档 | 待人工填写 |
| 总计 | 待人工填写 |

AI 使用说明（如实说明）：

- 第一版使用 Codex 辅助开发，并用 ImageGen 生成 6 张本地示例封面。
- 第二轮 UI 对齐使用 DeepSeek Harness 的 Agent Team：先由主线程读取题目截图，用 Python/Pillow 对参考图做像素采样，量出颜色、面板边界、卡片比例、字号与间距，写成共享设计规格；再拆成“素材准备、列表页、详情页、任务卡片/历史页”四个互不重叠的写作用域任务并行实现；主线程负责壳层/账户弹窗、i18n、集成与最终验收，用无头 Chrome + CDP 截图脚本逐页与参考图比对并修正 ±3～6px 偏差。
- 具体例子：参考图第一次被误判为卡片 8:15，实现后用像素扫描发现第一行卡片 163..521、第二行从 528 开始，实际比例应为 9:16；据此改回 9:16 并重新截图复核，逐列 gap 与卡片左缘均在 ±1px 内。
- 本次审查修复使用 Codex：先检查源码及报告中的竞态路径；用延迟账户响应和列表刷新失败重现前端问题，再修改并运行回归测试。后端以模拟数据库异常、状态更新未生效与文件删除失败验证边界。
- 本次独立验收后续修复使用 Codex：复现受理后历史刷新失败、用户列表加载失败及队列拒绝；增加任务入口、重试与事务内返还，并在隔离 MySQL 验证。
- 验证方式：TypeScript/ESLint、Vitest、JUnit/Maven、`next build`、Docker Compose 启动后的真实接口联调与浏览器截图；未发生的验证不写入结果。

## 已知限制与素材来源

- **未实现服务重启后的自动恢复**：重启时仍为 `QUEUED`/`RUNNING` 的任务可能一直停留在处理中，需要人工识别与处置；没有持久化重试、任务租约或启动清理。进程存活期间会重试记录已捕获的任务失败及清理待处理结果文件，但不会重新执行任务；进程退出后待重试项会丢失。
- 身份为演示方案：`X-Demo-User-Id` 可伪造，媒体接口按演示用户 ID 校验归属，仅适用于可信环境；额度/方案为演示数据，不涉及支付。
- 制作结果为第一张上传素材的本地副本，不具备真实 AI 生成效果；演示控制默认开启，生产应设置 `SIMULATION_ENABLED=false`。
- 上传/结果文件存本地卷，无完整生命周期管理；结果清理依赖数据库可用和文件可删除，长期失败或进程退出可能遗留文件，需要人工检查；不支持多实例横向扩展。
- 数据库初始化不是迁移系统；种子使用 `INSERT IGNORE`，旧数据卷中的既有行不会自动更新（前端对旧 `/covers/*.svg` 封面地址做了兼容映射）。
- 未提供端到端浏览器测试（仅单元/组件测试与人工截图验收），未统计覆盖率；GitHub Actions 未在远端真实运行。
- 未接入真实 AI、支付、第三方账号、国际化平台、消息队列或多区域部署。
- 素材来源：6 张项目内 ImageGen 示例图；6 张来自 [Lorem Picsum](https://picsum.photos)（图片源自 Unsplash，遵循 [Unsplash License](https://unsplash.com/license)），摄影师与原始链接见 [docs/cover-sources.md](docs/cover-sources.md)，全部已下载并本地压缩，未使用外部热链。开源依赖各自遵循其许可证；Maven Wrapper 脚本遵循 Apache License 2.0。

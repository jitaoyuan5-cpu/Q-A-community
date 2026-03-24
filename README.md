# 问答社区（P3）

前端：React 18 + React Router 7 + Vite + Tailwind 4  
后端：Node.js + Express + MySQL

## 本地开发

### 1) 前端
- 安装：`npm install`
- 启动：`npm run dev`
- 说明：仓库路径包含 `&` 时，前端脚本已改为显式 `node ./node_modules/...`，无需再手动绕过 `vite` 裸命令问题

### 2) 后端
- 安装：`npm run server:install`
- 配置：复制 `server/.env.example` 为 `server/.env`
- 迁移：`npm run server:migrate`
- 种子数据（仅本地）：`npm run server:seed`
- 启动：`npm run server:dev`
- 说明：`npm run server:dev` 现在会先检查 `4000` 端口；如果已有旧的 `node` 进程占用，会直接失败并提示你先停止旧实例，避免继续测到过期后端的 `404`
- 说明：后端启动时会自动补跑未执行的数据库迁移，避免因为 schema 落后导致登录或资料接口报列不存在
- 说明：开发环境默认同时接受 `http://localhost:5173` 和 `http://127.0.0.1:5173`，避免 Vite 切到 `127.0.0.1` 后登录请求被 CORS 拦截
- 可选 AI 配置：
  - `AI_PROVIDER=local|openai|openrouter|deepseek|moonshot|siliconflow|compatible`
  - `AI_API_KEY=...`
  - `AI_BASE_URL=...`：仅在你想覆盖预设地址，或使用 `compatible` 时必填
  - `AI_MODEL=...`：可覆盖默认模型
  - `AI_TIMEOUT_MS=12000`
  - 常见示例：
    - OpenAI：`AI_PROVIDER=openai`
    - OpenRouter：`AI_PROVIDER=openrouter`
    - DeepSeek：`AI_PROVIDER=deepseek`
    - Moonshot：`AI_PROVIDER=moonshot`
    - SiliconFlow：`AI_PROVIDER=siliconflow`
    - 自定义兼容网关：`AI_PROVIDER=compatible` 且填写 `AI_BASE_URL`
- 可选开放平台限流配置：
  - `PUBLIC_API_RATE_LIMIT=120`

### 3) 前端环境变量
- 复制 `.env.example` 为 `.env`
- 设置 `VITE_API_BASE_URL`（默认 `http://localhost:4000/api`）

## 测试与一键验收
- 前端测试：`npm test`
- 后端集成测试：`npm run test:backend`
- 后端真实数据库 E2E：`npm run test:backend:e2e`
- 一键验收（前端 typecheck + 测试 + build + 后端集成测试 + 后端真实数据库 E2E）：`npm run acceptance`

## P1 已落地能力
- 注册/登录/刷新/登出（JWT + Refresh Token）
- 路由守卫与接口鉴权
- 统一搜索（问题/文章/用户）
- 实时搜索建议 + 搜索历史
- 评论系统（问题评论、回答评论、二级回复）
- 关注问题动态（新回答标记、已读）
- 用户主页与资料编辑
- MySQL 迁移与 seed 脚本

## P2 已落地能力
- Markdown 编辑器与预览
- Markdown 代码块高亮渲染
- 图片上传（本地文件存储）
- 站内通知与未读状态
- 邮件提醒偏好设置（开发环境默认日志发送）
- 问题/文章分享
- 问题/文章收藏
- 举报与管理员审核台

## P3 已落地能力
- AI 问答助手：`/assistant`
- 问题页即时讨论：问题详情页内聊天区 + WebSocket 广播
- 视频教程：`/tutorials`、`/tutorials/:id`
- 在线编程环境：`/playground`
- 多语言：`zh-CN / en-US`
- PWA：manifest、service worker、安装提示、离线壳
- 开放平台：开发者入口、API Key、自助吊销、只读公共 API
- 教程后台：`/admin/tutorials`

## P3 关键入口
- AI 助手：`/assistant`
- 教程列表：`/tutorials`
- Playground：`/playground`
- 开发者平台：`/developers`
- API Keys：`/developers/keys`
- OpenAPI 文档页：`/developers/docs`
- 只读公共 API：`/api/public/v1/*`

## PWA 说明
- PWA 当前只缓存应用壳和静态资源，不缓存 `/api/*` 响应，避免把用户态接口结果离线回放给其他登录会话

## 关键目录
- `src/` 前端
- `server/src/` 后端 API
- `server/migrations/` 数据库迁移
- `server/scripts/` migrate/seed 脚本
- `RELEASE.md` 发布、回滚、监控说明

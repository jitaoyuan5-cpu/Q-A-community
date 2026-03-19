# 问答社区（P1）

前端：React 18 + React Router 7 + Vite + Tailwind 4  
后端：Node.js + Express + MySQL

## 本地开发

### 1) 前端
- 安装：`npm install`
- 启动：`npm run dev`

### 2) 后端
- 安装：`npm run server:install`
- 配置：复制 `server/.env.example` 为 `server/.env`
- 迁移：`npm run server:migrate`
- 种子数据（仅本地）：`npm run server:seed`
- 启动：`npm run server:dev`

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

## 关键目录
- `src/` 前端
- `server/src/` 后端 API
- `server/migrations/` 数据库迁移
- `server/scripts/` migrate/seed 脚本
- `RELEASE.md` 发布、回滚、监控说明

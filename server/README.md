# P3 Server

## Run
1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Run migrations: `npm run migrate`
4. Seed sample data: `npm run seed`
5. Start API: `npm run dev`
6. When starting from the repo root with `npm run server:dev`, the wrapper script now checks whether port `4000` is already occupied and fails fast instead of silently leaving you on a stale backend
7. API startup now auto-applies any pending SQL migrations before listening, so an outdated local schema does not break auth or profile queries
8. `CORS_ORIGIN` supports comma-separated values and automatically expands `localhost` / `127.0.0.1` loopback pairs for local Vite development

## Test
- Integration tests with mocked DB layer: `npm run test`
- Real MySQL E2E: `npm run test:e2e`
- `E2E_DB_NAME` defaults to `qa_community_e2e` and is recreated via migrations/seed before tests

## Main APIs
- Auth: `/api/auth/*`
- Questions/Answers: `/api/questions`, `/api/answers`
- Comments: `/api/comments`
- Follows: `/api/follows`
- Search: `/api/search`, `/api/search/suggest`, `/api/search/history`
- Users/Profile: `/api/users/:id`, `/api/users/me`
- Meta: `/api/meta/topics`, `/api/meta/jobs`, `/api/meta/articles`, `/api/meta/tags`
- Uploads: `/api/uploads`
- Favorites: `/api/favorites`
- Notifications: `/api/notifications`
- Reports/Admin: `/api/reports`, `/api/admin/reports`
- AI Assistant: `/api/assistant/*`
- Question Chats: `/api/question-chats/:questionId/messages`, WebSocket `/ws/questions/:id/chat`
- Tutorials: `/api/tutorials`, `/api/admin/tutorials`
- Playground: `/api/playground/templates`, `/api/playground/shares`
- Developer Platform: `/api/developer/keys`, `/api/public/v1/*`

## P3 Notes
- Assistant defaults to local retrieval + local summarization.
- To enable a real model backend, set:
  - `AI_PROVIDER=openai|openrouter|deepseek|moonshot|siliconflow|compatible`
  - `AI_API_KEY=...`
  - `AI_MODEL=...` when you want to override the preset model
  - `AI_BASE_URL=...` when you want to override the preset endpoint, or when `AI_PROVIDER=compatible`
- When `AI_PROVIDER` is any non-`local` remote provider, requests use `AI_TIMEOUT_MS` and explicitly degrade to the local retrieval summary if the upstream model is unavailable.
- All non-`local` providers are treated as OpenAI-compatible `/chat/completions` backends.
- Public API uses `x-api-key` and is read-only. Keys are shown once, stored as hashes, and can be revoked by the user.
- Tutorial videos are embedded from a provider allowlist (`YouTube / Bilibili / Vimeo`); the server does not host video files.
- PWA assets are served from the frontend app. The backend only exposes the APIs used by assistant, tutorials, developer keys, and realtime discussion.

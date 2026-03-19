# P1 Server

## Run
1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Run migrations: `npm run migrate`
4. Seed sample data: `npm run seed`
5. Start API: `npm run dev`

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

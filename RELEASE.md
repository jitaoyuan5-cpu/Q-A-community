# Deployment & Rollback (P1)

## Env
Frontend:
- `VITE_API_BASE_URL`

Backend:
- `PORT`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `REFRESH_SECRET`
- `REFRESH_EXPIRES_IN`
- `CORS_ORIGIN`

## Release Order
1. Deploy backend new version.
2. Run DB migration (`npm run migrate` in `server`).
3. Seed only in non-prod.
4. Deploy frontend.

## Rollback
1. Roll back frontend to previous artifact if API contract mismatch.
2. Roll back backend image/version.
3. Keep DB schema forward-only; disable new write paths with feature flag if needed.

## Monitoring
- API 5xx rate
- API p95 latency
- Auth refresh failure rate
- DB slow query count
- Frontend search failure rate
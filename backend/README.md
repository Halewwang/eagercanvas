# Eager Canvas Backend

Express API for auth, projects, runs, and usage metrics.

## Endpoints
- `POST /api/v1/auth/send-code`
- `POST /api/v1/auth/verify-code`
- `POST /api/v1/auth/register/send-code`
- `POST /api/v1/auth/register/verify-code`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET|POST|PATCH|DELETE /api/v1/projects`
- `POST /api/v1/runs`
- `GET /api/v1/runs/:id`
- `GET /api/v1/usage/summary`
- `GET /api/v1/usage/timeseries`

Compatibility endpoints used by current frontend workflow:
- `POST /api/v1/chat/completions`
- `POST /api/v1/images/generations`
- `POST /api/v1/videos`
- `GET /api/v1/videos/:taskId`

## Setup
1. Copy `.env.example` to `.env` and fill values.
2. Run SQL files in order on your Supabase Postgres:
   - `../supabase/001_init.sql`
   - `../supabase/002_auth_registration.sql`
3. Start server:

```bash
npm install
npm run dev
```

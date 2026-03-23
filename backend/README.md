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

## Queue And Worker

The backend now supports three run execution modes:

- `RUN_QUEUE_MODE=inline`
  Default. The API process handles runs directly. Chat stays synchronous. Image/video runs may still be detached inside the API process.
- `RUN_QUEUE_MODE=redis`
  The API process uses Redis-backed shared slots to cap concurrent run execution across instances.
- `RUN_QUEUE_MODE=worker`
  The API process only creates queued runs for image/video tasks. A separate worker process polls queued runs and executes them.

Recommended production setup:

```bash
REDIS_URL=redis://your-redis-host:6379
CACHE_BACKEND=redis
RATE_LIMIT_STORE=redis
RUN_QUEUE_MODE=worker
RUN_QUEUE_CONCURRENCY=4
RUN_WORKER_POLL_MS=2000
RUN_WORKER_BATCH_SIZE=2
```

Start API:

```bash
npm start
```

Start worker:

```bash
npm run worker
```

Notes:

- Chat completions remain synchronous to preserve current frontend behavior.
- Image generation is now compatibly async: the frontend request layer transparently polls `/api/v1/runs/:id`.
- Video generation is queued and can run in the detached worker mode without changing current frontend polling behavior.

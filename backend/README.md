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

Text uses `gpt-5.6-sol` at `https://api.enbrand.co/v1/responses` with `store:false`.
Set `OPENAI_API_KEY` for text in the ignored backend local env; `OPENAI_API_BASE_URL` defaults to `https://api.enbrand.co/v1`.
Images use APIMart `gpt-image-2`. Set the separate server-only `APIMART_API_KEY`; `APIMART_API_BASE_URL` defaults to `https://api.apimart.ai/v1`. Both text-to-image and reference-image requests use JSON `POST /v1/images/generations` with `model`, `prompt`, numeric `n:1`, aspect-ratio `size`, and `resolution` (`1k`/`2k`/`4k`). References use `image_urls` with at most 15 public URLs or image data URIs. Unsupported quality, background, output-format, and old provider fields are not forwarded.
APIMart returns an upstream task ID. The local run stores it durably; owner-authorized `GET /api/v1/images/:taskId` checks `GET /v1/tasks/:upstreamTaskId`, persists completed images, and updates the run. Refreshes and polling never resubmit a paid generation request. The capsule selects the next generation's ratio and resolution; downloads preserve the original result. Only Tools → Crop performs an explicit local edit.
Video requests use the shared server `PROVIDER_API_KEY`. Text uses `OPENAI_API_KEY`; images use `APIMART_API_KEY`. An administrator enables service access once per user; no user key creation, assignment, or binding is required. Disabled services and suspended/deleted accounts cannot generate or poll model tasks.

The `/admin` Dashboard manages users, roles, service access, and account lifecycle. Provider key management, balance/reconciliation screens, and the issue inbox have been removed. Historical database migrations remain for existing installations; no existing data is dropped.

## Setup
1. Copy `.env.example` to `.env.local` or `.env` and fill values. Keep real env files local only. The backend loads `.env.local` before `.env`, while shell/Vercel-provided environment variables keep highest priority.
2. Run SQL files in order on your Supabase Postgres:
   - `../supabase/001_init.sql`
   - `../supabase/002_auth_registration.sql`
3. Start server:

```bash
npm install
npm run dev
```

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
Images use only `gpt-image-2` at `/v1/images/generations` or multipart `/v1/images/edits`.
Set `OPENAI_API_KEY` in the ignored backend local env; `OPENAI_API_BASE_URL` defaults to `https://api.enbrand.co/v1`.
Image size, aspect ratio, resolution, JPEG/WebP selection, and compression controls are disabled after live gateway checks showed they were ignored. Legacy client fields are filtered, and image requests use one PNG output. Inline response MIME types are identified from the actual PNG/JPEG/WebP signature rather than the requested format. Quality and moderation overrides are also disabled: quality was ignored in repeated live checks, and moderation relies on the gateway default. Background is the only image option: `auto` (default) or `opaque`. The outbound body contains only `model`, `prompt`, `background`, fixed `output_format:"png"`, and fixed `n:1`; edits additionally send reference images.
Video requests use the shared server `PROVIDER_API_KEY`. Text and image requests use the shared `OPENAI_API_KEY`. An administrator enables service access once per user; no user key creation, assignment, or binding is required. Disabled services and suspended/deleted accounts cannot generate or poll model tasks.

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

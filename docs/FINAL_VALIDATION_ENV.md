# Final Validation Environment Handoff

This project needs real local environment files before final auth, Supabase, Resend, provider workflow, cloud persistence, and usage-ledger validation can run. Do not paste secrets into chat, issue comments, screenshots, or committed files.

Supabase connector evidence is recorded in `docs/SUPABASE_VALIDATION_EVIDENCE.md`. The connector can supply project metadata and the project API URL, but it does not replace local handling for service-role, JWT, Resend, and provider secrets.

Vercel can also be used as a secure handoff source if the Eager Canvas frontend/backend projects already have Environment Variables configured there. Sensitive Vercel variables should be pulled into ignored local env files, not pasted into chat.

## Files To Create Locally

Create these files on the validation machine:

```bash
/Users/hale/Documents/Eager DEV/Eager Canvas/repo/.env.local
/Users/hale/Documents/Eager DEV/Eager Canvas/repo/backend/.env.local
```

The repository ignores `.env`, `.env.*`, `backend/.env`, and `backend/.env.*`, while keeping `.env.example` and `backend/.env.example` tracked.

Backend env loading order is shell/Vercel environment first, then `backend/.env.local`, then `backend/.env`. This keeps Vercel runtime variables authoritative while still allowing local validation files.

## Frontend Values

Use `.env.example` as the shape:

```env
VITE_APP_API_BASE_URL=http://127.0.0.1:8787/api/v1
VITE_BYPASS_AUTH=false
```

`VITE_BYPASS_AUTH=false` is required for final validation. Local preview mode is useful for UI smoke tests, but it does not prove the real auth path.

## Backend Values

Use `backend/.env.example` as the shape and provide real values for:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
PROVIDER_API_BASE_URL=
PROVIDER_API_KEY=
DASHBOARD_302_API_BASE_URL=
DASHBOARD_302_API_KEY=
```

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be non-placeholder random strings with at least 24 characters. `PROVIDER_API_KEY` and `DASHBOARD_302_API_KEY` are both required because final validation covers provider generation and official 302 usage reconciliation.

Current Supabase candidate from connector evidence:

```env
SUPABASE_URL=https://rzfsyezidhgyikehucrh.supabase.co
```

Do not paste `SUPABASE_SERVICE_ROLE_KEY` into chat. Copy it from Supabase Dashboard into `backend/.env.local` on this machine.

## Optional Vercel Handoff

Current repo state: no `.vercel/project.json` is present, so this checkout is not linked to a Vercel project yet. The backend Vercel project name provided for validation is `eagercanvas-api`; link that project before pulling backend env values.

Recommended secure flow:

```bash
vercel link
vercel env pull .env.local --environment=development --yes
```

For the backend package, run the equivalent command from the backend directory if it is deployed as a separate Vercel project:

```bash
cd backend
vercel link --project eagercanvas-api
vercel env pull .env.local --environment=development --yes
```

If the frontend is a separate Vercel project, link and pull the frontend project from the repository root before starting the Vite app.

Use Vercel Dashboard or `vercel env add <NAME> <environment> --sensitive` for high-value keys. Avoid `echo "secret" | vercel env add ...` for secrets because the value may enter shell history.

If Vercel has production-only secrets, pull production into a temporary ignored file for validation and then map the required values into the normal local files:

```bash
vercel env pull .env.production.local --environment=production --yes
```

Do not commit any pulled env file.

## Readiness Check

To create ignored local skeleton files with known non-secret defaults and placeholder secrets, run:

```bash
npm run prepare:validation-env
```

This writes `.env.local` and `backend/.env.local` only when they do not already exist. Use `npm run prepare:validation-env -- --force` only when you intentionally want to replace those local files.

JWT secrets do not need an external provider. To generate strong local JWT secrets without printing them, run:

```bash
npm run generate:validation-jwt-secrets
```

After creating the files, run:

```bash
npm run check:validation-readiness
```

The command prints only pass/fail and missing-key reasons. It does not print secret values and it intentionally ignores `.env.example` files.

Current local skeleton status after `npm run prepare:validation-env` and `npm run generate:validation-jwt-secrets`: `7/10 ready`. The remaining failures are expected until real local secrets replace the placeholders for `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `PROVIDER_API_KEY`, and `DASHBOARD_302_API_KEY`.

To print the final validation runbook for the current readiness state, run:

```bash
npm run show:final-validation-runbook
```

The runbook lists readiness blockers, commands, and required evidence without printing env values.

## Final Validation Scope After Readiness Passes

Once readiness is `10/10 ready`, run the full local validation:

1. Start backend with the real backend env.
2. Start frontend with the real frontend env.
3. Verify login or registration code delivery through Resend.
4. Create a cloud project and reload it from Supabase-backed persistence.
5. Add Text, Image, Video, and config nodes, then connect the workflow.
6. Run a real provider workflow and confirm result status transitions.
7. Confirm usage event storage and 302 dashboard reconciliation data.
8. Re-run the manual regression checklist in `docs/OPTIMIZATION_PRD.md`.
9. Re-run `npm run check`, `npm run build`, and `git diff --check`.

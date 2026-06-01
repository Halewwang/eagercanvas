# Supabase Validation Evidence

Date: 2026-06-01

This file records non-secret Supabase evidence gathered through the Supabase connector for final validation planning. It intentionally does not include service-role keys, provider keys, Resend keys, JWT secrets, or publishable key values.

## Candidate Projects

| Project | Ref | Status | Region | API URL | Current Use |
|---------|-----|--------|--------|---------|-------------|
| EagerFlow | `bllsjeojnwerguvbdqbi` | `INACTIVE` | `ap-southeast-1` | `https://bllsjeojnwerguvbdqbi.supabase.co` | Not suitable for immediate final validation while inactive |
| Ling's Visuals Canvas | `rzfsyezidhgyikehucrh` | `ACTIVE_HEALTHY` | `ap-south-1` | `https://rzfsyezidhgyikehucrh.supabase.co` | Best current candidate for final validation |

## Active Project Public Schema Snapshot

Project ref: `rzfsyezidhgyikehucrh`

All listed tables have RLS enabled.

| Table | Rows |
|-------|------|
| `public.projects` | 94 |
| `public.workflow_runs` | 1092 |
| `public.usage_events` | 735 |
| `public.audit_logs` | 1196 |
| `public.auth_codes` | 2 |
| `public.sessions` | 2 |
| `public.usage_daily_agg` | 1 |
| `public.provider_billing_records` | 0 |
| `public.user_service_credentials` | 0 |
| `public.workspaces` | 0 |
| `public.workspace_members` | 0 |
| `public.shared_project_templates` | 0 |
| `public.users` | 0 |
| `public.user_profiles` | 0 |
| `public.roles` | 0 |
| `public.permissions` | 0 |
| `public.user_roles` | 0 |
| `public.role_permissions` | 0 |
| `public.admin_operation_logs` | 0 |
| `public.user_api_key_assignments` | 0 |

## Connector Findings

- Project URL can be supplied from the connector as `SUPABASE_URL`.
- Publishable and legacy anon keys exist and are enabled, but their values should not be pasted into docs or chat. This app currently uses the backend service-role path, so these keys are not enough for final backend validation.
- Connector migrations list is empty for the active project. Local SQL migrations remain the authoritative repo-side schema history under `supabase/`.
- Security advisor returned no lints for the active project.
- Performance advisor returned informational unused-index notices. These are not blockers for final validation and should not be removed without query evidence, because several indexed tables currently have low or zero row counts.

## Remaining Secret Inputs

The Supabase connector does not replace these local inputs:

- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `RESEND_API_KEY`
- `PROVIDER_API_KEY`
- `DASHBOARD_302_API_KEY`

Create them only in local ignored env files, then run:

```bash
npm run check:validation-readiness
```

# Admin Task Surface Visual Consolidation

**Date:** 2026-07-12
**Status:** Approved direction (方案 A)
**Scope:** `/admin/users`, `/admin/credentials`, `/admin/usage`

## Objective

Bring newly added admin task surfaces back into the existing neutral dark visual system, reduce wasted horizontal space, and make high-risk actions easier to scan without changing RBAC, mutation, billing, or provider contracts.

## User Management

### Action column

- Reduce the action column to a compact fixed width of approximately 56 pixels.
- Replace the full-width “操作” trigger with a square ellipsis icon button that has an accessible label.
- Keep the menu anchored to the row and within the viewport.
- Use the existing neutral glass palette, border, radius, shadow, focus ring, and typography tokens. No blue or saturated panel background.

### Action menu

- Group entries under three visible sections:
  1. **详情与角色** — 查看详情、管理角色。
  2. **服务凭证** — 开通/绑定/停用/重置服务凭证、调整额度。
  3. **账户状态** — 暂停、恢复、归档或恢复归档。
- Every action row includes a semantic icon and a text label.
- Move full multi-role editing out of the table menu. “管理角色” opens the existing user detail role tab, where the complete role array is edited and saved.
- Preserve current permission checks, self-protection, last-super-admin protection, desktop-only mutation guards, loading states, and structured confirmation dialogs.

### Filters and table width

- The desktop filter row must fill the same 12-column width as the metrics and table.
- Desktop allocation: search `4/12`; service, role, reconciliation, and status filters `2/12` each.
- The result summary occupies a separate full-width row so it does not leave a one-column gap.
- Tablet uses the existing 8-column grid; mobile stacks to 4 columns without horizontal overflow.

## Credentials

- Replace the green “创建凭证” button with the shared neutral `AdminMicroButton` using the add icon.
- Keep the disabled/loading behavior and validation unchanged.
- Do not introduce a one-off color token or a provider-branded accent.

## Usage

- Keep the request-ID detail and provider-log query in one aligned responsive grid.
- Desktop allocation: request detail `5/12`, provider logs `7/12`.
- Each panel must receive a usable minimum width; it must never collapse into character-by-character wrapping.
- Tablet and mobile stack the panels vertically.
- Preserve request-ID lookup, provider record filters, pagination, official-versus-local evidence separation, and failure/unmatched states.

## Icons and accessibility

- Reuse existing Coolicons and `AdminMicroButton` icon behavior.
- Required concepts: more, detail, roles/settings, activate/play, bind/key, pause, refresh/reset, limits/settings, archive/trash, restore/play, add.
- Icon-only triggers require an accessible name and visible focus state.
- Destructive actions remain visually differentiated through the existing subdued danger treatment rather than saturated color blocks.

## Responsive and visual acceptance

- Desktop: 1354–1440 px; no clipped filters, oversized action column, or menu overflow.
- Tablet: 1024 px; filters and task panels remain aligned and readable.
- Mobile: 390 px; sections stack, menus stay in viewport, and no horizontal overflow appears.
- The menu, create button, and usage panels must visually match the existing admin surfaces.

## Testing

- TDD contract tests for action-column width, ellipsis trigger, menu groups, icons, role-detail routing, full-width filters, neutral credential button, and usage 5/7 layout.
- Component compile/SSR tests where practical; avoid relying only on broad source regex assertions.
- Focused frontend tests, `npm run check`, `npm run build`, and `git diff --check`.
- Browser verification at desktop and mobile, including opening the action menu and checking the resulting state.

## Non-goals

- No RBAC or backend contract changes.
- No new mutation endpoints.
- No redesign of the user detail information architecture beyond using its existing role tab.
- No replacement of internal technical identifiers.

# UI Rules

This repository is migrating the product UI toward a React + HeroUI v3 frontend.

The current production frontend remains Vue 3 under `src/`. New React migration work lives under `apps/web-react/` until enough surface area has moved to replace the Vue app.

## React Migration Target

- Framework: `React 19`
- Build: `Vite`
- UI system: `HeroUI v3`
- Styling: HeroUI component styles, HeroUI semantic tokens, and Tailwind CSS v4 only for outer page layout
- Component imports: all HeroUI components must be imported from `@heroui/react`

## Non-Negotiable Rules

- Do not create a parallel local UI component library such as `BaseButton`, `BaseModal`, or `BaseInput` in React migration code.
- Do not introduce or mix Ant Design, MUI, shadcn/ui, Radix-styled wrappers, or another third-party styled component system.
- Do not add new `naive-ui` usage. Existing Vue usage may remain only until the corresponding surface is migrated.
- Use HeroUI component props, variants, size props, and typography components as the source of component styling.
- Prefer HeroUI semantic tokens such as `background`, `foreground`, `surface`, `overlay`, `muted`, `default`, `accent`, `danger`, `success`, and `warning` before hardcoded colors.
- Use Tailwind v4 utility classes only for outer page layout, responsive placement, and non-component composition.
- Do not use Tailwind utilities to redefine component typography, component spacing, component dimensions, borders, radius, shadows, or colors when a HeroUI component style already exists.
- Do not create custom CSS overrides to restyle HeroUI defaults unless the surface cannot be represented by HeroUI components.
- Every migrated React page must render in dark mode only, with component consistency, spacing consistency, and complete hover/focus/disabled/loading states.

## Component Hierarchy Rules

- Dialogs must use HeroUI structural regions instead of ad hoc layout wrappers: `Modal.Header` for title and description, `Modal.Body` for fields and content, and `Modal.Footer` or `Fieldset.Actions` for actions.
- Dialog titles for compact authentication flows use `Typography.Heading level={3}` unless the product spec explicitly calls for another level.
- Dialog title blocks are left-aligned by default. Use HeroUI `align` props when alignment must change.
- Form fields and actions must be separated through HeroUI form structure such as `Fieldset.Group` and `Fieldset.Actions`; do not add one-off margins to individual controls.
- Do not place dialog title/description inside `Fieldset.Legend` unless the title is the actual legend for the field group.

## Allowed Patterns

- Direct imports from `@heroui/react`, for example `Button`, `Input`, `Modal`, `Tabs`, `Dropdown`, `Spinner`, and `Card`.
- Tailwind v4 utilities for page-level layout, grid/flex composition, width constraints, and responsive placement outside HeroUI components.
- Small custom CSS for app shell, canvas layers, or integration surfaces that HeroUI cannot express.
- Feature-specific React hooks and framework-neutral service modules for business behavior.

## Disallowed Patterns

- React migration components importing from `src/components/ui/*`.
- Reimplementing modal, dropdown, tabs, input, button, select, spinner, or card behavior by hand.
- Hardcoded color palettes when HeroUI semantic tokens or Tailwind theme utilities can express the state.
- Component-level Tailwind classes such as custom font sizes, custom gaps, custom control heights, custom radii, custom borders, custom shadows, or custom colors on HeroUI components.
- CSS files that broadly override HeroUI internals to make HeroUI behave like a different design system.
- Adding visible UI states without hover, focus-visible, disabled, loading, and error behavior.

## Migration Order

1. Create the React + HeroUI v3 migration shell in `apps/web-react/`.
2. Migrate the login/register dialog first.
3. Migrate low-coupling pages: home account entry, workspace shell, usage/admin forms.
4. Extract framework-neutral API and auth services that can be shared by React surfaces.
5. Migrate Canvas only after React Flow parity is proven with existing canvas JSON.
6. Remove Vue/Naive UI dependencies only after the production entry point has moved.

## Review Checklist

Before merging React UI migration work, check:

- Are all UI components imported from `@heroui/react`?
- Did the change avoid new local UI primitives and banned UI libraries?
- Are component styles expressed through HeroUI props, variants, sizes, typography components, and semantic tokens?
- Does the component keep HeroUI hierarchy: dialog header/body/actions, h3 compact dialog title, left-aligned title block, and Fieldset group/action separation?
- Are Tailwind utilities limited to outer layout instead of component styling?
- Are interaction states complete for hover, focus, disabled, loading, validation, and error?
- Does the page render correctly in dark mode, without light-mode-only overrides?
- Does the migrated surface preserve the original behavior and route/API contract?

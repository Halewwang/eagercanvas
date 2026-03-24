# UI Rules

This project uses a single UI system:

- Framework: `Vue 3`
- Styling: `Tailwind CSS`
- UI entrypoints: `src/components/ui/*`
- Visual direction: HeroUI-inspired, but implemented locally for Vue

## Non-Negotiable Rules

- Do not add new `naive-ui` usage.
- Do not add any new third-party styled component library.
- Business views and feature components must import shared UI primitives from `src/components/ui/*`.
- Buttons, inputs, modals, dropdowns, selects, toasts, and cards must not be reimplemented ad hoc inside feature code.
- Colors, radii, borders, and shadows must come from shared tokens.
- Tailwind is for layout and composition. Shared interaction patterns belong in base components.

## Allowed Patterns

- Tailwind utility classes for spacing, layout, responsive behavior, and one-off composition.
- Shared primitives for repeated interaction elements.
- Local scoped styles only for component-specific visuals that cannot be reasonably expressed through Tailwind and tokens.

## Disallowed Patterns

- Direct imports from `naive-ui` in new code.
- New global class systems parallel to `src/components/ui/*`.
- Hardcoded hex colors in feature code when a token already exists.
- Implementing modal, dropdown, select, or toast behavior directly inside views.

## Base Component Inventory

The shared UI layer should converge on:

- `BaseButton`
- `BaseInput`
- `BaseTextarea`
- `BaseCard`
- `BaseModal`
- `BaseDropdown`
- `BaseSelect`
- `BaseSpinner`
- `BaseToast`

## Token Rules

Use shared tokens for:

- backgrounds
- surfaces
- borders
- text colors
- primary and danger actions
- radius scale
- shadow scale

## Migration Order

1. Introduce tokens and base components.
2. Replace `NIcon`, `NSpin`, and the message bridge.
3. Replace `NModal` and `NInput`.
4. Replace `NDropdown` and `NSelect`.
5. Remove `naive-ui` providers from the app root.
6. Remove `naive-ui` from dependencies after the last usage is gone.

## Review Checklist

Before merging UI work, check:

- Does the code use `src/components/ui/*` where expected?
- Did it introduce any new `naive-ui` usage?
- Are colors and spacing consistent with tokens?
- Did it create a new interaction primitive that should instead be shared?

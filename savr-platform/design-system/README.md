# SAVR Design System — Phase 03 Shared Foundation

Shared visual tokens ported from the approved premium visual direction
(`savr-premium-mobile-app/src/theme.css`) into production-safe primitives
available to both the web and mobile platforms.

## Source of truth

`savr-platform/design-system/tokens.ts` — all token values as TypeScript constants.

Do not edit `web/theme.css` or `mobile/src/theme/index.ts` without keeping
`tokens.ts` in sync.

## Platform usage

### Web (`savr-platform/web`)

The web app uses Tailwind v4. Token values are loaded via an `@import` of
`design-system/web/theme.css` inside `web/app/globals.css`. Tailwind reads the
`@theme` block and generates utility classes (`bg-primary`, `text-foreground`,
`rounded-lg`, etc.) along with CSS custom properties (`--color-primary`,
`--font-sans`, etc.) on `:root`.

```css
/* web/app/globals.css */
@import "tailwindcss";
@import "../../design-system/web/theme.css";
```

Reference token values as Tailwind utilities:

```tsx
<button className="bg-primary text-primary-foreground rounded-lg">
  Save
</button>
```

Or as CSS variables:

```css
.my-glow { box-shadow: var(--shadow-glow); }
```

### Mobile (`savr-platform/mobile`)

The mobile app uses React Native (no CSS). Token values are available as
TypeScript constants from `mobile/src/theme/index.ts`, which mirrors
`design-system/tokens.ts` values for React Native `StyleSheet` use.

```ts
import { colors, radii, typography } from '@/theme';

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
  },
  label: {
    color: colors.foreground,
    fontFamily: typography.fontSans,
  },
});
```

## Token categories

| Category    | Token file key | CSS namespace       | Description                              |
|-------------|---------------|---------------------|------------------------------------------|
| Colors      | `colors`      | `--color-*`         | Brand, neutral, text, semantic states    |
| Typography  | `typography`  | `--font-*`          | Font-family stacks                       |
| Spacing     | `spacing`     | `--spacing-*`       | Nav height, header height                |
| Radii       | `radii`       | `--radius-*`        | Border radius scale                      |
| Shadows     | `shadows`     | `--shadow-*`        | Elevation and glow effects               |
| Motion      | `motion`      | `--ease-*`, `--duration-*` | Easing curves and duration values |

## Brand palette

| Name               | Value     | Use                                    |
|--------------------|-----------|----------------------------------------|
| `primary`          | `#BAFF5C` | Primary actions, brand accent, focus   |
| `secondary`        | `#5CFFBA` | Secondary actions, mint highlights     |
| `accent`           | `#FFE55C` | Warm citrus emphasis                   |
| `pet`              | `#FFAB5C` | Pet-safety mode accent                 |
| `background`       | `#0D1210` | App background — deep forest-slate     |
| `surface`          | `#141A17` | Card and panel surfaces                |
| `surface-raised`   | `#1A221E` | Elevated surfaces, modals              |
| `foreground`       | `#FFFFFF` | Primary text                           |
| `foreground-secondary` | `#C8D9CF` | Secondary text                    |
| `foreground-muted` | `#7A9486` | Placeholder and disabled text          |

## Phase scope

Phase 03 establishes the shared token layer only. Feature screens, navigation
shells, and individual component overhauls happen in later phases. No product
data contracts, API routes, or auth flows changed in this phase.

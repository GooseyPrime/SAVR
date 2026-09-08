/**
 * SAVR Design System Tokens — Phase 03 Shared Foundation
 *
 * This file is the single canonical source of truth for all design token values.
 * Derived from the approved premium visual direction in savr-premium-mobile-app/src/theme.css.
 *
 * Platform usage:
 *   Web  — values are mirrored as CSS custom properties in design-system/web/theme.css
 *           and loaded into savr-platform/web/app/globals.css via Tailwind v4 @theme
 *   Mobile — import from savr-platform/mobile/src/theme/index.ts
 *            (mirrors these values as React Native-compatible constants)
 */

// Brand Colors
export const colors = {
  // Primary — Climate SAGE metal
  primary: '#7FA37A',
  primaryHover: '#8FB58B',
  primaryLight: '#7FA37A2E',
  primaryForeground: '#0C0B0A',

  // Secondary — tempered sage
  secondary: '#6F8F6A',
  secondaryHover: '#7FA37A',
  secondaryLight: '#7FA37A1F',
  secondaryForeground: '#F5F7F2',

  // Accent — pale alloy
  accent: '#A6BEA2',
  accentHover: '#B6CDAF',
  accentLight: '#7FA37A1A',
  accentForeground: '#0C0B0A',

  // Pet mode — muted bronze
  pet: '#B99971',
  petHover: '#C7A883',
  petLight: '#B999711F',
  petForeground: '#0C0B0A',

  // Neutrals — obsidian / wet-stone / warm surface
  background: '#0C0B0A',
  surface: '#141210',
  surfaceRaised: '#101410',
  muted: '#1A1816',
  mutedForeground: '#8F9A8B',
  border: '#7FA37A2E',
  borderStrong: '#7FA37A4A',

  // Text
  foreground: '#F5F7F2',
  foregroundSecondary: '#D8E0D4',
  foregroundMuted: '#9AA696',

  // Semantic states
  success: '#84B57C',
  successLight: '#84B57C20',
  warning: '#C9B47A',
  warningLight: '#C9B47A20',
  error: '#C67A7A',
  errorLight: '#C67A7A20',
  info: '#7FA37A',
  infoLight: '#7FA37A20',
} as const;

// Typography
export const typography = {
  fontDisplay: "'Fraunces', 'IBM Plex Serif', serif",
  fontSans: "'IBM Plex Sans', system-ui, -apple-system, sans-serif",
  fontMono: "'IBM Plex Mono', ui-monospace, monospace",
  fontScript: "'Fraunces', serif",
} as const;

// Spacing — layout-level primitives (in px)
export const spacing = {
  navHeight: 72,
  headerHeight: 56,
} as const;

// Border radius (in px)
export const radii = {
  sm: 1,
  md: 4,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

// Shadows (CSS string values for web; React Native uses elevation for mobile)
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.35)',
  md: '0 3px 12px rgba(0, 0, 0, 0.45)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.55)',
  xl: '0 14px 44px rgba(0, 0, 0, 0.65)',
  glow: '0 0 0 1px #7FA37A2E',
  glowStrong: '0 0 0 1px #7FA37A4A',
} as const;

// Motion — easing curves and duration values (ms)
export const motion = {
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  easeSpring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  easeSmooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  durationFast: 150,
  durationNormal: 300,
  durationSlow: 500,
} as const;

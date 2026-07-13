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
  // Primary — vibrant lime (logo accent)
  primary: '#BAFF5C',
  primaryHover: '#C8FF7A',
  primaryLight: '#BAFF5C18',
  primaryForeground: '#0D1208',

  // Secondary — fresh mint
  secondary: '#5CFFBA',
  secondaryHover: '#7AFFC8',
  secondaryLight: '#5CFFBA18',
  secondaryForeground: '#0D1208',

  // Accent — warm citrus
  accent: '#FFE55C',
  accentHover: '#FFEB7A',
  accentLight: '#FFE55C18',
  accentForeground: '#0D1208',

  // Pet mode — soft peach
  pet: '#FFAB5C',
  petHover: '#FFBC7A',
  petLight: '#FFAB5C18',
  petForeground: '#0D1208',

  // Neutrals — deep forest-slate
  background: '#0D1210',
  surface: '#141A17',
  surfaceRaised: '#1A221E',
  muted: '#232D28',
  mutedForeground: '#8FA89A',
  border: '#BAFF5C12',
  borderStrong: '#BAFF5C28',

  // Text
  foreground: '#FFFFFF',
  foregroundSecondary: '#C8D9CF',
  foregroundMuted: '#7A9486',

  // Semantic states
  success: '#5CFF8A',
  successLight: '#5CFF8A20',
  warning: '#FFE55C',
  warningLight: '#FFE55C20',
  error: '#FF6B6B',
  errorLight: '#FF6B6B20',
  info: '#5CBAFF',
  infoLight: '#5CBAFF20',
} as const;

// Typography
export const typography = {
  fontDisplay: "'Outfit', 'Inter', system-ui, sans-serif",
  fontSans: "'Inter', system-ui, -apple-system, sans-serif",
  fontMono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
  fontScript: "'Caveat', cursive",
} as const;

// Spacing — layout-level primitives (in px)
export const spacing = {
  navHeight: 72,
  headerHeight: 56,
} as const;

// Border radius (in px)
export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Shadows (CSS string values for web; React Native uses elevation for mobile)
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.4)',
  md: '0 4px 16px rgba(0, 0, 0, 0.5)',
  lg: '0 8px 32px rgba(0, 0, 0, 0.6)',
  xl: '0 16px 64px rgba(0, 0, 0, 0.7)',
  glow: '0 0 30px #BAFF5C25',
  glowStrong: '0 0 50px #BAFF5C40',
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

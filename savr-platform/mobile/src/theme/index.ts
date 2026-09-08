/**
 * SAVR Design System Tokens — Mobile (React Native)
 *
 * Mirrors the canonical token values from savr-platform/design-system/tokens.ts
 * as React Native-compatible constants. Use with StyleSheet.create().
 *
 * Do not edit values here without updating design-system/tokens.ts to match.
 *
 * See design-system/README.md for full usage guidance.
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
  // React Native supports CSS4 8-digit hex (#RRGGBBAA) — values match tokens.ts
  border: '#7FA37A2E',
  borderStrong: '#7FA37A4A',

  // Text
  foreground: '#F5F7F2',
  foregroundSecondary: '#D8E0D4',
  foregroundMuted: '#9AA696',

  // Semantic states
  success: '#84B57C',
  successLight: '#1B2A1A',
  warning: '#C9B47A',
  warningLight: '#2E2819',
  error: '#C67A7A',
  errorLight: '#2D1C1C',
  info: '#7FA37A',
  infoLight: '#1A2420',
} as const;

// Typography — font family stacks
export const typography = {
  fontDisplay: 'Fraunces',
  fontSans: 'IBM Plex Sans',
  fontMono: 'IBM Plex Mono',
  fontScript: 'Fraunces',
} as const;

// Spacing — layout-level primitives (in dp/px)
export const spacing = {
  navHeight: 72,
  headerHeight: 56,
} as const;

// Border radius (in dp/px)
export const radii = {
  sm: 1,
  md: 4,
  lg: 8,
  xl: 12,
  full: 9999,
} as const;

// Motion — duration values in ms (React Native Animated / Reanimated)
// Note: easing curves must be expressed as Easing functions in React Native.
export const motion = {
  durationFast: 150,
  durationNormal: 300,
  durationSlow: 500,
} as const;

// Shadow elevation helpers for React Native
// Use these as elevation/shadow style overrides per platform.
export const shadowElevations = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

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
  // React Native supports CSS4 8-digit hex (#RRGGBBAA) — values match tokens.ts
  border: '#BAFF5C12',
  borderStrong: '#BAFF5C28',

  // Text
  foreground: '#FFFFFF',
  foregroundSecondary: '#C8D9CF',
  foregroundMuted: '#7A9486',

  // Semantic states
  success: '#5CFF8A',
  successLight: '#1A3D25',
  warning: '#FFE55C',
  warningLight: '#3D3510',
  error: '#FF6B6B',
  errorLight: '#3D1515',
  info: '#5CBAFF',
  infoLight: '#152D3D',
} as const;

// Typography — font family stacks
export const typography = {
  fontDisplay: 'Outfit',
  fontSans: 'Inter',
  fontMono: 'JetBrains Mono',
  fontScript: 'Caveat',
} as const;

// Spacing — layout-level primitives (in dp/px)
export const spacing = {
  navHeight: 72,
  headerHeight: 56,
} as const;

// Border radius (in dp/px)
export const radii = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
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

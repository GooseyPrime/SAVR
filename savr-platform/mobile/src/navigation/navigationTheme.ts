import { DarkTheme, type Theme } from '@react-navigation/native';
import { colors } from '../theme';

export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.foreground,
    border: colors.border,
    notification: colors.accent,
  },
};

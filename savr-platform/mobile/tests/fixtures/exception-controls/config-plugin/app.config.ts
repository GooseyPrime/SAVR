import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'fixture',
  slug: 'fixture',
  plugins: ['./with-update-signing.js'],
});

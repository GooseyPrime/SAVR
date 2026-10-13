import type { ConfigContext, ExpoConfig } from 'expo/config';

const shared = { updates: { enabled: false, fallbackToCacheTimeout: 0 } };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...shared,
  name: 'fixture',
  slug: 'fixture',
});

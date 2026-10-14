import type { ConfigContext, ExpoConfig } from 'expo/config';

import { updateSettings } from './signing';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'fixture',
  slug: 'fixture',
  updates: { ...updateSettings },
});

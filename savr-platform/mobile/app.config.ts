import type { ExpoConfig, ConfigContext } from 'expo/config';

// Pin extra.eas.projectId after `eas init` for @intellme/savr.
// Project IDs are not secret. Leave empty until the Expo project is linked.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'SAVR',
  slug: 'savr',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'savr',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.savr.app',
    infoPlist: {
      NSCameraUsageDescription:
        'SAVR uses your camera to scan and photograph pantry items for inventory management.',
      NSPhotoLibraryUsageDescription:
        'SAVR needs access to your photo library to select images of pantry items.',
      NSPhotoLibraryAddUsageDescription:
        'SAVR saves recipe photos and inventory images to your photo library.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0D1210',
    },
    package: 'com.savr.app',
    versionCode: 1,
    predictiveBackGestureEnabled: false,
    softwareKeyboardLayoutMode: 'resize',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'savr', host: 'auth', pathPrefix: '/callback' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
    permissions: [
      'CAMERA',
      'INTERNET',
      'ACCESS_NETWORK_STATE',
    ],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-camera', 'expo-font', 'expo-image-picker', 'expo-status-bar'],
  extra: {
    eas: {
      projectId: EAS_PROJECT_ID,
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  },
  owner: 'intellme',
});

import type { ExpoConfig, ConfigContext } from 'expo/config';

// EAS project for @intellme/savr, created by `eas init`.
// Project IDs are not secret; the env var override exists for forks and CI.
// EAS cannot write this itself because the config is dynamic, so it is pinned here.
const EAS_PROJECT_ID =
  process.env.EAS_PROJECT_ID || 'acf58b96-e2fd-4d00-b289-e0686d13875c';

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
      // READ_EXTERNAL_STORAGE is required by expo-image-picker on Android 12
      // (API 32) and earlier. On API 33+ Android auto-denies this deprecated
      // permission, so retaining it in the manifest is safe across all versions.
      'android.permission.READ_EXTERNAL_STORAGE',
    ],
    blockedPermissions: [
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: [
    // Disable RECORD_AUDIO: this app captures images only.
    ['expo-camera', { recordAudioAndroid: false }],
    'expo-font',
    ['expo-image-picker', { photosPermission: 'SAVR needs access to your photo library to select images of pantry items.' }],
    'expo-status-bar',
  ],
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

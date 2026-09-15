import React from 'react';
import { useFonts } from 'expo-font';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import 'react-native-gesture-handler';

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces: Fraunces_600SemiBold,
    'IBM Plex Sans': IBMPlexSans_400Regular,
    'IBM Plex Mono': IBMPlexMono_500Medium,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

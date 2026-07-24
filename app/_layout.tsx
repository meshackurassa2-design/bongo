import { useEffect } from 'react';
import { LogBox, Alert } from 'react-native';

const originalHandler = global.ErrorUtils?.getGlobalHandler?.();
if (global.ErrorUtils) {
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    Alert.alert("FATAL JS ERROR", error.message + "\n\n" + error.stack);
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StyleSheet } from 'react-native';
import AnimatedSplash from '../components/AnimatedSplash';
import ThemeEffects from '../components/ThemeEffects';
import '../i18n';

// Ignore harmless background Supabase auth network errors in dev mode
LogBox.ignoreLogs(['TypeError: Network request failed']);



const customTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0A0A0F',
  },
};

export default function RootLayout() {
  const { init, session, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Initialize Auth Store
    useAuthStore.getState().init();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'auth';
    
    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, isLoading, segments]);

  // We no longer return null here, we let the app mount behind the splash screen
  // if (isLoading) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={customTheme}>
        <StatusBar style="light" backgroundColor="#0A0A0F" />
        <Stack screenOptions={{ headerShown: false, headerBackTitleVisible: false, headerBackTitle: ' ', contentStyle: { backgroundColor: '#0A0A0F' }, animation: 'fade' }}>
          <Stack.Screen name="(tabs)" options={{ title: '' }} />
          <Stack.Screen name="auth" />
          <Stack.Screen name="track/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="player" options={{ presentation: 'modal' }} />
          <Stack.Screen name="buy-credits" options={{ presentation: 'modal' }} />
          <Stack.Screen name="artist/[id]" />
          <Stack.Screen name="genre/[name]" />
        </Stack>
        <AnimatedSplash isReady={!isLoading} />
        <ThemeEffects />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

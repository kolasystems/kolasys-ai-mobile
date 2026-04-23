import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import * as Notifications from 'expo-notifications';

import { tokenCache } from './src/lib/auth';
import { TRPCProvider } from './src/lib/trpc';
import { ThemeProvider, useTheme } from './src/lib/theme';
import { initNotifications, registerPushToken } from './src/lib/notifications';
import { activateWatchSession } from './src/lib/watchBridge';
import AppNavigator, { navigationRef } from './src/navigation/AppNavigator';
import SignInScreen from './src/screens/SignInScreen';

const CLERK_PUBLISHABLE_KEY =
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
  'pk_test_cG9zc2libGUtdHJvbGwtMTUuY2xlcmsuYWNjb3VudHMuZGV2JA';

function RootNavigator() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const { colors } = useTheme();
  useEffect(() => {
    if (!isSignedIn) return;
    void initNotifications();
    void registerPushToken(getToken);
  }, [isSignedIn, getToken]);
  useEffect(() => {
    activateWatchSession();
  }, []);

  // Tapping a notes-ready push navigates to that recording. Works for
  // notifications received while the app is foreground/background; cold-
  // launch handling is a Phase 2 follow-up.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { recordingId?: string }
        | undefined;
      if (data?.recordingId && navigationRef.isReady()) {
        (navigationRef as { navigate: (route: string, params?: unknown) => void }).navigate(
          'Recordings',
          { screen: 'RecordingDetail', params: { id: data.recordingId } },
        );
      }
    });
    return () => sub.remove();
  }, []);
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }
  if (!isSignedIn) {
    return <SignInScreen />;
  }
  return <AppNavigator />;
}

function AuthenticatedApp() {
  const { isDark } = useTheme();
  return (
    <TRPCProvider>
      <RootNavigator />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </TRPCProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
          <AuthenticatedApp />
        </ClerkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

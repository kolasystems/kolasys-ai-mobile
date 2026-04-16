import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { tokenCache } from './src/lib/auth';
import { TRPCProvider } from './src/lib/trpc';
import { initNotifications } from './src/lib/notifications';
import AppNavigator from './src/navigation/AppNavigator';
import SignInScreen from './src/screens/SignInScreen';

const CLERK_PUBLISHABLE_KEY =
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
  'pk_test_cG9zc2libGUtdHJvbGwtMTUuY2xlcmsuYWNjb3VudHMuZGV2JA';

function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  useEffect(() => {
    if (isSignedIn) void initNotifications();
  }, [isSignedIn]);
  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#5B8DEF" />
      </View>
    );
  }
  if (!isSignedIn) {
    return <SignInScreen />;
  }
  return <AppNavigator />;
}

function AuthenticatedApp() {
  return (
    <TRPCProvider>
      <RootNavigator />
      <StatusBar style="dark" />
    </TRPCProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <AuthenticatedApp />
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

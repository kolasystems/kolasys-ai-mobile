import 'react-native-screens/native-stack';
import React from 'react';
import { View, ActivityIndicator, StyleSheet, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

import { tokenCache } from './src/lib/auth';
import { TRPCProvider } from './src/lib/trpc';
import AppNavigator from './src/navigation/AppNavigator';
import SignInScreen from './src/screens/SignInScreen';
import { getThemeColors, Colors } from './src/lib/theme';

const CLERK_PUBLISHABLE_KEY =
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
  'pk_test_cG9zc2libGUtdHJvbGwtMTUuY2xlcmsuYWNjb3VudHMuZGV2JA';

// ─── Auth gate ────────────────────────────────────────────────────────────────

function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);

  if (!isLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!isSignedIn) {
    return <SignInScreen />;
  }

  return <AppNavigator />;
}

// ─── Navigation theme ─────────────────────────────────────────────────────────

function ThemedNavigationContainer({ children }: { children: React.ReactNode }) {
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);

  const navTheme = {
    dark: isDark,
    colors: {
      primary: Colors.primary,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
      notification: Colors.primary,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
  };

  return (
    <NavigationContainer theme={navTheme}>{children}</NavigationContainer>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
        <ThemedNavigationContainer>
          <TRPCProvider>
            <RootNavigator />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </TRPCProvider>
        </ThemedNavigationContainer>
      </ClerkProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ClerkProvider, useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';

import { tokenCache } from './src/lib/auth';
import AppNavigator from './src/navigation/AppNavigator';
import SignInScreen from './src/screens/SignInScreen';

const CLERK_PUBLISHABLE_KEY =
  (Constants.expoConfig?.extra?.clerkPublishableKey as string | undefined) ??
  'pk_test_cG9zc2libGUtdHJvbGwtMTUuY2xlcmsuYWNjb3VudHMuZGV2JA';

function RootNavigator() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
  }
  if (!isSignedIn) {
    return <SignInScreen />;
  }
  return <AppNavigator />;
}

export default function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <RootNavigator />
    </ClerkProvider>
  );
}

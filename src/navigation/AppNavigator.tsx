import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  type Theme,
} from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import RecordingDetailScreen from '../screens/RecordingDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useTheme } from '../lib/theme';

export type TabParamList = {
  Home: undefined;
  Record: undefined;
  Recordings: undefined;
  Settings: undefined;
};

export type RecordingsStackParamList = {
  RecordingsList: undefined;
  RecordingDetail: { id: string };
};

const Stack = createNativeStackNavigator<RecordingsStackParamList>();

function RecordingsStack() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="RecordingsList" component={RecordingsScreen} options={{ title: 'Recordings' }} />
      <Stack.Screen name="RecordingDetail" component={RecordingDetailScreen} options={{ title: '' }} />
    </Stack.Navigator>
  );
}

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<string, [string, string]> = {
  Home: ['home', 'home-outline'],
  Record: ['mic', 'mic-outline'],
  Recordings: ['list', 'list-outline'],
  Settings: ['settings', 'settings-outline'],
};

export default function AppNavigator() {
  const { colors, isDark } = useTheme();

  // React Navigation theme — controls default screen background, header
  // background, card transitions, etc. Without this, RN uses its own light
  // palette regardless of our useTheme values.
  const navTheme: Theme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [isDark, colors],
  );

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const [active, inactive] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.textPrimary },
          headerTintColor: colors.accent,
          headerShadowVisible: false,
          sceneStyle: { backgroundColor: colors.background },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ headerTitle: 'Kolasys AI' }} />
        <Tab.Screen name="Record" component={RecordScreen} options={{ headerTitle: 'New Recording' }} />
        <Tab.Screen name="Recordings" component={RecordingsStack} options={{ headerShown: false }} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

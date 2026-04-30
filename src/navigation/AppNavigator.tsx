import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  createNavigationContainerRef,
  type Theme,
} from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import RecordingDetailScreen from '../screens/RecordingDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ContactsScreen from '../screens/ContactsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ActionItemsScreen from '../screens/ActionItemsScreen';
import AskAIScreen from '../screens/AskAIScreen';
import KnowledgeScreen from '../screens/KnowledgeScreen';
import TemplatesScreen from '../screens/TemplatesScreen';
import BillingScreen from '../screens/BillingScreen';
import { useTheme } from '../lib/theme';

export type TabParamList = {
  Home: undefined;
  Recordings: undefined;
  AskAI: undefined;
  ActionItems: undefined;
  Billing: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  Record: undefined;
  Knowledge: undefined;
  Templates: undefined;
};

export type RecordingsStackParamList = {
  RecordingsList: undefined;
  RecordingDetail: { id: string };
};

export type SettingsStackParamList = {
  SettingsMain: undefined;
  Contacts: undefined;
  Analytics: undefined;
};

/** Navigation container ref — used by the push-notification response listener
 *  to navigate to a RecordingDetail from outside the React tree. */
export const navigationRef = createNavigationContainerRef();

const RecordingsStackInstance = createNativeStackNavigator<RecordingsStackParamList>();
const SettingsStackInstance = createNativeStackNavigator<SettingsStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function RecordingsStack() {
  const { colors } = useTheme();
  return (
    <RecordingsStackInstance.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <RecordingsStackInstance.Screen name="RecordingsList" component={RecordingsScreen} options={{ title: 'Recordings' }} />
      <RecordingsStackInstance.Screen name="RecordingDetail" component={RecordingDetailScreen} options={{ title: '' }} />
    </RecordingsStackInstance.Navigator>
  );
}

function SettingsStack() {
  const { colors } = useTheme();
  return (
    <SettingsStackInstance.Navigator
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        headerTintColor: colors.accent,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <SettingsStackInstance.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <SettingsStackInstance.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{ title: 'Contacts' }}
      />
      <SettingsStackInstance.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
    </SettingsStackInstance.Navigator>
  );
}

const Tab = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, [string, string]> = {
  Home:        ['home',                   'home-outline'],
  Recordings:  ['list',                   'list-outline'],
  AskAI:       ['sparkles',               'sparkles-outline'],
  ActionItems: ['checkmark-circle',       'checkmark-circle-outline'],
  Billing:     ['card',                   'card-outline'],
  Settings:    ['settings',               'settings-outline'],
};

function Tabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const key = route.name as keyof TabParamList;
          const [active, inactive] = TAB_ICONS[key] ?? ['ellipse', 'ellipse-outline'];
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Recordings" component={RecordingsStack} options={{ headerShown: false }} />
      <Tab.Screen name="AskAI" component={AskAIScreen} options={{ headerShown: false, title: 'Ask AI' }} />
      <Tab.Screen name="ActionItems" component={ActionItemsScreen} options={{ headerShown: false, title: 'Tasks' }} />
      <Tab.Screen name="Billing" component={BillingScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Settings" component={SettingsStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors, isDark } = useTheme();

  // React Navigation theme — controls default screen background, header
  // background, card transitions, etc.
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
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <RootStack.Navigator
        screenOptions={{
          headerBackButtonDisplayMode: 'minimal',
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.textPrimary },
          headerTintColor: colors.accent,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <RootStack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <RootStack.Screen name="Record" component={RecordScreen} options={{ title: 'New Recording' }} />
        <RootStack.Screen name="Knowledge" component={KnowledgeScreen} options={{ headerShown: false }} />
        <RootStack.Screen name="Templates" component={TemplatesScreen} options={{ headerShown: false }} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import RecordingDetailScreen from '../screens/RecordingDetailScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';

import { getThemeColors, Colors, useColorScheme } from '../lib/theme';

// ─── Param Lists ──────────────────────────────────────────────────────────────

export type TabParamList = {
  Home: undefined;
  Record: undefined;
  Recordings: undefined;
  Calendar: undefined;
  Settings: undefined;
};

export type RecordingsStackParamList = {
  RecordingsList: undefined;
  RecordingDetail: { id: string };
};

// ─── Recordings Stack ─────────────────────────────────────────────────────────

const RecordingsStack = createNativeStackNavigator<RecordingsStackParamList>();

function RecordingsNavigator() {
  const isDark = useColorScheme();
  const theme = getThemeColors(isDark);

  return (
    <RecordingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
      }}
    >
      <RecordingsStack.Screen
        name="RecordingsList"
        component={RecordingsScreen}
        options={{ title: 'Recordings' }}
      />
      <RecordingsStack.Screen
        name="RecordingDetail"
        component={RecordingDetailScreen}
        options={{ title: 'Recording', headerBackButtonDisplayMode: 'minimal' }}
      />
    </RecordingsStack.Navigator>
  );
}

// ─── Tab Navigator ────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

export default function AppNavigator() {
  const isDark = useColorScheme();
  const theme = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom : 10;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Header
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        // Tab bar
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: bottomPad,
          height: 56 + bottomPad,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        // Icons
        tabBarIcon: ({ focused, color, size }) => {
          const iconMap: Record<string, [string, string]> = {
            Home:       ['home',     'home-outline'],
            Record:     ['mic',      'mic-outline'],
            Recordings: ['list',     'list-outline'],
            Calendar:   ['calendar', 'calendar-outline'],
            Settings:   ['settings', 'settings-outline'],
          };
          const [active, inactive] = iconMap[route.name] ?? ['help', 'help-outline'];

          if (route.name === 'Record') {
            return (
              <Ionicons
                name={(focused ? 'mic' : 'mic-outline') as never}
                size={size + 4}
                color={Colors.primary}
              />
            );
          }

          return (
            <Ionicons
              name={(focused ? active : inactive) as never}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home', headerTitle: 'Kolasys AI' }}
      />
      <Tab.Screen
        name="Recordings"
        component={RecordingsNavigator}
        options={{ title: 'Recordings', headerShown: false }}
      />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{ title: 'Record', headerTitle: 'New Recording' }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({});

import React from 'react';
import { View, StyleSheet, useColorScheme } from 'react-native';
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

import { getThemeColors, Colors } from '../lib/theme';

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
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);

  return (
    <RecordingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
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
        options={{ title: '', headerTransparent: false }}
      />
    </RecordingsStack.Navigator>
  );
}

// ─── Bottom Tab Navigator ─────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<TabParamList>();

function RecordTabButton({
  onPress,
  isDark,
}: {
  onPress?: () => void;
  isDark: boolean;
}) {
  return (
    <View style={styles.recordButtonWrapper}>
      <View
        style={[styles.recordButton, { backgroundColor: Colors.primary }]}
        // Using a touchable handled by tab navigator
      >
        <Ionicons name="mic" size={26} color={Colors.white} />
      </View>
    </View>
  );
}

export default function AppNavigator() {
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.tabBarBorder,
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 56 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, { active: string; inactive: string }> = {
            Home: { active: 'home', inactive: 'home-outline' },
            Record: { active: 'mic', inactive: 'mic-outline' },
            Recordings: { active: 'list', inactive: 'list-outline' },
            Calendar: { active: 'calendar', inactive: 'calendar-outline' },
            Settings: { active: 'settings', inactive: 'settings-outline' },
          };
          const icon = icons[route.name];
          if (route.name === 'Record') {
            return (
              <View style={[styles.recordTabIcon, { backgroundColor: focused ? Colors.primary : Colors.primary + 'DD' }]}>
                <Ionicons name="mic" size={22} color={Colors.white} />
              </View>
            );
          }
          return (
            <Ionicons
              name={(focused ? icon?.active : icon?.inactive) as never}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home', headerTitle: 'Kolasys AI' }} />
      <Tab.Screen name="Recordings" component={RecordingsNavigator} options={{ title: 'Recordings', headerShown: false }} />
      <Tab.Screen
        name="Record"
        component={RecordScreen}
        options={{
          title: 'Record',
          tabBarLabel: 'Record',
          tabBarStyle: { display: 'none' },
          headerTitle: 'New Recording',
        }}
      />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  recordButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  recordButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  recordTabIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
});

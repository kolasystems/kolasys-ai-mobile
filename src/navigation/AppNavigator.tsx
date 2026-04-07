import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import RecordScreen from '../screens/RecordScreen';
import RecordingsScreen from '../screens/RecordingsScreen';
import RecordingDetailScreen from '../screens/RecordingDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';

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
  return (
    <Stack.Navigator screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
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
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const [active, inactive] = TAB_ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];
            return <Ionicons name={(focused ? active : inactive) as never} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#5B8DEF',
          tabBarInactiveTintColor: '#6b7280',
          headerStyle: { backgroundColor: '#ffffff' },
          headerTitleStyle: { color: '#111827' },
          headerShadowVisible: false,
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

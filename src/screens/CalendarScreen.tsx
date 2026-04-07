import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useColorScheme,
  Linking,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { getThemeColors, Colors } from '../lib/theme';
import type { TabParamList } from '../navigation/AppNavigator';

type Nav = BottomTabNavigationProp<TabParamList>;

interface CalendarEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  url?: string;
  notes?: string;
  isOnline: boolean;
  meetingUrl?: string;
}

const MEETING_DOMAINS = ['zoom.us', 'meet.google.com', 'teams.microsoft.com', 'webex.com'];

function extractMeetingUrl(event: Calendar.Event): string | undefined {
  const text = [event.url, event.location, event.notes].join(' ').toLowerCase();
  for (const domain of MEETING_DOMAINS) {
    const regex = new RegExp(`https?://[\\w./\\-?=&%]*${domain.replace('.', '\\.')}[\\w./\\-?=&%]*`, 'i');
    const match = text.match(regex);
    if (match) return match[0];
  }
  return undefined;
}

function formatEventTime(date: Date): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatEventDate(date: Date): string {
  const d = new Date(date);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function groupByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    const key = new Date(event.startDate).toDateString();
    acc[key] = acc[key] ?? [];
    acc[key].push(event);
    return acc;
  }, {});
}

export default function CalendarScreen() {
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status === 'granted') {
      setHasPermission(true);
      await loadEvents();
    } else {
      setHasPermission(false);
    }
  };

  const requestPermission = async () => {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status === 'granted') {
      setHasPermission(true);
      await loadEvents();
    } else {
      Alert.alert(
        'Calendar Access Required',
        'Please enable calendar access in Settings to see upcoming meetings.',
        [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const loadEvents = async () => {
    setLoading(true);
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const rawEvents = await Calendar.getEventsAsync(
        calendars.map((c) => c.id),
        now,
        weekFromNow
      );

      const processed: CalendarEvent[] = rawEvents
        .filter((e) => e.title && !e.allDay)
        .map((e) => {
          const meetingUrl = extractMeetingUrl(e);
          return {
            id: e.id,
            title: e.title,
            startDate: new Date(e.startDate),
            endDate: new Date(e.endDate),
            location: e.location ?? undefined,
            url: e.url ?? undefined,
            notes: e.notes ?? undefined,
            isOnline: !!meetingUrl,
            meetingUrl,
          };
        })
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      setEvents(processed);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeployBot = (event: CalendarEvent) => {
    if (!event.meetingUrl) return;
    Alert.alert(
      'Deploy Meeting Bot',
      `Send Kolasys AI bot to "${event.title}"?\n\nThe bot will join and record the meeting automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deploy Bot',
          onPress: () => {
            // Navigate to Record tab with bot deploy
            navigation.navigate('Record');
            // TODO: pass meetingUrl to RecordScreen
          },
        },
      ]
    );
  };

  const handleRecordDevice = (event: CalendarEvent) => {
    navigation.navigate('Record');
  };

  const grouped = groupByDate(events);
  const dateGroups = Object.keys(grouped);

  if (hasPermission === null) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background, paddingHorizontal: 32 }]}>
        <View style={[styles.permissionIcon, { backgroundColor: Colors.primary + '15' }]}>
          <Ionicons name="calendar-outline" size={48} color={Colors.primary} />
        </View>
        <Text style={[styles.permissionTitle, { color: theme.text }]}>Connect Your Calendar</Text>
        <Text style={[styles.permissionSubtitle, { color: theme.textSecondary }]}>
          See upcoming meetings and start recording or deploy a bot directly from your calendar.
        </Text>
        <TouchableOpacity style={styles.connectButton} onPress={requestPermission}>
          <Ionicons name="calendar" size={18} color={Colors.white} />
          <Text style={styles.connectButtonText}>Connect Calendar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : events.length === 0 ? (
        <View style={[styles.centered, { padding: 32 }]}>
          <Ionicons name="calendar-outline" size={40} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No upcoming meetings</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Your calendar is clear for the next 7 days.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
        >
          {dateGroups.map((dateKey) => (
            <View key={dateKey} style={styles.dateGroup}>
              <Text style={[styles.dateHeader, { color: theme.textSecondary }]}>
                {formatEventDate(grouped[dateKey][0].startDate)}
              </Text>
              {grouped[dateKey].map((event) => (
                <View
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                >
                  <View style={styles.eventTime}>
                    <View style={[styles.timeDot, { backgroundColor: event.isOnline ? Colors.primary : Colors.gray400 }]} />
                    <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                      {formatEventTime(event.startDate)}
                    </Text>
                  </View>
                  <View style={styles.eventContent}>
                    <Text style={[styles.eventTitle, { color: theme.text }]} numberOfLines={2}>
                      {event.title}
                    </Text>
                    {event.location && !event.isOnline && (
                      <View style={styles.eventMeta}>
                        <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
                        <Text style={[styles.eventMetaText, { color: theme.textSecondary }]} numberOfLines={1}>
                          {event.location}
                        </Text>
                      </View>
                    )}
                    {event.isOnline && (
                      <View style={styles.eventMeta}>
                        <Ionicons name="videocam-outline" size={12} color={Colors.primary} />
                        <Text style={[styles.eventMetaText, { color: Colors.primary }]}>Online meeting</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.eventActions}>
                    {event.isOnline && (
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: Colors.primary + '15' }]}
                        onPress={() => handleDeployBot(event)}
                      >
                        <Ionicons name="hardware-chip-outline" size={14} color={Colors.primary} />
                        <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Bot</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border }]}
                      onPress={() => handleRecordDevice(event)}
                    >
                      <Ionicons name="mic-outline" size={14} color={theme.text} />
                      <Text style={[styles.actionBtnText, { color: theme.text }]}>Record</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 20 },
  permissionIcon: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  permissionTitle: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  permissionSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  connectButtonText: { color: Colors.white, fontSize: 15, fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
  dateGroup: { gap: 8 },
  dateHeader: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingLeft: 4 },
  eventCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventTime: { alignItems: 'center', gap: 4, paddingTop: 2, width: 40 },
  timeDot: { width: 8, height: 8, borderRadius: 4 },
  timeText: { fontSize: 11, textAlign: 'center' },
  eventContent: { flex: 1, gap: 4 },
  eventTitle: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventMetaText: { fontSize: 12 },
  eventActions: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  actionBtnText: { fontSize: 12, fontWeight: '600' },
});

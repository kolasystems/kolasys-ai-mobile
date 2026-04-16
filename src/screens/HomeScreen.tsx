import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Calendar from 'expo-calendar';
import { trpc } from '../lib/trpc';
import { trpcGet, trpcPost } from '../lib/api';
import type { Recording, ActionItem } from '../lib/trpc';
import { RecordingCard } from '../components/RecordingCard';
import { StatusBadge } from '../components/StatusBadge';
import type { TabParamList } from '../navigation/AppNavigator';
import { detectReadyTransitions, useReadyStore } from '../lib/notifications';

type Nav = BottomTabNavigationProp<TabParamList>;
type HomeTab = 'feed' | 'tasks' | 'calendar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateShort(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(secs: number | null): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function weekGroup(createdAt: Date | string): 'this-week' | 'last-week' | 'older' {
  const now = Date.now();
  const t = new Date(createdAt).getTime();
  const ago = now - t;
  if (ago < 7 * 86_400_000) return 'this-week';
  if (ago < 14 * 86_400_000) return 'last-week';
  return 'older';
}

function platformIcon(title: string, url?: string): string {
  const str = `${title} ${url ?? ''}`.toLowerCase();
  if (str.includes('zoom')) return 'videocam';
  if (str.includes('meet') || str.includes('google')) return 'logo-google';
  if (str.includes('teams') || str.includes('microsoft')) return 'logo-microsoft';
  if (str.includes('webex')) return 'videocam-outline';
  if (str.includes('slack')) return 'logo-slack';
  return 'calendar-outline';
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

function FeedCard({ recording, onPress }: { recording: Recording; onPress: () => void }) {
  return (
    <TouchableOpacity style={feedStyles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={feedStyles.cardRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={feedStyles.cardTitle} numberOfLines={2}>{recording.title}</Text>
          <View style={feedStyles.cardMeta}>
            <Text style={feedStyles.cardMetaText}>{formatDateShort(recording.createdAt)}</Text>
            {recording.duration != null && (
              <>
                <Text style={feedStyles.cardMetaDot}>·</Text>
                <Ionicons name="time-outline" size={12} color="#9ca3af" />
                <Text style={feedStyles.cardMetaText}>{formatDuration(recording.duration)}</Text>
              </>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={recording.status} size="sm" />
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </View>
      </View>
      {recording.status === 'READY' && (
        <View style={feedStyles.notesIndicator}>
          <Ionicons name="document-text-outline" size={13} color="#5B8DEF" />
          <Text style={feedStyles.notesIndicatorText}>Notes ready</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const feedStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827', lineHeight: 21 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { fontSize: 12, color: '#9ca3af' },
  cardMetaDot: { fontSize: 12, color: '#d1d5db' },
  notesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#5B8DEF12',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  notesIndicatorText: { fontSize: 12, color: '#5B8DEF', fontWeight: '500' },
});

function FeedTab({ recordings, isLoading, onRefresh, isRefreshing, onCardPress }: {
  recordings: Recording[];
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCardPress: (id: string) => void;
}) {
  if (isLoading) {
    return <ActivityIndicator color="#5B8DEF" style={{ marginTop: 32 }} />;
  }

  if (recordings.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
        <Ionicons name="mic-outline" size={40} color="#d1d5db" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>No recordings yet</Text>
        <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 }}>
          Tap "New Recording" to get started.
        </Text>
      </View>
    );
  }

  const thisWeek = recordings.filter(r => weekGroup(r.createdAt) === 'this-week');
  const lastWeek = recordings.filter(r => weekGroup(r.createdAt) === 'last-week');
  const older = recordings.filter(r => weekGroup(r.createdAt) === 'older');

  return (
    <View style={{ gap: 24 }}>
      {thisWeek.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionLabel}>This Week</Text>
          {thisWeek.map(r => <FeedCard key={r.id} recording={r} onPress={() => onCardPress(r.id)} />)}
        </View>
      )}
      {lastWeek.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionLabel}>Last Week</Text>
          {lastWeek.map(r => <FeedCard key={r.id} recording={r} onPress={() => onCardPress(r.id)} />)}
        </View>
      )}
      {older.length > 0 && (
        <View style={{ gap: 12 }}>
          <Text style={styles.sectionLabel}>Older</Text>
          {older.map(r => <FeedCard key={r.id} recording={r} onPress={() => onCardPress(r.id)} />)}
        </View>
      )}
    </View>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

interface RecordingWithItems {
  id: string;
  title: string;
  createdAt: Date | string;
  actionItems: ActionItem[];
}

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgent' },
    HIGH:   { bg: '#FEF3C7', text: '#D97706', label: 'High' },
    MEDIUM: { bg: '#DBEAFE', text: '#2563EB', label: 'Medium' },
    LOW:    { bg: '#F3F4F6', text: '#6B7280', label: 'Low' },
  };
  const s = map[priority] ?? map.LOW;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: s.text }}>{s.label}</Text>
    </View>
  );
}

function TaskItem({ item, onToggle }: { item: ActionItem; onToggle: (id: string, done: boolean) => void }) {
  const isDone = item.status === 'COMPLETED' || item.status === 'CANCELLED';
  return (
    <TouchableOpacity
      style={taskStyles.item}
      onPress={() => onToggle(item.id, !isDone)}
      activeOpacity={0.75}
    >
      <View style={[taskStyles.check, isDone && taskStyles.checkDone]}>
        {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[taskStyles.itemTitle, isDone && { textDecorationLine: 'line-through', color: '#9ca3af' }]}>
          {item.title}
        </Text>
        {(item.assignee || item.dueDate) && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {item.assignee && (
              <Text style={taskStyles.meta}>@{item.assignee}</Text>
            )}
            {item.dueDate && (
              <Text style={taskStyles.meta}>
                Due {new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </View>
        )}
      </View>
      <PriorityBadge priority={item.priority} />
    </TouchableOpacity>
  );
}

const taskStyles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  check: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
  itemTitle: { fontSize: 14, color: '#111827', lineHeight: 20 },
  meta: { fontSize: 12, color: '#9ca3af' },
});

function ExpandedSection({
  recording,
  getTokenRef,
  onToggle,
  onNavigate,
}: {
  recording: Recording;
  getTokenRef: React.MutableRefObject<() => Promise<string | null>>;
  onToggle: (recordingId: string, actionId: string, done: boolean) => void;
  onNavigate: (id: string) => void;
}) {
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const data = await trpcGet<any>('recordings.get', { id: recording.id }, token);
        if (!cancelled) {
          const note = data?.note ?? data?.notes?.[0] ?? null;
          setItems(note?.actionItems ?? []);
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [recording.id, getTokenRef]);

  if (loading) return <ActivityIndicator size="small" color="#5B8DEF" style={{ paddingVertical: 16 }} />;
  if (!items?.length) {
    return (
      <View style={{ paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: '#9ca3af' }}>No action items in this recording</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {items.map(item => (
        <TaskItem key={item.id} item={item} onToggle={(id, done) => onToggle(recording.id, id, done)} />
      ))}
      <TouchableOpacity onPress={() => onNavigate(recording.id)} style={{ paddingVertical: 8 }}>
        <Text style={{ fontSize: 13, color: '#5B8DEF', fontWeight: '600' }}>
          Open full recording →
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function TasksTab({ recordings, isLoading, getTokenRef, onNavigate }: {
  recordings: Recording[];
  isLoading: boolean;
  getTokenRef: React.MutableRefObject<() => Promise<string | null>>;
  onNavigate: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [itemOverrides, setItemOverrides] = useState<Record<string, string>>({}); // actionId → status

  const withNotes = recordings.filter(r => r.status === 'READY');

  const handleToggle = useCallback(async (recordingId: string, actionId: string, done: boolean) => {
    setItemOverrides(prev => ({ ...prev, [actionId]: done ? 'COMPLETED' : 'OPEN' }));
    try {
      const token = await getTokenRef.current();
      await trpcPost('recordings.updateActionItem', { id: actionId, status: done ? 'COMPLETED' : 'OPEN' }, token);
    } catch {
      setItemOverrides(prev => {
        const next = { ...prev };
        delete next[actionId];
        return next;
      });
      Alert.alert('Error', 'Could not update action item.');
    }
  }, [getTokenRef]);

  if (isLoading) return <ActivityIndicator color="#5B8DEF" style={{ marginTop: 32 }} />;

  if (withNotes.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
        <Ionicons name="checkmark-circle-outline" size={40} color="#d1d5db" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>No tasks yet</Text>
        <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 }}>
          Action items extracted from your meetings will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {withNotes.map(r => {
        const isOpen = expanded.has(r.id);
        return (
          <View key={r.id} style={taskSectionStyles.section}>
            <TouchableOpacity
              style={taskSectionStyles.header}
              onPress={() => setExpanded(prev => {
                const next = new Set(prev);
                if (next.has(r.id)) next.delete(r.id); else next.add(r.id);
                return next;
              })}
              activeOpacity={0.75}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={taskSectionStyles.title} numberOfLines={1}>{r.title}</Text>
                <Text style={taskSectionStyles.sub}>{formatDateShort(r.createdAt)}</Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
            </TouchableOpacity>
            {isOpen && (
              <ExpandedSection
                recording={r}
                getTokenRef={getTokenRef}
                onToggle={handleToggle}
                onNavigate={onNavigate}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

const taskSectionStyles = StyleSheet.create({
  section: { borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fafafa', gap: 12 },
  title: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sub: { fontSize: 12, color: '#9ca3af' },
});

// ─── Calendar Tab ─────────────────────────────────────────────────────────────

interface CalEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  notes?: string;
  url?: string;
  location?: string;
  calendarId: string;
}

function CalendarEventCard({ event, botEnabled, onToggle }: {
  event: CalEvent;
  botEnabled: boolean;
  onToggle: (id: string, value: boolean) => void;
}) {
  const icon = platformIcon(event.title, event.url);
  const duration = Math.round((event.endDate.getTime() - event.startDate.getTime()) / 60_000);
  const now = new Date();
  const isNow = event.startDate <= now && event.endDate >= now;

  return (
    <View style={[calStyles.card, isNow && calStyles.cardNow]}>
      {isNow && (
        <View style={calStyles.nowBadge}>
          <Text style={calStyles.nowBadgeText}>Now</Text>
        </View>
      )}
      <View style={calStyles.cardRow}>
        <View style={[calStyles.iconWrap, { backgroundColor: isNow ? '#5B8DEF18' : '#f3f4f6' }]}>
          <Ionicons name={icon as never} size={20} color={isNow ? '#5B8DEF' : '#6b7280'} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={calStyles.eventTitle} numberOfLines={2}>{event.title}</Text>
          <View style={calStyles.metaRow}>
            <Ionicons name="time-outline" size={12} color="#9ca3af" />
            <Text style={calStyles.metaText}>
              {formatTime(event.startDate)} · {duration}m
            </Text>
            {event.location ? (
              <>
                <Text style={calStyles.dot}>·</Text>
                <Text style={calStyles.metaText} numberOfLines={1}>{event.location}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      <View style={calStyles.botRow}>
        <View style={{ flex: 1 }}>
          <Text style={calStyles.botLabel}>Record with AI bot</Text>
          <Text style={calStyles.botSub}>Auto-join and transcribe this meeting</Text>
        </View>
        <Switch
          value={botEnabled}
          onValueChange={v => onToggle(event.id, v)}
          trackColor={{ false: '#e5e7eb', true: '#5B8DEF' }}
          thumbColor="#ffffff"
        />
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    gap: 12,
  },
  cardNow: { borderColor: '#5B8DEF', borderWidth: 1.5 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#111827', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#9ca3af', flex: 1 },
  dot: { fontSize: 12, color: '#d1d5db' },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f3f4f6' },
  botLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  botSub: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  nowBadge: { alignSelf: 'flex-start', backgroundColor: '#5B8DEF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  nowBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
});

function CalendarTab() {
  const [status, setStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [botToggles, setBotToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const { status: s } = await Calendar.requestCalendarPermissionsAsync();
        if (s !== 'granted') { setStatus('denied'); setLoading(false); return; }
        setStatus('granted');

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calIds = calendars.map(c => c.id);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);

        const raw = await Calendar.getEventsAsync(calIds, start, end);

        const upcoming = raw
          .filter(e => new Date(e.endDate) > new Date())
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .map(e => ({
            id: e.id,
            title: e.title,
            startDate: new Date(e.startDate),
            endDate: new Date(e.endDate),
            notes: e.notes ?? undefined,
            url: e.url ?? undefined,
            location: e.location ?? undefined,
            calendarId: e.calendarId,
          }));

        setEvents(upcoming);
      } catch {
        setStatus('denied');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBotToggle = (eventId: string, value: boolean) => {
    setBotToggles(prev => ({ ...prev, [eventId]: value }));
    if (value) {
      Alert.alert(
        'Record this meeting',
        'An AI bot will join and transcribe this meeting. This feature requires the meeting link to be in the calendar event.',
        [{ text: 'OK' }],
      );
    }
  };

  if (loading) return <ActivityIndicator color="#5B8DEF" style={{ marginTop: 32 }} />;

  if (status === 'denied') {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
        <Ionicons name="calendar-outline" size={40} color="#d1d5db" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>Calendar access needed</Text>
        <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 }}>
          Allow calendar access in Settings to see your upcoming meetings.
        </Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
        <Ionicons name="calendar-outline" size={40} color="#d1d5db" />
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151' }}>No upcoming meetings</Text>
        <Text style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 }}>
          Events from the next 7 days will appear here.
        </Text>
      </View>
    );
  }

  // Group by date
  const byDate: Record<string, CalEvent[]> = {};
  events.forEach(e => {
    const key = e.startDate.toDateString();
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(e);
  });

  return (
    <View style={{ gap: 24 }}>
      {Object.entries(byDate).map(([dateKey, dayEvents]) => {
        const d = new Date(dateKey);
        const isToday = d.toDateString() === new Date().toDateString();
        const label = isToday
          ? 'Today'
          : d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        return (
          <View key={dateKey} style={{ gap: 12 }}>
            <Text style={styles.sectionLabel}>{label}</Text>
            {dayEvents.map(ev => (
              <CalendarEventCard
                key={ev.id}
                event={ev}
                botEnabled={botToggles[ev.id] ?? false}
                onToggle={handleBotToggle}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<HomeTab>('feed');

  const firstName = user?.firstName ?? user?.username ?? 'there';

  const { data, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery(
    { limit: 50 },
    { refetchInterval: 20_000 },
  );
  const recordings: Recording[] = (data as any)?.recordings ?? (data as any)?.items ?? (Array.isArray(data) ? data : []);

  // Stable getToken ref for child components that fetch lazily
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  // Detect PROCESSING→READY transitions and fire local notifications
  const prevStatusesRef = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    if (!recordings.length) return;
    prevStatusesRef.current = detectReadyTransitions(
      recordings.map(r => ({ id: r.id, title: r.title, status: r.status })),
      prevStatusesRef.current,
    );
  }, [recordings]);

  const readyQueue = useReadyStore(s => s.queue);
  const dismissReady = useReadyStore(s => s.dismiss);

  const handleCardPress = useCallback((id: string) => {
    (navigation as any).navigate('Recordings', {
      screen: 'RecordingDetail',
      params: { id },
    });
  }, [navigation]);

  const tabs: { key: HomeTab; label: string; icon: string }[] = [
    { key: 'feed', label: 'My Feed', icon: 'home-outline' },
    { key: 'tasks', label: 'Tasks', icon: 'checkmark-circle-outline' },
    { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor="#5B8DEF"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {firstName}</Text>
          <Text style={styles.greetingSub}>Your meetings at a glance</Text>
        </View>
        <TouchableOpacity
          style={styles.recordBtn}
          onPress={() => navigation.navigate('Record')}
          activeOpacity={0.8}
        >
          <Ionicons name="mic" size={18} color="#ffffff" />
          <Text style={styles.recordBtnText}>Record</Text>
        </TouchableOpacity>
      </View>

      {/* Ready banner */}
      {readyQueue.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.readyBanner}
          activeOpacity={0.85}
          onPress={() => {
            dismissReady(item.id);
            handleCardPress(item.id);
          }}
        >
          <View style={styles.readyIcon}>
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.readyTitle}>Notes are ready</Text>
            <Text style={styles.readySub} numberOfLines={1}>{item.title}</Text>
          </View>
          <TouchableOpacity
            onPress={() => dismissReady(item.id)}
            hitSlop={10}
            style={styles.readyClose}
          >
            <Ionicons name="close" size={16} color="#ffffffcc" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}

      {/* Tabs */}
      <View style={styles.tabBar}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabItem, activeTab === t.key && styles.tabItemActive]}
            onPress={() => setActiveTab(t.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={t.icon as never}
              size={16}
              color={activeTab === t.key ? '#5B8DEF' : '#9ca3af'}
            />
            <Text style={[styles.tabLabel, activeTab === t.key && styles.tabLabelActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'feed' && (
        <FeedTab
          recordings={recordings}
          isLoading={isLoading}
          onRefresh={() => void refetch()}
          isRefreshing={isRefetching}
          onCardPress={handleCardPress}
        />
      )}
      {activeTab === 'tasks' && (
        <TasksTab
          recordings={recordings}
          isLoading={isLoading}
          getTokenRef={getTokenRef}
          onNavigate={handleCardPress}
        />
      )}
      {activeTab === 'calendar' && <CalendarTab />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 24, fontWeight: '700', color: '#111827', letterSpacing: -0.4 },
  greetingSub: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  recordBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#5B8DEF', paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 24,
  },
  recordBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 9, borderRadius: 10,
  },
  tabItemActive: { backgroundColor: '#ffffff' },
  tabLabel: { fontSize: 13, fontWeight: '500', color: '#9ca3af' },
  tabLabelActive: { color: '#5B8DEF', fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readyIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#ffffff25',
    alignItems: 'center', justifyContent: 'center',
  },
  readyTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  readySub: { fontSize: 12, color: '#ffffffcc', marginTop: 1 },
  readyClose: { padding: 4 },
});

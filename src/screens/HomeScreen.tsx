import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import * as Calendar from 'expo-calendar';
import { LinearGradient } from 'expo-linear-gradient';
import { trpc } from '../lib/trpc';
import { trpcGet, trpcPost } from '../lib/api';
import type { Recording, ActionItem } from '../lib/trpc';
import { StatusBadge } from '../components/StatusBadge';
import type { TabParamList } from '../navigation/AppNavigator';
import { detectReadyTransitions, useReadyStore } from '../lib/notifications';
import { useTheme } from '../lib/theme';

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        fontSize: 13,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {children}
    </Text>
  );
}

// ─── Feed Card ────────────────────────────────────────────────────────────────

function FeedCard({ recording, onPress }: { recording: Recording; onPress: () => void }) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        style={[
          feedCardStyles.wrap,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={feedCardStyles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[feedCardStyles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {recording.title}
            </Text>
            <View style={feedCardStyles.meta}>
              <Text style={[feedCardStyles.metaText, { color: colors.textMuted }]}>
                {formatDateShort(recording.createdAt)}
              </Text>
              {recording.duration != null && (
                <>
                  <Text style={[feedCardStyles.dot, { color: colors.borderStrong }]}>·</Text>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={[feedCardStyles.metaText, { color: colors.textMuted }]}>
                    {formatDuration(recording.duration)}
                  </Text>
                </>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <StatusBadge status={recording.status} size="sm" createdAt={recording.createdAt} />
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </View>
        {recording.status === 'READY' && (
          <View style={[feedCardStyles.notesPill, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="document-text-outline" size={13} color={colors.accent} />
            <Text style={[feedCardStyles.notesText, { color: colors.accent }]}>Notes ready</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const feedCardStyles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 15, fontWeight: '600', lineHeight: 21 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  dot: { fontSize: 12 },
  notesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  notesText: { fontSize: 12, fontWeight: '600' },
});

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

function FeedTab({
  recordings,
  isLoading,
  onCardPress,
}: {
  recordings: Recording[];
  isLoading: boolean;
  onCardPress: (id: string) => void;
}) {
  const { colors } = useTheme();

  if (isLoading) {
    return <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />;
  }

  if (recordings.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
        <Ionicons name="mic-outline" size={40} color={colors.textMuted} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>No recordings yet</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
          Tap &ldquo;Record&rdquo; to get started.
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
          <SectionLabel>This Week</SectionLabel>
          {thisWeek.map(r => (
            <FeedCard key={r.id} recording={r} onPress={() => onCardPress(r.id)} />
          ))}
        </View>
      )}
      {lastWeek.length > 0 && (
        <View style={{ gap: 12 }}>
          <SectionLabel>Last Week</SectionLabel>
          {lastWeek.map(r => (
            <FeedCard key={r.id} recording={r} onPress={() => onCardPress(r.id)} />
          ))}
        </View>
      )}
      {older.length > 0 && (
        <View style={{ gap: 12 }}>
          <SectionLabel>Older</SectionLabel>
          {older.map(r => (
            <FeedCard key={r.id} recording={r} onPress={() => onCardPress(r.id)} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const { colors } = useTheme();
  const map: Record<string, { bg: string; text: string; label: string }> = {
    URGENT: { bg: '#FEE2E2', text: '#DC2626', label: 'Urgent' },
    HIGH:   { bg: '#FEF3C7', text: '#D97706', label: 'High' },
    MEDIUM: { bg: '#DBEAFE', text: '#2563EB', label: 'Medium' },
    LOW:    { bg: colors.surfaceMuted, text: colors.textMuted, label: 'Low' },
  };
  const s = map[priority] ?? map.LOW;
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: s.text }}>{s.label}</Text>
    </View>
  );
}

function TaskItem({
  item,
  onToggle,
}: {
  item: ActionItem;
  onToggle: (id: string, done: boolean) => void;
}) {
  const { colors } = useTheme();
  const isDone = item.status === 'COMPLETED' || item.status === 'CANCELLED';

  return (
    <TouchableOpacity style={taskStyles.item} onPress={() => onToggle(item.id, !isDone)} activeOpacity={0.75}>
      <View
        style={[
          taskStyles.check,
          { borderColor: colors.borderStrong },
          isDone && { backgroundColor: colors.success, borderColor: colors.success },
        ]}
      >
        {isDone && <Ionicons name="checkmark" size={12} color="#fff" />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={[
            taskStyles.itemTitle,
            { color: colors.textPrimary },
            isDone && { textDecorationLine: 'line-through', color: colors.textMuted },
          ]}
        >
          {item.title}
        </Text>
        {(item.assignee || item.dueDate) && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            {item.assignee && (
              <Text style={[taskStyles.meta, { color: colors.textMuted }]}>@{item.assignee}</Text>
            )}
            {item.dueDate && (
              <Text style={[taskStyles.meta, { color: colors.textMuted }]}>
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
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  itemTitle: { fontSize: 14, lineHeight: 20 },
  meta: { fontSize: 12 },
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
  const { colors } = useTheme();
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

  if (loading) return <ActivityIndicator size="small" color={colors.accent} style={{ paddingVertical: 16 }} />;
  if (!items?.length) {
    return (
      <View style={{ paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' }}>
        <Text style={{ fontSize: 13, color: colors.textMuted }}>No action items in this recording</Text>
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {items.map(item => (
        <TaskItem key={item.id} item={item} onToggle={(id, done) => onToggle(recording.id, id, done)} />
      ))}
      <TouchableOpacity onPress={() => onNavigate(recording.id)} style={{ paddingVertical: 8 }}>
        <Text style={{ fontSize: 13, color: colors.accent, fontWeight: '600' }}>Open full recording →</Text>
      </TouchableOpacity>
    </View>
  );
}

function TasksTab({
  recordings,
  isLoading,
  getTokenRef,
  onNavigate,
}: {
  recordings: Recording[];
  isLoading: boolean;
  getTokenRef: React.MutableRefObject<() => Promise<string | null>>;
  onNavigate: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const withNotes = recordings.filter(r => r.status === 'READY');

  const handleToggle = useCallback(async (recordingId: string, actionId: string, done: boolean) => {
    try {
      const token = await getTokenRef.current();
      await trpcPost('recordings.updateActionItem', { id: actionId, status: done ? 'COMPLETED' : 'OPEN' }, token);
    } catch {
      Alert.alert('Error', 'Could not update action item.');
    }
  }, [getTokenRef]);

  if (isLoading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />;

  if (withNotes.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
        <Ionicons name="checkmark-circle-outline" size={40} color={colors.textMuted} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>No tasks yet</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
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
          <View
            key={r.id}
            style={[
              taskSectionStyles.section,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[taskSectionStyles.header, { backgroundColor: colors.surfaceMuted }]}
              onPress={() =>
                setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(r.id)) next.delete(r.id);
                  else next.add(r.id);
                  return next;
                })
              }
              activeOpacity={0.75}
            >
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[taskSectionStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                  {r.title}
                </Text>
                <Text style={[taskSectionStyles.sub, { color: colors.textMuted }]}>
                  {formatDateShort(r.createdAt)}
                </Text>
              </View>
              <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
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
  section: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  title: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12 },
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

function CalendarEventCard({
  event,
  botEnabled,
  onToggle,
}: {
  event: CalEvent;
  botEnabled: boolean;
  onToggle: (id: string, value: boolean) => void;
}) {
  const { colors } = useTheme();
  const icon = platformIcon(event.title, event.url);
  const duration = Math.round((event.endDate.getTime() - event.startDate.getTime()) / 60_000);
  const now = new Date();
  const isNow = event.startDate <= now && event.endDate >= now;

  return (
    <View
      style={[
        calStyles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isNow && { borderColor: colors.accent, borderWidth: 1.5 },
      ]}
    >
      {isNow && (
        <View style={[calStyles.nowBadge, { backgroundColor: colors.accent }]}>
          <Text style={calStyles.nowBadgeText}>Now</Text>
        </View>
      )}
      <View style={calStyles.cardRow}>
        <View
          style={[
            calStyles.iconWrap,
            { backgroundColor: isNow ? colors.accentSoft : colors.surfaceMuted },
          ]}
        >
          <Ionicons name={icon as never} size={20} color={isNow ? colors.accent : colors.textSecondary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[calStyles.eventTitle, { color: colors.textPrimary }]} numberOfLines={2}>
            {event.title}
          </Text>
          <View style={calStyles.metaRow}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={[calStyles.metaText, { color: colors.textMuted }]}>
              {formatTime(event.startDate)} · {duration}m
            </Text>
            {event.location ? (
              <>
                <Text style={[calStyles.dot, { color: colors.borderStrong }]}>·</Text>
                <Text style={[calStyles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
                  {event.location}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
      <View style={[calStyles.botRow, { borderTopColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[calStyles.botLabel, { color: colors.textSecondary }]}>Record with AI bot</Text>
          <Text style={[calStyles.botSub, { color: colors.textMuted }]}>
            Auto-join and transcribe this meeting
          </Text>
        </View>
        <Switch
          value={botEnabled}
          onValueChange={v => onToggle(event.id, v)}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#ffffff"
        />
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  card: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12 },
  cardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, flex: 1 },
  dot: { fontSize: 12 },
  botRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  botLabel: { fontSize: 13, fontWeight: '600' },
  botSub: { fontSize: 11, marginTop: 1 },
  nowBadge: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  nowBadgeText: { fontSize: 11, color: '#fff', fontWeight: '700' },
});

function CalendarTab() {
  const { colors } = useTheme();
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

  if (loading) return <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />;

  if (status === 'denied') {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 12 }}>
        <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
          Calendar access needed
        </Text>
        <Text
          style={{
            fontSize: 14, color: colors.textMuted,
            textAlign: 'center', lineHeight: 20, paddingHorizontal: 20,
          }}
        >
          Allow calendar access in Settings to see your upcoming meetings.
        </Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 40, gap: 10 }}>
        <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
          No upcoming meetings
        </Text>
        <Text style={{ fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
          Events from the next 7 days will appear here.
        </Text>
      </View>
    );
  }

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
            <SectionLabel>{label}</SectionLabel>
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
  const { colors, isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<HomeTab>('feed');

  const firstName = user?.firstName ?? user?.username ?? 'there';

  const { data, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery(
    { limit: 50 },
    { refetchInterval: 20_000 },
  );
  const recordings: Recording[] =
    (data as any)?.recordings ?? (data as any)?.items ?? (Array.isArray(data) ? data : []);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

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

  // Subscription / trial banner — silently no-ops if procedure isn't deployed.
  const [subscription, setSubscription] = useState<{
    plan: string;
    status: string;
    trialEndsAt: string | null;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const data = await trpcGet<{ plan: string; status: string; trialEndsAt: string | null }>(
          'billing.getSubscription',
          {},
          token,
        );
        if (!cancelled) setSubscription(data);
      } catch {
        // procedure may not be deployed — banner just stays hidden
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const trialBanner = useMemo(() => {
    if (!subscription || subscription.plan !== 'FREE') return null;
    if (!subscription.trialEndsAt) return null;
    const ms = new Date(subscription.trialEndsAt).getTime() - Date.now();
    const daysLeft = Math.ceil(ms / 86_400_000);
    if (ms <= 0) {
      return { tone: 'expired' as const, message: 'Your trial has ended — Upgrade to continue' };
    }
    if (daysLeft <= 7) {
      return {
        tone: 'warning' as const,
        message: `\u26A0\uFE0F Trial ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} \u2014 Upgrade to keep access`,
      };
    }
    return null;
  }, [subscription]);

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
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.accent}
          />
        }
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={
            isDark
              ? ['#1a0a0a', '#2d1515', '#1a1a2e']
              : ['#fff8f8', '#ffe8e8', '#f0f0ff']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.greeting, { color: isDark ? '#ffffff' : '#111827' }]}>
                Hello, {firstName}
              </Text>
              <Text
                style={[
                  styles.greetingSub,
                  { color: isDark ? 'rgba(255,255,255,0.75)' : colors.textSecondary },
                ]}
              >
                Your meetings at a glance
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.recordBtn, { backgroundColor: colors.accent }]}
              onPress={() => (navigation as any).navigate('Record')}
              activeOpacity={0.85}
            >
              <Ionicons name="mic" size={18} color="#ffffff" />
              <Text style={[styles.recordBtnText, { color: '#ffffff' }]}>Record</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {trialBanner && (
          <TouchableOpacity
            style={[
              styles.trialBanner,
              trialBanner.tone === 'expired'
                ? { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }
                : { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
            ]}
            activeOpacity={0.85}
            onPress={() => (navigation as any).navigate('Settings', { screen: 'Billing' })}
          >
            <Ionicons
              name={trialBanner.tone === 'expired' ? 'alert-circle' : 'time-outline'}
              size={20}
              color={trialBanner.tone === 'expired' ? '#7F1D1D' : '#92400E'}
            />
            <Text
              style={[
                styles.trialBannerText,
                { color: trialBanner.tone === 'expired' ? '#7F1D1D' : '#92400E' },
              ]}
              numberOfLines={2}
            >
              {trialBanner.message}
            </Text>
            <View
              style={[
                styles.trialBannerCta,
                {
                  backgroundColor: trialBanner.tone === 'expired' ? '#7F1D1D' : '#92400E',
                },
              ]}
            >
              <Text style={styles.trialBannerCtaText}>Upgrade</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          {/* Quick-access cards — Knowledge & Templates */}
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => (navigation as any).navigate('Knowledge')}
              activeOpacity={0.85}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="library-outline" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>Knowledge Base</Text>
              <Text style={[styles.quickSub, { color: colors.textMuted }]} numberOfLines={2}>
                People & topics from meetings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => (navigation as any).navigate('Templates')}
              activeOpacity={0.85}
            >
              <View style={[styles.quickIconWrap, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="documents-outline" size={20} color={colors.accent} />
              </View>
              <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>Templates</Text>
              <Text style={[styles.quickSub, { color: colors.textMuted }]} numberOfLines={2}>
                Reusable meeting prompts
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ready banner */}
          {readyQueue.map(item => (
            <TouchableOpacity
              key={item.id}
              style={[styles.readyBanner, { backgroundColor: colors.success }]}
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
              <TouchableOpacity onPress={() => dismissReady(item.id)} hitSlop={10} style={styles.readyClose}>
                <Ionicons name="close" size={16} color="#ffffffcc" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}

          {/* Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.surfaceMuted }]}>
            {tabs.map(t => {
              const active = activeTab === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tabItem, active && { backgroundColor: colors.surface }]}
                  onPress={() => setActiveTab(t.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={t.icon as never}
                    size={16}
                    color={active ? colors.accent : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.tabLabel,
                      { color: active ? colors.accent : colors.textMuted, fontWeight: active ? '700' : '500' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {activeTab === 'feed' && (
            <FeedTab recordings={recordings} isLoading={isLoading} onCardPress={handleCardPress} />
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
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerGradient: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 26, fontWeight: '800', color: '#ffffff', letterSpacing: -0.4 },
  greetingSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 3,
  },
  recordBtnText: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabLabel: { fontSize: 13 },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  readyIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff25',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readyTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  readySub: { fontSize: 12, color: '#ffffffcc', marginTop: 1 },
  readyClose: { padding: 4 },
  trialBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  trialBannerText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  trialBannerCta: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  trialBannerCtaText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { fontSize: 14, fontWeight: '700' },
  quickSub: { fontSize: 12, lineHeight: 16 },
});

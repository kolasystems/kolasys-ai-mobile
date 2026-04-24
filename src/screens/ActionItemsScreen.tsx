import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { trpcGet, trpcPost } from '../lib/api';
import { useTheme } from '../lib/theme';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
type Filter = 'all' | 'open' | 'completed';

interface ActionItem {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  priority: Priority;
  meetingId: string | null;
  meetingTitle: string | null;
  createdAt: string;
}

const PRIORITY_COLOR: Record<Priority, { bg: string; text: string; label: string }> = {
  LOW:    { bg: '#E5E7EB', text: '#4B5563', label: 'Low' },
  MEDIUM: { bg: '#FEF3C7', text: '#B45309', label: 'Medium' },
  HIGH:   { bg: '#FEE2E2', text: '#CA2625', label: 'High' },
};

function formatDueDate(iso: string): string {
  const d = new Date(iso);
  return `Due ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function SkeletonCard() {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [opacity]);
  return (
    <Animated.View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity, height: 74 },
      ]}
    />
  );
}

export default function ActionItemsScreen() {
  const { colors, isDark } = useTheme();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const load = useCallback(async (silent = false) => {
    if (!silent) setItems(null);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const data = await trpcGet<ActionItem[]>('actionItem.list', {}, token);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load action items.');
      setItems([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    void load(true);
  };

  const toggleComplete = async (item: ActionItem) => {
    const next = !item.completed;
    setItems((prev) => prev?.map((x) => (x.id === item.id ? { ...x, completed: next } : x)) ?? null);
    try {
      const token = await getTokenRef.current();
      await trpcPost('actionItem.update', { id: item.id, completed: next }, token);
    } catch {
      // Revert on failure
      setItems((prev) => prev?.map((x) => (x.id === item.id ? { ...x, completed: !next } : x)) ?? null);
    }
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === 'open') return items.filter((i) => !i.completed);
    if (filter === 'completed') return items.filter((i) => i.completed);
    return items;
  }, [items, filter]);

  const openCount = items?.filter((i) => !i.completed).length ?? 0;

  const gradientColors: [string, string] = isDark
    ? ['#1a0a0a', '#2d1515']
    : ['#fff5f5', '#ffe0e0'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Action Items</Text>
          <View style={[styles.countBadge, { backgroundColor: colors.accent }]}>
            <Text style={styles.countBadgeText}>{openCount} open</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['all', 'open', 'completed'] as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.accent : colors.surface,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setFilter(f)}
                activeOpacity={0.8}
              >
                <Text
                  style={{
                    color: active ? '#ffffff' : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {items === null ? (
        <View style={styles.list}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                {error ? 'Could not load' : 'No action items yet'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 }}>
                {error ?? 'Action items extracted from your meetings will show up here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const p = PRIORITY_COLOR[item.priority];
            return (
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => toggleComplete(item)}
                  style={[
                    styles.checkbox,
                    { borderColor: item.completed ? colors.accent : colors.borderStrong },
                    item.completed && { backgroundColor: colors.accent },
                  ]}
                  activeOpacity={0.7}
                >
                  {item.completed && <Ionicons name="checkmark" size={14} color="#ffffff" />}
                </TouchableOpacity>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: item.completed ? colors.textMuted : colors.textPrimary },
                      item.completed && { textDecorationLine: 'line-through' },
                    ]}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: p.bg }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: p.text }}>{p.label}</Text>
                    </View>
                    {item.dueDate && (
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {formatDueDate(item.dueDate)}
                      </Text>
                    )}
                    {item.meetingTitle && (
                      <View style={[styles.meetingChip, { backgroundColor: colors.surfaceMuted }]}>
                        <Ionicons name="mic-outline" size={10} color={colors.textMuted} />
                        <Text style={{ fontSize: 10, color: colors.textMuted }} numberOfLines={1}>
                          {item.meetingTitle}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countBadgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  filterRow: { gap: 8, paddingRight: 20 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  list: { padding: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  meetingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    maxWidth: 160,
  },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
});

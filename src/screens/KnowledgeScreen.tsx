import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { trpcGet } from '../lib/api';
import { useTheme } from '../lib/theme';

type EntryType = 'PERSON' | 'COMPANY' | 'TOPIC';

interface KnowledgeEntry {
  id: string;
  type: EntryType;
  name: string;
  summary: string;
  mentionCount: number;
  lastMentioned: string;
  avatarUrl: string | null;
}

const TYPE_ORDER: EntryType[] = ['PERSON', 'COMPANY', 'TOPIC'];
const TYPE_LABEL: Record<EntryType, string> = {
  PERSON: 'People',
  COMPANY: 'Companies',
  TOPIC: 'Topics',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join('') || '?';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function KnowledgeScreen() {
  const { colors, isDark } = useTheme();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<KnowledgeEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const load = useCallback(async (silent = false) => {
    if (!silent) setEntries(null);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const data = await trpcGet<KnowledgeEntry[]>('knowledge.list', {}, token);
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge.');
      setEntries([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    if (!entries) return {} as Record<EntryType, KnowledgeEntry[]>;
    const q = query.trim().toLowerCase();
    const match = q
      ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q))
      : entries;
    const byType: Record<EntryType, KnowledgeEntry[]> = { PERSON: [], COMPANY: [], TOPIC: [] };
    for (const e of match) byType[e.type].push(e);
    return byType;
  }, [entries, query]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const gradientColors: [string, string] = isDark
    ? ['#1a0a0a', '#2d1515']
    : ['#fff5f5', '#ffe0e0'];

  const totalCount = entries ? Object.values(filtered).reduce((n, arr) => n + arr.length, 0) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Knowledge</Text>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people, companies, topics…"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={colors.accent}
          />
        }
      >
        {entries === null ? (
          <View style={styles.empty}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Loading…</Text>
          </View>
        ) : totalCount === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles-outline" size={48} color={colors.textMuted} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
              {error ? 'Could not load' : 'Your knowledge base will auto-build from meetings'}
            </Text>
            {error && (
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 24 }}>
                {error}
              </Text>
            )}
          </View>
        ) : (
          TYPE_ORDER.map((type) => {
            const rows = filtered[type];
            if (!rows || rows.length === 0) return null;
            return (
              <View key={type} style={{ marginBottom: 20 }}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  {TYPE_LABEL[type]}
                </Text>
                {rows.map((entry) => {
                  const isOpen = expanded.has(entry.id);
                  return (
                    <TouchableOpacity
                      key={entry.id}
                      style={[
                        styles.card,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                      onPress={() => toggleExpand(entry.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                        <Text style={styles.avatarText}>{initials(entry.name)}</Text>
                      </View>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                          {entry.name}
                        </Text>
                        <Text
                          style={[styles.summary, { color: colors.textSecondary }]}
                          numberOfLines={isOpen ? undefined : 1}
                        >
                          {entry.summary}
                        </Text>
                        {isOpen && (
                          <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                            Last mentioned {formatDate(entry.lastMentioned)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.countChip, { backgroundColor: colors.accentSoft }]}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>
                          {entry.mentionCount}×
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingLeft: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '700' },
  summary: { fontSize: 13, lineHeight: 18 },
  countChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
});

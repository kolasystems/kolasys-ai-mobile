import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { trpc } from '../lib/trpc';

function formatTalkTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function relativeDate(date: Date | string | null): string {
  if (!date) return '—';
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function initials(name: string): string {
  return name
    .split(/[\s_]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// A deterministic colour from the name string
const AVATAR_COLORS = [
  '#CA2625', '#2563EB', '#7C3AED', '#059669',
  '#D97706', '#0891B2', '#DB2777', '#65A30D',
];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default function ContactsScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const { data, isLoading, error } = trpc.contacts.list.useQuery();

  const contacts = (data ?? []).filter((c: any) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search */}
      <View style={[styles.searchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search contacts…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {error && (
        <View style={styles.center}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Failed to load contacts</Text>
        </View>
      )}

      {!isLoading && !error && contacts.length === 0 && (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {query ? 'No contacts found' : 'No contacts yet'}
          </Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            {query
              ? 'Try a different search term'
              : 'Contacts are auto-extracted from meeting transcripts. Name speakers in your recordings to build your directory.'}
          </Text>
        </View>
      )}

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.name}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: avatarColor(item.name) }]}>
              <Text style={styles.avatarText}>{initials(item.name)}</Text>
            </View>
            <View style={styles.cardContent}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.meta}>
                <MetaPill icon="mic-outline" label={`${item.meetings} meeting${item.meetings !== 1 ? 's' : ''}`} colors={colors} />
                <MetaPill icon="time-outline" label={formatTalkTime(item.totalTalkSeconds)} colors={colors} />
                <MetaPill icon="calendar-outline" label={relativeDate(item.lastSeen)} colors={colors} />
              </View>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function MetaPill({
  icon, label, colors,
}: {
  icon: string; label: string; colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.pill, { backgroundColor: colors.surfaceMuted ?? colors.surface }]}>
      <Ionicons name={icon as never} size={11} color={colors.textMuted} />
      <Text style={[styles.pillText, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardContent: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  pillText: { fontSize: 11 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyBody: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { trpc } from '../lib/trpc';
import type { Recording } from '../lib/trpc';
import { RecordingCard } from '../components/RecordingCard';
import type { TabParamList } from '../navigation/AppNavigator';

type Nav = BottomTabNavigationProp<TabParamList>;

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as never} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const firstName = user?.firstName ?? user?.username ?? 'there';

  const { data, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery({ limit: 20 });

  const recordings: Recording[] = (data as any)?.recordings ?? (data as any)?.items ?? (Array.isArray(data) ? data : []);

  const totalRecordings = recordings.length;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const notesThisWeek = recordings.filter(
    (r) => r.status === 'READY' && new Date(r.createdAt).getTime() > oneWeekAgo,
  ).length;
  const openActions = recordings.reduce((acc, r) => {
    const open = r.note?.actionItems?.filter((a) => a.status === 'OPEN' || a.status === 'IN_PROGRESS').length ?? 0;
    return acc + open;
  }, 0);

  const recentRecordings = recordings.slice(0, 5);

  const handleCardPress = useCallback(
    (id: string) => {
      // Navigate to the Recordings tab → RecordingDetail
      (navigation as any).navigate('Recordings', {
        screen: 'RecordingDetail',
        params: { id },
      });
    },
    [navigation],
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor="#5B8DEF" />
      }
    >
      {/* Greeting */}
      <View style={styles.greeting}>
        <Text style={styles.greetingText}>Hello, {firstName} 👋</Text>
        <Text style={styles.greetingSubtitle}>Here's your meeting overview</Text>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <StatCard icon="mic" label="Recordings" value={totalRecordings} color="#5B8DEF" />
        <StatCard icon="document-text" label="Notes This Week" value={notesThisWeek} color="#10B981" />
        <StatCard icon="checkmark-circle" label="Open Actions" value={openActions} color="#F59E0B" />
      </View>

      {/* New Recording button */}
      <TouchableOpacity
        style={styles.recordButton}
        onPress={() => navigation.navigate('Record')}
        activeOpacity={0.8}
      >
        <Ionicons name="mic" size={20} color="#ffffff" />
        <Text style={styles.recordButtonText}>New Recording</Text>
      </TouchableOpacity>

      {/* Recent recordings */}
      <Text style={styles.sectionTitle}>Recent Recordings</Text>

      {isLoading ? (
        <ActivityIndicator color="#5B8DEF" style={{ marginTop: 24 }} />
      ) : recentRecordings.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="mic-outline" size={40} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No recordings yet</Text>
          <Text style={styles.emptySubtitle}>Tap "New Recording" to get started.</Text>
        </View>
      ) : (
        recentRecordings.map((r) => (
          <RecordingCard key={r.id} recording={r} onPress={() => handleCardPress(r.id)} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  greeting: { gap: 4 },
  greetingText: { fontSize: 26, fontWeight: '700', color: '#111827', letterSpacing: -0.5 },
  greetingSubtitle: { fontSize: 14, color: '#6b7280' },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderTopWidth: 3,
    padding: 12,
    gap: 6,
    backgroundColor: '#ffffff',
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 11, color: '#6b7280', lineHeight: 14 },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B8DEF',
    borderRadius: 14,
    height: 52,
    gap: 8,
  },
  recordButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: -8 },
  empty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
});

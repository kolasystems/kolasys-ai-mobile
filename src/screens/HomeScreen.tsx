import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { trpc } from '../lib/trpc';
import { RecordingCard } from '../components/RecordingCard';
import { Colors } from '../lib/theme';
import type { TabParamList } from '../navigation/AppNavigator';

type Nav = BottomTabNavigationProp<TabParamList>;

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as never} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useUser();
  const navigation = useNavigation<Nav>();

  const {
    data: recordings,
    isLoading,
    refetch,
    isRefetching,
  } = trpc.recordings.list.useQuery({ limit: 5 }, { staleTime: 30_000 });

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const items = (recordings?.items ?? []) as import('../lib/trpc').Recording[];
  const readyCount = items.filter((r) => r.status === 'READY').length;
  const processingCount = items.filter(
    (r) => r.status === 'PROCESSING' || r.status === 'TRANSCRIBING' || r.status === 'SUMMARIZING'
  ).length;

  const firstName = user?.firstName ?? user?.username ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor={Colors.primary} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{firstName} 👋</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.avatarInitial}>
            {(user?.firstName ?? 'K').charAt(0).toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <StatCard icon="mic-outline" label="Total recordings" value={items.length} color={Colors.primary} />
        <StatCard icon="document-text-outline" label="Notes ready" value={readyCount} color={Colors.ready} />
        <StatCard icon="time-outline" label="Processing" value={processingCount} color={Colors.pending} />
      </View>

      {/* Record CTA */}
      <TouchableOpacity
        style={styles.recordCTA}
        onPress={() => navigation.navigate('Record')}
        activeOpacity={0.85}
      >
        <View style={styles.recordCTAContent}>
          <View style={styles.recordCTAIcon}>
            <Ionicons name="mic" size={26} color={Colors.white} />
          </View>
          <View style={styles.recordCTAText}>
            <Text style={styles.recordCTATitle}>Start Recording</Text>
            <Text style={styles.recordCTASubtitle}>Capture your next meeting</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.white + 'BB'} />
      </TouchableOpacity>

      {/* Recent Recordings */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Recordings</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Recordings')}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Colors.primary} style={styles.loader} />
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="mic-off-outline" size={32} color="#9ca3af" />
            <Text style={styles.emptyText}>No recordings yet. Tap "Start Recording" to begin.</Text>
          </View>
        ) : (
          items.map((recording) => (
            <RecordingCard
              key={recording.id}
              recording={recording}
              onPress={() =>
                navigation.navigate('Recordings', {
                  screen: 'RecordingDetail',
                  params: { id: recording.id },
                } as never)
              }
            />
          ))
        )}
      </View>

      {/* Upcoming Meetings shortcut */}
      <TouchableOpacity
        style={styles.calendarBanner}
        onPress={() => navigation.navigate('Calendar')}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
        <Text style={styles.calendarBannerText}>View upcoming calendar meetings</Text>
        <Ionicons name="chevron-forward" size={16} color="#6b7280" />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 20, gap: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 14, color: '#6b7280' },
  name: { fontSize: 24, fontWeight: '700', letterSpacing: -0.3, color: '#111827' },
  avatarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '20',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: Colors.primary },
  stats: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  statLabel: { fontSize: 10, textAlign: 'center', color: '#6b7280' },
  recordCTA: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordCTAContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  recordCTAIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordCTAText: { gap: 2 },
  recordCTATitle: { color: Colors.white, fontSize: 17, fontWeight: '700' },
  recordCTASubtitle: { color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  section: { gap: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  loader: { marginTop: 20 },
  empty: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    gap: 10,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20, color: '#6b7280' },
  calendarBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  calendarBannerText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#111827' },
});

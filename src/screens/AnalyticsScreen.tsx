import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../lib/theme';
import { trpc } from '../lib/trpc';
import type { SettingsStackParamList } from '../navigation/AppNavigator';

function formatDuration(secs: number): string {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

type Nav = NativeStackNavigationProp<SettingsStackParamList>;

export default function AnalyticsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { data, isLoading, error } = trpc.analytics.getStats.useQuery();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} style={{ marginBottom: 12 }} />
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Failed to load analytics</Text>
      </View>
    );
  }

  const maxWeekCount = Math.max(...data.weeklyData.map((w: any) => w.count), 1);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Stat cards */}
      <View style={styles.statsGrid}>
        <StatCard
          label="Total Meetings"
          value={String(data.totalMeetings)}
          icon="mic-outline"
          colors={colors}
        />
        <StatCard
          label="Avg Duration"
          value={formatDuration(Math.round(data.avgDuration))}
          icon="time-outline"
          colors={colors}
        />
        <StatCard
          label="Action Items"
          value={String(data.totalActionItems)}
          icon="checkmark-circle-outline"
          colors={colors}
        />
        <StatCard
          label="Total Time"
          value={formatDuration(data.totalDuration)}
          icon="hourglass-outline"
          colors={colors}
        />
      </View>

      {/* Weekly meeting frequency */}
      <SectionCard title="Meeting Frequency" subtitle="Last 12 weeks" colors={colors}>
        <View style={styles.chart}>
          {data.weeklyData.map((week: any, i: number) => {
            const pct = maxWeekCount > 0 ? week.count / maxWeekCount : 0;
            const barH = Math.max(pct * 80, week.count > 0 ? 6 : 2);
            return (
              <View key={i} style={styles.barCol}>
                <Text style={[styles.barCount, { color: colors.textMuted }]}>
                  {week.count > 0 ? week.count : ''}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barH,
                        backgroundColor: week.count > 0 ? colors.accent : colors.border,
                        borderRadius: 3,
                      },
                    ]}
                  />
                </View>
                {(i === 0 || i === 5 || i === 11) && (
                  <Text style={[styles.barLabel, { color: colors.textMuted }]} numberOfLines={1}>
                    {week.label}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </SectionCard>

      {/* Speaker talk time */}
      {data.speakerTalkTime.length > 0 && (
        <SectionCard title="Speaker Talk Time" subtitle="Top 8 across all meetings" colors={colors}>
          <View style={styles.speakerList}>
            {data.speakerTalkTime.map((speaker: any, i: number) => {
              const maxSecs = data.speakerTalkTime[0]?.seconds ?? 1;
              const pct = Math.round((speaker.seconds / maxSecs) * 100);
              return (
                <View key={i} style={styles.speakerRow}>
                  <View style={[styles.speakerRank, { backgroundColor: colors.accent + '15' }]}>
                    <Text style={[styles.speakerRankText, { color: colors.accent }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.speakerInfo}>
                    <View style={styles.speakerNameRow}>
                      <Text style={[styles.speakerName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {speaker.name}
                      </Text>
                      <Text style={[styles.speakerTime, { color: colors.textMuted }]}>
                        {formatDuration(speaker.seconds)}
                      </Text>
                    </View>
                    <View style={[styles.speakerTrack, { backgroundColor: colors.border }]}>
                      <View style={[styles.speakerBar, { width: `${pct}%`, backgroundColor: colors.accent }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </SectionCard>
      )}

      {/* Recent recordings */}
      {data.recentRecordings.length > 0 && (
        <SectionCard title="Recent Meetings" subtitle="Last 10" colors={colors}>
          {data.recentRecordings.map((rec: any, i: number) => (
            <View
              key={rec.id}
              style={[
                styles.recRow,
                { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth },
              ]}
            >
              <View style={styles.recInfo}>
                <Text style={[styles.recTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {rec.title}
                </Text>
                <Text style={[styles.recMeta, { color: colors.textMuted }]}>
                  {new Date(rec.createdAt).toLocaleDateString()}
                  {rec.duration ? `  ·  ${formatDuration(rec.duration)}` : ''}
                </Text>
              </View>
              <View style={styles.recBadges}>
                {rec.noteCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: colors.accent + '15' }]}>
                    <Text style={[styles.badgeText, { color: colors.accent }]}>
                      {rec.noteCount} note{rec.noteCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                {rec.actionItemCount > 0 && (
                  <View style={[styles.badge, { backgroundColor: '#10B98115' }]}>
                    <Text style={[styles.badgeText, { color: '#059669' }]}>
                      {rec.actionItemCount} action{rec.actionItemCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function StatCard({
  label, value, icon, colors,
}: {
  label: string; value: string; icon: string; colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name={icon as never} size={18} color={colors.accent} style={{ marginBottom: 8 }} />
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function SectionCard({
  title, subtitle, children, colors,
}: {
  title: string; subtitle?: string; children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle && <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1,
    minWidth: '44%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'flex-start',
  },
  statValue: { fontSize: 24, fontWeight: '700', lineHeight: 28 },
  statLabel: { fontSize: 11, marginTop: 2 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '600' },
  sectionSubtitle: { fontSize: 11 },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 12,
    height: 120,
    gap: 2,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 },
  barTrack: { width: '100%', alignItems: 'center', justifyContent: 'flex-end', height: 80 },
  bar: { width: '80%' },
  barCount: { fontSize: 9 },
  barLabel: { fontSize: 8 },
  speakerList: { paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  speakerRank: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  speakerRankText: { fontSize: 11, fontWeight: '700' },
  speakerInfo: { flex: 1, gap: 5 },
  speakerNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  speakerName: { fontSize: 14, fontWeight: '500', flex: 1 },
  speakerTime: { fontSize: 12 },
  speakerTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  speakerBar: { height: 4, borderRadius: 2 },
  recRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  recInfo: { flex: 1 },
  recTitle: { fontSize: 14, fontWeight: '500' },
  recMeta: { fontSize: 11, marginTop: 2 },
  recBadges: { flexDirection: 'row', gap: 5, flexShrink: 0 },
  badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 10, fontWeight: '600' },
});

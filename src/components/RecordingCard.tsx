import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
import { useTheme } from '../lib/theme';
import type { Recording } from '../lib/trpc';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  recording: Recording;
  onPress: () => void;
}

export function RecordingCard({ recording, onPress }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const sourceIcon =
    recording.source === 'MEETING_BOT'
      ? 'videocam-outline'
      : recording.source === 'BROWSER'
      ? 'globe-outline'
      : 'cloud-upload-outline';

  const handlePressIn = () =>
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const handlePressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginBottom: 10 }}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
      >
        <View style={styles.top}>
          <View style={styles.titleRow}>
            <Ionicons name={sourceIcon} size={14} color={colors.textMuted} />
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {recording.title}
            </Text>
          </View>
          <StatusBadge status={recording.status} size="sm" createdAt={recording.createdAt} />
        </View>
        <View style={styles.meta}>
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {formatDate(recording.createdAt)}
          </Text>
          {recording.duration != null && (
            <>
              <Text style={[styles.dot, { color: colors.borderStrong }]}>·</Text>
              <Ionicons name="time-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {formatDuration(recording.duration)}
              </Text>
            </>
          )}
        </View>
        {recording.note?.summary && (
          <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={2}>
            {recording.note.summary}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  dot: {
    fontSize: 12,
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});

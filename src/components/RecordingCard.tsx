import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from './StatusBadge';
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
  const sourceIcon =
    recording.source === 'MEETING_BOT'
      ? 'videocam-outline'
      : recording.source === 'BROWSER'
      ? 'globe-outline'
      : 'cloud-upload-outline';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Ionicons name={sourceIcon} size={14} color="#6b7280" />
          <Text style={styles.title} numberOfLines={1}>
            {recording.title}
          </Text>
        </View>
        <StatusBadge status={recording.status} size="sm" createdAt={recording.createdAt} />
      </View>
      <View style={styles.meta}>
        <Text style={styles.metaText}>{formatDate(recording.createdAt)}</Text>
        {recording.duration != null && (
          <>
            <Text style={styles.dot}>·</Text>
            <Ionicons name="time-outline" size={12} color="#6b7280" />
            <Text style={styles.metaText}>{formatDuration(recording.duration)}</Text>
          </>
        )}
      </View>
      {recording.note?.summary && (
        <Text style={styles.summary} numberOfLines={2}>
          {recording.note.summary}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 14,
    marginBottom: 10,
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
    color: '#111827',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#6b7280',
  },
  dot: {
    fontSize: 12,
    color: '#9ca3af',
  },
  summary: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    color: '#6b7280',
  },
});

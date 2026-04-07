import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { getThemeColors, Colors } from '../lib/theme';
import type { TranscriptSegment as Segment } from '../lib/trpc';

const SPEAKER_COLORS = [
  Colors.primary,
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
];

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  segment: Segment;
  speakerLabels?: Record<string, string>; // speakerId -> displayName
  speakerIndex?: number; // for color assignment
}

export function TranscriptSegmentRow({ segment, speakerLabels, speakerIndex = 0 }: Props) {
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);

  const speakerColor = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
  const displayName = segment.speaker
    ? speakerLabels?.[segment.speaker] ?? segment.speaker
    : null;

  return (
    <View style={styles.row}>
      <Text style={[styles.timestamp, { color: theme.textMuted }]}>
        {formatTimestamp(segment.startTime)}
      </Text>
      <View style={styles.content}>
        {displayName && (
          <Text style={[styles.speaker, { color: speakerColor }]}>{displayName}</Text>
        )}
        <Text style={[styles.text, { color: theme.text }]}>{segment.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  timestamp: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
    width: 38,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  speaker: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  text: {
    fontSize: 14,
    lineHeight: 21,
  },
});

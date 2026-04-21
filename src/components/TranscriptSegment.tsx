import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, useTheme } from '../lib/theme';
import type { TranscriptSegment as Segment } from '../lib/trpc';

const SPEAKER_COLORS = [
  Colors.primary,
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
];

interface Word {
  word: string;
  start: number;
  end: number;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function parseWords(wordsJson: string | null | undefined): Word[] {
  if (!wordsJson) return [];
  try {
    const parsed = JSON.parse(wordsJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (w): w is Word =>
        typeof w?.word === 'string' &&
        typeof w?.start === 'number' &&
        typeof w?.end === 'number',
    );
  } catch {
    return [];
  }
}

interface Props {
  segment: Segment;
  speakerLabels?: Record<string, string>;
  speakerIndex?: number;
  /** JSON string from server; when present, words are individually tappable
   *  and the current word is highlighted against `playheadSec`. */
  wordsJson?: string | null;
  /** Current audio playhead position in seconds. */
  playheadSec?: number;
  /** Called with the start time (seconds) when a word is tapped. */
  onWordPress?: (startSec: number) => void;
}

export function TranscriptSegmentRow({
  segment,
  speakerLabels,
  speakerIndex = 0,
  wordsJson,
  playheadSec,
  onWordPress,
}: Props) {
  const { colors } = useTheme();
  const speakerColor = SPEAKER_COLORS[speakerIndex % SPEAKER_COLORS.length];
  const displayName = segment.speaker
    ? speakerLabels?.[segment.speaker] ?? segment.speaker
    : null;

  // Parse words once per (wordsJson) change
  const words = useMemo(() => parseWords(wordsJson ?? segment.wordsJson ?? null), [
    wordsJson,
    segment.wordsJson,
  ]);

  return (
    <View style={styles.row}>
      <Text style={[styles.timestamp, { color: colors.textMuted }]}>
        {formatTimestamp(segment.startTime)}
      </Text>
      <View style={styles.content}>
        {displayName && (
          <Text style={[styles.speaker, { color: speakerColor }]}>{displayName}</Text>
        )}
        {words.length > 0 ? (
          <Text style={[styles.text, { color: colors.textPrimary }]}>
            {words.map((w, i) => {
              const isActive =
                playheadSec !== undefined &&
                playheadSec >= w.start &&
                playheadSec < w.end;
              return (
                <Text
                  key={i}
                  onPress={() => onWordPress?.(w.start)}
                  suppressHighlighting
                  style={
                    isActive
                      ? {
                          color: colors.accent,
                          fontWeight: '700',
                          backgroundColor: colors.accentSoft,
                        }
                      : undefined
                  }
                >
                  {w.word}
                  {i < words.length - 1 ? ' ' : ''}
                </Text>
              );
            })}
          </Text>
        ) : (
          <Text style={[styles.text, { color: colors.textPrimary }]}>{segment.text}</Text>
        )}
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

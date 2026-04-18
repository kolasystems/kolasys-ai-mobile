import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, Colors } from '../lib/theme';

type Status = 'PENDING' | 'PROCESSING' | 'TRANSCRIBING' | 'SUMMARIZING' | 'READY' | 'FAILED';

// Hue for each status — used both for the dot and for a soft glow halo.
const STATUS_HUE: Record<Status, string> = {
  PENDING: Colors.pending,
  PROCESSING: Colors.processing,
  TRANSCRIBING: Colors.processing,
  SUMMARIZING: '#8B5CF6',
  READY: Colors.ready,
  FAILED: Colors.failed,
};

const STATUS_LABEL: Record<Status, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  TRANSCRIBING: 'Transcribing',
  SUMMARIZING: 'Summarizing',
  READY: 'Ready',
  FAILED: 'Failed',
};

const IN_PROGRESS_STATUSES: ReadonlySet<Status> = new Set([
  'PENDING',
  'PROCESSING',
  'TRANSCRIBING',
  'SUMMARIZING',
]);
const STUCK_THRESHOLD_MS = 30 * 60_000;
const STUCK_HUE = '#B45309';

export function isStuck(status: Status, createdAt: Date | string | null | undefined): boolean {
  if (!createdAt) return false;
  if (!IN_PROGRESS_STATUSES.has(status)) return false;
  const age = Date.now() - new Date(createdAt).getTime();
  return age > STUCK_THRESHOLD_MS;
}

export function formatStuckAge(createdAt: Date | string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// Tint a hex hue with ~18% alpha for the badge background.
function softBg(hue: string, isDark: boolean): string {
  // Simple hex → rgba conversion; falls back to hue if unexpected input.
  if (!hue.startsWith('#') || (hue.length !== 7 && hue.length !== 4)) return hue;
  const h = hue.length === 4
    ? `#${hue[1]}${hue[1]}${hue[2]}${hue[2]}${hue[3]}${hue[3]}`
    : hue;
  const r = parseInt(h.slice(1, 3), 16);
  const g = parseInt(h.slice(3, 5), 16);
  const b = parseInt(h.slice(5, 7), 16);
  const alpha = isDark ? 0.22 : 0.14;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface Props {
  status: Status;
  size?: 'sm' | 'md';
  createdAt?: Date | string | null;
}

export function StatusBadge({ status, size = 'md', createdAt }: Props) {
  const { isDark } = useTheme();
  const stuck = isStuck(status, createdAt);
  const hue = stuck ? STUCK_HUE : STATUS_HUE[status] ?? Colors.processing;
  const label = stuck ? 'Stuck' : STATUS_LABEL[status] ?? 'Status';
  const bg = softBg(hue, isDark);
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, isSmall && styles.badgeSm]}>
      {stuck ? (
        <Text style={[styles.warn, { color: hue }, isSmall && styles.warnSm]}>⚠</Text>
      ) : (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: hue,
              shadowColor: hue,
            },
          ]}
        />
      )}
      <Text style={[styles.label, { color: hue }, isSmall && styles.labelSm]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 3,
    elevation: 0,
  },
  warn: { fontSize: 11, fontWeight: '700' },
  warnSm: { fontSize: 10 },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 10,
  },
});

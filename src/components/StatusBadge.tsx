import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../lib/theme';

type Status = 'PENDING' | 'PROCESSING' | 'TRANSCRIBING' | 'SUMMARIZING' | 'READY' | 'FAILED';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Pending', color: Colors.pending, bg: '#FEF3C7' },
  PROCESSING: { label: 'Processing', color: Colors.processing, bg: '#DBEAFE' },
  TRANSCRIBING: { label: 'Transcribing', color: Colors.processing, bg: '#DBEAFE' },
  SUMMARIZING: { label: 'Summarizing', color: Colors.primaryDark, bg: '#EDE9FE' },
  READY: { label: 'Ready', color: Colors.ready, bg: '#D1FAE5' },
  FAILED: { label: 'Failed', color: Colors.failed, bg: '#FEE2E2' },
};

const IN_PROGRESS_STATUSES: ReadonlySet<Status> = new Set([
  'PENDING',
  'PROCESSING',
  'TRANSCRIBING',
  'SUMMARIZING',
]);
const STUCK_THRESHOLD_MS = 30 * 60_000;
const STUCK_COLOR = '#B45309'; // amber-700
const STUCK_BG = '#FEF3C7';    // amber-100

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

interface Props {
  status: Status;
  size?: 'sm' | 'md';
  /** When provided, the badge flips to an amber "Stuck" variant when the
   *  recording has been in an in-progress status for > 30 minutes. */
  createdAt?: Date | string | null;
}

export function StatusBadge({ status, size = 'md', createdAt }: Props) {
  const stuck = isStuck(status, createdAt);
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const isSmall = size === 'sm';

  const bg = stuck ? STUCK_BG : config.bg;
  const color = stuck ? STUCK_COLOR : config.color;
  const label = stuck ? 'Stuck' : config.label;

  return (
    <View style={[styles.badge, { backgroundColor: bg }, isSmall && styles.badgeSm]}>
      {stuck ? (
        <Text style={[styles.warn, { color }, isSmall && styles.warnSm]}>⚠</Text>
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      <Text style={[styles.label, { color }, isSmall && styles.labelSm]}>
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

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

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }, isSmall && styles.labelSm]}>
        {config.label}
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
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 10,
  },
});

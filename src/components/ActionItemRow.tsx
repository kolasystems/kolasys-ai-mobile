import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, useTheme } from '../lib/theme';
import type { ActionItem } from '../lib/trpc';

const PRIORITY_COLOR: Record<string, string> = {
  LOW: Colors.low,
  MEDIUM: Colors.medium,
  HIGH: Colors.high,
  URGENT: Colors.urgent,
};

interface Props {
  item: ActionItem;
  onToggle?: (id: string, completed: boolean) => void;
}

export function ActionItemRow({ item, onToggle }: Props) {
  const { colors } = useTheme();
  const isCompleted = item.status === 'COMPLETED' || item.status === 'CANCELLED';
  const priorityColor = PRIORITY_COLOR[item.priority] ?? Colors.low;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onToggle?.(item.id, !isCompleted)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: isCompleted ? colors.success : colors.borderStrong },
        ]}
      >
        {isCompleted && <Ionicons name="checkmark" size={14} color={colors.success} />}
      </View>
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: colors.textPrimary },
            isCompleted && { textDecorationLine: 'line-through', color: colors.textMuted },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={styles.meta}>
          {item.assignee && (
            <View style={styles.metaItem}>
              <Ionicons name="person-outline" size={11} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>{item.assignee}</Text>
            </View>
          )}
          {item.dueDate && (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textMuted }]}>
                {new Date(item.dueDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '22' }]}>
        <Text style={[styles.priorityText, { color: priorityColor }]}>
          {item.priority.charAt(0) + item.priority.slice(1).toLowerCase()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  meta: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaText: {
    fontSize: 11,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
});

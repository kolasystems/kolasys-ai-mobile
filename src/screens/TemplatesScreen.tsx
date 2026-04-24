import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { trpcGet } from '../lib/api';
import { useTheme } from '../lib/theme';

interface Template {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string | null;
  structure: unknown;
  autoApplyRules: unknown;
  isDefault: boolean;
  isGlobal: boolean;
  orgId: string | null;
}

export default function TemplatesScreen() {
  const { colors, isDark } = useTheme();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const load = useCallback(async (silent = false) => {
    if (!silent) setTemplates(null);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const data = await trpcGet<Template[]>('template.list', {}, token);
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates.');
      setTemplates([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const gradientColors: [string, string] = isDark
    ? ['#1a0a0a', '#2d1515']
    : ['#fff5f5', '#ffe0e0'];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.backBtn, { top: insets.top + 8 }]}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Templates</Text>
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: colors.accent }]}
            onPress={() =>
              Alert.alert('New Template', 'Template editor coming soon on mobile. Use the web app for now.')
            }
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <FlatList
        data={templates ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          templates === null ? null : (
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={48} color={colors.textMuted} />
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>
                {error ? 'Could not load' : 'No templates yet'}
              </Text>
              <Text style={{ fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18 }}>
                {error ?? 'Create a template to reuse prompts across meetings.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const isOpen = expanded.has(item.id);
          return (
            <TouchableOpacity
              onPress={() => toggleExpand(item.id)}
              activeOpacity={0.85}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.cardTop}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.category && (
                  <View style={[styles.catBadge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>
                      {item.category}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[styles.desc, { color: colors.textSecondary }]}
                numberOfLines={isOpen ? undefined : 2}
              >
                {item.description}
              </Text>
              <View style={styles.metaRow}>
                {item.isGlobal && (
                  <View style={styles.chipRow}>
                    <Ionicons name="globe-outline" size={11} color={colors.textMuted} />
                    <Text style={{ fontSize: 11, color: colors.textMuted }}>Global</Text>
                  </View>
                )}
                {item.isDefault && (
                  <View style={styles.chipRow}>
                    <Ionicons name="star" size={11} color={colors.accent} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.accent }}>
                      Default
                    </Text>
                  </View>
                )}
              </View>
              {isOpen && !!item.prompt && (
                <View style={[styles.promptBox, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.promptLabel, { color: colors.textMuted }]}>PROMPT</Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 19 }}>
                    {item.prompt}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  backBtn: {
    position: 'absolute',
    left: 12,
    zIndex: 10,
    padding: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4, marginLeft: 40 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  newBtnText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  list: { padding: 16 },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 6,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontSize: 15, fontWeight: '700', flex: 1 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  desc: { fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  promptBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginTop: 4,
  },
  promptLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  empty: { alignItems: 'center', gap: 10, paddingTop: 60 },
});

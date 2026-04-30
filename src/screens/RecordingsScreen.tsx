import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trpc } from '../lib/trpc';
import type { Recording } from '../lib/trpc';
import { RecordingCard } from '../components/RecordingCard';
import { useTheme } from '../lib/theme';
import { useSharedFiles } from '../hooks/useSharedFiles';
import type { RecordingsStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RecordingsStackParamList, 'RecordingsList'>;

export default function RecordingsScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [importStatus, setImportStatus] = useState<{ active: boolean; message: string } | null>(null);

  const { data, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery({ limit: 50 });

  useSharedFiles({
    onUploadStart: (file) =>
      setImportStatus({ active: true, message: `Uploading ${file.name}\u2026` }),
    onUploadSuccess: () => {
      setImportStatus({ active: false, message: 'Shared recording uploaded' });
      void refetch();
    },
    onUploadError: (_file, error) =>
      setImportStatus({ active: false, message: `Upload failed: ${error}` }),
    onAllUploadsComplete: () => {
      setTimeout(() => setImportStatus(null), 3000);
    },
  });

  const allRecordings: Recording[] =
    (data as any)?.recordings ?? (data as any)?.items ?? (Array.isArray(data) ? data : []);

  const filtered = search.trim()
    ? allRecordings.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
    : allRecordings;

  const handlePress = useCallback(
    (id: string) => navigation.navigate('RecordingDetail', { id }),
    [navigation],
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View
        style={[
          styles.searchBar,
          { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
        ]}
      >
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search recordings…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {importStatus && (
        <View
          style={[
            styles.importBanner,
            { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
          ]}
        >
          {importStatus.active ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Ionicons name="checkmark-circle" size={16} color={colors.accent} />
          )}
          <Text style={[styles.importText, { color: colors.textSecondary }]} numberOfLines={1}>
            {importStatus.message}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <RecordingCard recording={item} onPress={() => handlePress(item.id)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mic-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                {search ? 'No results found' : 'No recordings yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {search ? 'Try a different search.' : 'Record your first meeting to get started.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  importBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
  },
  importText: { flex: 1, fontSize: 13 },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});

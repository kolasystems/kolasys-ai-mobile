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
import { Colors } from '../lib/theme';
import type { RecordingsStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RecordingsStackParamList>;

type FilterStatus = 'all' | 'processing' | 'ready' | 'failed';

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'processing', label: 'Processing' },
  { key: 'ready', label: 'Ready' },
  { key: 'failed', label: 'Failed' },
];

export default function RecordingsScreen() {
  const navigation = useNavigation<Nav>();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const {
    data,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    isRefetching,
  } = trpc.recordings.list.useInfiniteQuery(
    { limit: 20 },
    {
      getNextPageParam: (lastPage: { nextCursor?: string }) => lastPage.nextCursor,
      staleTime: 30_000,
    }
  );

  const allItems: Recording[] = (data?.pages ?? []).flatMap(
    (p: { items: Recording[] }) => p.items
  );

  const filtered = allItems.filter((r) => {
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all'
        ? true
        : filter === 'processing'
        ? ['PENDING', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING'].includes(r.status)
        : filter === 'ready'
        ? r.status === 'READY'
        : r.status === 'FAILED';
    return matchesSearch && matchesFilter;
  });

  const handleRefresh = useCallback(() => { void refetch(); }, [refetch]);
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <View style={styles.screen}>
      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchInput}>
          <Ionicons name="search" size={16} color="#6b7280" />
          <TextInput
            style={styles.searchText}
            placeholder="Search recordings…"
            placeholderTextColor="#6b7280"
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterChip,
              filter === f.key
                ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                : { backgroundColor: '#f9fafb', borderColor: '#e5e7eb' },
            ]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, { color: filter === f.key ? '#ffffff' : '#6b7280' }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecordingCard
              recording={item}
              onPress={() => navigation.navigate('RecordingDetail', { id: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={Colors.primary} style={styles.footerLoader} />
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mic-off-outline" size={40} color="#9ca3af" />
              <Text style={styles.emptyTitle}>{search ? 'No results' : 'No recordings yet'}</Text>
              <Text style={styles.emptySubtitle}>
                {search
                  ? 'Try a different search term'
                  : 'Tap "Record" to capture your first meeting'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  searchRow: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchInput: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchText: { flex: 1, fontSize: 14, color: '#111827' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  listContent: { padding: 16, paddingTop: 4 },
  loader: { marginTop: 40 },
  footerLoader: { paddingVertical: 16 },
  empty: {
    alignItems: 'center',
    padding: 40,
    marginTop: 40,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', color: '#6b7280' },
});

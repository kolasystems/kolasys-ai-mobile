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
import type { RecordingsStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RecordingsStackParamList, 'RecordingsList'>;

export default function RecordingsScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery({ limit: 50 });

  const allRecordings: Recording[] = (data as any)?.recordings ?? (data as any)?.items ?? (Array.isArray(data) ? data : []);

  const filtered = search.trim()
    ? allRecordings.filter((r) =>
        r.title.toLowerCase().includes(search.toLowerCase()),
      )
    : allRecordings;

  const handlePress = useCallback(
    (id: string) => navigation.navigate('RecordingDetail', { id }),
    [navigation],
  );

  return (
    <View style={styles.screen}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color="#6b7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recordings…"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#5B8DEF" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor="#5B8DEF" />
          }
          renderItem={({ item }) => (
            <RecordingCard recording={item} onPress={() => handlePress(item.id)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mic-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>
                {search ? 'No results found' : 'No recordings yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
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
  screen: { flex: 1, backgroundColor: '#ffffff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#374151' },
  emptySubtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingHorizontal: 32 },
});

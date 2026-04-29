import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { trpc } from '../lib/trpc';
import { trpcPost } from '../lib/api';
import type { Recording } from '../lib/trpc';
import { RecordingCard } from '../components/RecordingCard';
import { useTheme } from '../lib/theme';
import type { RecordingsStackParamList } from '../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RecordingsStackParamList, 'RecordingsList'>;

const ACCEPTED_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'video/mp4',
  'video/x-m4v',
];

const MIME_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/m4a',
  mp4: 'audio/mp4',
  m4v: 'video/x-m4v',
  wav: 'audio/wav',
};

export default function RecordingsScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const { data, isLoading, refetch, isRefetching } = trpc.recordings.list.useQuery({ limit: 50 });

  const allRecordings: Recording[] =
    (data as any)?.recordings ?? (data as any)?.items ?? (Array.isArray(data) ? data : []);

  const filtered = search.trim()
    ? allRecordings.filter(r => r.title.toLowerCase().includes(search.toLowerCase()))
    : allRecordings;

  const handlePress = useCallback(
    (id: string) => navigation.navigate('RecordingDetail', { id }),
    [navigation],
  );

  const handlePick = async () => {
    if (uploading) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ACCEPTED_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      void uploadAsset(res.assets[0]);
    } catch (err) {
      Alert.alert('Could not pick file', err instanceof Error ? err.message : 'Unknown error.');
    }
  };

  const uploadAsset = async (asset: DocumentPicker.DocumentPickerAsset) => {
    setUploading(true);
    setProgress(0);
    setStage('Preparing upload\u2026');

    try {
      const token = await getTokenRef.current();
      const fileName = asset.name || 'recording';
      const ext = (fileName.split('.').pop() ?? 'm4a').toLowerCase();
      const contentType = asset.mimeType ?? MIME_BY_EXT[ext] ?? 'audio/m4a';
      const title = fileName.replace(/\.[^.]+$/, '') || `Upload \u2014 ${new Date().toLocaleString()}`;

      // 1. Create the DB recording row
      const recording = await trpcPost<{ id: string }>(
        'recordings.create',
        { title, source: 'UPLOAD' },
        token,
      );
      if (!recording?.id) throw new Error('Failed to create recording record.');

      // 2. Get a pre-signed S3 upload URL
      setStage('Requesting upload URL\u2026');
      const uploadInfo = await trpcPost<{ url: string; key: string }>(
        'recordings.getUploadUrl',
        { recordingId: recording.id, contentType, extension: ext },
        token,
      );
      if (!uploadInfo?.url) throw new Error('Failed to get upload URL.');

      // 3. PUT the file to S3 with progress
      setStage('Uploading\u2026');
      const task = FileSystem.createUploadTask(
        uploadInfo.url,
        asset.uri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { 'Content-Type': contentType },
        },
        (p) => {
          const total = p.totalBytesExpectedToSend || asset.size || 1;
          const sent = p.totalBytesSent || 0;
          setProgress(Math.min(1, sent / total));
        },
      );
      const putRes = await task.uploadAsync();
      if (!putRes || putRes.status < 200 || putRes.status >= 300) {
        const status = putRes?.status ?? 'unknown';
        throw new Error(`S3 upload failed (${status})`);
      }

      // 4. Confirm — enqueues transcription
      setStage('Finalizing\u2026');
      const fileSize =
        asset.size ?? (await FileSystem.getInfoAsync(asset.uri).then(
          (i) => (i.exists && 'size' in i && typeof i.size === 'number' ? i.size : undefined),
        ));
      await trpcPost(
        'recordings.confirmUpload',
        {
          recordingId: recording.id,
          fileSize,
          mimeType: contentType,
        },
        token,
      );

      setStage('Done');
      void refetch();
      Alert.alert('Uploaded', 'Your recording is being transcribed.');
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setUploading(false);
      setProgress(0);
      setStage('');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header row: title + upload button */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recordings</Text>
        <TouchableOpacity
          onPress={handlePick}
          disabled={uploading}
          style={[
            styles.uploadBtn,
            { backgroundColor: colors.accent, opacity: uploading ? 0.6 : 1 },
          ]}
          activeOpacity={0.85}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="add" size={20} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>

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
          placeholder="Search recordings\u2026"
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
                {search ? 'Try a different search.' : 'Tap + to upload an audio file.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Upload progress modal */}
      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{stage || 'Uploading\u2026'}</Text>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
              <View
                style={[
                  styles.progressFill,
                  { backgroundColor: colors.accent, width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  uploadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
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
  list: { paddingHorizontal: 12, paddingBottom: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  modalTitle: { fontSize: 15, fontWeight: '700' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  modalSub: { fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
});

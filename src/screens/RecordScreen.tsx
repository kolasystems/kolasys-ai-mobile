import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useRecordingStore } from '../store/recording.store';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { trpc } from '../lib/trpc';
import { Colors } from '../lib/theme';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const HIGH_QUALITY_OPTIONS: Audio.RecordingOptions = {
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    audioQuality: Audio.IOSAudioQuality.MAX,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 128000,
  },
};

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const {
    state,
    recording,
    recordingUri,
    elapsedSeconds,
    meteringLevel,
    uploadProgress,
    pendingTitle,
    setState,
    setRecording,
    setRecordingUri,
    setElapsedSeconds,
    setMeteringLevel,
    setUploadProgress,
    setPendingTitle,
    reset,
  } = useRecordingStore();

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const createRecording = trpc.recordings.create.useMutation();
  const getUploadUrl = trpc.recordings.getUploadUrl.useMutation();
  const confirmUpload = trpc.recordings.confirmUpload.useMutation();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Microphone Required',
        'Kolasys AI needs microphone access to record meetings. Please enable it in Settings.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const startRecording = async () => {
    const permitted = await requestPermissions();
    if (!permitted) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        HIGH_QUALITY_OPTIONS,
        (status) => {
          if (status.isRecording && status.metering !== undefined) {
            const normalised = Math.max(0, Math.min(1, (status.metering + 80) / 80));
            setMeteringLevel(normalised);
          }
        },
        100
      );
      setRecording(rec);
      setState('recording');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      timerRef.current = setInterval(() => {
        setElapsedSeconds(useRecordingStore.getState().elapsedSeconds + 1);
      }, 1000);
    } catch (err) {
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      console.error('Start recording error:', err);
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    await recording.pauseAsync();
    setState('paused');
    if (timerRef.current) clearInterval(timerRef.current);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const resumeRecording = async () => {
    if (!recording) return;
    await recording.startAsync();
    setState('recording');
    timerRef.current = setInterval(() => {
      setElapsedSeconds(useRecordingStore.getState().elapsedSeconds + 1);
    }, 1000);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const stopRecording = async () => {
    if (!recording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecordingUri(uri);
      setState('processing');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (err) {
      Alert.alert('Error', 'Failed to stop recording.');
      console.error('Stop recording error:', err);
    }
  };

  const uploadRecording = useCallback(async () => {
    if (!recordingUri) return;
    const title = pendingTitle.trim() || `Meeting — ${new Date().toLocaleDateString()}`;
    setState('uploading');
    try {
      const rec = await createRecording.mutateAsync({ title, source: 'UPLOAD' });
      const { url, key } = await getUploadUrl.mutateAsync({
        recordingId: rec.id,
        contentType: 'audio/m4a',
        extension: 'm4a',
      });
      const fileInfo = await fetch(recordingUri);
      const blob = await fileInfo.blob();
      const fileSize = blob.size;
      setUploadProgress(0.1);
      await fetch(url, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'audio/m4a' },
      });
      setUploadProgress(0.8);
      await confirmUpload.mutateAsync({
        recordingId: rec.id,
        fileSize,
        mimeType: 'audio/m4a',
        duration: elapsedSeconds,
      });
      setUploadProgress(1.0);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Recording Uploaded!',
        "Your meeting is being transcribed and summarized. You'll be notified when notes are ready.",
        [
          {
            text: 'View Recording',
            onPress: () => {
              reset();
              (navigation as never as { navigate: (name: string, params: object) => void }).navigate(
                'RecordingDetail',
                { id: rec.id }
              );
            },
          },
          { text: 'Done', onPress: reset },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      Alert.alert('Upload Error', message);
      setState('processing');
    }
  }, [recordingUri, pendingTitle, elapsedSeconds]);

  const handleDiscard = () => {
    Alert.alert('Discard Recording?', 'This recording will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          if (recording) {
            try { await recording.stopAndUnloadAsync(); } catch { /* ignore */ }
          }
          reset();
        },
      },
    ]);
  };

  const isActive = state === 'recording' || state === 'paused';

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Consent notice */}
        <View style={styles.consentBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#6b7280" />
          <Text style={styles.consentText}>All participants must consent to being recorded.</Text>
        </View>

        {/* State: idle */}
        {state === 'idle' && (
          <View style={styles.idleContainer}>
            <View style={styles.idleCircle}>
              <Ionicons name="mic-outline" size={60} color={Colors.primary} />
            </View>
            <Text style={styles.idleTitle}>Ready to Record</Text>
            <Text style={styles.idleSubtitle}>Tap the button below to start capturing your meeting</Text>
            <TouchableOpacity style={styles.startButton} onPress={startRecording} activeOpacity={0.85}>
              <Ionicons name="mic" size={28} color={Colors.white} />
              <Text style={styles.startButtonText}>Start Recording</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State: recording / paused */}
        {isActive && (
          <View style={styles.recordingContainer}>
            <Text style={styles.timer}>{formatTime(elapsedSeconds)}</Text>
            <Text style={[styles.recordingStatus, { color: state === 'paused' ? Colors.pending : Colors.failed }]}>
              {state === 'paused' ? '⏸ Paused' : '● Recording'}
            </Text>
            <WaveformVisualizer isRecording={state === 'recording'} meteringLevel={meteringLevel} />
            <View style={styles.controls}>
              <TouchableOpacity style={styles.controlButton} onPress={handleDiscard}>
                <Ionicons name="trash-outline" size={22} color={Colors.failed} />
                <Text style={[styles.controlLabel, { color: Colors.failed }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.stopButton} onPress={stopRecording} activeOpacity={0.85}>
                <View style={styles.stopSquare} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={state === 'recording' ? pauseRecording : resumeRecording}
              >
                <Ionicons name={state === 'recording' ? 'pause' : 'play'} size={22} color="#111827" />
                <Text style={styles.controlLabel}>{state === 'recording' ? 'Pause' : 'Resume'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* State: processing */}
        {state === 'processing' && (
          <View style={styles.processingContainer}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.ready} />
            </View>
            <Text style={styles.processingTitle}>Recording Complete</Text>
            <Text style={styles.processingDuration}>{formatTime(elapsedSeconds)} recorded</Text>
            <View style={styles.titleInput}>
              <TextInput
                style={styles.titleTextInput}
                placeholder={`Meeting — ${new Date().toLocaleDateString()}`}
                placeholderTextColor="#6b7280"
                value={pendingTitle}
                onChangeText={setPendingTitle}
                autoFocus
                returnKeyType="done"
              />
            </View>
            <TouchableOpacity style={styles.uploadButton} onPress={uploadRecording} activeOpacity={0.85}>
              <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
              <Text style={styles.uploadButtonText}>Process Recording</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDiscard} style={styles.discardLink}>
              <Text style={[styles.discardLinkText, { color: Colors.failed }]}>Discard</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* State: uploading */}
        {state === 'uploading' && (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.uploadingTitle}>Uploading…</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadProgress * 100}%` }]} />
            </View>
            <Text style={styles.uploadingSubtitle}>
              {Math.round(uploadProgress * 100)}% — Do not close the app
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 24, flexGrow: 1, gap: 20 },
  consentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  consentText: { flex: 1, fontSize: 12, lineHeight: 16, color: '#6b7280' },
  idleContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, paddingVertical: 40 },
  idleCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '15',
  },
  idleTitle: { fontSize: 26, fontWeight: '700', color: '#111827' },
  idleSubtitle: { fontSize: 15, textAlign: 'center', maxWidth: 260, lineHeight: 22, color: '#6b7280' },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 50,
    gap: 10,
    marginTop: 8,
  },
  startButtonText: { color: Colors.white, fontSize: 18, fontWeight: '700' },
  recordingContainer: { flex: 1, alignItems: 'center', gap: 12, paddingVertical: 20 },
  timer: { fontSize: 56, fontWeight: '200', letterSpacing: 2, fontVariant: ['tabular-nums'], color: '#111827' },
  recordingStatus: { fontSize: 14, fontWeight: '600' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, marginTop: 16 },
  controlButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  controlLabel: { fontSize: 10, fontWeight: '600', color: '#111827' },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.failed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopSquare: { width: 26, height: 26, borderRadius: 4, backgroundColor: Colors.white },
  processingContainer: { flex: 1, alignItems: 'center', gap: 14, paddingVertical: 20 },
  doneIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.ready + '20',
  },
  processingTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  processingDuration: { fontSize: 15, color: '#6b7280' },
  titleInput: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  titleTextInput: { fontSize: 15, color: '#111827' },
  uploadButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
  },
  uploadButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  discardLink: { padding: 8 },
  discardLinkText: { fontSize: 14, fontWeight: '500' },
  uploadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  uploadingTitle: { fontSize: 20, fontWeight: '700', color: '#111827' },
  progressBar: { width: '80%', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: '#e5e7eb' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },
  uploadingSubtitle: { fontSize: 13, color: '#6b7280' },
});

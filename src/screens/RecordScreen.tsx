import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { trpcPost } from '../lib/api';
import { useTheme } from '../lib/theme';

// True on a physical device, false on simulator/emulator
const IS_REAL_DEVICE = Constants.isDevice;

type RecordState = 'idle' | 'recording' | 'paused' | 'stopped' | 'uploading' | 'done';

const NUM_BARS = 7;

// Most common languages shown as chips in the upload panel.
// Full list lives in the web default-language-selector component.
const RECORD_LANGUAGES = [
  { code: 'auto', label: 'Auto' },
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'fr', label: 'FR' },
  { code: 'de', label: 'DE' },
  { code: 'pt', label: 'PT' },
  { code: 'ja', label: 'JA' },
  { code: 'zh', label: 'ZH' },
  { code: 'ar', label: 'AR' },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${pad(m)}:${pad(s)}`;
}

export default function RecordScreen() {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { colors, isDark } = useTheme();

  const [state, setState] = useState<RecordState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('en');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animated bar heights
  const barAnims = useRef(Array.from({ length: NUM_BARS }, () => new Animated.Value(4))).current;

  // Pulsing halo around the record button while recording
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0)).current;

  // ── Permission ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // Check current status without prompting — we'll prompt on first tap
    Audio.getPermissionsAsync().then(({ status }) => {
      if (status === 'granted') setHasPermission(true);
      if (status === 'denied') { setHasPermission(false); setPermissionDenied(true); }
      // 'undetermined' → leave null, prompt when user taps record
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Pulsing halo while recording ─────────────────────────────────────────────

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (state === 'recording') {
      pulseScale.setValue(1);
      pulseOpacity.setValue(0.35);
      loop = Animated.loop(
        Animated.parallel([
          Animated.timing(pulseScale, {
            toValue: 1.5,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    } else {
      pulseOpacity.setValue(0);
    }
    return () => {
      if (loop) loop.stop();
    };
  }, [state, pulseScale, pulseOpacity]);

  // ── Waveform animation ───────────────────────────────────────────────────────

  const startWaveform = useCallback(() => {
    barAnims.forEach((anim, i) => {
      const animate = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 10 + Math.random() * 30,
            duration: 150 + i * 40,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: 4 + Math.random() * 8,
            duration: 150 + i * 40,
            useNativeDriver: false,
          }),
        ]).start(({ finished }) => {
          if (finished) animate();
        });
      };
      setTimeout(() => animate(), i * 80);
    });
  }, [barAnims]);

  const stopWaveform = useCallback(() => {
    barAnims.forEach((anim) => {
      anim.stopAnimation();
      Animated.timing(anim, { toValue: 4, duration: 200, useNativeDriver: false }).start();
    });
  }, [barAnims]);

  // ── Timer ────────────────────────────────────────────────────────────────────

  const startTimer = () => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // ── Recording controls ───────────────────────────────────────────────────────

  const handleStart = async () => {
    // Simulator check — must happen before permission request
    if (!IS_REAL_DEVICE) {
      Alert.alert(
        'Real Device Required',
        'Recording requires a real device. The simulator does not have a microphone.',
      );
      return;
    }

    // Request permission if not yet determined
    if (hasPermission === null) {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setHasPermission(true);
      } else {
        setHasPermission(false);
        setPermissionDenied(true);
        return;
      }
    }

    if (!hasPermission) {
      setPermissionDenied(true);
      return;
    }

    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recordingRef.current = rec;
      setElapsed(0);
      setState('recording');
      startTimer();
      startWaveform();
    } catch (err: unknown) {
      console.error('[RecordScreen] start error:', err);
      const msg = err instanceof Error ? err.message.toLowerCase() : '';

      if (msg.includes('recorder') || msg.includes('prepare') || msg.includes('avaudiosession')) {
        // Likely a simulator or hardware issue
        Alert.alert(
          'Microphone Unavailable',
          IS_REAL_DEVICE
            ? 'Microphone access required. Please allow microphone access in Settings > Privacy & Security > Microphone > Kolasys AI.'
            : 'Recording requires a real device. The simulator does not have a microphone.',
          IS_REAL_DEVICE
            ? [
                { text: 'Open Settings', onPress: () => void Linking.openSettings() },
                { text: 'Cancel', style: 'cancel' },
              ]
            : [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Recording Error', 'Could not start recording. Please try again.');
      }
    }
  };

  const handlePause = async () => {
    if (!recordingRef.current) return;
    await recordingRef.current.pauseAsync();
    setState('paused');
    stopTimer();
    stopWaveform();
  };

  const handleResume = async () => {
    if (!recordingRef.current) return;
    await recordingRef.current.startAsync();
    setState('recording');
    startTimer();
    startWaveform();
  };

  const handleStop = async () => {
    if (!recordingRef.current) return;
    stopTimer();
    stopWaveform();
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    setRecordingUri(uri ?? null);
    setState('stopped');

    // Auto-suggest title based on time
    const now = new Date();
    setTitle(
      `Recording – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
    );
  };

  const handleDiscard = () => {
    Alert.alert('Discard Recording', 'This recording will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          setRecordingUri(null);
          setElapsed(0);
          setTitle('');
          setLanguage('en');
          setState('idle');
        },
      },
    ]);
  };

  const handleUpload = async () => {
    if (!recordingUri) return;
    if (!title.trim()) {
      Alert.alert('Title required', 'Please add a title before uploading.');
      return;
    }
    setState('uploading');
    try {
      const token = await getToken();
      const contentType = 'audio/m4a';
      const extension = 'm4a';

      // 1. Create the DB recording row (PENDING)
      const recording = await trpcPost<{ id: string }>(
        'recordings.create',
        { title: title.trim(), source: 'UPLOAD' },
        token,
      );
      if (!recording?.id) throw new Error('Failed to create recording record.');

      // 2. Get a pre-signed S3 upload URL
      const uploadInfo = await trpcPost<{ url: string; key: string }>(
        'recordings.getUploadUrl',
        { recordingId: recording.id, contentType, extension },
        token,
      );
      if (!uploadInfo?.url) throw new Error('Failed to get upload URL.');

      // 3. PUT the audio file directly to S3
      const putRes = await FileSystem.uploadAsync(uploadInfo.url, recordingUri, {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': contentType },
      });
      if (putRes.status < 200 || putRes.status >= 300) {
        throw new Error(`S3 upload failed (${putRes.status})${putRes.body ? `: ${putRes.body.slice(0, 200)}` : ''}`);
      }

      // 4. Confirm upload (enqueues transcription)
      const info = await FileSystem.getInfoAsync(recordingUri);
      const fileSize = info.exists && 'size' in info && typeof info.size === 'number' ? info.size : undefined;
      await trpcPost(
        'recordings.confirmUpload',
        {
          recordingId: recording.id,
          duration: elapsed > 0 ? elapsed : undefined,
          fileSize,
          mimeType: contentType,
          language: language === 'auto' ? undefined : language,
        },
        token,
      );

      setState('done');
      Alert.alert('Uploaded!', 'Your recording is processing. You\u2019ll be notified when the notes are ready.', [
        {
          text: 'OK',
          onPress: () => {
            setRecordingUri(null);
            setElapsed(0);
            setTitle('');
            setState('idle');
          },
        },
      ]);
    } catch (err: unknown) {
      setState('stopped');
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.';
      Alert.alert('Upload Error', msg);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (permissionDenied) {
    return (
      <LinearGradient
        colors={[colors.bgGradientStart, colors.bgGradientEnd]}
        style={styles.centered}
      >
        <Ionicons name="mic-off-outline" size={48} color={colors.danger} />
        <Text style={[styles.permTitle, { color: colors.textPrimary }]}>Microphone Access Required</Text>
        {IS_REAL_DEVICE ? (
          <>
            <Text style={[styles.permSub, { color: colors.textSecondary }]}>
              Please allow microphone access in:{'\n'}
              Settings {'>'} Privacy {'>'} Microphone {'>'} Kolasys AI
            </Text>
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: colors.accent }]}
              onPress={() => void Linking.openSettings()}
            >
              <Ionicons name="settings-outline" size={16} color="#ffffff" />
              <Text style={styles.permBtnText}>Open Settings</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[styles.permSub, { color: colors.textSecondary }]}>
            Recording requires a real device.{'\n'}The simulator does not have a microphone.
          </Text>
        )}
      </LinearGradient>
    );
  }

  const isRecording = state === 'recording';
  const isActive = state === 'recording' || state === 'paused';
  const isStopped = state === 'stopped';
  const isUploading = state === 'uploading';

  const barIdleColor = isDark ? '#2E2E3A' : '#D1D5DB';

  return (
    <LinearGradient
      colors={[colors.bgGradientStart, colors.bgGradientEnd]}
      style={{ flex: 1 }}
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Timer */}
          <Text
            style={[
              styles.timer,
              { color: isRecording ? colors.textPrimary : colors.textMuted },
            ]}
          >
            {formatTimer(elapsed)}
          </Text>

          {/* Waveform */}
          <View style={styles.waveform}>
            {barAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: anim,
                    backgroundColor: isRecording ? colors.accent : barIdleColor,
                    shadowColor: colors.accent,
                    shadowOpacity: isRecording ? 0.9 : 0,
                    shadowRadius: isRecording ? 6 : 0,
                    shadowOffset: { width: 0, height: 0 },
                  },
                ]}
              />
            ))}
          </View>

          {/* Main mic button */}
          {!isActive && !isStopped && (
            <TouchableOpacity
              style={[
                styles.micButton,
                { backgroundColor: colors.accent, shadowColor: colors.accent },
              ]}
              onPress={handleStart}
              activeOpacity={0.85}
            >
              <Ionicons name="mic" size={44} color="#ffffff" />
            </TouchableOpacity>
          )}

          {/* Recording controls */}
          {isActive && (
            <View style={styles.controls}>
              <TouchableOpacity
                style={[styles.controlBtn, { borderColor: colors.border }]}
                onPress={handleStop}
                activeOpacity={0.8}
              >
                <Ionicons name="stop" size={28} color={colors.danger} />
              </TouchableOpacity>
              <View>
                {/* Pulsing halo */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.pulseRing,
                    {
                      backgroundColor: colors.accent,
                      opacity: pulseOpacity,
                      transform: [{ scale: pulseScale }],
                    },
                  ]}
                />
                <TouchableOpacity
                  style={[styles.controlBtn, styles.controlBtnLarge, { backgroundColor: colors.accent, borderColor: colors.accent, shadowColor: colors.accent }]}
                  onPress={isRecording ? handlePause : handleResume}
                  activeOpacity={0.8}
                >
                  <Ionicons name={isRecording ? 'pause' : 'play'} size={36} color="#ffffff" />
                </TouchableOpacity>
              </View>
              <View style={styles.controlBtn} />
            </View>
          )}

          {/* Post-recording: title + language + upload */}
          {isStopped && (
            <View style={styles.uploadPanel}>
              <Text style={[styles.uploadDuration, { color: colors.textSecondary }]}>
                Recording complete · {formatTimer(elapsed)}
              </Text>

              <TextInput
                style={[
                  styles.titleInput,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="Recording title…"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                autoCapitalize="words"
                returnKeyType="done"
              />

              {/* Language picker */}
              <View style={[styles.langRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="language-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.langLabel, { color: colors.textSecondary }]}>Language</Text>
                <View style={styles.langButtons}>
                  {RECORD_LANGUAGES.map((lang) => (
                    <TouchableOpacity
                      key={lang.code}
                      onPress={() => setLanguage(lang.code)}
                      style={[
                        styles.langChip,
                        language === lang.code
                          ? { backgroundColor: colors.accent }
                          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.langChipText,
                          { color: language === lang.code ? '#ffffff' : colors.textSecondary },
                        ]}
                      >
                        {lang.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.uploadBtn,
                  { backgroundColor: colors.accent, opacity: title.trim() ? 1 : 0.5 },
                ]}
                onPress={handleUpload}
                disabled={!title.trim() || isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#ffffff" />
                    <Text style={styles.uploadBtnText}>Upload & Process</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard}>
                <Text style={[styles.discardText, { color: colors.textSecondary }]}>Discard</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Status label */}
          {!isActive && !isStopped && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>Tap to start recording</Text>
          )}
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { backgroundColor: colors.danger }]} />
              <Text style={[styles.recordingText, { color: colors.danger }]}>Recording…</Text>
            </View>
          )}
          {state === 'paused' && (
            <Text style={[styles.hint, { color: colors.textMuted }]}>Paused</Text>
          )}

          {/* Consent */}
          <Text style={[styles.consent, { color: colors.textMuted }]}>
            By recording, you confirm all participants have consented to being recorded.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#ffffff' },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  permTitle: { fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
  permSub: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 22 },
  permBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5B8DEF',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },
  permBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  timer: {
    fontSize: 56,
    fontWeight: '200',
    color: '#9ca3af',
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
    marginTop: 16,
  },
  timerActive: { color: '#111827' },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
  },
  bar: {
    width: 5,
    borderRadius: 3,
    minHeight: 4,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#5B8DEF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B8DEF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  pulseRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 36,
  },
  hint: { fontSize: 14, color: '#9ca3af' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  recordingText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
  uploadPanel: { width: '100%', gap: 14, alignItems: 'stretch' },
  uploadDuration: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexWrap: 'wrap',
  },
  langLabel: { fontSize: 13, fontWeight: '500' },
  langButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1, justifyContent: 'flex-end' },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  langChipText: { fontSize: 12, fontWeight: '700' },
  titleInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#5B8DEF',
    gap: 8,
  },
  uploadBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  discardBtn: { alignItems: 'center', paddingVertical: 4 },
  discardText: { fontSize: 14, color: '#6b7280' },
  consent: {
    fontSize: 11,
    textAlign: 'center',
    color: '#9ca3af',
    lineHeight: 16,
    marginTop: 'auto',
    paddingTop: 16,
  },
});

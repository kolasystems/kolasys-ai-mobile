import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@clerk/clerk-expo';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import type { Recording, Note, NoteSection, ActionItem, TranscriptSegment } from '../lib/trpc';
import { StatusBadge, isStuck, formatStuckAge } from '../components/StatusBadge';
import { ActionItemRow } from '../components/ActionItemRow';
import { TranscriptSegmentRow } from '../components/TranscriptSegment';
import { AskAITab } from '../components/AskAITab';
import { useReadyStore } from '../lib/notifications';
import type { RecordingsStackParamList } from '../navigation/AppNavigator';

type RouteT = RouteProp<RecordingsStackParamList, 'RecordingDetail'>;
type NavT = NativeStackNavigationProp<RecordingsStackParamList, 'RecordingDetail'>;
type Tab = 'notes' | 'transcript' | 'actions' | 'ai';

const API = 'https://app.kolasys.ai/api/trpc';
const PROCESSING_STATUSES = ['PENDING', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING'];
const APP_URL = 'https://app.kolasys.ai';

// ─── tRPC helpers ─────────────────────────────────────────────────────────────

async function trpcGet<T>(procedure: string, input: Record<string, unknown>, token: string | null): Promise<T> {
  const inputParam = encodeURIComponent(JSON.stringify({ '0': { json: input } }));
  const url = `${API}/${procedure}?batch=1&input=${inputParam}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const raw = await res.json();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (item?.error) throw new Error(item.error.message ?? 'tRPC error');
  return item?.result?.data?.json ?? item?.result?.data;
}

async function trpcPost<T = void>(procedure: string, input: Record<string, unknown>, token: string | null): Promise<T> {
  const url = `${API}/${procedure}?batch=1`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ '0': { json: input } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const raw = await res.json().catch(() => null);
  const item = Array.isArray(raw) ? raw[0] : raw;
  return (item?.result?.data?.json ?? item?.result?.data) as T;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Note export helpers ──────────────────────────────────────────────────────

function buildNotesMarkdown(recording: Recording, note: Note): string {
  const lines: string[] = [`# ${recording.title}`, formatDate(recording.createdAt), '', '## Summary', note.summary, ''];
  if (note.keyPoints?.length) lines.push('## Key Points', ...note.keyPoints.map(p => `- ${p}`), '');
  if (note.decisions?.length) lines.push('## Decisions', ...note.decisions.map(d => `- ${d}`), '');
  if (note.nextSteps?.length) lines.push('## Next Steps', ...note.nextSteps.map(s => `- ${s}`), '');
  note.sections?.forEach((s: NoteSection) => {
    lines.push(`## ${s.heading ?? s.title ?? ''}`, s.content, '');
  });
  if (note.actionItems?.length) {
    lines.push('## Action Items');
    note.actionItems.forEach((a: ActionItem) => {
      const done = a.status === 'COMPLETED' ? 'x' : ' ';
      lines.push(`- [${done}] ${a.title}${a.assignee ? ` (@${a.assignee})` : ''}${a.priority !== 'MEDIUM' ? ` [${a.priority}]` : ''}`);
    });
  }
  return lines.join('\n');
}

function buildTranscriptText(recording: Recording, segments: TranscriptSegment[]): string {
  const lines: string[] = [`# Transcript: ${recording.title}`, formatDate(recording.createdAt), ''];
  segments.forEach(seg => {
    const ts = formatTimestamp(seg.startTime);
    const speaker = seg.speaker ? `[${seg.speaker}]` : '';
    lines.push(`${ts} ${speaker} ${seg.text}`.trim());
  });
  return lines.join('\n');
}

function buildNotesHTML(recording: Recording, note: Note): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

  const sectionHtml = (title: string, content: string) =>
    `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(content)}</p>`;

  const bulletHtml = (title: string, items: string[]) =>
    `<h2>${escapeHtml(title)}</h2><ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`;

  const sectionsHtml = [
    `<h2>Summary</h2><p>${escapeHtml(note.summary)}</p>`,
    ...(note.keyPoints?.length ? [bulletHtml('Key Points', note.keyPoints)] : []),
    ...(note.decisions?.length ? [bulletHtml('Decisions', note.decisions)] : []),
    ...(note.nextSteps?.length ? [bulletHtml('Next Steps', note.nextSteps)] : []),
    ...(note.sections?.map((s: NoteSection) => sectionHtml(s.heading ?? s.title ?? '', s.content)) ?? []),
    ...(note.actionItems?.length ? [`<h2>Action Items</h2><ul>${note.actionItems.map((a: ActionItem) =>
      `<li><strong>${escapeHtml(a.title)}</strong>${a.assignee ? ` — @${escapeHtml(a.assignee)}` : ''} [${a.priority}]</li>`
    ).join('')}</ul>`] : []),
  ];

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(recording.title)}</title>
  <style>body{font-family:-apple-system,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111}
  h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;margin-top:24px;margin-bottom:8px;color:#374151}
  p,li{font-size:15px;line-height:1.6;color:#374151}.date{color:#9ca3af;font-size:13px;margin-bottom:32px}
  </style></head><body>
  <h1>${escapeHtml(recording.title)}</h1>
  <p class="date">${escapeHtml(formatDate(recording.createdAt))}</p>
  ${sectionsHtml.join('\n')}
  </body></html>`;
}

// ─── Static waveform ──────────────────────────────────────────────────────────

const WAVEFORM_BARS = 50;
// Pre-seeded heights so it looks natural but is stable (not random each render)
const WAVEFORM_HEIGHTS = [
  0.4,0.6,0.3,0.7,0.5,0.8,0.4,0.9,0.6,0.3,
  0.7,0.5,0.4,0.8,0.6,0.3,0.7,0.9,0.4,0.5,
  0.6,0.8,0.3,0.5,0.7,0.9,0.4,0.6,0.3,0.8,
  0.5,0.7,0.4,0.9,0.6,0.3,0.7,0.5,0.4,0.8,
  0.6,0.9,0.3,0.5,0.7,0.4,0.6,0.8,0.3,0.5,
];

type WaveformBarProps = {
  duration: number | null;
  // Override the default "Audio deleted after transcription" subtitle. Pass `null`
  // to hide the subtitle entirely (used when the real player is mounted below).
  subtitle?: string | null;
};

function WaveformBar({ duration, subtitle }: WaveformBarProps) {
  const sub =
    subtitle === undefined ? 'Audio deleted after transcription' : subtitle;

  return (
    <View style={waveStyles.wrap}>
      <View style={waveStyles.bars}>
        {WAVEFORM_HEIGHTS.map((h, i) => (
          <View
            key={i}
            style={[waveStyles.bar, { height: Math.max(4, h * 40) }]}
          />
        ))}
      </View>
      {(duration != null || sub) && (
        <View style={waveStyles.durationRow}>
          {duration != null && (
            <Text style={waveStyles.durationText}>{formatDuration(duration)}</Text>
          )}
          {sub && <Text style={waveStyles.durationSub}>{sub}</Text>}
        </View>
      )}
    </View>
  );
}

const waveStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8, gap: 10 },
  bars: { flexDirection: 'row', alignItems: 'center', gap: 2.5, height: 40 },
  bar: { width: 4, borderRadius: 2, backgroundColor: '#5B8DEF60', flex: 1 },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  durationText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  durationSub: { fontSize: 11, color: '#9ca3af' },
});

// ─── Audio player (real playback via expo-av + pre-signed S3 URL) ────────────

type AudioState =
  | { kind: 'loading' }
  | { kind: 'unavailable' }      // server says the audio file is gone
  | { kind: 'error'; message: string }
  | { kind: 'ready' };

function AudioPlayerBlock({
  recordingId,
  duration,
}: {
  recordingId: string;
  duration: number | null;
}) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const soundRef = useRef<Audio.Sound | null>(null);
  const isMountedRef = useRef(true);
  const hasRetriedRef = useRef(false);

  const [state, setState] = useState<AudioState>({ kind: 'loading' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number>(
    duration != null ? duration * 1000 : 0,
  );
  const [barWidth, setBarWidth] = useState(0);

  // Latest position is needed inside `onStatus` when refetching after an
  // expired URL — keep a ref so we don't have to thread state into callbacks.
  const positionMsRef = useRef(0);
  useEffect(() => { positionMsRef.current = positionMs; }, [positionMs]);
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  async function fetchUrl(): Promise<string | null> {
    const token = await getTokenRef.current();
    const data = await trpcGet<{ url: string | null }>(
      'recordings.getAudioUrl',
      { recordingId },
      token,
    );
    return data?.url ?? null;
  }

  async function unloadSound() {
    const s = soundRef.current;
    soundRef.current = null;
    if (!s) return;
    try {
      await s.unloadAsync();
    } catch {
      /* noop */
    }
  }

  async function loadSound(url: string, startAtMs = 0, autoplay = false) {
    await unloadSound();
    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      {
        shouldPlay: autoplay,
        positionMillis: startAtMs,
        progressUpdateIntervalMillis: 250,
      },
    );
    if (!isMountedRef.current) {
      await sound.unloadAsync().catch(() => {});
      return;
    }
    soundRef.current = sound;
    sound.setOnPlaybackStatusUpdate(onStatus);
  }

  async function onStatus(status: AVPlaybackStatus) {
    if (!isMountedRef.current) return;

    if (!status.isLoaded) {
      if (status.error && !hasRetriedRef.current) {
        // Most commonly a 403 from an expired signed URL — refetch once.
        hasRetriedRef.current = true;
        try {
          const fresh = await fetchUrl();
          if (!fresh) {
            setState({ kind: 'unavailable' });
            return;
          }
          await loadSound(fresh, positionMsRef.current, isPlayingRef.current);
        } catch {
          setState({ kind: 'error', message: 'Playback error' });
        }
      }
      return;
    }

    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis);
    if (status.durationMillis) setDurationMs(status.durationMillis);
    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  }

  useEffect(() => {
    isMountedRef.current = true;
    hasRetriedRef.current = false;

    (async () => {
      setState({ kind: 'loading' });

      // Let audio play with the iOS hardware silent switch on.
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      } catch {
        /* non-fatal — audio will still play, just mute in silent mode */
      }

      try {
        const url = await fetchUrl();
        if (!isMountedRef.current) return;
        if (!url) {
          setState({ kind: 'unavailable' });
          return;
        }
        await loadSound(url);
        if (!isMountedRef.current) return;
        setState({ kind: 'ready' });
      } catch (err) {
        if (!isMountedRef.current) return;
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to load audio',
        });
      }
    })();

    return () => {
      isMountedRef.current = false;
      void unloadSound();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingId]);

  async function togglePlay() {
    const s = soundRef.current;
    if (!s) return;
    try {
      const status = await s.getStatusAsync();
      if (!status.isLoaded) return;
      if (status.isPlaying) {
        await s.pauseAsync();
      } else {
        await s.playAsync();
      }
    } catch {
      // Could be an expired URL, or another transient failure. Retry once
      // with a fresh URL — mirrors the `onStatus` recovery path.
      if (hasRetriedRef.current) return;
      hasRetriedRef.current = true;
      try {
        const fresh = await fetchUrl();
        if (!fresh) {
          setState({ kind: 'unavailable' });
          return;
        }
        await loadSound(fresh, positionMsRef.current, true);
      } catch {
        setState({ kind: 'error', message: 'Playback failed' });
      }
    }
  }

  async function skip(deltaSec: number) {
    const s = soundRef.current;
    if (!s) return;
    const dur = durationMs || 0;
    if (dur === 0) return;
    const next = Math.max(0, Math.min(dur, positionMs + deltaSec * 1000));
    try {
      await s.setPositionAsync(next);
    } catch {
      /* noop */
    }
  }

  async function seekToX(locationX: number) {
    const s = soundRef.current;
    const dur = durationMs || 0;
    if (!s || !barWidth || !dur) return;
    const frac = Math.max(0, Math.min(1, locationX / barWidth));
    const target = Math.round(frac * dur);
    try {
      await s.setPositionAsync(target);
      setPositionMs(target);
    } catch {
      /* noop */
    }
  }

  if (state.kind === 'loading') {
    return (
      <View style={playerStyles.container}>
        <WaveformBar duration={duration} subtitle="Loading audio…" />
        <View style={playerStyles.loadingRow}>
          <ActivityIndicator size="small" color="#5B8DEF" />
        </View>
      </View>
    );
  }

  if (state.kind === 'unavailable') {
    // Existing behaviour — keep the default "deleted" subtitle.
    return (
      <View style={playerStyles.container}>
        <WaveformBar duration={duration} />
      </View>
    );
  }

  if (state.kind === 'error') {
    return (
      <View style={playerStyles.container}>
        <WaveformBar duration={duration} subtitle={state.message} />
      </View>
    );
  }

  const displayDurMs = durationMs || (duration ?? 0) * 1000;
  const progress = displayDurMs > 0 ? Math.min(1, positionMs / displayDurMs) : 0;

  return (
    <View style={playerStyles.container}>
      <WaveformBar duration={null} subtitle={null} />

      {/* Scrubber — tap anywhere on the bar to seek */}
      <View style={playerStyles.scrubberWrap}>
        <View
          style={playerStyles.progressTrack}
          onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderRelease={(e) => void seekToX(e.nativeEvent.locationX)}
          hitSlop={12}
        >
          <View
            style={[playerStyles.progressFill, { width: `${progress * 100}%` }]}
          />
          <View
            style={[
              playerStyles.progressThumb,
              { left: `${progress * 100}%` },
            ]}
          />
        </View>
        <View style={playerStyles.timeRow}>
          <Text style={playerStyles.time}>
            {formatTimestamp(positionMs / 1000)}
          </Text>
          <Text style={playerStyles.time}>
            {formatTimestamp(displayDurMs / 1000)}
          </Text>
        </View>
      </View>

      {/* Transport controls */}
      <View style={playerStyles.controls}>
        <TouchableOpacity
          style={playerStyles.seekBtn}
          onPress={() => void skip(-15)}
          activeOpacity={0.7}
        >
          <Ionicons name="play-skip-back" size={18} color="#111827" />
          <Text style={playerStyles.seekLabel}>15</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={playerStyles.playBtn}
          onPress={() => void togglePlay()}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={22}
            color="#ffffff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={playerStyles.seekBtn}
          onPress={() => void skip(15)}
          activeOpacity={0.7}
        >
          <Text style={playerStyles.seekLabel}>15</Text>
          <Ionicons name="play-skip-forward" size={18} color="#111827" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const playerStyles = StyleSheet.create({
  container: {
    paddingBottom: 8,
  },
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  scrubberWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 4,
  },
  progressTrack: {
    position: 'relative',
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e5e7eb',
    overflow: 'visible',
    justifyContent: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
    backgroundColor: '#5B8DEF',
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#5B8DEF',
    marginLeft: -7,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  timeRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 11,
    color: '#6b7280',
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f3f4f6',
  },
  playBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#5B8DEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 8,
  },
  seekLabel: { fontSize: 12, fontWeight: '700', color: '#111827' },
});

// ─── Topic outline ────────────────────────────────────────────────────────────

interface TopicSegment {
  title: string;
  timestamp: number;
  segmentIndex: number;
  pageIndex: number;
}

function buildOutline(segments: TranscriptSegment[], pageSize: number): TopicSegment[] {
  if (!segments.length) return [];
  const topics: TopicSegment[] = [];
  let lastTopicTime = -120;

  segments.forEach((seg, i) => {
    const isFirst = i === 0;
    const bigGap = seg.startTime - lastTopicTime > 90; // 90-second gap = new topic
    const everyN = i > 0 && i % 12 === 0; // every 12 segments regardless

    if (isFirst || bigGap || everyN) {
      // Use first ~60 chars of first sentence as topic title
      const sentence = seg.text.split(/[.!?]/)[0].trim();
      const title = sentence.length > 60 ? sentence.slice(0, 57) + '…' : sentence || `Section ${topics.length + 1}`;
      topics.push({
        title,
        timestamp: seg.startTime,
        segmentIndex: i,
        pageIndex: Math.floor(i / pageSize),
      });
      lastTopicTime = seg.startTime;
    }
  });

  return topics;
}

function TopicOutline({ segments, pageSize, onTopicPress }: {
  segments: TranscriptSegment[];
  pageSize: number;
  onTopicPress: (pageIndex: number) => void;
}) {
  const outline = buildOutline(segments, pageSize);
  if (outline.length < 2) return null;

  return (
    <View style={outlineStyles.wrap}>
      <Text style={outlineStyles.heading}>Outline</Text>
      {outline.map((topic, i) => (
        <TouchableOpacity
          key={i}
          style={outlineStyles.item}
          onPress={() => onTopicPress(topic.pageIndex)}
          activeOpacity={0.7}
        >
          <Text style={outlineStyles.timestamp}>{formatTimestamp(topic.timestamp)}</Text>
          <Text style={outlineStyles.title} numberOfLines={1}>{topic.title}</Text>
          <Ionicons name="chevron-forward" size={14} color="#d1d5db" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const outlineStyles = StyleSheet.create({
  wrap: { marginBottom: 8, gap: 2 },
  heading: { fontSize: 13, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    borderRadius: 10, backgroundColor: '#fafafa',
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb',
    marginBottom: 4,
  },
  timestamp: { fontSize: 12, fontWeight: '700', color: '#5B8DEF', width: 40, fontVariant: ['tabular-nums'] },
  title: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
});

// ─── Export sheet ─────────────────────────────────────────────────────────────

function ExportSheet({ visible, recording, segments, onClose }: {
  visible: boolean;
  recording: Recording;
  segments: TranscriptSegment[];
  onClose: () => void;
}) {
  const note = recording.note ?? null;
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try {
      await fn();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = () => run('copy-link', async () => {
    await Clipboard.setStringAsync(`${APP_URL}/recordings/${recording.id}`);
    Alert.alert('Copied', 'Link copied to clipboard.');
    onClose();
  });

  const copyNotes = () => run('copy-notes', async () => {
    if (!note) { Alert.alert('No notes', 'Notes not available yet.'); return; }
    await Clipboard.setStringAsync(buildNotesMarkdown(recording, note));
    Alert.alert('Copied', 'Notes copied to clipboard.');
    onClose();
  });

  const copyTranscript = () => run('copy-tx', async () => {
    if (!segments.length) { Alert.alert('No transcript', 'Transcript not available.'); return; }
    await Clipboard.setStringAsync(buildTranscriptText(recording, segments));
    Alert.alert('Copied', 'Transcript copied to clipboard.');
    onClose();
  });

  const exportNotesTxt = () => run('notes-txt', async () => {
    if (!note) { Alert.alert('No notes', 'Notes not available yet.'); return; }
    const content = buildNotesMarkdown(recording, note);
    const path = `${FileSystem.cacheDirectory}notes-${recording.id}.txt`;
    await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: `${recording.title} — Notes` });
    onClose();
  });

  const exportTranscriptTxt = () => run('tx-txt', async () => {
    if (!segments.length) { Alert.alert('No transcript', 'Transcript not available.'); return; }
    const content = buildTranscriptText(recording, segments);
    const path = `${FileSystem.cacheDirectory}transcript-${recording.id}.txt`;
    await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: `${recording.title} — Transcript` });
    onClose();
  });

  const exportNotesPdf = () => run('notes-pdf', async () => {
    if (!note) { Alert.alert('No notes', 'Notes not available yet.'); return; }
    const html = buildNotesHTML(recording, note);
    const { uri } = await Print.printToFileAsync({ html });
    const dest = `${FileSystem.cacheDirectory}notes-${recording.id}.pdf`;
    await FileSystem.moveAsync({ from: uri, to: dest });
    await Sharing.shareAsync(dest, { mimeType: 'application/pdf', dialogTitle: `${recording.title} — Notes PDF` });
    onClose();
  });

  type ExportAction = { id: string; icon: string; label: string; sub: string; onPress: () => void; disabled?: boolean };

  const actions: ExportAction[] = [
    { id: 'copy-link', icon: 'link-outline', label: 'Share link', sub: 'Copy link to clipboard', onPress: copyLink },
    { id: 'copy-notes', icon: 'copy-outline', label: 'Copy Notes', sub: 'Copy as Markdown text', onPress: copyNotes, disabled: !note },
    { id: 'copy-tx', icon: 'copy-outline', label: 'Copy Transcript', sub: 'Copy full transcript text', onPress: copyTranscript, disabled: !segments.length },
    { id: 'notes-txt', icon: 'document-text-outline', label: 'Export Notes as TXT', sub: 'Save and share .txt file', onPress: exportNotesTxt, disabled: !note },
    { id: 'tx-txt', icon: 'document-text-outline', label: 'Export Transcript as TXT', sub: 'Save and share .txt file', onPress: exportTranscriptTxt, disabled: !segments.length },
    { id: 'notes-pdf', icon: 'document-outline', label: 'Export Notes as PDF', sub: 'Generate and share PDF', onPress: exportNotesPdf, disabled: !note },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity style={exportStyles.overlay} activeOpacity={1} onPress={onClose} />
      <View style={exportStyles.sheet}>
        <View style={exportStyles.handle} />
        <Text style={exportStyles.sheetTitle}>Export</Text>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={[exportStyles.action, action.disabled && { opacity: 0.4 }]}
            onPress={action.disabled ? undefined : action.onPress}
            disabled={action.disabled || !!busy}
            activeOpacity={0.7}
          >
            <View style={exportStyles.actionIcon}>
              {busy === action.id ? (
                <ActivityIndicator size="small" color="#5B8DEF" />
              ) : (
                <Ionicons name={action.icon as never} size={20} color="#5B8DEF" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={exportStyles.actionLabel}>{action.label}</Text>
              <Text style={exportStyles.actionSub}>{action.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={exportStyles.cancelBtn} onPress={onClose}>
          <Text style={exportStyles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const exportStyles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 34, paddingTop: 12, paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 20,
    gap: 4,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb',
    alignSelf: 'center', marginBottom: 12,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 8 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#5B8DEF15', alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  actionSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  cancelBtn: {
    marginTop: 12, backgroundColor: '#f3f4f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});

// ─── Notes tab ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 30;

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <View style={{ gap: 6 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ color: '#5B8DEF', marginTop: 3, fontSize: 12 }}>●</Text>
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 21, color: '#374151' }}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function NotesSectionBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={notesStyles.sectionHeading}>{title}</Text>
      {children}
    </View>
  );
}

function NotesTab({ note }: { note: Note | null | undefined }) {
  if (!note) {
    return (
      <View style={[notesStyles.tabContent, { alignItems: 'center', paddingTop: 40, gap: 10 }]}>
        <Ionicons name="document-text-outline" size={36} color="#9ca3af" />
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151' }}>Notes not yet available</Text>
        <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 20 }}>
          Notes are generated after transcription completes.{'\n'}Pull down to refresh.
        </Text>
      </View>
    );
  }

  const hasKeyPoints = !!note.keyPoints?.length;
  const hasDecisions = !!note.decisions?.length;
  const hasNextSteps = !!note.nextSteps?.length;
  const hasSections = !!note.sections?.length;
  const hasAnything = note.summary || hasKeyPoints || hasDecisions || hasNextSteps || hasSections;

  if (!hasAnything) {
    return (
      <View style={[notesStyles.tabContent, { alignItems: 'center', paddingTop: 40 }]}>
        <Text style={{ fontSize: 14, color: '#6b7280' }}>No note content found.</Text>
      </View>
    );
  }

  return (
    <View style={notesStyles.tabContent}>
      {!!note.summary && (
        <View style={notesStyles.summaryCard}>
          <Text style={notesStyles.summaryLabel}>Summary</Text>
          <Text style={notesStyles.summaryText}>{note.summary}</Text>
        </View>
      )}
      {hasKeyPoints && (
        <NotesSectionBlock title="Key Points">
          <BulletList items={note.keyPoints!} />
        </NotesSectionBlock>
      )}
      {hasDecisions && (
        <NotesSectionBlock title="Decisions">
          <BulletList items={note.decisions!} />
        </NotesSectionBlock>
      )}
      {hasNextSteps && (
        <NotesSectionBlock title="Next Steps">
          <BulletList items={note.nextSteps!} />
        </NotesSectionBlock>
      )}
      {hasSections && note.sections.map((section: NoteSection) => (
        <NotesSectionBlock key={section.id} title={section.heading ?? section.title ?? ''}>
          <Text style={notesStyles.sectionContent}>{section.content}</Text>
        </NotesSectionBlock>
      ))}
    </View>
  );
}

const notesStyles = StyleSheet.create({
  tabContent: { padding: 20, gap: 20 },
  summaryCard: {
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: '#5B8DEF30',
    backgroundColor: '#5B8DEF0D', gap: 6,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, color: '#5B8DEF' },
  summaryText: { fontSize: 14, lineHeight: 21, color: '#111827' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionContent: { fontSize: 14, lineHeight: 21, color: '#6b7280' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function RecordingDetailScreen() {
  const route = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();
  const { getToken } = useAuth();
  const { id } = route.params;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [transcriptPage, setTranscriptPage] = useState(0);
  const [showExport, setShowExport] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const markReady = useReadyStore(s => s.markReady);
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const isProcessing = (status: string) => PROCESSING_STATUSES.includes(status);
  const loadRef = useRef<(silent?: boolean) => Promise<void>>(undefined);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const token = await getTokenRef.current();
      const inputParam = encodeURIComponent(JSON.stringify({ '0': { json: { id } } }));
      const url = `${API}/recordings.get?batch=1&input=${inputParam}`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const raw = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(raw)}`);

      const item = Array.isArray(raw) ? raw[0] : raw;
      if (item?.error) throw new Error(item.error.message ?? `tRPC error: ${JSON.stringify(item.error)}`);

      const rawData = item?.result?.data?.json ?? item?.result?.data;
      if (!rawData) throw new Error(`Unexpected response shape: ${JSON.stringify(raw)}`);

      const data: Recording = {
        ...rawData,
        note: rawData.note ?? rawData.notes?.[0] ?? null,
      };

      setRecording(data);

      const prevStatus = prevStatusRef.current;
      prevStatusRef.current = data.status;
      if (prevStatus && prevStatus !== 'READY' && data.status === 'READY') {
        markReady(data.id, data.title);
      }

      if (isProcessing(data.status)) {
        pollRef.current = setTimeout(() => void loadRef.current?.(true), 5000);
      }
    } catch (err: unknown) {
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      const msg = isAbort
        ? 'Request timed out. Check your internet connection.'
        : err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      clearTimeout(timeoutId);
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, markReady]);

  loadRef.current = load;

  useEffect(() => {
    void load();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [load]);

  const handleRefresh = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    setIsRefreshing(true);
    void load(true);
  };

  const handleToggleAction = useCallback(async (actionId: string, completed: boolean) => {
    try {
      const token = await getTokenRef.current();
      await trpcPost('recordings.updateActionItem', { id: actionId, status: completed ? 'COMPLETED' : 'OPEN' }, token);
      void loadRef.current?.(true);
    } catch {
      Alert.alert('Error', 'Could not update action item.');
    }
  }, []);

  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRetryStuck = useCallback(async () => {
    if (!recording) return;
    setIsRetrying(true);
    try {
      const token = await getTokenRef.current();
      const res = await trpcPost<{ success: boolean; reason?: string }>(
        'recordings.retryStuck',
        { recordingId: recording.id },
        token,
      );
      if (res?.success) {
        void loadRef.current?.(true);
      } else {
        Alert.alert('Cannot retry', res?.reason ?? 'Audio may have been purged.');
      }
    } catch (err) {
      Alert.alert('Retry failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setIsRetrying(false);
    }
  }, [recording]);

  const handleDeleteRecording = useCallback(() => {
    if (!recording) return;
    Alert.alert(
      'Delete recording?',
      'This will permanently delete the recording, any transcript, notes, and the audio file. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const token = await getTokenRef.current();
              await trpcPost('recordings.delete', { id: recording.id }, token);
              navigation.goBack();
            } catch (err) {
              setIsDeleting(false);
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Unknown error.');
            }
          },
        },
      ],
    );
  }, [recording, navigation]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5B8DEF" />
      </View>
    );
  }

  if (error || !recording) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#EF4444" />
        <Text style={styles.errorTitle}>Failed to load recording</Text>
        <Text style={styles.errorText}>{error ?? 'Unknown error'}</Text>
        <TouchableOpacity onPress={() => void load()} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const segments: TranscriptSegment[] = recording.transcript?.segments ?? [];
  const pagedSegments = segments.slice(transcriptPage * PAGE_SIZE, (transcriptPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(segments.length / PAGE_SIZE);

  const speakerIds = [...new Set(segments.map(s => s.speaker).filter(Boolean))] as string[];
  const speakerIndexMap: Record<string, number> = {};
  speakerIds.forEach((sid, i) => { speakerIndexMap[sid] = i; });

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <StatusBadge status={recording.status} size="sm" createdAt={recording.createdAt} />
        <TouchableOpacity
          onPress={() => setShowExport(true)}
          style={styles.headerShare}
        >
          <Ionicons name="share-outline" size={22} color="#5B8DEF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#5B8DEF" />
        }
      >
        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{recording.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={13} color="#6b7280" />
            <Text style={styles.metaText}>{formatDate(recording.createdAt)}</Text>
            {recording.duration != null && (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Ionicons name="time-outline" size={13} color="#6b7280" />
                <Text style={styles.metaText}>{formatDuration(recording.duration)}</Text>
              </>
            )}
          </View>
        </View>

        {/* Processing banner */}
        {isProcessing(recording.status) && (
          <View style={styles.banner}>
            <ActivityIndicator size="small" color="#5B8DEF" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.bannerTitle, { color: '#5B8DEF' }]}>
                {recording.status === 'TRANSCRIBING' ? 'Transcribing audio…' :
                 recording.status === 'SUMMARIZING' ? 'Generating notes…' : 'Processing…'}
              </Text>
              <Text style={styles.bannerSub}>This usually takes 1–3 minutes</Text>
            </View>
          </View>
        )}

        {/* Stuck banner */}
        {isProcessing(recording.status) && isStuck(recording.status, recording.createdAt) && (
          <View style={styles.stuckBanner}>
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <View style={{ flex: 1, gap: 10 }}>
              <View style={{ gap: 2 }}>
                <Text style={styles.stuckTitle}>Stuck?</Text>
                <Text style={styles.stuckSub}>
                  This recording has been processing for {formatStuckAge(recording.createdAt)}.
                </Text>
              </View>
              <View style={styles.stuckBtnRow}>
                <TouchableOpacity
                  style={[styles.stuckBtn, styles.stuckRetryBtn, isRetrying && { opacity: 0.6 }]}
                  onPress={handleRetryStuck}
                  disabled={isRetrying || isDeleting}
                  activeOpacity={0.8}
                >
                  {isRetrying ? (
                    <ActivityIndicator size="small" color="#B45309" />
                  ) : (
                    <Ionicons name="refresh" size={14} color="#B45309" />
                  )}
                  <Text style={styles.stuckRetryText}>
                    {isRetrying ? 'Retrying…' : 'Retry'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stuckBtn, styles.stuckDeleteBtn, isDeleting && { opacity: 0.6 }]}
                  onPress={handleDeleteRecording}
                  disabled={isRetrying || isDeleting}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={14} color="#ffffff" />
                  <Text style={styles.stuckDeleteText}>
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Failed banner */}
        {recording.status === 'FAILED' && (
          <View style={[styles.banner, { backgroundColor: '#FEE2E215', borderColor: '#EF444440' }]}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={[styles.bannerTitle, { color: '#EF4444' }]}>
              Processing failed. Please try uploading again.
            </Text>
          </View>
        )}

        {/* Tabs */}
        {recording.status === 'READY' && (
          <>
            <View style={styles.tabs}>
              {(['notes', 'transcript', 'actions', 'ai'] as Tab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: activeTab === tab ? '#5B8DEF' : '#6b7280' }]}>
                    {tab === 'ai' ? 'Ask AI' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'actions' && recording.note?.actionItems?.length
                      ? ` (${recording.note.actionItems.length})`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'notes' && <NotesTab note={recording.note} />}

            {activeTab === 'transcript' && (
              <View>
                {/* Real audio player — fetches pre-signed S3 URL on mount
                    (i.e. every time the Transcript tab is focused) and
                    gracefully degrades when the audio has been purged. */}
                <AudioPlayerBlock
                  recordingId={recording.id}
                  duration={recording.duration}
                />

                <View style={[styles.tabContent, { paddingTop: 16 }]}>
                  {/* Topic outline */}
                  {segments.length > 0 && (
                    <TopicOutline
                      segments={segments}
                      pageSize={PAGE_SIZE}
                      onTopicPress={(pageIndex) => setTranscriptPage(pageIndex)}
                    />
                  )}

                  {/* Segments */}
                  {segments.length === 0 ? (
                    <Text style={styles.emptyTab}>No transcript available</Text>
                  ) : (
                    <>
                      {pagedSegments.map((seg) => (
                        <TranscriptSegmentRow
                          key={seg.id}
                          segment={seg}
                          speakerIndex={seg.speaker ? speakerIndexMap[seg.speaker] : 0}
                        />
                      ))}
                      {totalPages > 1 && (
                        <View style={styles.pagination}>
                          <TouchableOpacity
                            disabled={transcriptPage === 0}
                            onPress={() => setTranscriptPage(transcriptPage - 1)}
                            style={[styles.pageBtn, { opacity: transcriptPage === 0 ? 0.3 : 1 }]}
                          >
                            <Ionicons name="chevron-back" size={18} color="#111827" />
                          </TouchableOpacity>
                          <Text style={styles.pageText}>{transcriptPage + 1} / {totalPages}</Text>
                          <TouchableOpacity
                            disabled={transcriptPage >= totalPages - 1}
                            onPress={() => setTranscriptPage(transcriptPage + 1)}
                            style={[styles.pageBtn, { opacity: transcriptPage >= totalPages - 1 ? 0.3 : 1 }]}
                          >
                            <Ionicons name="chevron-forward" size={18} color="#111827" />
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              </View>
            )}

            {activeTab === 'actions' && (
              <View style={styles.tabContent}>
                {!recording.note?.actionItems?.length ? (
                  <Text style={styles.emptyTab}>No action items extracted</Text>
                ) : (
                  recording.note.actionItems.map((item: ActionItem) => (
                    <ActionItemRow key={item.id} item={item} onToggle={handleToggleAction} />
                  ))
                )}
              </View>
            )}

            {activeTab === 'ai' && <AskAITab recordingId={recording.id} />}
          </>
        )}
      </ScrollView>

      {/* Export sheet */}
      <ExportSheet
        visible={showExport}
        recording={recording}
        segments={segments}
        onClose={() => setShowExport(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'center' },
  errorText: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  retryBtn: { paddingVertical: 8, paddingHorizontal: 20, backgroundColor: '#5B8DEF', borderRadius: 10 },
  retryText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  backLink: { marginTop: 4 },
  backLinkText: { fontSize: 14, color: '#6b7280' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  headerBack: { padding: 8 },
  headerShare: { padding: 8, marginLeft: 'auto' },
  titleBlock: { padding: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3, color: '#111827' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 13, color: '#6b7280' },
  metaDot: { fontSize: 13, color: '#9ca3af' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#5B8DEF15',
    borderColor: '#5B8DEF40',
    gap: 12,
  },
  bannerTitle: { fontSize: 14, fontWeight: '600' },
  bannerSub: { fontSize: 12, color: '#5B8DEF99' },
  stuckBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  stuckTitle: { fontSize: 14, fontWeight: '700', color: '#78350F' },
  stuckSub: { fontSize: 12, color: '#92400E', lineHeight: 17 },
  stuckBtnRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stuckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  stuckRetryBtn: {
    backgroundColor: '#FDE68A',
    borderWidth: 1,
    borderColor: '#D97706',
  },
  stuckRetryText: { fontSize: 13, fontWeight: '700', color: '#B45309' },
  stuckDeleteBtn: { backgroundColor: '#DC2626' },
  stuckDeleteText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#5B8DEF' },
  tabText: { fontSize: 14, fontWeight: '600' },
  tabContent: { padding: 20, gap: 16 },
  emptyTab: { textAlign: 'center', paddingTop: 20, fontSize: 14, color: '#6b7280' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 12,
  },
  pageBtn: {
    width: 36, height: 36, borderRadius: 10,
    borderWidth: 1, borderColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center',
  },
  pageText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
});

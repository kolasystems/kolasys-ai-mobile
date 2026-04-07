import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { trpc } from '../lib/trpc';
import type { Recording, Note, NoteSection, ActionItem, TranscriptSegment } from '../lib/trpc';
import { StatusBadge } from '../components/StatusBadge';
import { ActionItemRow } from '../components/ActionItemRow';
import { TranscriptSegmentRow } from '../components/TranscriptSegment';
import type { RecordingsStackParamList } from '../navigation/AppNavigator';

type RouteT = RouteProp<RecordingsStackParamList, 'RecordingDetail'>;
type NavT = NativeStackNavigationProp<RecordingsStackParamList, 'RecordingDetail'>;
type Tab = 'notes' | 'transcript' | 'actions';

const PROCESSING_STATUSES = ['PENDING', 'PROCESSING', 'TRANSCRIBING', 'SUMMARIZING'];

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

const PAGE_SIZE = 30;

// ─── Notes tab ────────────────────────────────────────────────────────────────

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

function NotesSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={notesStyles.sectionHeading}>{title}</Text>
      {children}
    </View>
  );
}

function NotesTab({ note }: { note: Note | null }) {
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
      {/* Summary */}
      {!!note.summary && (
        <View style={notesStyles.summaryCard}>
          <Text style={notesStyles.summaryLabel}>Summary</Text>
          <Text style={notesStyles.summaryText}>{note.summary}</Text>
        </View>
      )}

      {/* Key Points */}
      {hasKeyPoints && (
        <NotesSection title="Key Points">
          <BulletList items={note.keyPoints!} />
        </NotesSection>
      )}

      {/* Decisions */}
      {hasDecisions && (
        <NotesSection title="Decisions">
          <BulletList items={note.decisions!} />
        </NotesSection>
      )}

      {/* Next Steps */}
      {hasNextSteps && (
        <NotesSection title="Next Steps">
          <BulletList items={note.nextSteps!} />
        </NotesSection>
      )}

      {/* Custom sections — handle both `heading` and `title` field names */}
      {hasSections && note.sections.map((section: NoteSection) => {
        const sectionTitle = section.heading ?? section.title ?? '';
        return (
          <NotesSection key={section.id} title={sectionTitle}>
            <Text style={notesStyles.sectionContent}>{section.content}</Text>
          </NotesSection>
        );
      })}
    </View>
  );
}

const notesStyles = StyleSheet.create({
  tabContent: { padding: 20, gap: 20 },
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5B8DEF30',
    backgroundColor: '#5B8DEF0D',
    gap: 6,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#5B8DEF',
  },
  summaryText: { fontSize: 14, lineHeight: 21, color: '#111827' },
  sectionHeading: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionContent: { fontSize: 14, lineHeight: 21, color: '#6b7280' },
});

export default function RecordingDetailScreen() {
  const route = useRoute<RouteT>();
  const navigation = useNavigation<NavT>();
  const { id } = route.params;

  const [activeTab, setActiveTab] = useState<Tab>('notes');
  const [transcriptPage, setTranscriptPage] = useState(0);

  const isProcessing = (status: string) => PROCESSING_STATUSES.includes(status);

  const { data: recording, isLoading, refetch, isRefetching } = trpc.recordings.get.useQuery(
    { id },
    {
      refetchInterval: (query: unknown) => {
        const data = (query as any)?.state?.data as Recording | null | undefined;
        return data && isProcessing(data.status) ? 5000 : false;
      },
    },
  );

  // Debug: log full API response to help diagnose missing note fields
  console.log('[RecordingDetail] recording:', JSON.stringify(recording, null, 2));

  const updateActionItem = trpc.recordings.updateActionItem.useMutation({
    onSuccess: () => { void refetch(); },
  });

  const handleToggleAction = useCallback(
    (actionId: string, completed: boolean) => {
      updateActionItem.mutate({ id: actionId, status: completed ? 'COMPLETED' : 'OPEN' });
    },
    [updateActionItem],
  );

  const handleShare = useCallback(async () => {
    if (!recording?.note) return;
    const note = recording.note;
    const lines: string[] = [`# ${recording.title}`, formatDate(recording.createdAt), '', '## Summary', note.summary, ''];
    if (note.keyPoints?.length) {
      lines.push('## Key Points', ...note.keyPoints.map((p) => `- ${p}`), '');
    }
    if (note.decisions?.length) {
      lines.push('## Decisions', ...note.decisions.map((d) => `- ${d}`), '');
    }
    if (note.nextSteps?.length) {
      lines.push('## Next Steps', ...note.nextSteps.map((s) => `- ${s}`), '');
    }
    note.sections?.forEach((s: NoteSection) => {
      const heading = s.heading ?? s.title ?? '';
      lines.push(`## ${heading}`, s.content, '');
    });
    if (note.actionItems?.length) {
      lines.push('## Action Items');
      note.actionItems.forEach((a: ActionItem) => {
        lines.push(`- [ ] ${a.title}${a.assignee ? ` (@${a.assignee})` : ''}`);
      });
    }
    await Share.share({ message: lines.join('\n'), title: recording.title });
  }, [recording]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5B8DEF" />
      </View>
    );
  }

  if (!recording) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#6b7280" />
        <Text style={styles.errorText}>Recording not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const segments: TranscriptSegment[] = recording.transcript?.segments ?? [];
  const pagedSegments = segments.slice(transcriptPage * PAGE_SIZE, (transcriptPage + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(segments.length / PAGE_SIZE);

  const speakerIds = [...new Set(segments.map((s) => s.speaker).filter(Boolean))] as string[];
  const speakerIndexMap: Record<string, number> = {};
  speakerIds.forEach((sid, i) => { speakerIndexMap[sid] = i; });

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <StatusBadge status={recording.status} size="sm" />
        {recording.note && (
          <TouchableOpacity onPress={() => void handleShare()} style={styles.headerShare}>
            <Ionicons name="share-outline" size={22} color="#5B8DEF" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor="#5B8DEF" />
        }
      >
        {/* Title block */}
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

        {/* Failed banner */}
        {recording.status === 'FAILED' && (
          <View style={[styles.banner, { backgroundColor: '#FEE2E215', borderColor: '#EF444440' }]}>
            <Ionicons name="alert-circle" size={20} color="#EF4444" />
            <Text style={[styles.bannerTitle, { color: '#EF4444' }]}>Processing failed. Please try uploading again.</Text>
          </View>
        )}

        {/* Tabs */}
        {recording.status === 'READY' && (
          <>
            <View style={styles.tabs}>
              {(['notes', 'transcript', 'actions'] as Tab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.tab, activeTab === tab && styles.tabActive]}
                  onPress={() => setActiveTab(tab)}
                >
                  <Text style={[styles.tabText, { color: activeTab === tab ? '#5B8DEF' : '#6b7280' }]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'actions' && recording.note?.actionItems?.length
                      ? ` (${recording.note.actionItems.length})`
                      : ''}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'notes' && (
              <NotesTab note={recording.note ?? null} />
            )}

            {activeTab === 'transcript' && (
              <View style={styles.tabContent}>
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
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 16, color: '#6b7280' },
  backLink: { marginTop: 8 },
  backLinkText: { fontSize: 15, color: '#5B8DEF', fontWeight: '600' },
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
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
});

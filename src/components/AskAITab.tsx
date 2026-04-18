import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { useTheme } from '../lib/theme';

const ASK_URL = 'https://app.kolasys.ai/api/ai/ask';

type Role = 'user' | 'assistant';

interface Source {
  index: number;
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  startTime: number | null;
  similarity: number;
}

interface Message {
  id: string;
  role: Role;
  content: string;
  sources?: Source[];
}

function nid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse accumulated SSE buffer, return an array of parsed events + remainder.
 * Events are `data: {...}\n\n` separated.
 */
function parseSSE(buffer: string): { events: any[]; remainder: string } {
  const events: any[] = [];
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const raw = line.slice(6).trim();
    if (!raw || raw === '[DONE]') continue;
    try {
      events.push(JSON.parse(raw));
    } catch {
      // Incomplete JSON — skip; the remainder will pick it up next pass
    }
  }
  return { events, remainder };
}

export function AskAITab({ recordingId }: { recordingId: string }) {
  const { getToken } = useAuth();
  const { colors } = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;
    setError(null);

    const userMsg: Message = { id: nid(), role: 'user', content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoading(true);

    const assistantId = nid();
    setMessages((m) => [...m, { id: assistantId, role: 'assistant', content: '', sources: [] }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

    try {
      const token = await getToken();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', ASK_URL, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

        let processed = 0;
        let buffer = '';

        const consume = () => {
          const chunk = xhr.responseText.slice(processed);
          processed = xhr.responseText.length;
          buffer += chunk;
          const { events, remainder } = parseSSE(buffer);
          buffer = remainder;

          for (const event of events) {
            if (event.type === 'text' && typeof event.text === 'string') {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantId);
                if (idx === -1) return prev;
                const copy = [...prev];
                copy[idx] = { ...copy[idx], content: copy[idx].content + event.text };
                return copy;
              });
              setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 10);
            } else if (event.type === 'sources' && Array.isArray(event.sources)) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === assistantId);
                if (idx === -1) return prev;
                const copy = [...prev];
                copy[idx] = { ...copy[idx], sources: event.sources };
                return copy;
              });
            } else if (event.type === 'error') {
              setError(event.message ?? 'Streaming error.');
            }
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === XMLHttpRequest.LOADING) consume();
          if (xhr.readyState === XMLHttpRequest.DONE) {
            consume();
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText.slice(0, 200)}`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error.'));

        xhr.send(
          JSON.stringify({
            recordingId,
            messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        );
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
      // Drop the empty assistant placeholder if nothing streamed in
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.id === assistantId && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, isLoading, messages, recordingId]);

  const submit = () => {
    const content = input.trim();
    if (!content) return;
    setInput('');
    void send(content);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 && !isLoading && (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="sparkles" size={22} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              Ask AI about this meeting
            </Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Questions are answered using only this recording's transcript.
            </Text>
            <View style={styles.suggestions}>
              {[
                'Summarize the meeting',
                'What did we decide?',
                'List next steps by owner',
              ].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestion, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => void send(s)}
                >
                  <Text style={[styles.suggestionText, { color: colors.textSecondary }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.bubble,
              m.role === 'user'
                ? { backgroundColor: colors.accent, alignSelf: 'flex-end', borderBottomRightRadius: 4 }
                : { backgroundColor: colors.surfaceMuted, alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
            ]}
          >
            <Text
              style={[
                styles.bubbleText,
                { color: m.role === 'user' ? '#ffffff' : colors.textPrimary },
              ]}
            >
              {m.content || (isLoading ? '...' : '')}
            </Text>
            {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
              <View style={[styles.sources, { borderTopColor: colors.border }]}>
                <Text style={[styles.sourcesLabel, { color: colors.textMuted }]}>Sources</Text>
                {m.sources.map((src) => (
                  <Text
                    key={src.index}
                    style={[styles.sourceLine, { color: colors.textSecondary }]}
                    numberOfLines={2}
                  >
                    [{src.index}] {src.chunkText}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.inputRow,
          { borderTopColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.textPrimary }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything about this meeting..."
          placeholderTextColor={colors.textMuted}
          multiline
          editable={!isLoading}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={submit}
          disabled={!input.trim() || isLoading}
          style={[
            styles.sendBtn,
            { backgroundColor: colors.accent },
            (!input.trim() || isLoading) && { opacity: 0.4 },
          ]}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="arrow-up" size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 400 },
  list: { flex: 1 },
  listContent: { padding: 20, gap: 12, flexGrow: 1 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#5B8DEF15',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  emptySub: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },
  suggestions: { gap: 8, alignSelf: 'stretch', marginTop: 8 },
  suggestion: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  suggestionText: { fontSize: 13, color: '#374151' },
  bubble: {
    maxWidth: '88%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 8,
  },
  bubbleUser: { backgroundColor: '#5B8DEF', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#f3f4f6', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20, color: '#111827' },
  sources: { gap: 4, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  sourcesLabel: { fontSize: 10, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  sourceLine: { fontSize: 11, color: '#6b7280', lineHeight: 15 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderRadius: 10,
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5',
  },
  errorText: { flex: 1, fontSize: 13, color: '#991B1B' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    fontSize: 14,
    color: '#111827',
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#5B8DEF',
    alignItems: 'center', justifyContent: 'center',
  },
});

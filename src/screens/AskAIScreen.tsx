import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@clerk/clerk-expo';
import { trpcPost } from '../lib/api';
import { useTheme } from '../lib/theme';

interface Source {
  index: number;
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  startTime: number | null;
  similarity: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
}

const SUGGESTIONS = [
  'What were my action items this week?',
  'Who did I meet with last week?',
  'What decisions were made in recent meetings?',
];

function TypingIndicator() {
  const { colors } = useTheme();
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);
  return (
    <View style={styles.typingRow}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.textMuted,
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
          }}
        />
      ))}
    </View>
  );
}

export default function AskAIScreen() {
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const send = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || sending) return;
    setInput('');
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    try {
      const token = await getTokenRef.current();
      const res = await trpcPost<{ answer?: string; sources?: Source[] } | unknown>(
        'search.askAI',
        { question: q },
        token,
      );
      const typed = (res ?? {}) as { answer?: string; sources?: Source[] };
      const assistant: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: typed.answer ?? 'I couldn\u2019t generate an answer right now.',
        sources: typed.sources,
      };
      setMessages((prev) => [...prev, assistant]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', text: `Error: ${msg}` },
      ]);
    } finally {
      setSending(false);
    }
  }, [sending]);

  const openRecording = (recordingId: string) => {
    navigation.navigate('Recordings', {
      screen: 'RecordingDetail',
      params: { id: recordingId },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
    >
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 6 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Ask AI</Text>
        <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
          Answers drawn from your meetings.
        </Text>
      </View>

      {messages.length === 0 && !sending ? (
        <View style={{ flex: 1, padding: 20, gap: 10 }}>
          <Text style={[styles.suggestLabel, { color: colors.textMuted }]}>TRY ASKING</Text>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => void send(s)}
              style={[
                styles.suggestChip,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles-outline" size={15} color={colors.accent} />
              <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>{s}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <FlatList
          inverted
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListHeaderComponent={sending ? <TypingIndicator /> : null}
          renderItem={({ item }) => {
            const isUser = item.role === 'user';
            return (
              <View
                style={[
                  styles.bubble,
                  isUser
                    ? { backgroundColor: '#CA2625', alignSelf: 'flex-end', borderBottomRightRadius: 4 }
                    : {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                        alignSelf: 'flex-start',
                        borderBottomLeftRadius: 4,
                      },
                ]}
              >
                <Text style={{ color: isUser ? '#ffffff' : colors.textPrimary, fontSize: 14, lineHeight: 20 }}>
                  {item.text}
                </Text>
                {!isUser && item.sources && item.sources.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {item.sources.map((s) => (
                      <TouchableOpacity
                        key={`${s.recordingId}-${s.index}`}
                        style={[styles.sourceChip, { backgroundColor: colors.accentSoft }]}
                        onPress={() => openRecording(s.recordingId)}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.accent }}>
                          [{s.index}]
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.accent }} numberOfLines={1}>
                          {s.recordingTitle}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}

      <View
        style={[
          styles.inputRow,
          { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: insets.bottom + 8 },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask about your meetings…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { backgroundColor: colors.surfaceMuted, color: colors.textPrimary }]}
          multiline
          editable={!sending}
          onSubmitEditing={() => void send(input)}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <TouchableOpacity
          onPress={() => void send(input)}
          disabled={!input.trim() || sending}
          style={[
            styles.sendBtn,
            { backgroundColor: colors.accent, opacity: !input.trim() || sending ? 0.4 : 1 },
          ]}
          activeOpacity={0.8}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Ionicons name="paper-plane" size={18} color="#ffffff" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  suggestLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  suggestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  bubble: { maxWidth: '88%', padding: 12, borderRadius: 16 },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: 180,
  },
  typingRow: {
    flexDirection: 'row',
    gap: 4,
    alignSelf: 'flex-start',
    padding: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 21,
    fontSize: 14,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

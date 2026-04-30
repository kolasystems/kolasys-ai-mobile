import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Switch,
  TextInput,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { SettingsStackParamList } from '../navigation/AppNavigator';
import { useTheme, type ThemeColors } from '../lib/theme';
import { trpcGet, trpcPost } from '../lib/api';

function Row({
  icon,
  label,
  value,
  onPress,
  destructive,
  rightSlot,
  colors,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  rightSlot?: React.ReactNode;
  colors: ThemeColors;
}) {
  const accent = destructive ? colors.danger : colors.accent;
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: destructive ? colors.danger + '1E' : colors.accentSoft },
        ]}
      >
        <Ionicons name={icon as never} size={18} color={accent} />
      </View>
      <Text
        style={[
          styles.rowLabel,
          { color: destructive ? colors.danger : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
      {rightSlot ? (
        rightSlot
      ) : value ? (
        <Text style={[styles.rowValue, { color: colors.textSecondary }]}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }: { navigation: NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'> }) {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut, getToken } = useAuth();
  const { colors, mode, isDark, toggleDark } = useTheme();

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'User';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  const themeStatus = useMemo(() => {
    if (mode === 'system') return `System (${isDark ? 'Dark' : 'Light'})`;
    return mode === 'dark' ? 'Dark' : 'Light';
  }, [mode, isDark]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // ── Org settings (audio retention + bot name) ───────────────────────────────
  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const [deleteAudio, setDeleteAudio] = useState<boolean>(false);
  const [botName, setBotName] = useState<string>('');
  const [botNameDraft, setBotNameDraft] = useState<string>('');
  const [orgSettingsLoaded, setOrgSettingsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const data = await trpcGet<{
          deleteAudioAfterTranscription?: boolean;
          botDisplayName?: string;
        }>('settings.getOrgSettings', {}, token);
        if (cancelled) return;
        setDeleteAudio(!!data?.deleteAudioAfterTranscription);
        setBotName(data?.botDisplayName ?? '');
        setBotNameDraft(data?.botDisplayName ?? '');
        setOrgSettingsLoaded(true);
      } catch {
        // procedure may not be deployed — leave defaults
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persistOrgSettings = async (patch: { deleteAudioAfterTranscription?: boolean; botDisplayName?: string }) => {
    try {
      const token = await getTokenRef.current();
      await trpcPost('settings.updateOrgSettings', patch, token);
    } catch (err) {
      Alert.alert('Save failed', err instanceof Error ? err.message : 'Could not update settings.');
    }
  };

  const handleToggleDeleteAudio = (next: boolean) => {
    setDeleteAudio(next);
    void persistOrgSettings({ deleteAudioAfterTranscription: next });
  };

  const handleBotNameBlur = () => {
    const trimmed = botNameDraft.trim();
    if (trimmed === botName) return;
    setBotName(trimmed);
    void persistOrgSettings({ botDisplayName: trimmed });
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View
        style={[
          styles.profileCard,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ gap: 3, flex: 1 }}>
          <Text style={[styles.profileName, { color: colors.textPrimary }]}>{fullName}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{email}</Text>
        </View>
      </View>

      {/* Data */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>DATA</Text>
      <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Row
          icon="people-outline"
          label="Contacts"
          value="Meeting participants"
          onPress={() => navigation.navigate('Contacts')}
          colors={colors}
        />
        <Row
          icon="bar-chart-outline"
          label="Analytics"
          value="Meeting intelligence"
          onPress={() => navigation.navigate('Analytics')}
          colors={colors}
        />
      </View>

      {/* Subscription */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>SUBSCRIPTION</Text>
      <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <Row
          icon="card-outline"
          label="Billing"
          value="Plan & subscription"
          onPress={() => (navigation as any).navigate('Billing')}
          colors={colors}
        />
      </View>

      {/* Organization */}
      {orgSettingsLoaded && (
        <>
          <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ORGANIZATION</Text>
          <View style={[styles.section, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Row
              icon="trash-outline"
              label="Auto-delete audio after transcription"
              colors={colors}
              rightSlot={
                <Switch
                  value={deleteAudio}
                  onValueChange={handleToggleDeleteAudio}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#ffffff"
                  ios_backgroundColor={colors.border}
                />
              }
            />
            <Row
              icon="person-circle-outline"
              label="Bot display name"
              colors={colors}
              rightSlot={
                <TextInput
                  value={botNameDraft}
                  onChangeText={setBotNameDraft}
                  onBlur={handleBotNameBlur}
                  placeholder="Kolasys Bot"
                  placeholderTextColor={colors.textMuted}
                  returnKeyType="done"
                  onSubmitEditing={handleBotNameBlur}
                  style={[styles.botInput, { color: colors.textPrimary, borderColor: colors.border }]}
                />
              }
            />
          </View>
        </>
      )}

      {/* Appearance */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>APPEARANCE</Text>
      <View
        style={[
          styles.section,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Row
          icon={isDark ? 'moon' : 'sunny'}
          label="Dark Mode"
          value={themeStatus}
          colors={colors}
          rightSlot={
            <Switch
              value={isDark}
              onValueChange={toggleDark}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor="#ffffff"
              ios_backgroundColor={colors.border}
            />
          }
        />
      </View>

      {/* Account */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]}>ACCOUNT</Text>
      <View
        style={[
          styles.section,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Row
          icon="globe-outline"
          label="Web App"
          value="app.kolasys.ai"
          onPress={() => void Linking.openURL('https://app.kolasys.ai')}
          colors={colors}
        />
        <Row
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => void Linking.openURL('https://kolasys.ai/privacy')}
          colors={colors}
        />
        <Row
          icon="document-outline"
          label="Terms of Service"
          onPress={() => void Linking.openURL('https://kolasys.ai/terms')}
          colors={colors}
        />
        <Row icon="information-circle-outline" label="Version" value={appVersion} colors={colors} />
      </View>

      {/* Sign out */}
      <Text style={[styles.sectionHeader, { color: colors.textMuted }]} />
      <View
        style={[
          styles.section,
          { borderColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <Row icon="log-out-outline" label="Sign Out" onPress={handleSignOut} destructive colors={colors} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 4 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  profileName: { fontSize: 17, fontWeight: '700' },
  profileEmail: { fontSize: 13 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
    paddingTop: 12,
    paddingBottom: 6,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15 },
  rowValue: { fontSize: 13 },
  botInput: {
    minWidth: 120,
    maxWidth: 180,
    fontSize: 14,
    textAlign: 'right',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
  },
});

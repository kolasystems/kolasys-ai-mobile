import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  useColorScheme,
  Linking,
} from 'react-native';
import { useUser, useAuth, useOrganization, useOrganizationList } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, Colors } from '../lib/theme';

function SettingRow({
  icon,
  label,
  value,
  onPress,
  destructive,
  toggle,
  toggleValue,
  onToggle,
  theme,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.settingRow, { borderBottomColor: theme.border }]}
      onPress={onPress}
      disabled={toggle || !onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: (destructive ? Colors.failed : Colors.primary) + '18' }]}>
        <Ionicons name={icon as never} size={18} color={destructive ? Colors.failed : Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: destructive ? Colors.failed : theme.text }]}>{label}</Text>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: theme.border, true: Colors.primary }}
          thumbColor={Colors.white}
        />
      ) : value ? (
        <Text style={[styles.settingValue, { color: theme.textSecondary }]}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
      ) : null}
    </TouchableOpacity>
  );
}

function SectionHeader({ title, theme }: { title: string; theme: ReturnType<typeof getThemeColors> }) {
  return (
    <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>{title}</Text>
  );
}

export default function SettingsScreen() {
  const isDark = useColorScheme() === 'dark';
  const theme = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { organization } = useOrganization();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => void signOut(),
      },
    ]);
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: Colors.primary }]}>
          <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: theme.text }]}>{fullName}</Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{email}</Text>
        </View>
      </View>

      {/* Organisation */}
      {organization && (
        <>
          <SectionHeader title="ORGANISATION" theme={theme} />
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SettingRow
              icon="business-outline"
              label={organization.name}
              value="Active org"
              theme={theme}
            />
          </View>
        </>
      )}

      {/* Integrations */}
      <SectionHeader title="INTEGRATIONS" theme={theme} />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SettingRow
          icon="logo-slack"
          label="Slack"
          value="Connect"
          onPress={() => Alert.alert('Slack', 'Configure Slack integration in the web app at app.kolasys.ai')}
          theme={theme}
        />
        <SettingRow
          icon="document-text-outline"
          label="Notion"
          value="Connect"
          onPress={() => Alert.alert('Notion', 'Configure Notion integration in the web app at app.kolasys.ai')}
          theme={theme}
        />
        <SettingRow
          icon="calendar-outline"
          label="Google Calendar"
          value="Connected"
          theme={theme}
        />
      </View>

      {/* Notifications */}
      <SectionHeader title="NOTIFICATIONS" theme={theme} />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SettingRow
          icon="notifications-outline"
          label="Notes ready alerts"
          toggle
          toggleValue={notificationsEnabled}
          onToggle={setNotificationsEnabled}
          theme={theme}
        />
        <SettingRow
          icon="mail-outline"
          label="Weekly digest email"
          toggle
          toggleValue={weeklyDigestEnabled}
          onToggle={setWeeklyDigestEnabled}
          theme={theme}
        />
      </View>

      {/* About */}
      <SectionHeader title="ABOUT" theme={theme} />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SettingRow
          icon="globe-outline"
          label="Web App"
          value="app.kolasys.ai"
          onPress={() => void Linking.openURL('https://app.kolasys.ai')}
          theme={theme}
        />
        <SettingRow
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => void Linking.openURL('https://kolasys.ai/privacy')}
          theme={theme}
        />
        <SettingRow
          icon="document-outline"
          label="Terms of Service"
          onPress={() => void Linking.openURL('https://kolasys.ai/terms')}
          theme={theme}
        />
        <SettingRow
          icon="information-circle-outline"
          label="Version"
          value="1.0.0"
          theme={theme}
        />
      </View>

      {/* Sign Out */}
      <SectionHeader title="" theme={theme} />
      <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SettingRow
          icon="log-out-outline"
          label="Sign Out"
          onPress={handleSignOut}
          destructive
          theme={theme}
        />
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
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  profileInfo: { gap: 3 },
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
  section: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  settingIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 15 },
  settingValue: { fontSize: 13 },
});

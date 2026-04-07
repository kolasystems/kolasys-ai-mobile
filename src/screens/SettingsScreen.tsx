import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useUser, useAuth, useOrganization } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../lib/theme';

function SettingRow({
  icon,
  label,
  value,
  onPress,
  destructive,
  toggle,
  toggleValue,
  onToggle,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={toggle || !onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.settingIcon, { backgroundColor: (destructive ? Colors.failed : Colors.primary) + '18' }]}>
        <Ionicons name={icon as never} size={18} color={destructive ? Colors.failed : Colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: destructive ? Colors.failed : '#111827' }]}>{label}</Text>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: '#e5e7eb', true: Colors.primary }}
          thumbColor={Colors.white}
        />
      ) : value ? (
        <Text style={styles.settingValue}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color="#6b7280" />
      ) : null}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();
  const { organization } = useOrganization();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [weeklyDigestEnabled, setWeeklyDigestEnabled] = useState(true);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{fullName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{fullName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>
      </View>

      {/* Organisation */}
      {organization && (
        <>
          <SectionHeader title="ORGANISATION" />
          <View style={styles.section}>
            <SettingRow icon="business-outline" label={organization.name} value="Active org" />
          </View>
        </>
      )}

      {/* Integrations */}
      <SectionHeader title="INTEGRATIONS" />
      <View style={styles.section}>
        <SettingRow
          icon="logo-slack"
          label="Slack"
          value="Connect"
          onPress={() => Alert.alert('Slack', 'Configure Slack integration in the web app at app.kolasys.ai')}
        />
        <SettingRow
          icon="document-text-outline"
          label="Notion"
          value="Connect"
          onPress={() => Alert.alert('Notion', 'Configure Notion integration in the web app at app.kolasys.ai')}
        />
        <SettingRow icon="calendar-outline" label="Google Calendar" value="Connected" />
      </View>

      {/* Notifications */}
      <SectionHeader title="NOTIFICATIONS" />
      <View style={styles.section}>
        <SettingRow
          icon="notifications-outline"
          label="Notes ready alerts"
          toggle
          toggleValue={notificationsEnabled}
          onToggle={setNotificationsEnabled}
        />
        <SettingRow
          icon="mail-outline"
          label="Weekly digest email"
          toggle
          toggleValue={weeklyDigestEnabled}
          onToggle={setWeeklyDigestEnabled}
        />
      </View>

      {/* About */}
      <SectionHeader title="ABOUT" />
      <View style={styles.section}>
        <SettingRow
          icon="globe-outline"
          label="Web App"
          value="app.kolasys.ai"
          onPress={() => void Linking.openURL('https://app.kolasys.ai')}
        />
        <SettingRow
          icon="shield-checkmark-outline"
          label="Privacy Policy"
          onPress={() => void Linking.openURL('https://kolasys.ai/privacy')}
        />
        <SettingRow
          icon="document-outline"
          label="Terms of Service"
          onPress={() => void Linking.openURL('https://kolasys.ai/terms')}
        />
        <SettingRow icon="information-circle-outline" label="Version" value="1.0.0" />
      </View>

      {/* Sign Out */}
      <SectionHeader title="" />
      <View style={styles.section}>
        <SettingRow icon="log-out-outline" label="Sign Out" onPress={handleSignOut} destructive />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  content: { padding: 16, gap: 4 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    marginBottom: 20,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  avatarText: { color: Colors.white, fontSize: 22, fontWeight: '700' },
  profileInfo: { gap: 3 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#111827' },
  profileEmail: { fontSize: 13, color: '#6b7280' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingLeft: 4,
    paddingTop: 12,
    paddingBottom: 6,
    color: '#6b7280',
  },
  section: { borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#ffffff', overflow: 'hidden' },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  settingIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 15 },
  settingValue: { fontSize: 13, color: '#6b7280' },
});

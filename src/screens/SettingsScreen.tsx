import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
} from 'react-native';
import { useUser, useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';

function Row({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const color = destructive ? '#EF4444' : '#5B8DEF';
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.rowIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as never} size={18} color={color} />
      </View>
      <Text style={[styles.rowLabel, destructive && { color: '#EF4444' }]}>{label}</Text>
      {value ? (
        <Text style={styles.rowValue}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { signOut } = useAuth();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'User';
  const email = user?.primaryEmailAddress?.emailAddress ?? '';
  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '1.0.0';

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

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
        <View style={{ gap: 3 }}>
          <Text style={styles.profileName}>{fullName}</Text>
          <Text style={styles.profileEmail}>{email}</Text>
        </View>
      </View>

      {/* Account */}
      <Text style={styles.sectionHeader}>ACCOUNT</Text>
      <View style={styles.section}>
        <Row icon="globe-outline" label="Web App" value="app.kolasys.ai"
          onPress={() => void Linking.openURL('https://app.kolasys.ai')} />
        <Row icon="shield-checkmark-outline" label="Privacy Policy"
          onPress={() => void Linking.openURL('https://kolasys.ai/privacy')} />
        <Row icon="document-outline" label="Terms of Service"
          onPress={() => void Linking.openURL('https://kolasys.ai/terms')} />
        <Row icon="information-circle-outline" label="Version" value={appVersion} />
      </View>

      {/* Sign out */}
      <Text style={styles.sectionHeader} />
      <View style={styles.section}>
        <Row icon="log-out-outline" label="Sign Out" onPress={handleSignOut} destructive />
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
    marginBottom: 20,
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#5B8DEF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
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
  section: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
    gap: 12,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: 15, color: '#111827' },
  rowValue: { fontSize: 13, color: '#6b7280' },
});

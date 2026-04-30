import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { LinearGradient } from 'expo-linear-gradient';
import { trpcGet } from '../lib/api';
import { useTheme } from '../lib/theme';

type Plan = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
type Status = 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'none';

interface Subscription {
  plan: Plan;
  status: Status;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  recordingsThisMonth: number;
  recordingsLimit: number | null; // null = unlimited
  seats?: number;
}

const STRIPE_CHECKOUT = 'https://app.kolasys.ai/api/stripe/checkout';
const STRIPE_PORTAL = 'https://app.kolasys.ai/api/stripe/portal';

// TODO: replace with real Stripe price IDs from the dashboard
const PRICE_IDS = {
  pro: 'price_pro_monthly',
  team: 'price_team_monthly_per_seat',
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function BillingScreen() {
  const { colors, isDark } = useTheme();
  const { getToken } = useAuth();
  const insets = useSafeAreaInsets();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [redirecting, setRedirecting] = useState<string | null>(null);

  const getTokenRef = useRef(getToken);
  useEffect(() => { getTokenRef.current = getToken; });

  const load = useCallback(async (silent = false) => {
    if (!silent) setSub(null);
    setError(null);
    try {
      const token = await getTokenRef.current();
      const data = await trpcGet<Subscription>('billing.getSubscription', {}, token);
      setSub(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscription.');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startCheckout = async (priceId: string, label: string) => {
    setRedirecting(label);
    try {
      const token = await getTokenRef.current();
      const res = await fetch(STRIPE_CHECKOUT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ priceId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const url = json?.url ?? json?.checkoutUrl;
      if (!url) throw new Error('No checkout URL returned.');
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Checkout failed', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setRedirecting(null);
    }
  };

  const openPortal = async () => {
    setRedirecting('portal');
    try {
      const token = await getTokenRef.current();
      const res = await fetch(STRIPE_PORTAL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const url = json?.url ?? json?.portalUrl;
      if (!url) throw new Error('No portal URL returned.');
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Could not open portal', err instanceof Error ? err.message : 'Unknown error.');
    } finally {
      setRedirecting(null);
    }
  };

  const gradientColors: [string, string] = isDark
    ? ['#1a0a0a', '#2d1515']
    : ['#fff5f5', '#ffe0e0'];

  const plan = sub?.plan ?? 'FREE';
  const isPaid = plan === 'PRO' || plan === 'TEAM' || plan === 'ENTERPRISE';
  const trialDaysLeft = sub?.trialEndsAt && sub.status === 'trialing'
    ? daysUntil(sub.trialEndsAt)
    : null;
  const limit = sub?.recordingsLimit ?? null;
  const used = sub?.recordingsThisMonth ?? 0;
  const usagePct = limit ? Math.min(1, used / limit) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Billing</Text>
        <View style={styles.planRow}>
          <View style={[styles.planBadge, { backgroundColor: '#CA2625' }]}>
            <Text style={styles.planBadgeText}>{plan}</Text>
          </View>
          {sub?.status === 'trialing' && (
            <View style={[styles.statusBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>TRIAL</Text>
            </View>
          )}
          {sub?.status === 'past_due' && (
            <View style={[styles.statusBadge, { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }]}>
              <Text style={[styles.statusText, { color: '#7F1D1D' }]}>PAYMENT FAILED</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(true); }}
            tintColor={colors.accent}
          />
        }
      >
        {sub === null && !error && (
          <View style={styles.empty}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}

        {error && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Trial countdown */}
        {trialDaysLeft != null && (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.accentSoft, borderColor: colors.accent },
            ]}
          >
            <Ionicons name="timer-outline" size={20} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.accent }]}>
              Trial ends in {trialDaysLeft} {trialDaysLeft === 1 ? 'day' : 'days'}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>
              Pick a plan below to keep transcribing.
            </Text>
          </View>
        )}

        {/* Usage */}
        {sub && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>USAGE THIS MONTH</Text>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              {used} {limit !== null ? `/ ${limit}` : ''} recordings
            </Text>
            {limit !== null && (
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: usagePct > 0.9 ? colors.danger : colors.accent,
                      width: `${Math.round(usagePct * 100)}%`,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}

        {/* Plans (free or no-trial state) */}
        {sub && !isPaid && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>UPGRADE</Text>

            <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.planCardTop}>
                <Text style={[styles.planName, { color: colors.textPrimary }]}>Pro</Text>
                <Text style={[styles.price, { color: colors.textPrimary }]}>$9.99<Text style={{ fontSize: 12, color: colors.textMuted }}>/month</Text></Text>
              </View>
              <Text style={[styles.planDesc, { color: colors.textSecondary }]}>
                Unlimited transcription, exports, AI summaries, and integrations for solo users.
              </Text>
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: '#CA2625' }]}
                onPress={() => void startCheckout(PRICE_IDS.pro, 'pro')}
                disabled={redirecting !== null}
                activeOpacity={0.85}
              >
                {redirecting === 'pro' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.ctaText}>Start Trial</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.planCardTop}>
                <Text style={[styles.planName, { color: colors.textPrimary }]}>Team</Text>
                <Text style={[styles.price, { color: colors.textPrimary }]}>$8.99<Text style={{ fontSize: 12, color: colors.textMuted }}>/seat/month</Text></Text>
              </View>
              <Text style={[styles.planDesc, { color: colors.textSecondary }]}>
                Everything in Pro plus shared workspaces, team analytics, and admin controls.
              </Text>
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: '#CA2625' }]}
                onPress={() => void startCheckout(PRICE_IDS.team, 'team')}
                disabled={redirecting !== null}
                activeOpacity={0.85}
              >
                {redirecting === 'team' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.ctaText}>Start Trial</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Manage subscription (paid) */}
        {sub && isPaid && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SUBSCRIPTION</Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {sub.currentPeriodEnd && (
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                </Text>
              )}
              {sub.seats != null && (
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  {sub.seats} seat{sub.seats === 1 ? '' : 's'}
                </Text>
              )}
              <TouchableOpacity
                style={[styles.cta, { backgroundColor: colors.accent, marginTop: 8 }]}
                onPress={() => void openPortal()}
                disabled={redirecting !== null}
                activeOpacity={0.85}
              >
                {redirecting === 'portal' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.ctaText}>Manage Subscription</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    gap: 10,
  },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  planRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  planBadgeText: { color: '#ffffff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 4,
  },
  planCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  planCardTop: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  planName: { fontSize: 18, fontWeight: '800' },
  price: { fontSize: 22, fontWeight: '800' },
  planDesc: { fontSize: 13, lineHeight: 18 },
  cta: {
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  empty: { alignItems: 'center', paddingTop: 60 },
});

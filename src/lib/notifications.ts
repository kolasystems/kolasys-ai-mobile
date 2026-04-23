// Notification helpers. Local in-app pings work without APNs; remote push
// (used by Apple Watch Phase 2) requires an Expo push token registered with
// the server.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { trpcPost } from './api';

// ─── Handler + permissions ────────────────────────────────────────────────────

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
}

// ─── Expo push token registration (Phase 2: notes-ready push) ────────────────

/** Register the device's Expo push token with the backend. Call once after
 *  sign-in. Safe to call multiple times — the server mutation is idempotent.
 *  No-op on the simulator (Device.isDevice === false) and on platforms other
 *  than iOS. */
export async function registerPushToken(
  getToken: () => Promise<string | null>,
): Promise<void> {
  if (!Device.isDevice) return;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const res = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      status = res.status;
    }
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig as { extra?: { eas?: { projectId?: string } } } | null)
        ?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenResult = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    const token = tokenResult.data;
    if (!token) return;

    const authToken = await getToken();
    await trpcPost('settings.updatePushToken', { token }, authToken);
  } catch (err) {
    // Non-fatal: offline, missing projectId, backend procedure not yet
    // deployed, etc. The notes-ready push just won't work until this succeeds
    // on a later launch.
    console.warn('[registerPushToken]', err instanceof Error ? err.message : err);
  }
}

// ─── Ready-notification tracking (dedup across screens) ──────────────────────

export interface ReadyItem {
  id: string;
  title: string;
  at: number;
}

interface ReadyStore {
  /** Recordings that transitioned to READY and haven't been dismissed yet. */
  queue: ReadyItem[];
  /** IDs we've already notified about (prevents duplicate banners/pings). */
  seen: Set<string>;
  markReady: (id: string, title: string) => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

export const useReadyStore = create<ReadyStore>((set, get) => ({
  queue: [],
  seen: new Set<string>(),
  markReady: (id, title) => {
    if (get().seen.has(id)) return;
    const seen = new Set(get().seen);
    seen.add(id);
    set({
      seen,
      queue: [...get().queue, { id, title, at: Date.now() }],
    });
    void Notifications.scheduleNotificationAsync({
      content: {
        title: 'Notes are ready',
        body: title,
        data: { recordingId: id },
      },
      trigger: null,
    });
  },
  dismiss: (id) => set({ queue: get().queue.filter((r) => r.id !== id) }),
  clear: () => set({ queue: [] }),
}));

// ─── Transition detection helper ─────────────────────────────────────────────

interface StatusLike { id: string; title: string; status: string }

/**
 * Call whenever a fresh recordings list arrives. IDs that flipped from
 * processing-ish to READY fire a local notification exactly once per app session.
 */
export function detectReadyTransitions(
  current: StatusLike[],
  previous: Map<string, string> | null,
): Map<string, string> {
  const next = new Map<string, string>();
  const store = useReadyStore.getState();

  for (const rec of current) {
    next.set(rec.id, rec.status);
    if (!previous) continue;
    const prev = previous.get(rec.id);
    if (prev && prev !== 'READY' && rec.status === 'READY') {
      store.markReady(rec.id, rec.title);
    }
  }
  return next;
}

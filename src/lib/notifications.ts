// Local-notification helpers. No APNs required — everything here is device-local.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { create } from 'zustand';

// ─── Handler + permissions ────────────────────────────────────────────────────

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
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
      ios: { allowAlert: true, allowBadge: false, allowSound: false },
    });
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

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { WatchBridge } = NativeModules as {
  WatchBridge?: {
    activate: () => void;
    sendState: (state: string, elapsed: number) => void;
  };
};

export type WatchCommand = 'start' | 'stop' | 'bookmark';

/** Activate the WatchConnectivity session. Call once on app start. */
export function activateWatchSession(): void {
  if (Platform.OS === 'ios' && WatchBridge) {
    WatchBridge.activate();
  }
}

/** Push a state update to the paired Apple Watch. */
export function sendStateToWatch(state: string, elapsed: number): void {
  if (Platform.OS === 'ios' && WatchBridge) {
    WatchBridge.sendState(state, elapsed);
  }
}

/** Subscribe to commands emitted by the Watch (start / stop). Returns an
 *  unsubscribe function. No-op on platforms where the bridge isn't loaded. */
export function addWatchCommandListener(
  callback: (command: WatchCommand) => void,
): () => void {
  if (Platform.OS !== 'ios' || !WatchBridge) return () => {};
  const emitter = new NativeEventEmitter(WatchBridge as never);
  const sub = emitter.addListener('WatchCommand', (event: { command: string }) => {
    if (event.command === 'start' || event.command === 'stop' || event.command === 'bookmark') {
      callback(event.command);
    }
  });
  return () => sub.remove();
}

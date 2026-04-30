import { NativeModules, Platform } from 'react-native';

export interface SharedFile {
  uri: string;
  path: string;
  name: string;
  size: number;
  modifiedAt: number;
}

interface SharedFilesBridgeNative {
  getPendingFiles: () => Promise<SharedFile[]>;
  deletePendingFile: (path: string) => Promise<boolean>;
}

const { SharedFilesBridge } = NativeModules as {
  SharedFilesBridge?: SharedFilesBridgeNative;
};

/** Returns true when the native bridge has been linked into the binary. */
export function isSharedFilesBridgeAvailable(): boolean {
  return Platform.OS === 'ios' && !!SharedFilesBridge;
}

/** List files written by the Share Extension into the App Group container.
 *  Returns an empty list if the bridge isn't linked (Android, dev simulator
 *  without the native target, etc.). */
export async function getPendingSharedFiles(): Promise<SharedFile[]> {
  if (!isSharedFilesBridgeAvailable()) return [];
  try {
    return await SharedFilesBridge!.getPendingFiles();
  } catch (err) {
    console.warn('[sharedFilesBridge] getPendingFiles failed', err);
    return [];
  }
}

/** Delete a pending shared file once it has been uploaded successfully. */
export async function deletePendingSharedFile(path: string): Promise<void> {
  if (!isSharedFilesBridgeAvailable()) return;
  try {
    await SharedFilesBridge!.deletePendingFile(path);
  } catch (err) {
    console.warn('[sharedFilesBridge] deletePendingFile failed', err);
  }
}

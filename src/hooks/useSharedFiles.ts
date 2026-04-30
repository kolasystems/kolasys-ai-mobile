import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import * as FileSystem from 'expo-file-system/legacy';
import { trpcPost } from '../lib/api';
import {
  deletePendingSharedFile,
  getPendingSharedFiles,
  isSharedFilesBridgeAvailable,
  type SharedFile,
} from '../lib/sharedFilesBridge';

const MIME_BY_EXT: Record<string, string> = {
  m4a: 'audio/m4a',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  aac: 'audio/aac',
  mp4: 'audio/mp4',
  mov: 'video/quicktime',
};

function inferContentType(filename: string): { contentType: string; extension: string } {
  const ext = (filename.split('.').pop() ?? 'm4a').toLowerCase();
  return { contentType: MIME_BY_EXT[ext] ?? 'audio/m4a', extension: ext };
}

function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, '');
  if (!base || base.startsWith('share-')) {
    const now = new Date();
    return `Shared – ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  return base;
}

interface UploadResult {
  success: boolean;
  recordingId?: string;
  error?: string;
}

async function uploadSharedFile(
  file: SharedFile,
  getToken: () => Promise<string | null>,
): Promise<UploadResult> {
  const token = await getToken();
  const { contentType, extension } = inferContentType(file.name);

  const recording = await trpcPost<{ id: string }>(
    'recordings.create',
    { title: titleFromFilename(file.name), source: 'UPLOAD' },
    token,
  );
  if (!recording?.id) return { success: false, error: 'Failed to create recording.' };

  const uploadInfo = await trpcPost<{ url: string; key: string }>(
    'recordings.getUploadUrl',
    { recordingId: recording.id, contentType, extension },
    token,
  );
  if (!uploadInfo?.url) return { success: false, error: 'Failed to get upload URL.' };

  const putRes = await FileSystem.uploadAsync(uploadInfo.url, file.uri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: { 'Content-Type': contentType },
  });
  if (putRes.status < 200 || putRes.status >= 300) {
    return { success: false, error: `S3 upload failed (${putRes.status})` };
  }

  await trpcPost(
    'recordings.confirmUpload',
    {
      recordingId: recording.id,
      fileSize: file.size > 0 ? file.size : undefined,
      mimeType: contentType,
    },
    token,
  );

  return { success: true, recordingId: recording.id };
}

export interface UseSharedFilesOptions {
  onUploadStart?: (file: SharedFile) => void;
  onUploadSuccess?: (file: SharedFile, recordingId: string) => void;
  onUploadError?: (file: SharedFile, error: string) => void;
  onAllUploadsComplete?: () => void;
}

/** Picks up audio files written by the iOS Share Extension into the App Group
 *  container, uploads them via the standard 4-step recordings pipeline, then
 *  deletes the local copy. Triggered when the app becomes active and once on
 *  initial mount. No-ops on platforms where the native bridge isn't linked. */
export function useSharedFiles(options: UseSharedFilesOptions = {}): void {
  const { getToken } = useAuth();

  const optionsRef = useRef(options);
  const getTokenRef = useRef(getToken);
  const inFlightRef = useRef(false);
  useEffect(() => {
    optionsRef.current = options;
    getTokenRef.current = getToken;
  });

  useEffect(() => {
    if (!isSharedFilesBridgeAvailable()) return;

    let cancelled = false;

    const drain = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        const files = await getPendingSharedFiles();
        if (cancelled || files.length === 0) return;

        for (const file of files) {
          if (cancelled) break;
          optionsRef.current.onUploadStart?.(file);
          try {
            const result = await uploadSharedFile(file, () => getTokenRef.current());
            if (result.success && result.recordingId) {
              await deletePendingSharedFile(file.path);
              optionsRef.current.onUploadSuccess?.(file, result.recordingId);
            } else {
              optionsRef.current.onUploadError?.(file, result.error ?? 'Upload failed.');
            }
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Upload failed.';
            optionsRef.current.onUploadError?.(file, message);
          }
        }
        if (!cancelled) optionsRef.current.onAllUploadsComplete?.();
      } finally {
        inFlightRef.current = false;
      }
    };

    void drain();

    const onChange = (status: AppStateStatus) => {
      if (status === 'active') void drain();
    };
    const sub = AppState.addEventListener('change', onChange);

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}

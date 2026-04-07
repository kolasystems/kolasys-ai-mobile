import { create } from 'zustand';
import { Audio } from 'expo-av';

export type RecordingState = 'idle' | 'recording' | 'paused' | 'processing' | 'uploading';

export interface RecordingStore {
  // State
  state: RecordingState;
  recording: Audio.Recording | null;
  recordingUri: string | null;
  durationMs: number;
  uploadProgress: number;
  meteringLevel: number; // -160 to 0 dB, normalised to 0-1
  elapsedSeconds: number;
  pendingTitle: string;

  // Actions
  setState: (state: RecordingState) => void;
  setRecording: (recording: Audio.Recording | null) => void;
  setRecordingUri: (uri: string | null) => void;
  setDurationMs: (ms: number) => void;
  setUploadProgress: (progress: number) => void;
  setMeteringLevel: (level: number) => void;
  setElapsedSeconds: (seconds: number) => void;
  setPendingTitle: (title: string) => void;
  reset: () => void;
}

const initialState = {
  state: 'idle' as RecordingState,
  recording: null,
  recordingUri: null,
  durationMs: 0,
  uploadProgress: 0,
  meteringLevel: 0,
  elapsedSeconds: 0,
  pendingTitle: '',
};

export const useRecordingStore = create<RecordingStore>((set) => ({
  ...initialState,

  setState: (state) => set({ state }),
  setRecording: (recording) => set({ recording }),
  setRecordingUri: (uri) => set({ recordingUri: uri }),
  setDurationMs: (ms) => set({ durationMs: ms }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  setMeteringLevel: (level) => set({ meteringLevel: level }),
  setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),
  setPendingTitle: (title) => set({ pendingTitle: title }),
  reset: () => set(initialState),
}));

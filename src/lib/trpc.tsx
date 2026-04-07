import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-expo';

// ─── Shared types mirroring the web API ───────────────────────────────────────

export type RecordingStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'TRANSCRIBING'
  | 'SUMMARIZING'
  | 'READY'
  | 'FAILED';

export type RecordingSource = 'UPLOAD' | 'BROWSER' | 'MEETING_BOT';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ActionItemStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Recording {
  id: string;
  title: string;
  status: RecordingStatus;
  source: RecordingSource;
  duration: number | null;
  fileSize: number | null;
  createdAt: Date;
  updatedAt: Date;
  transcript?: Transcript | null;
  note?: Note | null;
}

export interface Transcript {
  id: string;
  text: string;
  language: string;
  confidence: number | null;
  segments: TranscriptSegment[];
}

export interface TranscriptSegment {
  id: string;
  speaker: string | null;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number | null;
}

export interface SpeakerLabel {
  id: string;
  speakerId: string;
  displayName: string;
}

export interface Note {
  id: string;
  summary: string;
  sections: NoteSection[];
  actionItems: ActionItem[];
}

export interface NoteSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  dueDate: Date | null;
  status: ActionItemStatus;
  priority: Priority;
}

// ─── tRPC router type (minimal — mirrors server endpoints used by mobile) ─────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const trpc = createTRPCReact<any>();

// ─── Provider ─────────────────────────────────────────────────────────────────

const API_URL = 'https://app.kolasys.ai/api/trpc';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: API_URL,
          transformer: superjson,
          async headers() {
            const token = await getToken();
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

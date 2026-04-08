# Kolasys AI Mobile — Claude Reference

> A quick-start for a new Claude session on this repo.

**Repo:** https://github.com/kolasystems/kolasys-ai-mobile  
**Web backend:** https://app.kolasys.ai (tRPC API at `https://app.kolasys.ai/api/trpc`)  
**Web repo:** `/Users/kolasys/Desktop/kolasys-ai` (or `github.com/kolasystems/kolasys-ai`)  
**Last updated:** 2026-04-07

---

## What This Is

React Native / Expo SDK 54 mobile companion app for Kolasys AI (meeting notes + transcription).  
New Architecture enabled (`newArchEnabled: true` in app.json). iOS only for now (Android untested).

---

## Quick Start

```bash
cd ~/Desktop/kolasys-ai-mobile
npm install --legacy-peer-deps   # ALWAYS use --legacy-peer-deps (Clerk pulls react-dom)
npx expo run:ios                 # Builds and opens in iOS Simulator
```

Two workers (in the web repo) must be running for the full pipeline:
```bash
cd ~/Desktop/kolasys-ai
npx tsx src/workers/transcription.worker.ts
npx tsx src/workers/summarization.worker.ts
```

---

## Critical Rules

### Never upgrade native packages independently
Always use `npx expo install <package>` — NOT `npm install`. These three are version-pinned to Expo SDK 54 and must NOT be changed:

| Package | Required version |
|---|---|
| `react-native-safe-area-context` | ~5.6.0 |
| `react-native-screens` | ~4.16.0 |
| `react-native-gesture-handler` | ~2.28.0 |

Upgrading these independently causes a JSI crash: `expected dynamic type 'boolean', but had type 'string'`.

### Always use --legacy-peer-deps
```bash
npm install <package> --legacy-peer-deps
```
`@clerk/clerk-expo` has a react-dom peer conflict. Every `npm install` without `--legacy-peer-deps` will fail.

### expo-file-system v19 API change
Import from `expo-file-system/legacy` for `cacheDirectory`, `EncodingType`, `writeAsStringAsync`, `moveAsync`:
```typescript
import * as FileSystem from 'expo-file-system/legacy';  // NOT 'expo-file-system'
```

### getToken must be in a useRef
`useAuth().getToken` from Clerk is recreated on every render. Using it directly in `useCallback` or `useEffect` deps causes infinite re-render loops:
```typescript
const getTokenRef = useRef(getToken);
useEffect(() => { getTokenRef.current = getToken; });  // sync ref each render
// Then use getTokenRef.current() — never getToken directly in deps
```

---

## Project Structure

```
src/
├── lib/
│   ├── api.ts          Shared trpcGet/trpcPost HTTP helpers
│   └── trpc.tsx        tRPC React client, TRPCProvider, shared types
├── navigation/
│   └── AppNavigator.tsx Bottom tabs + RecordingsStack
├── screens/
│   ├── HomeScreen.tsx          Feed / Tasks / Calendar tabs
│   ├── RecordScreen.tsx        expo-av recording + upload
│   ├── RecordingsScreen.tsx    List + search
│   ├── RecordingDetailScreen.tsx  Notes / Transcript / Actions + Export sheet
│   └── SettingsScreen.tsx
└── components/
    ├── RecordingCard.tsx
    ├── StatusBadge.tsx
    ├── ActionItemRow.tsx
    └── TranscriptSegment.tsx
```

---

## API Layer

The app talks to `https://app.kolasys.ai/api/trpc` (same tRPC router as the web app).

### Direct fetch pattern (preferred for detail screens)
```typescript
import { trpcGet, trpcPost } from '../lib/api';

const data = await trpcGet<Recording>('recordings.get', { id }, token);
await trpcPost('recordings.updateActionItem', { id, status: 'COMPLETED' }, token);
```

### tRPC React hooks (for list queries)
```typescript
const { data, isLoading } = trpc.recordings.list.useQuery({ limit: 50 });
```

### Notes normalization
The server returns `notes[]` (array, take:1). Always normalize:
```typescript
const data = { ...rawData, note: rawData.note ?? rawData.notes?.[0] ?? null };
```

---

## Navigation

```typescript
// Tab navigation types
export type TabParamList = {
  Home: undefined; Record: undefined; Recordings: undefined; Settings: undefined;
};
export type RecordingsStackParamList = {
  RecordingsList: undefined; RecordingDetail: { id: string };
};

// Navigate from Home to RecordingDetail (cross-tab)
navigation.navigate('Recordings', { screen: 'RecordingDetail', params: { id } });
```

---

## Key Screens

### HomeScreen
Three internal tabs:
- **My Feed** — recordings grouped this week / last week / older
- **Tasks** — recordings with notes collapsed; expand to lazy-load action items
- **Calendar** — expo-calendar device events, platform icon, bot-record toggle

### RecordingDetailScreen
Three tabs: Notes | Transcript | Actions  
Transcript tab adds: static waveform, disabled audio player UI (audio deleted post-transcription), topic outline  
Header: export sheet (share link, copy notes/transcript, TXT/PDF export)

### RecordScreen
`Constants.isDevice` check → shows simulator warning. Real device: mic permission → record → upload.

---

## Screen Status

| Screen | Status |
|---|---|
| HomeScreen (Feed/Tasks/Calendar) | ✅ Built |
| RecordScreen | ✅ Built |
| RecordingsScreen | ✅ Built |
| RecordingDetailScreen | ✅ Built |
| SettingsScreen | ✅ Built |
| CalendarScreen (standalone) | Built but not in nav |

---

## Installed Packages

Key packages beyond Expo defaults:
- `@clerk/clerk-expo` v2.19.31 — auth
- `@trpc/react-query` v11 + `@tanstack/react-query` v5 — API layer
- `expo-av` — audio recording
- `expo-calendar` — device calendar (Calendar tab)
- `expo-clipboard` — copy to clipboard (export sheet)
- `expo-file-system` (legacy) — file writes for TXT export
- `expo-print` — PDF generation
- `expo-sharing` — share files
- `react-native-reanimated` v4 — animations
- `react-native-worklets` — required peer dep for reanimated v4

---

## TypeScript Notes

There are pre-existing TS errors in `src/lib/trpc.tsx` and screens that use `trpc.recordings.*`. These are caused by `createTRPCReact<any>()` not inferring router types. The app works fine at runtime — these errors are noise. Do not try to fix them by adding a full `AppRouter` type (that would import server-only Prisma code into the client).

---

## PROGRESS.md

See `PROGRESS.md` for the full feature checklist, known issues, and what still needs to be built.

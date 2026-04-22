# Kolasys AI Mobile — Claude Reference

> Quick-start for a new Claude Code session on this repo.

**Repo:** https://github.com/kolasystems/kolasys-ai-mobile  
**Web backend:** https://app.kolasys.ai (tRPC API at `https://app.kolasys.ai/api/trpc`)  
**Web repo:** `~/Desktop/kolasys-ai` · `github.com/kolasystems/kolasys-ai`  
**Last updated:** 2026-04-20

---

## What This Is

React Native / Expo SDK 54 mobile companion app for Kolasys AI (AI-powered meeting notes + transcription). iOS only for now (Android untested). New Architecture enabled (`newArchEnabled: true`).

---

## Quick Start

```bash
cd ~/Desktop/kolasys-ai-mobile
npm install --legacy-peer-deps   # ALWAYS use --legacy-peer-deps
npx expo run:ios                 # Builds and opens in iOS Simulator
```

Workers run on Railway 24/7 — no local workers needed for the full pipeline.  
For local web dev only:
```bash
cd ~/Desktop/kolasys-ai && npm run dev
```

---

## Critical Rules

### Always use --legacy-peer-deps
```bash
npm install <package> --legacy-peer-deps
```
`@clerk/clerk-expo` has a react-dom peer conflict. Every `npm install` without the flag will fail.

### Never upgrade native packages independently
Always use `npx expo install <package>`. These are pinned to Expo SDK 54:

| Package | Required version |
|---|---|
| `react-native-safe-area-context` | ~5.6.0 |
| `react-native-screens` | ~4.16.0 |
| `react-native-gesture-handler` | ~2.28.0 |

Upgrading these independently causes a JSI crash: `expected dynamic type 'boolean', but had type 'string'`.

### expo-file-system v19 legacy import
```typescript
import * as FileSystem from 'expo-file-system/legacy'; // NOT 'expo-file-system'
```

### getToken must be in a useRef
`useAuth().getToken` is recreated on every render — always sync to a ref:
```typescript
const getTokenRef = useRef(getToken);
useEffect(() => { getTokenRef.current = getToken; }); // no deps — runs every render
// Use: await getTokenRef.current()
```

### Clerk keys — NEVER mix test/live
- Local `.env`: `pk_test_` + `sk_test_` (must match)
- Railway + Vercel: `pk_live_` + `sk_live_`

---

## Project Structure

```
App.tsx                          Entry — SafeAreaProvider > ThemeProvider > ClerkProvider > AuthenticatedApp
src/
├── lib/
│   ├── theme.ts                 ThemeProvider, useTheme(), lightColors, darkColors, ThemeColors type
│   ├── api.ts                   trpcGet / trpcPost HTTP helpers
│   ├── trpc.tsx                 tRPC React client, TRPCProvider, shared types (Recording, Note, etc.)
│   ├── auth.ts                  Clerk tokenCache (expo-secure-store)
│   └── notifications.ts         Push notifications + useReadyStore (zustand)
├── store/
│   └── recording.store.ts       Zustand store for RecordScreen state
├── navigation/
│   └── AppNavigator.tsx         Bottom tabs + RecordingsStack; NavigationContainer with full navTheme
├── screens/
│   ├── HomeScreen.tsx           Feed / Tasks / Calendar tabs
│   ├── RecordScreen.tsx         expo-av recording + S3 upload pipeline
│   ├── RecordingsScreen.tsx     List + search
│   ├── RecordingDetailScreen.tsx Notes / Transcript / Actions / Ask AI + Export + Modals
│   ├── SettingsScreen.tsx       Profile, dark mode toggle, links, sign out
│   ├── CalendarScreen.tsx       Standalone calendar (also embedded in HomeScreen)
│   └── SignInScreen.tsx         Email + Google OAuth + MFA
└── components/
    ├── AskAITab.tsx             SSE streaming AI chat for RecordingDetail
    ├── RecordingCard.tsx
    ├── StatusBadge.tsx          isDark-aware alpha backgrounds
    ├── ActionItemRow.tsx
    ├── TranscriptSegment.tsx
    └── WaveformVisualizer.tsx
```

---

## Theme System

Theme lives at `src/lib/theme.ts`. **There is no `src/contexts/ThemeContext.tsx`.**

```typescript
import { useTheme } from '../lib/theme';

const { colors, isDark, toggleDark, mode, setMode } = useTheme();
```

- **Storage key:** `'kolasys-theme'` in AsyncStorage
- **Values stored:** `'light' | 'dark' | 'system'`
- **`isDark`:** derived from `mode === 'dark' || (mode === 'system' && systemScheme === 'dark')`
- Hydrates from AsyncStorage on mount; persists on every `setMode` call
- `toggleDark()` flips between `'light'` and `'dark'` (not system)

### Color tokens (ThemeColors)
```typescript
colors.background       // Screen background
colors.surface          // Card/panel background
colors.surfaceRaised    // Elevated surface
colors.surfaceMuted     // Subtle fill
colors.textPrimary      // Main text
colors.textSecondary    // Secondary text
colors.textMuted        // Placeholder/caption
colors.border           // Hairline borders
colors.borderStrong     // Stronger border
colors.accent           // #5B8DEF — primary brand color
colors.accentSoft       // rgba(91,141,239,0.12/.22) — icon backgrounds
colors.gradientStart/End // Header gradients
colors.bgGradientStart/End // Full-screen gradients (RecordScreen)
```

### Dark mode status (as of 2026-04-20)
All screens and components are fully themed. No hardcoded hex colors in production screens.

---

## API Layer

API is at `https://app.kolasys.ai/api/trpc` (same tRPC router as web app).

### Direct fetch (preferred for detail screens)
```typescript
import { trpcGet, trpcPost } from '../lib/api';

const data = await trpcGet<Recording>('recordings.get', { id }, token);
await trpcPost('recordings.updateActionItem', { id, status: 'COMPLETED' }, token);
```

### React hooks (for list queries with auto-refetch)
```typescript
const { data, isLoading, refetch } = trpc.recordings.list.useQuery({ limit: 50 });
```

### tRPC batch format (manual fetch)
```typescript
// GET:  /api/trpc/procedure?batch=1&input={"0":{"json":{...}}}
// POST: /api/trpc/procedure?batch=1  body: {"0":{"json":{...}}}
// Response: [{result:{data:{json:...}}}]
```

### Notes normalization
Server returns `notes[]` (array, take:1). Always normalize:
```typescript
const data = { ...rawData, note: rawData.note ?? rawData.notes?.[0] ?? null };
```

---

## Navigation

```typescript
export type TabParamList = {
  Home: undefined; Record: undefined; Recordings: undefined; Settings: undefined;
};
export type RecordingsStackParamList = {
  RecordingsList: undefined; RecordingDetail: { id: string };
};

// Navigate from Home tab to RecordingDetail (cross-tab):
navigation.navigate('Recordings', { screen: 'RecordingDetail', params: { id } });
```

`AppNavigator` sets `NavigationContainer theme={navTheme}` with full color mapping + `sceneStyle`/`contentStyle` so React Navigation backgrounds respect dark mode.

---

## Key Screens

### RecordingDetailScreen
Four tabs: **Notes | Transcript | Actions | Ask AI**

- **Notes tab:** Summary card + Refine Summary button (calls `recordings.refineSummary` → Claude Opus live), key points, decisions, next steps, sections — all markdown-rendered via `react-native-markdown-display`
- **Transcript tab:** Real audio player (`expo-av` + pre-signed S3 URL with retry on 403), topic outline, paginated segments (30/page), Name Speakers modal, Find & Replace modal
- **Actions tab:** Checkable action items with priority/assignee/due date
- **Ask AI tab:** SSE streaming chat (`AskAITab`) against the recording transcript
- **Export sheet:** Share link, Copy Notes/Transcript, TXT/PDF export
- **Overflow menu (⋯):** Re-transcribe modal, Find & Replace

### RecordScreen
- `Constants.isDevice` check — shows friendly message on simulator (no mic)
- `expo-av` recording → PUT directly to S3 via pre-signed URL → `recordings.confirmUpload`
- State managed locally (not via `useRecordingStore` — store exists for future use)

### SettingsScreen
- Dark mode toggle (Switch) → `toggleDark()` from `useTheme()`
- Shows `System (Dark/Light)`, `Dark`, or `Light` as value text

---

## Apple Watch Phase 1 (✅ running on simulator, 2026-04-22)

SwiftUI watch app + WatchConnectivity native bridge + RN JS module — all wired, Xcode Watch target added, bundle ID and companion ID set, running on the paired Watch simulator. Tap mic on the wrist → iPhone starts recording; live MM:SS timer and haptic feedback on start/stop.

Files scaffolded:
- `ios/KolasysWatch Watch App/KolasysWatchApp.swift` — SwiftUI entry point
- `ios/KolasysWatch Watch App/ContentView.swift` — tap-to-record UI with red pulse animation
- `ios/KolasysWatch Watch App/WatchConnector.swift` — `WCSessionDelegate`, sends `{command: 'start'|'stop'}`
- `ios/KolasysWatch/WatchBridge.swift` — iOS-side `RCTEventEmitter`, emits `WatchCommand` events to JS
- `ios/KolasysWatch/WatchBridge.m` — Objective-C `RCT_EXTERN_MODULE` header
- `src/lib/watchBridge.ts` — `activateWatchSession`, `sendStateToWatch`, `addWatchCommandListener`
- `RecordScreen.tsx` listens for commands via refs; mirrors `state + elapsed` every second
- `App.tsx` calls `activateWatchSession()` on mount

Manual Xcode setup (one-time):
1. Open `ios/KolasysAI.xcworkspace` in Xcode.
2. **File → New → Target → watchOS → Watch App.**
3. Product Name: `KolasysWatch` · Bundle ID: `com.kolasystems.kolasysai.watchkitapp` · Language: Swift · Interface: SwiftUI.
4. Delete Xcode's auto-generated Swift files and drag in the three files from `ios/KolasysWatch Watch App/` instead.
5. Add `WatchConnectivity.framework` to **both** the Watch target and the main `KolasysAI` target.
6. Drag `ios/KolasysWatch/WatchBridge.swift` + `WatchBridge.m` into the main `KolasysAI` target; accept the bridging-header prompt.
7. Set the Apple Team ID on both targets.
8. Run on a paired iPhone + Watch simulator (must be paired in Devices in Xcode).

Message format:
- Watch → iOS: `{ command: 'start' | 'stop' }`
- iOS → Watch: `{ state: 'idle' | 'recording' | …, elapsed: number }`

---

## Screen Status (2026-04-20)

| Screen / Feature | Status |
|---|---|
| HomeScreen (Feed / Tasks / Calendar) | ✅ Built + dark mode |
| RecordScreen | ✅ Built + dark mode |
| RecordingsScreen | ✅ Built + dark mode |
| RecordingDetailScreen (4 tabs) | ✅ Built + dark mode |
| SettingsScreen | ✅ Built + dark mode |
| CalendarScreen (standalone) | ✅ Built + dark mode (embedded in HomeScreen) |
| SignInScreen | ✅ Built (always light — pre-auth) |
| AskAITab (SSE streaming) | ✅ Built + dark mode |
| Refine Summary (Claude Opus) | ✅ Live |
| Real audio player (S3 pre-signed) | ✅ Built |
| Export sheet (TXT / PDF / copy) | ✅ Built |
| Find & Replace transcript | ✅ Built |
| Name Speakers | ✅ Built |
| Re-transcribe modal | ✅ Built |
| Dark mode (full app) | ✅ Complete as of 2026-04-20 |
| Markdown rendering | ✅ react-native-markdown-display |
| Push notifications (notes ready) | ✅ Partial — expo-notifications wired, not TestFlight |
| ContactsScreen | ✅ Built — search, initials avatar, meta pills |
| AnalyticsScreen | ✅ Built — stat cards, bar chart, speaker talk time |
| SettingsStack navigation | ✅ Contacts + Analytics accessible from Settings > DATA section |
| Word-level audio sync | ✅ Tappable words on Transcript tab (new recordings only) |
| Apple Watch Phase 1 | ✅ Running on simulator (confirmed 2026-04-22) — WatchConnectivity bridge live, wrist tap → iPhone recording, live MM:SS timer, haptic on start/stop |
| TestFlight | ❌ Needs Apple Developer account |
| Android | ❌ Untested |

---

## Installed Packages (key packages)

```
@clerk/clerk-expo           ^2.19.31   Auth
@react-native-async-storage/async-storage  2.2.0   Theme persistence
@react-navigation/bottom-tabs / native / native-stack  ^7.x  Navigation
@tanstack/react-query       ^5.96.2    Server state
@trpc/react-query           ^11.16.0   API layer
expo-av                     ~16.0.8    Audio recording + playback
expo-blur                   ~15.0.8    (installed; BlurView NOT used — transparent on simulator)
expo-calendar               ~15.0.8    Device calendar
expo-clipboard              ~8.0.8     Copy to clipboard
expo-file-system            ~19.0.21   File writes (use /legacy import)
expo-haptics                ~15.0.8    Installed, not yet used
expo-linear-gradient        ~15.0.8    Header + screen gradients
expo-notifications          ~0.32.16   Push notifications
expo-print                  ~15.0.8    PDF generation
expo-secure-store           ~15.0.8    Clerk token cache
expo-sharing                ~14.0.8    File sharing
expo-task-manager           ~14.0.9    Installed, not yet used
react-native-markdown-display  ^7.0.2  Markdown in Notes tab + summaries
react-native-reanimated     ~4.1.1     Animations
react-native-worklets       ^0.5.1     Required peer for reanimated v4
superjson                   ^2.2.6     tRPC serialization
zustand                     ^5.0.12    Global state (notifications, recording store)
```

> ⚠️ **expo-blur is installed but BlurView must NOT be used** — it renders transparent on iOS Simulator (no GPU). Use plain `View` with `backgroundColor: colors.surface` instead.

---

## Known Issues

| Issue | Status |
|---|---|
| Hermes build phase warning | Harmless — pre-existing CocoaPods warning |
| npm peer dep conflict (react-dom) | Workaround: always `--legacy-peer-deps` |
| `trpc.recordings.list` response shape varies | Handled — code checks `data.recordings`, `data.items`, bare array |
| BlurView transparent on simulator | Fixed — BlurView removed from all screens |
| TypeScript errors in `src/lib/trpc.tsx` | Pre-existing noise from `createTRPCReact<any>()` — do not fix by importing server Prisma types |

---

## Architecture

```
App.tsx
└── SafeAreaProvider
    └── ThemeProvider              ← src/lib/theme.ts (NOT src/contexts/ThemeContext.tsx)
        └── ClerkProvider
            └── AuthenticatedApp
                ├── TRPCProvider
                ├── RootNavigator  ← shows SignInScreen or AppNavigator
                └── StatusBar      ← style={isDark ? 'light' : 'dark'}

AppNavigator
└── NavigationContainer theme={navTheme}   ← full React Navigation theming
    └── BottomTabNavigator
        ├── HomeScreen
        ├── RecordScreen
        ├── RecordingsStack
        │   ├── RecordingsScreen
        │   └── RecordingDetailScreen
        └── SettingsScreen
```

### Key patterns
- **Theme:** `useTheme()` from `src/lib/theme` everywhere — never `Colors.*` in screens
- **tRPC direct:** `trpcGet`/`trpcPost` in `src/lib/api.ts` for detail screens
- **tRPC hooks:** `trpc.X.useQuery()` for list screens with auto-refetch
- **Stable getToken:** always via `useRef` — never in dependency arrays directly
- **Polling:** `loadRef.current` pattern avoids self-referential `useEffect` deps
- **Notes:** always normalize `rawData.note ?? rawData.notes?.[0] ?? null`

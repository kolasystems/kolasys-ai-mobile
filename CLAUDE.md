# Kolasys AI Mobile — Claude Reference

> Quick-start for a new Claude Code session on this repo.

**Repo:** https://github.com/kolasystems/kolasys-ai-mobile  
**Web backend:** https://app.kolasys.ai (tRPC API at `https://app.kolasys.ai/api/trpc`)  
**Web repo:** `~/Desktop/kolasys-ai` · `github.com/kolasystems/kolasys-ai`  
**Last updated:** 2026-04-27

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

### iOS Build — CocoaPods objectVersion fix
After any Xcode 16 upgrade or fresh clone, run before `pod install`:
```bash
sed -i '' 's/objectVersion = 70/objectVersion = 60/' ios/KolasysAI.xcodeproj/project.pbxproj
```
Xcode 16 writes `objectVersion = 70` which CocoaPods 1.16.x cannot parse. Safe to apply — Xcode ignores this field at build time.

### WatchBridge file reference paths
If you see `Build input file cannot be found: '.../ios/WatchBridge.swift'`:
```bash
sed -i '' 's/path = WatchBridge\.swift;/path = KolasysAI\/WatchBridge.swift;/' ios/KolasysAI.xcodeproj/project.pbxproj
sed -i '' 's/path = WatchBridge\.m;/path = KolasysAI\/WatchBridge.m;/' ios/KolasysAI.xcodeproj/project.pbxproj
```

### Watch app deployment
`npx expo run:ios` only deploys the **iPhone** target. After every `expo run:ios`, reinstall the Watch app:
1. `open ios/KolasysAI.xcworkspace`
2. Switch scheme to `KolasysWatch Watch App`
3. Select paired Apple Watch as destination
4. Cmd+R

### Metro
Always keep a separate terminal running:
```bash
npx expo start
```
After a build, shake phone → **Reload** to pick up JS changes. Use `--tunnel` on a physical device if local-network DNS is flaky.

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
│   ├── notifications.ts         Push notifications + useReadyStore (zustand)
│   └── watchBridge.ts           activateWatchSession, sendStateToWatch, addWatchCommandListener
├── store/
│   └── recording.store.ts       Zustand store for RecordScreen state
├── navigation/
│   └── AppNavigator.tsx         Bottom tabs + RecordingsStack + root stack; NavigationContainer with full navTheme
├── screens/
│   ├── HomeScreen.tsx           Feed / Tasks / Calendar tabs
│   ├── RecordScreen.tsx         expo-av recording + S3 upload pipeline + WatchConnectivity
│   ├── RecordingsScreen.tsx     List + search
│   ├── RecordingDetailScreen.tsx Notes / Transcript / Actions / Ask AI + Export + Modals
│   ├── SettingsScreen.tsx       Profile, dark mode toggle, links, sign out
│   ├── CalendarScreen.tsx       Standalone calendar (also embedded in HomeScreen)
│   ├── SignInScreen.tsx         Email + Google OAuth + MFA
│   ├── ActionItemsScreen.tsx    All action items across recordings, filter All/Open/Completed
│   ├── KnowledgeScreen.tsx      knowledge.getTopEntities — PERSON/TOPIC/PROJECT grouped
│   ├── AskAIScreen.tsx          Global chat — search.askAI mutation (NOT ai.ask)
│   ├── TemplatesScreen.tsx      templates.list — expand cards, +New redirects to web
│   ├── ContactsScreen.tsx       Contacts with search, initials avatars, meta pills
│   └── AnalyticsScreen.tsx      Stat cards, 12-week bar chart, speaker talk time
└── components/
    ├── AskAITab.tsx             SSE streaming AI chat for RecordingDetail (per-recording)
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

## Confirmed tRPC Procedures (2026-04-27)

```
recordings.list              GET    { limit: 50 } — includes nested actionItems[]
recordings.get               GET    { id }
recordings.updateActionItem  POST   { id, status, priority? }
                                    status: OPEN | IN_PROGRESS | COMPLETED | CANCELLED
recordings.refineSummary     POST   calls Claude Opus live
knowledge.getTopEntities     GET    { limit: 50 } — types: PERSON | TOPIC | PROJECT
templates.list               GET    {}
search.askAI                 POST   { question, context? }
settings.updatePushToken     POST   { token: string }
settings.getOrgSettings      GET    —
settings.updateOrgSettings   POST   partial org settings
apiKeys.list                 GET    —  (web only — no mobile screen)
apiKeys.create               POST   { name: string }
apiKeys.revoke               POST   { id: string }
```

**WRONG procedure names (all return 404):**
```
ai.ask          → WRONG. Correct: search.askAI
actionItem.list → WRONG. Use recordings.list + extract .actionItems[]
template.list   → WRONG. Correct: templates.list (plural)
knowledge.list  → WRONG. Correct: knowledge.getTopEntities
```

### search.askAI — Global Ask AI
- Type: mutation (not query — embeds + Claude calls cost tokens)
- Input: `{ question: string, recordingId?: string }`
- Output: `{ answer: string, sources: Source[] }`
- Source shape: `{ index, recordingId, recordingTitle, chunkText, startTime: number|null, similarity }`
- Requires recordings to have vector embeddings. If none exist, returns graceful empty-sources fallback.
- To generate embeddings: web app → Recording Detail → "Generate Embeddings" button.
- Note: `/api/ai/ask` is a separate HTTP SSE endpoint for streaming chat (used by AskAITab per-recording). `search.askAI` is for one-shot global queries.

---

## Navigation

```typescript
export type TabParamList = {
  Home: undefined;
  Record: undefined;
  Recordings: undefined;
  ActionItems: undefined;
  AskAI: undefined;
  Settings: undefined;
};
// Stack screens (not tabs): Knowledge, Templates — in root stack above tab navigator

export type RecordingsStackParamList = {
  RecordingsList: undefined;
  RecordingDetail: { id: string };
};

// Navigate from Home tab to RecordingDetail (cross-tab):
navigation.navigate('Recordings', { screen: 'RecordingDetail', params: { id } });
```

`AppNavigator` sets `NavigationContainer theme={navTheme}` with full color mapping so React Navigation backgrounds respect dark mode.

### SettingsStack Navigation — CRITICAL
`useNavigation()` inside SettingsScreen returns the **tab** navigator context, not SettingsStack. When SettingsScreen is the root of SettingsStack, accept navigation as a typed prop:

```tsx
// CORRECT
export default function SettingsScreen({
  navigation
}: {
  navigation: NativeStackNavigationProp<SettingsStackParamList, 'SettingsMain'>
}) { ... }

// WRONG — returns tab navigator, doesn't know Contacts/Analytics
const navigation = useNavigation()
```

---

## Key Screens

### RecordingDetailScreen
Four tabs: **Notes | Transcript | Actions | Ask AI**

- **Notes tab:** Summary + Refine Summary (→ `recordings.refineSummary` → Claude Opus), key points, decisions, next steps — markdown via `react-native-markdown-display`
- **Transcript tab:** Real audio player (`expo-av` + S3 pre-signed URL with 403 retry), paginated segments (30/page), Name Speakers modal, Find & Replace modal, word-level tap-to-seek (new recordings only)
- **Actions tab:** Checkable action items → `recordings.updateActionItem` — `{ id, status }`
- **Ask AI tab:** SSE streaming chat (`AskAITab`) grounded in THIS recording's transcript — uses `/api/ai/ask` HTTP endpoint, NOT `search.askAI`
- **Export sheet:** Share link, Copy Notes/Transcript, TXT/PDF export
- **Overflow menu (⋯):** Re-transcribe modal, Find & Replace

### AskAIScreen (global, bottom tab)
- Uses `search.askAI` mutation (not SSE) — one-shot global search across all recordings
- Requires embeddings to be generated first
- Source chips show `recordingTitle`
- Suggested questions on empty state

### ActionItemsScreen
- Fetches via `recordings.list`, extracts `.actionItems[]` — no standalone procedure
- Filter tabs: All | Open | Completed
- Priority badges: LOW (gray) / MEDIUM (amber) / HIGH (brand red #CA2625) / URGENT (red)
- Toggle: `recordings.updateActionItem` with `{ id, status: nextStatus }`

### KnowledgeScreen
- `knowledge.getTopEntities` with `{ limit: 50 }`
- Types: `PERSON | TOPIC | PROJECT` (type `COMPANY` does not exist)
- Tap to expand: mention count, recording count, first/last seen

### TemplatesScreen
- `templates.list` (no input) — field is `prompt` not `promptText`, no `usageCount` field
- +New → Alert redirecting to web app

### RecordScreen
- `Constants.isDevice` check — shows friendly message on simulator (no mic)
- `expo-av` recording → PUT to S3 via pre-signed URL → `recordings.confirmUpload`
- WatchConnectivity wired — activates on mount, syncs state + elapsed every second

---

## Apple Watch Phase 1 (✅ running on Apple Watch Series 11, 2026-04-22)

SwiftUI watch app + WatchConnectivity native bridge. Tap mic on wrist → iPhone starts recording. Live MM:SS timer, haptic feedback on start/stop.

**Files:**
- `ios/KolasysWatch Watch App/KolasysWatchApp.swift` — SwiftUI entry point
- `ios/KolasysWatch Watch App/ContentView.swift` — tap-to-record UI with red pulse animation
- `ios/KolasysWatch Watch App/WatchConnector.swift` — `WCSessionDelegate`
- `ios/KolasysAI/WatchBridge.swift` — `RCTEventEmitter`, emits `WatchCommand` to JS
- `ios/KolasysAI/WatchBridge.m` — `RCT_EXTERN_MODULE` header
- `src/lib/watchBridge.ts` — `activateWatchSession`, `sendStateToWatch`, `addWatchCommandListener`

**Bundle IDs:**
- iPhone: `com.kolasystems.kolasysai`
- Watch: `com.kolasystems.kolasysai.watchkitapp`

**Message format:**
- Watch → iOS: `{ command: 'start' | 'stop' }`
- iOS → Watch: `{ state: 'idle' | 'recording', elapsed: number }` (every 1s)

---

## Apple Watch Phase 2 (✅ fully live, 2026-04-27)

Push notification sent to iPhone (mirrored to Watch) when meeting notes are ready.

**Architecture:**
- Push token stored on `OrgMember.expoPushToken` — per-user, not per-org
- `settings.updatePushToken` mutation upserts token for `(orgId, userId)`
- `summarization.worker.ts` Step 8.5: after READY, fetches `OrgMember` for recording owner, builds 3-bullet body, calls `sendExpoPush()` from `src/services/push.service.ts`
- Plain `fetch` to `https://exp.host/--/api/v2/push/send` — no SDK
- Payload: `{ title, body (3 bullets), data: { recordingId }, sound: 'default' }`
- Push failures wrapped in try/catch — never fails the job
- WatchOS mirrors iPhone notification to wrist automatically

**Phase 3 (not yet built):** Force Touch to bookmark a transcript moment.

---

## Screen Status (2026-04-27)

| Screen / Feature | Status |
|---|---|
| HomeScreen (Feed / Tasks / Calendar) | ✅ Built + dark mode |
| RecordScreen | ✅ Built + dark mode + WatchConnectivity |
| RecordingsScreen | ✅ Built + dark mode |
| RecordingDetailScreen (4 tabs) | ✅ Built + dark mode |
| SettingsScreen | ✅ Built + dark mode |
| CalendarScreen | ✅ Built + dark mode |
| SignInScreen | ✅ Built (always light — pre-auth) |
| AskAITab (SSE streaming, per-recording) | ✅ Built + dark mode |
| AskAIScreen (global, search.askAI) | ✅ Built — needs embeddings to return results |
| ActionItemsScreen | ✅ Built — extracted from recordings.list, toggle confirmed working |
| KnowledgeScreen | ✅ Built — knowledge.getTopEntities, PERSON/TOPIC/PROJECT |
| TemplatesScreen | ✅ Built — templates.list, +New redirects to web |
| ContactsScreen | ✅ Built — search, initials avatar, meta pills |
| AnalyticsScreen | ✅ Built — stat cards, bar chart, speaker talk time |
| Refine Summary (Claude Opus) | ✅ Live |
| Real audio player (S3 pre-signed) | ✅ Built |
| Export sheet (TXT / PDF / copy) | ✅ Built |
| Find & Replace transcript | ✅ Built |
| Name Speakers | ✅ Built |
| Re-transcribe modal | ✅ Built |
| Dark mode (full app) | ✅ Complete |
| Markdown rendering | ✅ react-native-markdown-display |
| Word-level audio sync | ✅ New recordings only (wordsJson on TranscriptSegment) |
| Apple Watch Phase 1 | ✅ Series 11 — wrist tap → iPhone recording, MM:SS timer, haptic |
| Apple Watch Phase 2 | ✅ Push notification on notes ready, 3-bullet wrist summary |
| Apple Watch Phase 3 | ❌ Not built — Force Touch bookmark |
| TestFlight | ❌ Pending Apple Developer account |
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

> ⚠️ **expo-blur is installed but BlurView must NOT be used** — renders transparent on iOS Simulator (no GPU). Use plain `View` with `backgroundColor: colors.surface` instead.

---

## Known Issues

| Issue | Status |
|---|---|
| Hermes build phase warning | Harmless — pre-existing CocoaPods warning |
| npm peer dep conflict (react-dom) | Workaround: always `--legacy-peer-deps` |
| `trpc.recordings.list` response shape varies | Handled — code checks `data.recordings`, `data.items`, bare array |
| BlurView transparent on simulator | Fixed — BlurView removed from all screens |
| TypeScript errors in `src/lib/trpc.tsx` | Pre-existing noise from `createTRPCReact<any>()` — do not fix by importing server Prisma types |
| AskAI shows "no embeddings" on first use | Expected — user must generate embeddings from web Recording Detail first |

---

## Web App Reference (app.kolasys.ai)

Stack: Next.js 16.2 + Prisma 7 + tRPC 11 + Clerk 7 + Neon (DB) + Upstash (Redis) + S3

**Key web-only files:**
- `src/server/routers/apikeys.router.ts` — `apiKeys.list/create/revoke`
- `src/lib/api-auth.ts` — Bearer token auth for public REST API
- `src/app/api/v1/recordings/` — public REST endpoints
- `src/services/push.service.ts` — `sendExpoPush()` helper
- `src/server/root.ts` — root tRPC router (NOT index.ts)

**Public REST API (bearer token: `Authorization: Bearer kol_xxx`):**
- `GET /api/v1/recordings` — list recordings (supports ?limit= up to 200)
- `GET /api/v1/recordings/[id]/transcript`
- `GET /api/v1/recordings/[id]/actions`

**Key rules:**
- Prisma v7: no `$transaction`, no nested creates. Sequential calls only. `db push` for schema changes.
- Dark theme: bg `#0F0F13`, surface `#1A1A24`, border `rgba(255,255,255,0.08)`
- Brand red: `#CA2625`. Error red: `#EF4444`. Never mix.
- Branch strategy: `feat/*` → test locally → merge to main → Vercel auto-deploys.

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
└── NavigationContainer theme={navTheme}
    └── RootStack
        ├── BottomTabNavigator
        │   ├── HomeScreen
        │   ├── RecordScreen
        │   ├── RecordingsStack
        │   │   ├── RecordingsScreen
        │   │   └── RecordingDetailScreen
        │   ├── ActionItemsScreen
        │   ├── AskAIScreen
        │   └── SettingsStack
        │       ├── SettingsScreen
        │       ├── ContactsScreen
        │       └── AnalyticsScreen
        ├── KnowledgeScreen   (root stack — accessible from HomeScreen quick actions)
        └── TemplatesScreen   (root stack — accessible from HomeScreen quick actions)
```

### Key patterns
- **Theme:** `useTheme()` from `src/lib/theme` everywhere — never `Colors.*` in screens
- **tRPC direct:** `trpcGet`/`trpcPost` in `src/lib/api.ts` for detail screens
- **tRPC hooks:** `trpc.X.useQuery()` for list screens with auto-refetch
- **Stable getToken:** always via `useRef` — never in dependency arrays directly
- **Polling:** `loadRef.current` pattern avoids self-referential `useEffect` deps
- **Notes:** always normalize `rawData.note ?? rawData.notes?.[0] ?? null`
- **BlurView:** never use — transparent on simulator. Use `View` with `backgroundColor: colors.surface`

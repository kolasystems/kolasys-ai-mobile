# Kolasys AI Mobile — Progress

**Last updated: April 7, 2026**

## Project Overview

React Native / Expo SDK 54 mobile client for [app.kolasys.ai](https://app.kolasys.ai).
Repo: [github.com/kolasystems/kolasys-ai-mobile](https://github.com/kolasystems/kolasys-ai-mobile)

---

## What's Built and Working

### Authentication
- [x] Email + password sign-in via Clerk
- [x] Google OAuth via `expo-auth-session` (works in development build)
- [x] MFA support: email code (6-digit) and TOTP authenticator app
- [x] Session token caching in `expo-secure-store`
- [x] Sign-out with confirmation

### Navigation
- [x] Bottom tab navigator: Home, Record, Recordings, Settings
- [x] Native stack navigator for Recordings → RecordingDetail
- [x] React Navigation v7 with New Architecture compatibility

### Home Screen — 3 internal tabs
- [x] **My Feed tab**: recordings grouped by this week / last week / older; status badges; notes-ready indicator
- [x] **Tasks tab**: recordings with notes listed as collapsible sections; lazy-loads action items on expand; checkbox toggle with API update
- [x] **Calendar tab**: expo-calendar device events for today + next 7 days; platform icon detection (Zoom / Meet / Teams); per-meeting bot-record toggle
- [x] "Record" shortcut button in header → Record tab
- [x] Pull-to-refresh

### Record Screen
- [x] Microphone permission handling
- [x] Start / Pause / Resume / Stop recording (expo-av)
- [x] MM:SS live timer
- [x] Animated waveform bars (7 bars, animated during recording)
- [x] Auto-generated title suggestion on stop
- [x] Title input field
- [x] Upload & Process button (multipart/form-data POST with auth)
- [x] Discard recording with confirmation
- [x] Consent notice text
- [x] Simulator detection (no microphone on simulator — shows friendly message)

### Recordings Screen
- [x] Searchable list of all recordings
- [x] Pull-to-refresh
- [x] `RecordingCard` component with title, date, duration, status badge
- [x] Empty state (no recordings / no search results)
- [x] Navigate to RecordingDetail on tap

### Recording Detail Screen
- [x] Back navigation
- [x] Title, date, duration metadata
- [x] Status badge
- [x] Auto-polling while processing (every 5 seconds)
- [x] Processing banner with contextual message (Transcribing / Generating notes / Processing)
- [x] Failed banner
- [x] **Notes tab**: summary card + structured sections + key points / decisions / next steps
- [x] **Transcript tab**:
  - Static waveform visualization (50-bar waveform placeholder)
  - Disabled audio player UI (Play/Pause, −15s, +15s; tapping explains audio was deleted post-transcription)
  - Topic outline: auto-detected sections from transcript timestamps (tap to jump to page)
  - Paginated segments with speaker labels and timestamps
- [x] **Actions tab**: checkable action items with priority badges + assignee + due date
- [x] **Export sheet** (replaces plain share button):
  - Share link (copy `app.kolasys.ai/recordings/{id}` to clipboard)
  - Copy Notes (Markdown to clipboard)
  - Copy Transcript (plain text to clipboard)
  - Export Notes as TXT (save + share via expo-sharing)
  - Export Transcript as TXT (save + share)
  - Export Notes as PDF (expo-print HTML → PDF → share)

### Settings Screen
- [x] User profile card (name, email, avatar initial)
- [x] Links: web app, privacy policy, terms of service
- [x] App version from expo-constants
- [x] Sign out

### Infrastructure
- [x] tRPC v11 + React Query v5 client with auth headers
- [x] `src/lib/api.ts` — shared `trpcGet` / `trpcPost` helpers
- [x] New Architecture (`newArchEnabled: true`) — JSI-compatible
- [x] Native development build via `npx expo run:ios`
- [x] All native package versions pinned to Expo SDK 54 exact versions
- [x] react-native-worklets installed (required peer dep for reanimated v4)

---

## Competitor Research (April 2026)

Analyzed Fireflies.ai and PLAUD (AI voice recorder hardware) to inform feature roadmap.

### Fireflies.ai strengths observed
- "Soundbites" — shareable audio clips with transcript highlight
- AskFred AI chatbot on each recording (Q&A over transcript)
- Smart search across all meetings
- CRM integrations (Salesforce, HubSpot) — auto log meeting to deal
- Channels / shared workspaces — public team feed of recordings
- Thread comments on transcript segments

### PLAUD strengths observed
- Hardware AI pin (always-on ambient recording)
- Mind map export from notes
- Summary cards styled like social media posts (shareable images)
- Offline transcription on-device
- Multiple language auto-detect

### Key gaps our app addresses vs competitors
- Our export sheet (Copy/TXT/PDF) surpasses Fireflies free tier export restrictions
- Our Calendar tab with bot-toggle is more integrated than Fireflies' calendar widget
- Our Tasks tab aggregates action items across all meetings (Fireflies buries this)

---

## What Still Needs to Be Done

### High Priority
- [ ] **Android build** — `npx expo run:android` not yet tested
- [ ] **Physical device build** — requires Apple Developer account ($99/yr, pending)
- [ ] **Push notifications** — expo-notifications installed but not wired up; alert when notes are ready
- [ ] **Upload endpoint** — confirm the correct upload API path; adjust `RecordScreen.tsx` if different

### Features — Based on Competitor Analysis
- [ ] **AskFred-style AI chat** — "Ask AI" input on RecordingDetailScreen for Q&A over transcript
- [ ] **Smart search** — search across note content, not just recording title
- [ ] **Shareable summary card** — image export of key points as a shareable graphic
- [ ] **Transcript comments** — tap a segment to add a note/comment
- [ ] **Soundbite clips** — select transcript range to share as a highlight
- [ ] **CRM integration UI** — "Log to CRM" action in export sheet

### Features — Infrastructure
- [ ] **Recordings pagination** — currently fetches up to 50; needs infinite scroll
- [ ] **Offline support** — no caching; requires network connectivity
- [ ] **Background recording** — stops if app backgrounded; needs expo-task-manager
- [ ] **Speaker label editing** — transcript shows raw speaker IDs; UI to rename not yet built

### Calendar Tab
- [ ] **Bot deployment** — toggle actually deploys bot via `recordings.create` tRPC mutation (currently shows alert)
- [ ] **Meeting link detection** — parse Zoom/Meet URLs from event notes/location for bot URL

### Polish
- [ ] **Dark mode** — all colors are hardcoded light; theme system was removed to fix a JSI crash
- [ ] **Haptic feedback** — expo-haptics installed but not used
- [ ] **Skeleton loaders** — screens show ActivityIndicator; skeleton screens would feel smoother
- [ ] **Feed key points bullets** — Feed cards can't show note bullets (API list endpoint doesn't return note content); requires either API change or separate per-recording fetches

### Infrastructure
- [ ] **EAS Build** — configure `eas.json` for cloud builds and OTA updates
- [ ] **TestFlight distribution** — needs Apple Developer account + EAS Build
- [ ] **App Store submission** — icons, splash screen, App Store metadata, privacy manifest

---

## Known Issues

| Issue | Status | Notes |
|---|---|---|
| Hermes build phase warning | Harmless | Pre-existing CocoaPods warning; doesn't affect runtime |
| npm peer dep conflict (react-dom) | Workaround in place | `npm install --legacy-peer-deps` required; caused by `@clerk/clerk-expo` pulling in `react-dom` |
| `trpc.recordings.list` response shape | Handled | Code handles `data.recordings`, `data.items`, and bare array |
| Upload endpoint path | Unverified | Assumes `https://app.kolasys.ai/api/upload`; may need adjustment |
| Google OAuth in simulator | Works | Uses `exp://` redirect URI via `AuthSession.makeRedirectUri()` |
| expo-file-system v19 API | Fixed | Must import from `expo-file-system/legacy` for `cacheDirectory`, `EncodingType`, `writeAsStringAsync` |

---

## Native Package Versions (Expo SDK 54 pinned)

These were the root cause of a persistent JSI crash (`expected dynamic type 'boolean', but had type 'string'`). All three were downgraded from newer versions to the exact versions Expo SDK 54 expects:

| Package | Required | Was |
|---|---|---|
| react-native-safe-area-context | ~5.6.0 | 5.7.0 |
| react-native-screens | ~4.16.0 | 4.24.0 |
| react-native-gesture-handler | ~2.28.0 | 2.31.0 |

**Do not upgrade these independently** — always use `npx expo install <package>` to get the SDK-compatible version.

---

## Architecture

```
App.tsx
└── ClerkProvider (Clerk auth)
    └── TRPCProvider (tRPC + React Query)
        └── AppNavigator (NavigationContainer)
            ├── BottomTabNavigator
            │   ├── HomeScreen (Feed / Tasks / Calendar tabs)
            │   ├── RecordScreen (expo-av recording)
            │   ├── RecordingsStack
            │   │   ├── RecordingsScreen (list + search)
            │   │   └── RecordingDetailScreen (Notes / Transcript / Actions + Export sheet)
            │   └── SettingsScreen
            └── (CalendarScreen — built but not in nav; re-add when ready)
```

### Key patterns
- **tRPC calls**: `src/lib/api.ts` `trpcGet`/`trpcPost` for direct HTTP; `trpc.X.useQuery()` for reactive queries
- **Stable getToken**: `useAuth().getToken` is recreated each render → always store in `useRef` before using in `useCallback`/`useEffect`
- **Notes normalization**: server returns `notes[]` (array, take:1); client normalizes to `note` singular via `rawData.note ?? rawData.notes?.[0] ?? null`
- **Polling**: `loadRef.current` pattern to break self-referential polling dependency

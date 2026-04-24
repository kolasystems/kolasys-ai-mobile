# Kolasys AI Mobile — Progress

**Last updated: April 24, 2026**

## Project Overview

React Native / Expo SDK 54 mobile client for [app.kolasys.ai](https://app.kolasys.ai).
Repo: [github.com/kolasystems/kolasys-ai-mobile](https://github.com/kolasystems/kolasys-ai-mobile)

---

## ✅ Complete — Web Parity Screens (2026-04-24)

- [x] **ActionItemsScreen** — tasks extracted from recordings, filter All/Open/Completed, priority badges LOW/MEDIUM/HIGH/URGENT
- [x] **KnowledgeScreen** — personal knowledge graph, grouped People/Topics/Projects, search, tap to expand, back button
- [x] **AskAIScreen** — full chat UI, Claude-powered, suggested questions, source citations per answer
- [x] **TemplatesScreen** — org + global templates, expand to view prompt, +New redirects to web with URL
- [x] New bottom tabs: **ActionItems** (Tasks) and **AskAI** added to tab bar
- [x] **Knowledge** and **Templates** accessible as stack screens from HomeScreen quick-action cards
- [x] HomeScreen gradient updated: dark `['#1a0a0a','#2d1515','#1a1a2e']`, light `['#fff8f8','#ffe8e8','#f0f0ff']`

---

## ✅ Complete — iOS Build Stability (2026-04-24)

- [x] Fixed CocoaPods `objectVersion=70` error (Xcode 16 vs CocoaPods 1.16.x incompatibility)
- [x] Fixed `WatchBridge.swift` and `WatchBridge.m` file reference paths in `project.pbxproj`
- [x] Both fixes documented in `CLAUDE.md` as permanent rules
- [x] Watch app confirmed working — requires separate Xcode build of Watch target after `expo run:ios`

---

## ✅ Complete — Authentication

- [x] Email + password sign-in via Clerk
- [x] Google OAuth via `expo-auth-session`
- [x] MFA support: email code (6-digit) and TOTP authenticator app
- [x] Session token caching in `expo-secure-store`
- [x] Sign-out with confirmation
- [x] Sign-in screen — real brand logo (assets/icon.png, 90×90)

---

## ✅ Complete — Navigation

- [x] Bottom tab navigator: Home, Record, Recordings, Settings
- [x] Native stack navigator for Recordings → RecordingDetail
- [x] React Navigation v7 with New Architecture compatibility
- [x] Full dark mode navTheme applied to NavigationContainer

---

## ✅ Complete — Home Screen (3 tabs)

- [x] **My Feed tab**: recordings grouped by this week / last week / older; status badges
- [x] **Tasks tab**: recordings with action items; checkbox toggle with API update; All Tasks / My Tasks sub-tabs
- [x] **Calendar tab**: expo-calendar device events for today + next 7 days; platform icon detection (Zoom / Meet / Teams)
- [x] Pull-to-refresh on all tabs
- [x] Dark mode — all sub-screens

---

## ✅ Complete — Record Screen

- [x] Microphone permission handling (real device only; friendly message on simulator)
- [x] Start / Pause / Resume / Stop recording (expo-av)
- [x] MM:SS live timer
- [x] Animated waveform bars
- [x] Auto-generated title suggestion on stop
- [x] Language picker chips (16 languages) — passes language to confirmUpload
- [x] Upload & Process button (S3 pre-signed URL pipeline)
- [x] Discard recording with confirmation
- [x] Dark mode

---

## ✅ Complete — Recordings Screen

- [x] Searchable list of all recordings
- [x] Pull-to-refresh
- [x] RecordingCard: title, date, duration, status badge
- [x] Empty state
- [x] Navigate to RecordingDetail on tap
- [x] Dark mode

---

## ✅ Complete — Recording Detail Screen (4 tabs)

- [x] Back navigation, title, date, duration metadata
- [x] Status badge, auto-polling while processing (every 5s)
- [x] Processing banner (Transcribing / Generating notes / Processing) and Failed banner
- [x] **Notes tab**: summary card + Refine Summary (Claude Opus, Condense/Elaborate) + key points/decisions/next steps + sections, all markdown-rendered
- [x] **Transcript tab**: real audio player (expo-av + S3 pre-signed URL with retry on 403), topic outline, paginated segments (30/page), Name Speakers modal, Find & Replace modal
- [x] **Actions tab**: checkable action items with priority badges + assignee + due date
- [x] **Ask AI tab**: SSE streaming chat grounded in recording transcript
- [x] **Export sheet**: share link, copy notes/transcript, export as TXT/PDF
- [x] **Overflow menu (⋯)**: Re-transcribe modal, Find & Replace
- [x] Dark mode — all sub-components

---

## ✅ Complete — Settings Screen

- [x] User profile card (name, email, avatar initial)
- [x] Dark mode toggle (Switch) → toggleDark() from useTheme()
- [x] Links: web app, privacy policy, terms of service
- [x] App version from expo-constants
- [x] Sign out
- [x] Dark mode

---

## ✅ Complete — Brand Identity (2026-04-21)

- [x] Brand red accent `#CA2625` — all interactive elements, buttons, tabs, icons
- [x] `accentSoft: rgba(202,38,37,0.12/.22)` — soft backgrounds
- [x] `accentPressed: #A01E1E (light) / #E04B4A (dark)` — pressed states
- [x] `Colors.primary = '#CA2625'` — legacy call sites
- [x] App icon — 1024×1024 RGB PNG (no alpha — iOS requirement)
- [x] Adaptive icon (Android) — same image, white bg
- [x] Splash screen — logo centered on white, 512×512
- [x] `app.json` — splashBackground `#FFFFFF`, notification color `#CA2625`
- [x] Sign-in screen — real logo PNG instead of mic icon placeholder

> **Icon change process:** After changing assets/icon.png, must run `npx expo prebuild --clean && npx expo run:ios`. Git push alone does NOT update the iOS simulator icon — Xcode bakes it during prebuild.

---

## ✅ Complete — Dark Mode (2026-04-20)

- [x] Theme lives at `src/lib/theme.ts` — useTheme(), lightColors, darkColors
- [x] Storage key: `'kolasys-theme'` in AsyncStorage
- [x] ThemeProvider wraps entire app in App.tsx
- [x] NavigationContainer receives full navTheme
- [x] All screens use `colors.*` tokens — no hardcoded hex
- [x] BlurView removed everywhere (transparent on simulator) — plain View with `colors.surface`
- [x] StatusBar: `style={isDark ? 'light' : 'dark'}`

---

## ✅ Complete — Multi-Language (2026-04-21)

- [x] Language picker on Record screen (16 RECORD_LANGUAGES chips)
- [x] Selected language passed to `confirmUpload` tRPC call
- [x] Web: 16-language dropdown in New Recording modal
- [x] Web: org-level default language in Settings

---

## ✅ Complete — Infrastructure

- [x] tRPC v11 + React Query v5 client with auth headers
- [x] `src/lib/api.ts` — trpcGet / trpcPost helpers
- [x] New Architecture (`newArchEnabled: true`) — JSI-compatible
- [x] Native development build via `npx expo run:ios`
- [x] Native packages pinned to Expo SDK 54 exact versions (prevents JSI crash)
- [x] Railway workers handle all backend processing — no local workers needed

---

## ✅ Complete — Contacts Screen (2026-04-21)

- [x] Push navigation from Settings → Contacts via SettingsStack
- [x] Search bar with live filter
- [x] Contact cards: coloured initials avatar (deterministic from name), name, meeting count pill, talk time pill, last seen pill
- [x] Empty state with icon and helpful copy
- [x] Pulls from trpc.contacts.list

---

## ✅ Complete — Analytics Screen (2026-04-21)

- [x] Push navigation from Settings → Analytics via SettingsStack
- [x] 4 stat cards in 2×2 grid: Total Meetings, Avg Duration, Action Items, Total Time
- [x] 12-week meeting frequency bar chart (custom View-based, no library)
- [x] Speaker talk time horizontal progress bars (top 8)
- [x] Recent recordings list (last 10)
- [x] Pulls from trpc.analytics.getStats

---

## ✅ Complete — SettingsStack Navigation (2026-04-21)

- [x] AppNavigator.tsx — Settings tab is now a SettingsStack (not a direct tab screen)
- [x] SettingsStackParamList exported: { SettingsMain, Contacts, Analytics }
- [x] SettingsScreen accepts navigation as typed prop — NOT useNavigation() hook (hook returns tab context, not stack)
- [x] DATA section in Settings with Contacts and Analytics rows

---

## ✅ Complete — Word-Level Audio Sync (2026-04-21)

- [x] TranscriptSegment type updated with wordsJson?: string | null
- [x] TranscriptSegmentRow renders word-by-word tappable Text when wordsJson present
- [x] Active word highlighted in colors.accent + colors.accentSoft background
- [x] Tap word → soundRef.current.setPositionAsync(Math.round(startSec * 1000))
- [x] Falls back to plain text for recordings without wordsJson (old recordings)

---

## 🔴 Not Yet Built — Next Priority

### High (build next)
- [x] **Apple Watch Phase 1** — SwiftUI WatchOS target built and running on simulator. WatchConnectivity bridge live. Tap mic button on wrist → triggers recording on iPhone. Live MM:SS timer. Haptic on start/stop. Brand red #CA2625. No competitor has this.
- [~] **Apple Watch Phase 2** — mobile side wired: Expo push token registration on sign-in (`registerPushToken` → `settings.updatePushToken` tRPC call), notification handler enables sound + badge, `addNotificationResponseReceivedListener` routes a `{recordingId}` payload to the RecordingDetail screen via `navigationRef`. **Pending:** web-side `settings.updatePushToken` tRPC mutation + Railway summarization-worker call to the Expo push endpoint when a recording transitions to READY.
- [ ] **Soundbites** — clip highlight from recording, share via public link
- [ ] **Bot capture from mobile** — deploy meeting bot from calendar screen

### Medium
- [ ] **CRM integration** — HubSpot + Salesforce
- [ ] **API keys page** — expose developer access

### Apple Watch — Planned, No Competitor Has This
- [ ] **Phase 1** — SwiftUI WatchOS target, WatchConnectivity, tap crown to start/stop recording on iPhone, live timer, haptic
- [ ] **Phase 2** — notification when notes ready, 3-bullet summary on wrist
- [ ] **Phase 3** — Force Touch bookmark (creates transcript timestamp)

### Infrastructure
- [ ] **TestFlight** — needs Apple Developer account ($99/yr, pending approval)
- [ ] **EAS Build** — configure eas.json for cloud builds and OTA updates
- [ ] **Android** — untested; likely works but needs verification
- [ ] **Background recording** — stops if app backgrounded; needs expo-task-manager
- [ ] **Push notifications** — expo-notifications wired but not live (needs TestFlight)

---

## Known Issues

| Issue | Status |
|---|---|
| `npm install` without `--legacy-peer-deps` fails | Always use `--legacy-peer-deps` — Clerk conflicts with react-dom |
| BlurView transparent on simulator | Fixed — BlurView removed from all screens, using plain View |
| Hermes build phase warning | Harmless — pre-existing CocoaPods warning |
| TypeScript noise in `src/lib/trpc.tsx` | Pre-existing from `createTRPCReact<any>()` — do not fix by importing server Prisma types |
| App icon doesn't update from git push | Must run `npx expo prebuild --clean && npx expo run:ios` after icon changes |

---

## Native Package Versions (Expo SDK 54 pinned)

| Package | Required version |
|---|---|
| `react-native-safe-area-context` | ~5.6.0 |
| `react-native-screens` | ~4.16.0 |
| `react-native-gesture-handler` | ~2.28.0 |

**Never upgrade these independently** — always `npx expo install <package>`. Mismatched versions cause a JSI crash: `expected dynamic type 'boolean', but had type 'string'`.

---

## Competitive Context — Mobile

Fireflies mobile (audited April 21, 2026) has:
- Emoji-categorized AI summary bullets (💰 Finance, 🧠 Strategy, 🎉 Events)
- My Feed / Tasks / Calendar tabs (we match this)
- All Tasks / My Tasks with assignee avatars on each task (we have tasks but no avatars)
- Soundbites library + Playlists tab (we don't have this yet)
- Capture modal: Record audio, Add to live meeting, Upload Audio or Video, Schedule meeting

**Key gaps vs Fireflies mobile:**
1. Contacts screen — missing entirely
2. Analytics screen — missing
3. Soundbites library — missing
4. Assignee avatars on Tasks — missing
5. Emoji-bullet feed summary style — polish gap

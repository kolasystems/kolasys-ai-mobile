# Kolasys AI Mobile — Progress

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

### Home Screen
- [x] Greeting with Clerk user's first name
- [x] 3 stat cards: total recordings, notes this week, open actions
- [x] Recent recordings list using `RecordingCard` component
- [x] "New Recording" shortcut button → Record tab
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
- [x] Share button (exports notes as Markdown)
- [x] **Notes tab**: summary card + structured sections
- [x] **Transcript tab**: paginated segments with speaker labels and timestamps
- [x] **Actions tab**: checkable action items with priority badges + assignee + due date

### Settings Screen
- [x] User profile card (name, email, avatar initial)
- [x] Links: web app, privacy policy, terms of service
- [x] App version from expo-constants
- [x] Sign out

### Infrastructure
- [x] tRPC v11 + React Query v5 client with auth headers
- [x] New Architecture (`newArchEnabled: true`) — JSI-compatible
- [x] Native development build via `npx expo run:ios`
- [x] All native package versions pinned to Expo SDK 54 exact versions
- [x] react-native-worklets installed (required peer dep for reanimated v4)

---

## What Still Needs to Be Done

### High Priority
- [ ] **Android build** — `npx expo run:android` not yet tested
- [ ] **Physical device build** — requires Apple Developer account ($99/yr, pending)
- [ ] **Push notifications** — expo-notifications is installed but not wired up; users need alerts when notes are ready
- [ ] **Upload endpoint** — confirm the correct upload API path (`/api/upload` is assumed); adjust `RecordScreen.tsx:152` if different

### Features
- [ ] **Calendar screen** — `CalendarScreen.tsx` exists and is implemented but not in the current tab navigator; re-add when ready
- [ ] **Bot deployment** — "Deploy Bot" flow from Calendar screen needs real API integration
- [ ] **Recordings pagination** — currently fetches up to 50 recordings; needs infinite scroll for large libraries
- [ ] **Offline support** — no caching; requires network connectivity for all data
- [ ] **Background recording** — currently stops if app is backgrounded; needs expo-task-manager integration
- [ ] **Speaker label editing** — transcript shows raw speaker IDs; UI to rename speakers not yet built
- [ ] **Search across notes content** — current search only filters by recording title

### Polish
- [ ] **Dark mode** — all colors are hardcoded light; theme system was removed to fix a JSI crash and not yet restored
- [ ] **Haptic feedback** — expo-haptics is installed but not used
- [ ] **Skeleton loaders** — screens show ActivityIndicator during load; skeleton screens would feel smoother
- [ ] **Recording detail from Home** — tapping a recording card on HomeScreen navigates to the Recordings tab but doesn't deep-link directly to the detail

### Infrastructure
- [ ] **EAS Build** — configure `eas.json` for cloud builds and OTA updates via Expo Application Services
- [ ] **TestFlight distribution** — needs Apple Developer account + EAS Build
- [ ] **App Store submission** — icons, splash screen, App Store metadata, privacy manifest

---

## Known Issues

| Issue | Status | Notes |
|---|---|---|
| Hermes build phase warning | Harmless | Pre-existing CocoaPods warning; doesn't affect runtime |
| npm peer dep conflict (react-dom) | Workaround in place | `npm install --legacy-peer-deps` required; caused by `@clerk/clerk-expo` pulling in `react-dom` |
| `trpc.recordings.list` response shape | Unverified | Code handles both `data.recordings`, `data.items`, and bare array; adjust if server shape differs |
| Upload endpoint path | Unverified | Assumes `https://app.kolasys.ai/api/upload`; may need to match actual server route |
| Google OAuth in simulator | Works | Uses `exp://` redirect URI via `AuthSession.makeRedirectUri()` |

---

## Native Package Versions (Expo SDK 54 pinned)

These were the root cause of a persistent JSI crash (`expected dynamic type 'boolean', but had type 'string'`). All three were downgraded from newer versions to the exact versions Expo SDK 54 expects:

| Package | Required | Was |
|---|---|---|
| react-native-safe-area-context | ~5.6.0 | 5.7.0 |
| react-native-screens | ~4.16.0 | 4.24.0 |
| react-native-gesture-handler | ~2.28.0 | 2.31.0 |

Do not upgrade these independently — always use `npx expo install <package>` to get the SDK-compatible version.

# Kolasys AI Mobile — Claude Reference

> Quick-start for a new Claude Code session on this repo.

**Repo:** https://github.com/kolasystems/kolasys-ai-mobile  
**Web backend:** https://app.kolasys.ai (tRPC API at `https://app.kolasys.ai/api/trpc`)  
**Web repo:** `~/Desktop/kolasys-ai` · `github.com/kolasystems/kolasys-ai`  
**Desktop repo:** `~/Desktop/kolasys-ai-desktop` · `github.com/kolasystems/kolasys-ai-desktop`  
**Last updated:** 2026-04-28

---

## What This Is

React Native / Expo SDK 54 mobile companion app for Kolasys AI (AI-powered meeting notes + transcription). iOS only (Android untested). New Architecture enabled.

**TestFlight:** v1.0.0 Build 1 — live, installed on Paul's iPhone 16 Pro Max (iOS 26.3.1)

---

## Quick Start

```bash
cd ~/Desktop/kolasys-ai-mobile
npm install --legacy-peer-deps   # ALWAYS use --legacy-peer-deps
npx expo run:ios                 # Builds and opens in iOS Simulator
```

---

## Apple Developer Account

- **Team:** Kola Systems LLC
- **Team ID:** `G4FYFLNJMC`
- **Apple ID:** `paulkola@mac.com`
- **Bundle ID:** `com.kolasystems.kolasysai`
- **Watch Bundle ID:** `com.kolasystems.kolasysai.watchkitapp`
- **App Store Connect App ID:** `6764396351`
- **Distribution Cert:** Serial `191020F4D88B38BABFC095B2CDE411CA`, expires Apr 28, 2027
- **Provisioning Profile:** ID `2Q2QXZB5A8`, expires Apr 28, 2027

## App Store Connect API Key (Admin)
- **Key ID:** `5Q4VY62Z5Y`
- **Issuer ID:** `07c0f1b4-b2d4-452e-9397-6fe2bbe40418`
- **File:** `~/Downloads/AuthKey_5Q4VY62Z5Y.p8`

## EAS
- **Expo account:** `kolasysai` (paulkola@mac.com, GitHub OAuth)
- **Project:** `@kolasysai/kolasys-ai-mobile`
- **Project ID:** `b6cab2a6-d1df-4288-b887-4a9a4860766a`

---

## TestFlight Submission (Xcode — Preferred Method)

EAS cloud build fails at pod install (CocoaPods + Xcode 16 objectVersion issue). Use Xcode archive instead:

1. Plug iPhone into Mac via USB
2. Xcode destination → **Any iOS Device (arm64)**
3. Stop any running app (■ button)
4. **Product → Archive** — wait 5-10 min
5. Organizer → **Distribute App → App Store Connect → Upload**
6. Encryption question → **"None of the algorithms mentioned above"**
7. Build appears in TestFlight within 15 min

## EAS Build Command (for future reference)
```bash
cd ~/Desktop/kolasys-ai-mobile
export EXPO_ASC_API_KEY_ID=5Q4VY62Z5Y
export EXPO_ASC_ISSUER_ID=07c0f1b4-b2d4-452e-9397-6fe2bbe40418
export EXPO_ASC_API_KEY_PATH=/Users/kolasys/Downloads/AuthKey_5Q4VY62Z5Y.p8
eas build --platform ios --profile production
```
Note: EAS cloud build has CocoaPods objectVersion issue. Use Xcode archive instead.

---

## Critical Rules

### Always use --legacy-peer-deps
```bash
npm install <package> --legacy-peer-deps
```

### iOS Build — CocoaPods objectVersion fix
After any Xcode 16 upgrade or fresh clone:
```bash
sed -i '' 's/objectVersion = 70/objectVersion = 60/' ios/KolasysAI.xcodeproj/project.pbxproj
```

### WatchBridge file reference paths
If you see `Build input file cannot be found: '.../ios/WatchBridge.swift'`:
```bash
sed -i '' 's/path = WatchBridge\.swift;/path = KolasysAI\/WatchBridge.swift;/' ios/KolasysAI.xcodeproj/project.pbxproj
sed -i '' 's/path = WatchBridge\.m;/path = KolasysAI\/WatchBridge.m;/' ios/KolasysAI.xcodeproj/project.pbxproj
```

### Watch app deployment
`expo run:ios` only deploys iPhone target. After every iPhone build, reinstall Watch:
1. `open ios/KolasysAI.xcworkspace`
2. Scheme → `KolasysWatch Watch App`
3. Destination → paired Apple Watch
4. Cmd+R

### Clerk keys — NEVER mix test/live
- Local `.env`: `pk_test_` + `sk_test_`
- Railway + Vercel: `pk_live_` + `sk_live_`

### getToken must be in a useRef
```typescript
const getTokenRef = useRef(getToken);
useEffect(() => { getTokenRef.current = getToken; });
```

### Metro
Always keep running: `npx expo start`  
After build: shake phone → Reload (or press `r` in Metro terminal)

---

## Confirmed tRPC Procedures (2026-04-28)

```
recordings.list              GET    { limit: 50 } — includes nested actionItems[]
recordings.get               GET    { id }
recordings.updateActionItem  POST   { id, status, priority? }
                                    status: OPEN | IN_PROGRESS | COMPLETED | CANCELLED
recordings.refineSummary     POST   calls Claude Opus live
knowledge.getTopEntities     GET    { limit: 50 } — types: PERSON | TOPIC | PROJECT
templates.list               GET    {}
search.askAI                 POST   { question, context? }   ← NOT ai.ask
settings.updatePushToken     POST   { token: string }
settings.getOrgSettings      GET    —
settings.updateOrgSettings   POST   partial org settings
apiKeys.list                 GET    —
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

### search.askAI
- Type: mutation
- Input: `{ question: string, recordingId?: string }`
- Output: `{ answer: string, sources: Source[] }`
- Source: `{ index, recordingId, recordingTitle, chunkText, startTime: number|null, similarity }`
- Requires embeddings — generate from web Recording Detail page first

---

## Screen Status (2026-04-28)

| Screen / Feature | Status |
|---|---|
| HomeScreen (Feed / Tasks / Calendar) | ✅ |
| RecordScreen + WatchConnectivity | ✅ |
| RecordingsScreen | ✅ |
| RecordingDetailScreen (4 tabs) | ✅ |
| SettingsScreen | ✅ |
| AskAIScreen (global, search.askAI) | ✅ — needs embeddings |
| ActionItemsScreen | ✅ — toggle confirmed working |
| KnowledgeScreen | ✅ — knowledge.getTopEntities |
| TemplatesScreen | ✅ — templates.list |
| ContactsScreen | ✅ |
| AnalyticsScreen | ✅ |
| Apple Watch Phase 1 | ✅ — wrist tap → record |
| Apple Watch Phase 2 | ✅ — push notification on notes ready |
| Apple Watch Phase 3 | ❌ — Force Touch bookmark not built |
| TestFlight | ✅ — v1.0.0 Build 14 installed on iPhone 16 Pro Max — share extension live |
| Android | ❌ — untested |

---

## Theme System

Theme at `src/lib/theme.ts` — NO ThemeContext file.

```typescript
import { useTheme } from '../lib/theme';
const { colors, isDark, toggleDark } = useTheme();
```

Storage key: `'kolasys-theme'`. Brand red: `#CA2625`. Error red: `#EF4444`. Never mix.

**BlurView:** NEVER use — transparent on iOS simulator. Use `View` with `backgroundColor: colors.surface`.

---

## Apple Watch

### Phase 1 ✅ (April 22)
- Files: `ios/KolasysWatch Watch App/` — SwiftUI entry, ContentView, WatchConnector
- Bridge: `ios/KolasysAI/WatchBridge.swift` + `.m`, `src/lib/watchBridge.ts`
- Watch → iOS: `{ command: 'start' | 'stop' }`
- iOS → Watch: `{ state: 'idle' | 'recording', elapsed: number }` every 1s

### Phase 2 ✅ (April 27)
- `OrgMember.expoPushToken` — per-user token
- `settings.updatePushToken` saves token for `(orgId, userId)`
- Summarization worker sends Expo push on completion
- 3-bullet body from note sections, `data: { recordingId }`
- `src/services/push.service.ts` — `sendExpoPush()` — plain fetch, no SDK

---

## Web App Reference

Stack: Next.js 16.2 + Prisma 7 + tRPC 11 + Clerk 7 + Neon + Upstash + S3  
Root router: `src/server/root.ts` (NOT index.ts)

**Public REST API (`Authorization: Bearer kol_xxx`):**
- `GET /api/v1/recordings`
- `POST /api/v1/recordings` — create + S3 upload URL (desktop app)
- `POST /api/v1/recordings/{id}/confirm` — trigger transcription
- `GET /api/v1/recordings/{id}/transcript`
- `GET /api/v1/recordings/{id}/actions`

**Key rules:**
- Prisma v7: no `$transaction`, no nested creates, `db push` for schema changes
- Dark theme: bg `#0F0F13`, surface `#1A1A24`, border `rgba(255,255,255,0.08)`
- Branch: `feat/*` → test → merge to main → Vercel auto-deploys

---

## Known Issues

| Issue | Detail |
|---|---|
| EAS cloud build | Fails at pod install — use Xcode archive for TestFlight |
| AskAI empty results | Expected — generate embeddings from web Recording Detail first |
| BlurView transparent | Fixed — removed from all screens |
| npm peer conflict | Workaround: always `--legacy-peer-deps` |
| CocoaPods objectVersion | Re-apply sed fix after any Xcode upgrade |

---

## April 29, 2026 — TestFlight Builds

**Build 5 is current stable.** Earlier session work that landed in this build:
- `a9076eb` — `RecordScreen` `isDevice` fix: now uses `Platform.OS !== 'web'` instead of `Constants.isDevice`. Production iPhone builds were sometimes seeing `Constants.isDevice === false` and incorrectly hitting the "Real Device Required" alert.
- `9bd3ba2` — file-upload feature attempted (`expo-document-picker` + `+` button on `RecordingsScreen`).
- `5d1052b` — **reverted** the file-upload feature. The native binary in TestFlight was built before `expo-document-picker` pods were installed, so the JS bridge couldn't find the native module at runtime. Need `cd ios && pod install` (or a fresh native rebuild) before re-introducing the picker.

**Build 14 is current stable** (April 30). Brought the iOS Share Extension live for Voice Memos. Took several iterations:
- `9f64bdb` — initial scaffold (SwiftUI / `UIHostingController`).
- `7f9241b` — restored `Info.plist` + `ShareViewController.swift` after Xcode wiped them while adding the target.
- `a4b52aa` — `import Combine` for `ObservableObject` (still SwiftUI at this point).
- `9c8147b` — `NSExtensionActivationRule` rewritten as a `SUBQUERY` predicate string. Fixed Voice Memos not showing the extension at all.
- `615d2d1` — removed `@objc(ShareViewController)`. The rename mismatched `NSExtensionPrincipalClass = $(PRODUCT_MODULE_NAME).ShareViewController`.
- `d0a24d7` — **rewrote in pure UIKit**. SwiftUI/`UIHostingController` was hitting the Xcode 16 `SwiftUICore` linker restriction and silently killing the extension. This is the load-bearing fix.
- `fe9b9c5` — removed `import MobileCoreServices`, switched to plain UTI string literals.
- `069d66c` — copy the shared file *inside* the `loadFileRepresentation` callback before dispatching to main. The provided URL is sandbox-scoped and disappears the moment the block returns.

### Rule: pod install before archiving

**ALWAYS run `pod install` after adding any native Expo package before archiving.** Never add a native package and archive in the same step without `pod install` — TestFlight builds will ship a JS bundle that calls into a native module that isn't actually linked, producing silent runtime failures (`undefined is not an object`, calls that no-op, etc.).

```bash
cd ios
pod install
cd ..
# then Xcode → Product → Archive
```

### TestFlight build process (recap)

1. Plug iPhone into Mac
2. Xcode destination → **Any iOS Device (arm64)**
3. **Product → Archive** (~10 min)
4. Organizer → **Distribute App → App Store Connect → Upload**
5. Build appears in TestFlight in ~15 min

(Same flow as in the "TestFlight Submission" section above — restated here so the rule + process live together.)

---

## iOS Share Extension (`KolasysShare`)

✅ **Working in Build 14.** Lets users send audio from Voice Memos / Files / etc. straight into Kolasys AI via the iOS share sheet. The extension drops the audio into the App Group container; the main app picks it up on foreground and runs the standard 4-step upload pipeline.

### Hard requirements (learned the hard way)

- **Pure UIKit only.** No `SwiftUI`, no `UIHostingController`, no `Combine`. Xcode 16 enforces a `SwiftUICore` linker restriction (`cannot link directly with 'SwiftUICore' because product being built is not an allowed client of it`) that silently kills the extension at runtime. The current `ShareViewController.swift` is intentionally pure UIKit — do not "modernize" it back to SwiftUI.
- **Minimum deployment target: iOS 15.6.** Both the main app target and the `KolasysShare` target must be set to ≥ 15.6. Lower targets break `loadFileRepresentation`'s async semantics and `UTType` resolution on real devices.
- **Don't use `@objc(ShareViewController)`** — `NSExtensionPrincipalClass` is `$(PRODUCT_MODULE_NAME).ShareViewController`, and the `@objc` rename forces a bare ObjC name that iOS can't resolve.
- **Don't import `MobileCoreServices`** — deprecated, causes silent crashes alongside `UniformTypeIdentifiers`.
- **`NSExtensionActivationRule` must be a predicate string**, not a dict. The dict form (`NSExtensionActivationSupportsFileWithMaxCount` etc.) is fallback-only — Voice Memos won't show the extension. Use the `SUBQUERY` predicate matching `public.audio` / `com.apple.m4a-audio` / `public.mpeg-4-audio` / `public.movie`.
- **Copy the shared file inside the `loadFileRepresentation` callback block** — the URL is sandbox-scoped and gets reclaimed as soon as the block returns. Dispatching to main first = file gone.

### Files (already scaffolded in the repo)

- `ios/KolasysShare/ShareViewController.swift` — **pure UIKit** Share Extension UI + file copy
- `ios/KolasysShare/Info.plist` — `NSExtension` config, principal class `ShareViewController`
- `ios/KolasysShare/KolasysShare.entitlements` — App Group `group.com.kolasystems.kolasysai`
- `ios/KolasysAI/SharedFilesBridge.swift` + `.m` — RN bridge exposed as `NativeModules.SharedFilesBridge`
- `ios/KolasysAI/KolasysAI.entitlements` — App Group added next to `aps-environment`
- `src/lib/sharedFilesBridge.ts` — JS wrapper, no-ops when bridge isn't linked
- `src/hooks/useSharedFiles.ts` — drains pending files on app foreground
- Wired into `src/screens/RecordingsScreen.tsx`

### Manual Xcode steps (one-time per fresh prebuild)

`expo prebuild` does not know about the Share Extension target, so it has to be added by hand. Repeat after any `expo prebuild --clean` (or fresh checkout where the project was regenerated):

1. **Open the workspace:** `open ios/KolasysAI.xcworkspace`
2. **Add the extension target:**
   - File → New → Target… → iOS → **Share Extension**
   - Product Name: `KolasysShare`
   - Bundle Identifier: `com.kolasystems.kolasysai.KolasysShare`
   - Language: Swift
   - When prompted to activate the scheme: **Cancel** (we don't run it standalone)
3. **Replace the autogenerated extension files** with the scaffolded ones in `ios/KolasysShare/`:
   - Delete `ShareViewController.swift`, `MainInterface.storyboard`, and `Info.plist` from the new target group
   - Drag in `ios/KolasysShare/ShareViewController.swift` and `ios/KolasysShare/Info.plist`
   - Set the target's **Info.plist File** build setting to `KolasysShare/Info.plist`
   - Remove `NSExtensionMainStoryboard` references — we use `NSExtensionPrincipalClass`
   - Set the target's **iOS Deployment Target** to **15.6** (Build Settings → Deployment)
4. **App Group entitlement:**
   - Select the **KolasysAI** target → Signing & Capabilities → **+ Capability** → App Groups → check `group.com.kolasystems.kolasysai`
   - Select the **KolasysShare** target → same capability + same group
   - Verify both targets reference the matching `.entitlements` file in **Build Settings → Code Signing Entitlements**
5. **Add the bridge to the main app target:**
   - Right-click the `KolasysAI` group → **Add Files to "KolasysAI"…**
   - Select `ios/KolasysAI/SharedFilesBridge.swift` and `SharedFilesBridge.m`
   - Target membership: **KolasysAI only** (not the share extension)
6. **Run `pod install`** and rebuild:
   ```bash
   cd ios && pod install && cd ..
   ```
7. Build & run on a real device. Open Voice Memos → share a memo → "Kolasys AI" should appear in the share sheet.

### How it flows at runtime

1. User taps share sheet → `ShareViewController` reads the attachment via `NSItemProvider.loadFileRepresentation(forTypeIdentifier:)`
2. File is copied into `group.com.kolasystems.kolasysai/pending-uploads/share-<timestamp>.<ext>`
3. Main app foregrounds → `useSharedFiles` calls `SharedFilesBridge.getPendingFiles()`
4. Each file goes through `recordings.create` → `recordings.getUploadUrl` → S3 PUT → `recordings.confirmUpload`
5. `SharedFilesBridge.deletePendingFile()` removes the local copy on success

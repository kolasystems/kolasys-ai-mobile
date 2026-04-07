# Kolasys AI Mobile

AI-powered meeting notes for iOS. Records meetings, transcribes audio, and generates structured notes with action items — all connected to the Kolasys AI platform at [app.kolasys.ai](https://app.kolasys.ai).

**GitHub:** https://github.com/kolasystems/kolasys-ai-mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81 + Expo SDK 54 |
| Auth | Clerk (`@clerk/clerk-expo`) |
| API | tRPC v11 + React Query v5 |
| Navigation | React Navigation v7 (bottom tabs + native stack) |
| Audio | expo-av |
| Calendar | expo-calendar |
| Storage | expo-secure-store (token cache) |
| Language | TypeScript |

---

## Prerequisites

- Node.js 18+
- Xcode 15+ (for iOS simulator)
- CocoaPods (installed automatically on first run)
- An account at [app.kolasys.ai](https://app.kolasys.ai)

---

## Environment Setup

The Clerk publishable key is embedded in `app.json` under `expo.extra.clerkPublishableKey`. No `.env` file is needed for local development — the key is already configured.

If you need to use a different Clerk instance, update `app.json`:

```json
{
  "expo": {
    "extra": {
      "clerkPublishableKey": "pk_test_YOUR_KEY_HERE"
    }
  }
}
```

---

## Running Locally (iOS Simulator)

```bash
# Install dependencies
npm install

# Run on iOS simulator (builds native app — required for auth and audio)
npx expo run:ios
```

The first run will:
1. Install CocoaPods automatically
2. Download React Native prebuilt binaries (~150 MB)
3. Build and launch the app in the iOS simulator

Subsequent runs are faster as binaries are cached.

> **Note:** Expo Go is not supported. The app uses native modules (audio recording, secure storage, calendar) that require a development build via `npx expo run:ios`.

---

## Running on a Physical Device

> Requires an Apple Developer account (paid, $99/year).

Once your Apple Developer account is approved:

1. Open `ios/KolasysAI.xcworkspace` in Xcode
2. Select your device from the target dropdown
3. Set your Team under **Signing & Capabilities**
4. Or run from the CLI:

```bash
npx expo run:ios --device
```

---

## Project Structure

```
kolasys-ai-mobile/
├── App.tsx                          # Root: ClerkProvider → TRPCProvider → navigator
├── app.json                         # Expo config (bundle ID, scheme, keys)
├── src/
│   ├── screens/
│   │   ├── SignInScreen.tsx         # Email/password + Google OAuth + MFA
│   │   ├── HomeScreen.tsx           # Dashboard: stats + recent recordings
│   │   ├── RecordScreen.tsx         # Audio recorder with upload
│   │   ├── RecordingsScreen.tsx     # Searchable recordings list
│   │   ├── RecordingDetailScreen.tsx # Notes / Transcript / Actions tabs
│   │   └── SettingsScreen.tsx       # Profile + sign out
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Bottom tabs + recordings stack
│   ├── components/
│   │   ├── RecordingCard.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── ActionItemRow.tsx
│   │   └── TranscriptSegment.tsx
│   └── lib/
│       ├── trpc.tsx                 # tRPC client + TRPCProvider
│       ├── auth.ts                  # Clerk token cache (SecureStore)
│       └── theme.ts                 # Color constants
└── ios/                             # Generated native iOS project
```

---

## API

All data is fetched from the production API at `https://app.kolasys.ai/api/trpc`. Requests are authenticated with a Clerk session JWT passed as `Authorization: Bearer <token>`.

Key procedures used:
- `recordings.list` — paginated list of recordings
- `recordings.get` — single recording with transcript + notes
- `recordings.updateActionItem` — toggle action item status

Audio uploads go to `https://app.kolasys.ai/api/upload` as multipart/form-data.

---

## Authentication

Sign-in supports:
- Email + password
- Google OAuth (via `expo-auth-session`)
- MFA (email code + TOTP authenticator app)

Session tokens are cached in `expo-secure-store` and automatically refreshed by Clerk.

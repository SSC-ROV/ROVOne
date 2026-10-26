# ROV Team Hub — iPad App (TestFlight)

Native shell app (SwiftUI + WKWebView) that loads https://rov.sscrov.com
full-screen. Landscape-locked, pull-to-refresh, persistent login.
**The server IS the website** — site updates reach the app automatically,
no re-release needed.

## Requirements

1. **Xcode 15+** (from the App Store, ~12GB)
2. **Apple Developer Program account** (US$99/year,
   [developer.apple.com](https://developer.apple.com/programs/); TestFlight
   requires the paid account — free accounts can only side-load to your own
   devices and expire after 7 days)

## Build & release

1. `git pull`, then open `ios/ROVTeamHub.xcodeproj` in Xcode
2. Select the blue project icon → TARGETS `ROVTeamHub` → **Signing &
   Capabilities**:
   - Team: pick your Apple Developer account
   - Bundle Identifier: change to your own, e.g. `hk.ssc.rov.hub`
     (default `com.sscrov.rovteamhub`; must be unique)
3. Select **Any iOS Device (arm64)** in the device bar → **Product → Archive**
4. When the Archive window opens → **Distribute App** →
   **TestFlight & App Store** → Upload
5. In [App Store Connect](https://appstoreconnect.apple.com) → My Apps
   (first time: create the app — name, language, Bundle ID) → **TestFlight** tab
6. First upload: answer the "Missing Compliance" email — the app uses standard
   HTTPS encryption only (Info.plist already sets
   `ITSAppUsesNonExemptEncryption=false`, usually auto-exempt)
7. **TestFlight → Internal Testing**: add yourself as a tester, install
   immediately; **External Testing**: add teammates' emails or open a public
   link (Apple review 1–2 days once, then fast)
8. Testers install the **TestFlight** app → accept the invite → install

## Push notifications (APNs)

The app registers for web push; tokens are reported per signed-in user and
events (cycle approvals, part requests…) are pushed to members' devices.

1. [developer.apple.com](https://developer.apple.com/account/resources/authkeys/list)
   → Keys → **+** → enable **Apple Push Notifications service (APNs)** →
   download the `.p8` key (one-time download) and note the **Key ID**
2. Note your **Team ID** from the Membership page
3. Vercel → Settings → Environment Variables, add:
   - `APNS_KEY_ID` = Key ID
   - `APNS_TEAM_ID` = Team ID
   - `APNS_KEY_B64` = Base64 of the .p8 file
     (`base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy`)
4. Redeploy. Test on a real device (simulators don't receive remote push)

## Updating

Bump `MARKETING_VERSION`, Archive, Upload. TestFlight prompts testers to
update automatically.

## Files

- `ROVTeamHub/ContentView.swift` — WKWebView shell (progress bar,
  pull-to-refresh, external links open in Safari)
- `ROVTeamHub/Info.plist` — landscape lock, fullscreen, encryption exemption
- `ROVTeamHub/Assets.xcassets` — app icon

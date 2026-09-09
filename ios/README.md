# ROV Team Hub — iPad App（TestFlight 發佈）

原生殼 App（SwiftUI + WKWebView），載入 https://rov.sscrov.com ，鎖定橫屏、下拉重新整理、登入狀態持久化。**伺服器就是網站本身**——以後網站更新，App 內容自動跟上，不用重新發版。

## 前置要求

1. **Xcode 15+**（App Store 安裝，約 12GB）
2. **Apple Developer Program 帳號**（每年 US$99，[developer.apple.com](https://developer.apple.com/programs/) 註冊；TestFlight 必須付費帳號，免費帳號只能直接裝到自己機器、7 天過期）

## 建置步驟

1. `git pull` 後用 Xcode 打開 `ios/ROVTeamHub.xcodeproj`
2. 選左側藍色專案圖示 → TARGETS `ROVTeamHub` → **Signing & Capabilities**：
   - Team 選你的 Apple Developer 帳號（會員名或 Individual Team）
   - Bundle Identifier 建議改成自己的，例如 `hk.ssc.rov.hub`（預設 `com.sscrov.rovteamhub`，若與他人衝突必須改）
3. 選裝置列的 **Any iOS Device (arm64)** → 選單 **Product → Archive**
4. Archive 完成跳出視窗 → **Distribute App** → **TestFlight & App Store** → Upload
5. 到 [App Store Connect](https://appstoreconnect.apple.com) → 我的 App（首次要新增 App：名稱、語言、Bundle ID）→ **TestFlight** 分頁
6. 第一次上傳後要處理一個合規問題：收到「Missing Compliance」郵件 → 回覆 App 使用標準 HTTPS 加密即可（Info.plist 已帶 `ITSAppUsesNonExemptEncryption=false`，通常自動免答）
7. **TestFlight → 內部測試**：加自己為測試員，即刻可裝；**外部測試**：加隊員 email 或開連結，需 Apple 審核（通常 1–2 天，之後每次更新都很快）
8. 測試員在手機安裝 **TestFlight App** → 接受邀請 → 安裝 ROV Team Hub

## 修改後更新版本

改任何東西後：把 `MARKETING_VERSION`（目前 1.0.0）遞增 → 重新 Archive → Upload。TestFlight 舊版會自動提示更新。

## 目錄

- `ROVTeamHub/ContentView.swift` — WKWebView 殼（進度條、下拉刷新、外鏈交給 Safari）
- `ROVTeamHub/Info.plist` — 鎖橫屏、全螢幕、免加密合規申報
- `ROVTeamHub/Assets.xcassets` — App 圖標

# ROV 隊伍任務平台

給學校 ROV 團隊的任務看板、時間規劃、任務日曆與裝備管理網站。
前後端完整、單機可跑，不需要註冊任何外部服務。

## 功能總覽

| 頁面 | 內容 |
|---|---|
| 首頁 | 比賽日倒數、進行中／已逾期／本週截止統計、我的任務、近期活動 |
| 看板 | 待辦／進行中／已完成三欄，拖曳改狀態；任務含負責人、組別、優先級、截止日、子任務、關聯比賽任務 |
| 日曆 | 月曆同時顯示任務截止與活動（例會／水測／比賽），點日期看詳情，隊長可直接新增活動 |
| 比賽任務 | 規則書任務對照表：每個比賽任務關聯工程任務，自動算完成度% |
| 開發週期 | 成員提案開發週期（起訖日期＋合作成員）→ 隊長審批 → 老師審批 → 進行中；任務可歸屬週期，幹部頁看每人週期統計與任務完成度 |
| 零件採買 | 需求 → **老師審批** → 下單 → 到貨全程追蹤，含預估／實際花費統計 |
| 設備 | 設備借用登記（誰借走、應還日、逾期變紅）、維修狀態 |
| 水測日誌 | 每次下水的測試內容、問題、修正、待驗證事項，一鍵轉成追蹤任務 |
| 管理（隊長） | 隊名、比賽日期、成員開戶／重設密碼、Discord 通知、iCal 訂閱 |

### 開發週期的審批鏈

```
成員提案（名稱、起訖日期、合作成員、目標）
  → 【待隊長審批】→ 隊長核准 →【待老師審批】→ 老師核准 →【進行中】→ 標記完成 →【已完成】
  → 隊長或老師駁回 →【已駁回】→ 提案人修改後可重新提交
隊長自己提案：自動跳過隊長層級，直接待老師審批
老師自己提案：直接開始
老師也可以直接核准「待隊長審批」的提案（最終審批權）
```

任務在看板編輯時可選擇「所屬開發週期」，週期頁會顯示每個週期的任務完成度；
隊長與老師在週期頁底部能看到每位成員參與的週期數量統計。

### 老師審批怎麼運作？（零件採買）

不需要給老師帳號。零件送出後，隊長在「零件採買」頁按 **複製老師審批連結**，
把連結用 LINE / Messenger 傳給老師；老師打開網頁就能看到申請內容，
按「核准」或「駁回」（可留備註），結果自動寫回系統並推播到 Discord。
每筆申請的連結都是一次性隨機 token，審完即失效。

### 通知與訂閱

- **Discord Webhook**（管理頁貼上網址 → 儲存 → 發送測試通知）：任務指派、
  老師審批結果會自動推到頻道
- **iCal 日曆訂閱**（管理頁複製連結）：隊員在手機／電腦日曆 App「訂閱日曆」
  貼上，例會、水測、任務截止自動同步，不用開網站

## 快速開始

```bash
npm install   # 第一次才需要
npm run dev   # 開發模式，開 http://localhost:3000
```

正式使用：

```bash
npm run build
npm start     # 開 http://localhost:3000
```

## 預設帳號

| 帳號 | 密碼 | 角色 |
|---|---|---|
| `leader` | `rov2026` | 隊長 |
| `teacher` | `rov2026` | 老師（與隊長同級最高權限） |
| `member` | `rov2026` | 隊員（示範） |

> ⚠️ 第一次登入後請立刻到「帳號」頁改密碼，並在「管理」頁替隊員開帳號、
> 把比賽日期改成實際日期。示範任務、零件、設備可以直接刪掉。

## 權限一覽

老師與隊長同級（皆為最高權限），差別只在定位：老師不例外地也可以免登入使用審批連結。

| 操作 | 隊長／老師 | 隊員 |
|---|---|---|
| 建立任務、改狀態、勾子任務、借用設備、寫日誌、申請零件 | ✅ | ✅ |
| 編輯任務內容 | 任何任務 | 自己負責或建立的 |
| **在系統內直接批准零件**、審批連結 | ✅ | ❌（僅連結可由老師按） |
| 刪除任務／活動／設備／比賽任務、零件採買進度、修改日曆、隊伍設定、成員管理 | ✅ | ❌ |

## 資料與備份（線上：Supabase）

- **所有資料都在 Supabase Postgres**（不會在任何 Vercel / 瀏覽器 / 原始碼裡）
- 備份方式（三選一）：
  1. **開始每日自動備份**：Supabase 控制台 → 專案 → Database → Backups（Free 方案啟用後為每日，需先在後台設定；建議每週手動確認一次）
  2. **手動備份**：控制台 Database → 下載備份（Download backup）
  3. **命令行進階**（可寫入排程）：`pg_dump "$DATABASE_URL" > backup_$(date +%F).sql`
- 恢復：控制台 Restore；或 `psql "$DATABASE_URL" < backup.sql`
- ⚠️ `data/rov.db` 只是遷移前 SQLite 的舊檔，**僅適用於完全離線的舊版（階段一）部署**，與線上無關
- 交接事項：Supabase 登入權限至少兩人知道（不要只有一個人記得）；若帳密遺失，帳號可能無法找回

## 平台限制與運維（重要，正式營運期間）

| 限制 | 影響與對策 |
|---|---|
| Vercel Hobby 函數超時 **10 秒**（未開 Fluid Compute） | 目前 CRUD 遠低於此；**未來加檔案上傳／圖片處理／批量匯出前，務必先壓測**，否則會被 504 殺掉 |
| Vercel Hobby Cron **每天最多 1 次** | 「截止日自動提醒」若要每小時級粒度，須升級 Pro 或改用外部免費 cron 服務打 webhook |
| Supabase Free 專案 **7 天無活動自動暫停**；暫停超過 90 天後 Restore 按鈕失效（需手動重建新專案、URL/Key 都會變） | 假期（暑假／CNY）前先建 **keep-alive**：Vercel Cron 每日打一次網站（`/api/ical?token=...` 也算活動）；交接文件第一行寫「網站打不開 → 先去 Supabase 控制台看是否 paused → 按 Restore」 |
| Cloudflare 目前 DNS only（灰雲，無 CDN／WAF） | Vercel 已自帶 TLS，風險低；若未來遭遇針對性濫用（如審批連結被重放），可改開橘雲代理並加規則 |

## 安全備忘（已實作並驗證）

- 登入限流：同帳號＋IP 5 次失敗鎖 15 分鐘（`login_attempts` 表）
- 首次登入／密碼被重設 → **強制先改密碼**才能使用（服務端攔截＋跳轉「帳號」頁）
- 改密碼後：其他所有 session 立即失效
- 審批連結：128-bit 隨機 token、72 小時過期、審核一次即失效（資料庫層標記）
- 審計日誌：關鍵操作（刪除、審批、改密、重設密碼、設定變更）寫入 `audit_log`，隊長／老師可在 `/api/admin/audit-log` 查看
- 任務樂觀鎖（`version`）：兩人同時編輯同一任務時，後寫者收到 409 提示重新整理
- 密碼雜湊：scrypt（Node 官方參數 N=16384, r=8, p=1）＋每位使用者獨立 16-byte salt
- 靜態檢查已通過：無 `dangerouslySetInnerHTML`（XSS 靠 React 默認轉義）、全部 SQL 參數化、Google Client Secret 與 Discord Webhook 不出現在前端 bundle／非幹部 API 回應


## 部署架構（目前線上：2026-09-07）

```
隊員/老師 ──> https://rov.sscrov.com（Cloudflare DNS 直連）
                  │
                  ▼
              Vercel（Next.js 無伺服器，Hobby 免費層）
                  │
                  ▼
   Supabase（PostgreSQL，新加坡 ap-southeast-1，Free 專案）
```

- 程式碼：`github.com/lyunnamed/rov-team-hub`（private）→ push 即自動部署
- 環境變數（Vercel Project Settings → Environment Variables）：`DATABASE_URL`
  用 Supabase 的 **Transaction pooler** 連線（`...pooler.supabase.com:6543`，
  必須 `prepare: false`，見 `src/lib/pg.ts`）
- 資料與備份：全部在 Supabase（Free 方案一週無活動會暫停，控制台按一下 Restore 即恢復）；
  `data/rov.db` 只是遷移前的舊檔，可刪
- 本機（Mac）已不再承載網站；`com.rov.next`／`com.rov.tunnel` 兩個 LaunchAgent 與
  Cloudflare Tunnel `rov-hub` 均已移除

### 首次架設步驟（供未來複製）

Supabase：建 Free 專案（新加坡）→ 用 `npm run migrate` 建表與搬資料
（本地需 `DATABASE_URL` 環境變數）。Vercel：GitHub 匯入 repo →
設定 `DATABASE_URL` → Deploy → 在 Cloudflare 新增 CNAME
`rov → <vercel-dns-xxx>.vercel-dns.com`（DNS only，不要開橘雲代理）。

### 階段一：只在學校／隊內使用（最簡單，建議先這樣）

1. 找一台可以 24 小時開著的電腦（舊筆電、社辦電腦、Raspberry Pi 都行）
2. 裝 [Node.js LTS](https://nodejs.org)（一直按下一步就好）
3. 把整個 `rov-team-hub` 資料夾複製過去，在資料夾開終端機執行：
   ```bash
   npm install
   npm run build
   npx pm2 start "npm start" --name rov-hub   # pm2 讓它掛在背景不會關
   ```
   （pm2 第一次用要先 `npm install -g pm2`）
4. 查這台電腦的內網 IP（macOS：系統設定→Wi-Fi→詳細資訊；Windows：`ipconfig`）
5. 隊友連 `http://<那台電腦的IP>:3000` 就能用了
- 注意：學校 Wi-Fi 有可能阻擋設備互連（AP 隔離），測一下隊友手機開不開得了；
  不行的話改用手機熱點或找資訊組開通

### 階段二：校外也能連（需要「隧道」工具，免動網路設定）

宿舍或家裡想連學校電腦，用 Cloudflare Tunnel（免費、不用申請公網 IP）：

```bash
brew install cloudflared          # 或從官網下載 Windows 版
cloudflared tunnel --url http://localhost:3000
```

會給你一個 `https://xxxx.trycloudflare.com` 網址，丟給隊友即可。
缺點：每次重開網址會換。要固定網址，需花約 US$10/年買網域
（Namecheap / Cloudflare Registrar）+ 設定 named tunnel（照 Cloudflare 官網教學點一點）。

ngrok 也是類似工具，免費版網址同樣會換，二選一即可。

### 階段三：正規部署（之後有需求再說）

租雲端主機（DigitalOcean / Hetzner / AWS Lightsail，每月約 US$4–6）+
綁網域 + HTTPS。程式完全不用改，只是換台永遠開機的機器跑同樣的指令。
**不建議 Vercel / Netlify**：這個專案用 SQLite 檔案資料庫，那類平台沒有
永久磁碟，要改成 Turso/Supabase 才行（未來想改再找我）。

### 上線檢查清單（長期營運版）

- [x] 預設密碼已改（系統已強制首次登入改密碼；管理員重設後同樣強制）
- [x] 每位隊員都用自己帳號（Google 登入自動開戶；或管理頁手動開戶）
- [x] Discord Webhook 設定並測試（管理頁 → 通知與整合）
- [x] iCal 訂閱連結發給隊員（可隨時在管理頁「重新產生」輪換）
- [ ] Supabase 帳號密碼至少兩人知道（交接）
- [ ] 設定 Supabase「Backups」；每月手動下載備份一次到雲端硬碟
- [ ] 建立 keep-alive：Vercel Cron 每日一次打健康檢查（如 `/api/ical?token=...`）

## 技術棧

Next.js 16（App Router）· React 19 · Tailwind CSS 4 · better-sqlite3 ·
原生 HTML5 拖曳 · cookie session（無外部依賴）

## API 接口文件（給未來 iPad / iPhone App）

所有功能都是 JSON REST API（`/api/...`），登入後憑 cookie session 呼叫
（iOS 的 URLSession / WKWebView 會自動帶 cookie），未來做原生 App 直接對接即可：

| 端點 | 方法 | 說明 |
|---|---|---|
| `/api/auth/login` `/logout` `/me` `/password` | POST/GET | 登入、登出、當前使用者、改密碼 |
| `/api/auth/google/start` `/auth/google/callback` `/google/status` | GET | Google 帳號登入（OAuth）+ 是否已設定 |
| `/api/tasks` `/api/tasks/[id]` `/api/tasks/[id]/items` `/api/items/[id]` | CRUD | 任務與子任務（可帶 `mission_id`、`cycle_id`） |
| `/api/events` `/api/events/[id]` | CRUD | 日曆活動 |
| `/api/cycles` `/api/cycles/[id]` | CRUD | 開發週期（`action: approve/reject/complete/resubmit`） |
| `/api/parts` `/api/parts/[id]` | CRUD | 零件採買 |
| `/api/approve/[token]` | GET/POST | 老師免登入審批 |
| `/api/equipment` `/api/equipment/[id]` | CRUD | 設備借用（`action: borrow/return/maintenance`） |
| `/api/missions` `/api/missions/[id]` | CRUD | 比賽任務對照 |
| `/api/divelogs` `/api/divelogs/[id]` | CRUD | 水測日誌 |
| `/api/members` `/api/settings` `/api/ical?token=` | GET | 成員、設定、日曆訂閱 |

### 登入方式

- **Google 帳號登入（主要）**：管理頁「Google 登入」區設定
  （Client ID／Secret／允許網域／幹部 email 清單，回呼網址複製到
  Google Cloud Console OAuth 設定）。只允許白名單網域（如 `stu.ssc.edu.hk`），
  首次登入自動開帳號（角色依 email 清單：leader／teacher／member）；
  Google 應用未驗證時會出現警告畫面，按「進階 → 繼續」即可
- **帳號密碼登入（後備）**：隊員由隊長開戶，密碼 scrypt 雜湊儲存

## 之後可以加的

1. 截止日自動提醒（需要排程器，例如 Vercel Cron 打 API）
2. 檔案附件上傳（接線圖、3D 列印檔）
3. 多隊／多屆資料切換
4. iOS / iPadOS 原生 App（直接吃上面的 API）

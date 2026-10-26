# ROV Team Hub

A mission-control web app for a school ROV team: development cycles, task
tracking, calendar, parts purchasing, equipment loans and dive logs.
Full-stack, single repo, no external services required to run locally.

The UI is bilingual (Traditional Chinese / English — switch with the
language button, top right). The wall display board at `/display` is
English-only.

## Features

| Page | What it does |
|---|---|
| Home | Competition countdown, active / overdue / due-this-week stats, my tasks, upcoming events |
| Calendar | Month view showing task deadlines and events (meetings / water tests / competitions); click a date for details; leaders can add events |
| Development Cycles | Members propose cycles (date range + collaborators) → leader approval → teacher approval → active; tasks can belong to cycles; staff see per-member cycle stats and completion |
| Parts Purchasing | Request → **teacher approval** → ordered → arrived, with estimated / actual spend stats |
| Equipment | Loan register (who took it, due back, overdue turns red), maintenance status |
| Dive Logs | What was tested, issues found, fixes applied, items to re-verify — one click to convert into a tracked task |
| Admin (leader) | Team name, competition date, member accounts / password resets, notifications, iCal subscription |
| Display board | Full-screen wall dashboard (`/display`) — dark HUD style, live clock, cycle progress, month calendar |

### Development cycle approval chain

```
Member proposal (name, date range, collaborators, goal)
  → [PENDING LEADER] → leader approves → [PENDING TEACHER] → teacher approves → [ACTIVE] → mark complete → [COMPLETED]
  → leader or teacher rejects → [REJECTED] → proposer can edit and resubmit
Leader's own proposal: skips the leader level, goes straight to the teacher
Teacher's own proposal: goes live immediately
Teachers can also directly approve anything pending leader approval (final say)
```

Tasks are created and ticked inside the cycle card; each cycle shows task
completion. Leaders and teachers see per-member participation stats at the
bottom of the cycles page.

### Claimable cycles

Leaders can post a cycle as **open for members to claim** (toggle in the
proposal form). Claimable cycles appear in a "Claimable cycles" section for
members, who can claim one with a single click — it then appears under their
name and the leader gets a push notification. Leaders can choose whether a
posted cycle counts toward their own cycle statistics.

### How teacher approval works (parts purchasing)

No teacher account needed. Once a part request is submitted, the leader clicks
**Copy teacher approval link** on the Parts page and sends it via LINE /
Messenger. The teacher opens the page, sees the request, and presses Approve
or Reject (with optional note) — the result is written back automatically.
Each request link carries a one-time random token that expires in 72 hours.
Staff can also approve directly inside the app.

### Notifications

- **Microsoft Teams dashboards** (Admin → paste webhook URLs): cycle approvals,
  parts requests, claims and member changes are pushed to Teams channels
- **Discord webhook** (optional, Admin): task assignments and teacher
  approval results pushed to a Discord channel
- **Push notifications**: cycles, approvals and claims send web push to
  team members' devices (works with the iPad app)
- **iCal calendar subscription** (Admin → copy link): members subscribe in
  their phone / desktop calendar app; meetings, water tests and task
  deadlines sync automatically — no need to open the site

## Display board account

A dedicated kiosk account for the wall display PC:

| Account | Password | Notes |
|---|---|---|
| `dashboard` | `123` | Logging in redirects straight to the dark English display board |

Change the password on the Account page if the PC is in a shared space.

## Quick start

```bash
npm install   # first time only
npm run dev   # dev mode, opens on http://localhost:3000
```

Production:

```bash
npm run build
npm start     # serves on http://localhost:3000
```

## Default accounts

| Account | Password | Role |
|---|---|---|
| `leader` | `rov2026` | Leader |
| `teacher` | `rov2026` | Teacher (same top-level permissions as leader) |
| `member` | `rov2026` | Member (demo) |
| `dashboard` | `123` | Wall display — login redirects to the board |

> ⚠️ Change these passwords immediately after first login (Accounts page),
> create real member accounts in Admin, and set the real competition date.
> The demo tasks, parts and equipment can be deleted.

## Permissions

Teachers and leaders share the same top-level permissions; the difference is
positioning only. Teachers can always use the no-login approval links too.

| Action | Leader / Teacher | Member |
|---|---|---|
| Create tasks, update status, tick subtasks, borrow equipment, write dive logs, request parts | ✅ | ✅ |
| Edit task content | Any task | Own assigned / created |
| **Approve parts in-app**, approval links | ✅ | ❌ (link may be pressed by teacher only) |
| Delete tasks / events / equipment, parts progress, edit calendar, team settings, member management | ✅ | ❌ |

## Data & backup (live: Supabase)

- **All data lives in Supabase Postgres** (not on Vercel, not in the browser,
  not in the repo)
- Backup options (any of):
  1. **Daily automatic backups**: Supabase console → Project → Database →
     Backups (daily once enabled; verify weekly)
  2. **Manual**: console → Database → Download backup
  3. **CLI**: `pg_dump "$DATABASE_URL" > backup_$(date +%F).sql`
- Restore: console Restore; or `psql "$DATABASE_URL" < backup.sql`
- ⚠️ Supabase Free projects **pause after 7 days of inactivity**; after 90
  days paused the Restore button stops working. Before long holidays set up a
  keep-alive ping (any Vercel Cron hitting the site counts as activity)
- Handover: at least two people should hold the Supabase credentials

## Platform limits & ops (production)

| Limit | Impact & mitigation |
|---|---|
| Vercel Hobby function timeout **10s** | Current CRUD is far below this; **load-test before adding file uploads / image processing / bulk exports** or requests will be killed at 504 |
| Vercel Hobby cron **1 run per day** | Hourly-granularity deadline reminders need Pro or an external cron hitting a webhook |
| Supabase Free **pauses after 7 days idle**; past 90 days paused, Restore stops working | Before holidays create a keep-alive (daily Vercel Cron hitting `/api/ical?token=...`); first line of handover doc: "site down → check Supabase console for paused → Restore" |
| Cloudflare currently DNS only (grey cloud, no CDN/WAF) | Vercel already provides TLS; if the approval links are ever abused, switch on the orange cloud proxy with rules |

## Security notes (implemented & verified)

- Login rate limiting: 5 failed attempts per account+IP locks 15 minutes
  (`login_attempts` table)
- First login / password reset → **forced password change** before use
  (server-side intercept + redirect to the Account page)
- Changing a password invalidates all other sessions immediately
- Approval links: 128-bit random token, 72-hour expiry, single-use
  (flagged at the database level)
- Audit log: critical operations (deletes, approvals, password changes,
  resets, settings changes) written to `audit_log`, viewable by leader /
  teacher at `/api/admin/audit-log`
- Optimistic locking on tasks (`version`): concurrent editors get a 409 and
  are asked to refresh
- Password hashing: scrypt (Node defaults N=16384, r=8, p=1) + per-user
  16-byte salt
- Static checks passed: no `dangerouslySetInnerHTML` (XSS escaped by React),
  all SQL parameterised, Google Client Secret and webhook URLs never appear
  in the client bundle or non-staff API responses

## Deployment architecture (current live: 2026-09-07)

```
Members / teachers ──> https://rov.sscrov.com (Cloudflare DNS, direct)
                  │
                  ▼
              Vercel (Next.js serverless, Hobby free tier)
                  │
                  ▼
   Supabase (PostgreSQL, Singapore ap-southeast-1, Free plan)
```

- Code: `github.com/lyunnamed/rov-team-hub` (private) → push auto-deploys
- Environment variable (Vercel Project Settings → Environment Variables):
  `DATABASE_URL` using Supabase's **Transaction pooler**
  (`...pooler.supabase.com:6543`, requires `prepare: false`, see
  `src/lib/pg.ts`)
- Data & backup: everything in Supabase (Free plan pauses after a week of
  inactivity — Restore in the console brings it back); `data/rov.db` is a
  pre-migration leftover and can be deleted
- The Mac no longer hosts the site; the `com.rov.next` / `com.rov.tunnel`
  LaunchAgents and the Cloudflare Tunnel `rov-hub` have been removed

### Fresh setup steps (for future reference)

Supabase: create a Free project (Singapore) → `npm run migrate` to create
tables and move data (needs `DATABASE_URL` locally). Vercel: import the repo
from GitHub → set `DATABASE_URL` → Deploy → add a Cloudflare CNAME
`rov → <vercel-dns-xxx>.vercel-dns.com` (DNS only, no orange-cloud proxy).

### Phase 1: school / team-only (simplest, do this first)

1. Find a computer that can stay on 24/7 (old laptop, club room PC,
   Raspberry Pi)
2. Install [Node.js LTS](https://nodejs.org)
3. Copy the whole `rov-team-hub` folder over, open a terminal in it and run:
   ```bash
   npm install
   npm run build
   npx pm2 start "npm start" --name rov-hub   # pm2 keeps it in the background
   ```
   (pm2 needs `npm install -g pm2` first)
4. Find the machine's LAN IP (macOS: System Settings → Wi-Fi → Details;
   Windows: `ipconfig`)
5. Teammates open `http://<that-ip>:3000`
- Note: school Wi-Fi may block device-to-device traffic (AP isolation) — test
  with a teammate's phone; if blocked use a phone hotspot or ask IT

### Phase 2: access from outside school (tunnel tool)

To reach the school PC from home, use Cloudflare Tunnel (free, no public IP
needed):

```bash
brew install cloudflared          # or the Windows build from the site
cloudflared tunnel --url http://localhost:3000
```

You get a `https://xxxx.trycloudflare.com` URL to share. Downside: the URL
changes on every restart. For a fixed URL you need a domain (~US$10/year) +
a named tunnel.

### Phase 3: proper hosting (when needed)

Rent a cloud VM (DigitalOcean / Hetzner / AWS Lightsail, ~US$4–6/month) +
domain + HTTPS. The code needs no changes — it is the same commands on a
machine that is always on.

### Production checklist (long-running)

- [x] Default passwords changed (system forces a change on first login;
      admin resets force it too)
- [x] Every member on their own account (Google login auto-provisions; or
      created manually in Admin)
- [x] Microsoft Teams dashboards configured and tested (Admin → Notifications)
- [x] iCal subscription link sent to members (rotate anytime via Admin →
      "Regenerate")
- [x] Display board account (`dashboard`) for the wall PC
- [ ] Supabase credentials known by at least two people (handover)
- [ ] Supabase "Backups" enabled; download a backup to cloud storage monthly
- [ ] Keep-alive: daily Vercel Cron hitting a health endpoint
      (e.g. `/api/ical?token=...`)

## Tech stack

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 ·
Supabase Postgres (postgres.js) · Web Push ·
cookie session (no external auth dependency) · Vercel

## API reference (for a future native app)

Everything is a JSON REST API (`/api/...`) called with the cookie session
(iOS URLSession / WKWebView attach cookies automatically):

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/auth/login` `/logout` `/me` `/password` | POST/GET | Login, logout, current user, change password |
| `/api/auth/google/start` `/auth/google/callback` `/google/status` | GET | Google (OAuth) sign-in + configured flag |
| `/api/tasks` `/api/tasks/[id]` `/api/tasks/[id]/items` `/api/items/[id]` | CRUD | Tasks and subtasks (optional `mission_id`, `cycle_id`) |
| `/api/events` `/api/events/[id]` | CRUD | Calendar events |
| `/api/cycles` `/api/cycles/[id]` | CRUD | Development cycles (`action: approve/reject/complete/resubmit/claim`) |
| `/api/parts` `/api/parts/[id]` | CRUD | Parts purchasing |
| `/api/approve/[token]` | GET/POST | Teacher no-login approval |
| `/api/equipment` `/api/equipment/[id]` | CRUD | Equipment loans (`action: borrow/return/maintenance`) |
| `/api/divelogs` `/api/divelogs/[id]` | CRUD | Dive logs |
| `/api/members` `/api/settings` `/api/ical?token=` `/api/display?token=` | GET | Members, settings, calendar feed, display board data |
| `/api/push/...` | — | Web push subscriptions |

### Sign-in methods

- **Google account (primary)**: configured in Admin → "Google login"
  (Client ID / Secret / allowed domains / staff email list; copy the callback
  URL into Google Cloud Console OAuth settings). Only whitelisted domains
  (e.g. `stu.ssc.edu.hk`) can sign in; accounts are auto-provisioned on
  first login with the role derived from the email list. The unverified-app
  warning screen: Advanced → Continue.
- **Username + password (fallback)**: accounts created by the leader,
  scrypt-hashed passwords

## iPad / wall display app

`ios/` contains a SwiftUI + WKWebView shell that loads the site full-screen
(landscape-locked, pull-to-refresh, persistent login) plus TestFlight
instructions — see `ios/README.md`.

## Ideas for later

1. Automatic deadline reminders (needs a scheduler, e.g. Vercel Cron hitting
   an API)
2. File attachments (wiring diagrams, 3D print files)
3. Multi-team / multi-season data switch
4. Native iOS / iPadOS app (consuming the API above)

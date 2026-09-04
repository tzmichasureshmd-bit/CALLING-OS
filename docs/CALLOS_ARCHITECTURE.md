# CALLOS — Architecture & Repository Audit

_Last updated: Phase 1 audit. This document describes the system as it exists **today** and the target production architecture. No application behavior was changed to produce this audit._

---

## 1. What CALLOS is

CALLOS is a **sales call monitoring & intelligence platform** for telecalling teams (Real Estate, EdTech, B2B, MSME). Two client apps share one backend:

- **Employee Android app** (`mobile/`) — installed on each salesperson's phone. Collects the phone's call log (and, where permitted, recordings) and syncs to the server.
- **Company web dashboard** (`web/`) — managers/admins monitor all employees' calls, analytics, leads, opportunities, follow-ups, reports, billing.

Target production data flow:

```
Employee Android phone
   → call happens → Android call log
   → local storage / sync queue (offline-safe)
   → CALLOS FastAPI  → PostgreSQL
        → AI / transcription (async worker)
   → CALLOS web dashboard → manager / admin
```

---

## 2. Repository layout (current)

```
CALL OSS/
├── web/                 React 19 + Vite 6 + Tailwind 4 dashboard  [BUILT, mock data]
│   ├── index.html
│   ├── vite.config.js   (@vitejs/plugin-react + @tailwindcss/vite)
│   ├── package.json
│   └── src/
│       ├── main.jsx     (BrowserRouter + ThemeProvider)
│       ├── App.jsx      (routes + layout shell)
│       ├── index.css    (theme CSS variables, light/dark)
│       ├── context/ThemeContext.jsx
│       ├── data/mockData.js
│       ├── components/  (ui.jsx, Sidebar.jsx, Topbar.jsx)
│       └── pages/       (10 pages)
├── mobile/              React Native + Expo SDK 52 + expo-router 4  [BUILT, mock data]
│   ├── app.json         (Android permissions declared)
│   ├── app/             (_layout, (tabs)/*, onboarding)
│   └── src/             (theme.js, mockData.js, components.jsx)
├── backend/             [NOT STARTED — planned FastAPI + PostgreSQL]
├── docs/                (this audit set)
└── README.md
```

---

## 3. Web dashboard — current architecture

- **Routing:** `react-router-dom` v7, `BrowserRouter`. Routes defined in `App.jsx`. Layout = persistent `Sidebar` + `Topbar` + `<Routes>`.
- **Theme:** `ThemeContext` toggles `data-theme` on `<html>`; all colors are CSS variables in `index.css` (`--bg`, `--bg-card`, `--text-primary`, `--text-muted`, `--text-dim`, `--border`, `--accent`, plus semantic success/danger/warning/info). Persisted to `localStorage`. Light + dark both implemented.
- **Styling:** inline styles + CSS variables (per project convention), Tailwind 4 available via `@tailwindcss/vite`.
- **Charts:** Recharts (line, stacked bar, donut, area).
- **Icons/animation:** lucide-react, framer-motion.
- **Data:** everything reads from `src/data/mockData.js`. No network calls yet. `axios` is installed but unused so far.

### Pages (all built, mock-driven)
| Route | Page | Status |
|---|---|---|
| `/` | Dashboard (KPIs, opportunities, pipeline, top salesperson, leaderboard, 3 charts) | UI complete, mock |
| `/manage/employees` | Employees table + onboarding stepper | UI complete, mock |
| `/manage/excluded` | Excluded phone numbers | UI complete, mock |
| `/call-logs` | Call logs table + filters | UI complete, mock |
| `/transcribe` | Recorded-call transcript list | UI complete, mock (no real AI) |
| `/opportunities-closed` | Won/Lost | UI complete, mock |
| `/reports` | Charts + team summary | UI complete, mock |
| `/subscription` | Plan + billing | UI complete, mock |
| `/invoices` | Invoice history | UI complete, mock |
| `/settings` | Org / appearance / profile / security | UI complete, mock |

---

## 4. Mobile app — current architecture

- **Framework:** Expo SDK 52, `expo-router` 4 (file-based routing).
- **Structure:** `app/_layout.jsx` (Stack) → `app/(tabs)/_layout.jsx` (bottom tabs) → 4 tab screens; `app/onboarding.jsx` (modal stack).
- **Tabs:** Dashboard, Logs, Analytics, Settings — matching the real CALLOS app screenshots.
- **Onboarding:** Permissions → Sign Up → SIM Selection → SIM Verification → Dashboard (currently a visual stepper on mock data).
- **Theme/data:** `src/theme.js` (light tokens), `src/mockData.js`, `src/components.jsx` (AppHeader, SetupBanner, RangePills, MetricCard).
- **Android config:** `app.json` declares `READ_CALL_LOG`, `READ_PHONE_STATE`, `READ_CONTACTS`, `READ_EXTERNAL_STORAGE`, package `com.tzmicha.callos`, `newArchEnabled: true`.

---

## 5. Existing vs Mock vs Missing

### Existing (real, working)
- Web UI: all 10 pages, routing, light/dark theme, charts, responsive layout, build passes.
- Mobile UI: 4 tabs + onboarding screens, bottom nav, theme.
- Data model shape (in mock) already mirrors the planned backend entities.

### Mock (looks real, not wired)
- All numbers/tables/charts on both apps come from static mock files.
- Company connect code `TZM-2026-5823` is mock data (correctly NOT hardcoded in business logic).
- Transcribe / AI insights are placeholders (no model calls).
- Recording "Play" buttons reference `recording_url` strings, no real files.
- Mobile onboarding shows success without checking real permissions.

### Missing (not started)
- Backend (FastAPI), database (PostgreSQL), migrations.
- Authentication, RBAC, multi-tenant isolation.
- Real Android call-log reading + SIM detection + background sync + offline queue.
- Recording storage, transcription workers, AI.
- Reports export, real billing/invoicing, audit logs, notifications backend.
- Tests, CI, Docker, deployment.

---

## 6. Technical risks

- **Android call-log + recording access** is the highest-risk area (OEM differences, Play policy, background limits). Cannot be faked; needs a development build + native modules. See `CALLOS_ANDROID_PLAN.md`.
- **Multi-tenant isolation** must be enforced server-side on every query. Getting this wrong leaks data across companies.
- **Recording privacy** — sensitive data; requires private storage + signed URLs + consent. See `CALLOS_SECURITY_PLAN.md`.
- **Chunk size** — web bundle is ~860 kB (one chunk). Mitigated by route-level code splitting (planned in Phase where web is polished).

---

## 7. Recommended implementation order (user-approved)

1. **Web** — finish/polish, add reusable state components, centralize API client (env-based), keep UI.
2. **Mobile** — finish/verify screens (done), permission UX honesty.
3. **Connect** — shared data contract; web + mobile ready to call the same API shapes.
4. **Backend** — FastAPI + PostgreSQL, auth, multi-tenant, calls/sync, analytics.
5. Leads/follow-ups/opportunities → recordings/transcription/AI → reports/billing/audit → security/perf/deploy.

This matches the master prompt's phases while following the user's "web → mobile → connect → backend" sequencing.

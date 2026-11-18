# CALLOS — Sales Call Monitoring Platform

# CallNexa

CallNexa is a sales call monitoring and management platform with a web dashboard, mobile employee app, and FastAPI/PostgreSQL backend.

**Current web handoff document:** [`docs/CALLNEXA_WEB_APPLICATION_MAIN.md`](docs/CALLNEXA_WEB_APPLICATION_MAIN.md)

- **`web/`** — Company, Employee, and Super Admin web application.
- **`mobile/`** — Employee Android application for call-log and recording sync. Mobile work is outside the current web phase.
- **`backend/`** — FastAPI API, PostgreSQL data model, authentication, CRM workflows, analytics, subscriptions, and billing foundation.

The web application uses real authentication and backend APIs. Payment checkout is intentionally deferred; plan selection currently opens the CallNexa sales contact flow.

---

## How the system fits together

```
  EMPLOYEE PHONES (mobile APK)          COMPANY / MANAGER (web dashboard)
        |  reads call log,                    |  views all employees' calls,
        |  recordings, SIM                    |  analytics, opportunities
        v                                     v
  ------------------------  BACKEND API  ------------------------
     employees · call_logs · recordings · leads · opportunities
```

Company connect code used across both apps: **`TZM-2026-5823`** (Tzmicha IT Solutions).

---

## Web dashboard (`web/`)

React 19 · Vite 6 · Tailwind CSS 4 · Recharts · lucide-react · framer-motion · axios · react-router-dom.
Full light/dark theme via CSS variables (`--bg-card`, `--text-primary`, `--border`, `--text-muted`, `--text-dim`, `--accent`). Theme toggle (sun/moon) in the top bar.

### Run

```bash
cd web
npm install       # already installed
npm run dev       # http://localhost:5173
npm run build     # production build -> web/dist
```

### Pages

| Route | Page |
|---|---|
| `/` | Call Analytics Dashboard (KPIs, Top Opportunities, Pipeline, Top Salesperson, Team Leaderboard, Call Performance charts) |
| `/manage/employees` | Manage Employees + Mobile Onboarding guide |
| `/manage/excluded` | Excluded Phone Numbers |
| `/call-logs` | Call Logs (all employees, color-coded call types, recordings) |
| `/transcribe` | AI Transcribe of recorded calls |
| `/opportunities-closed` | Won / Lost deals |
| `/reports` | Charts + team summary |
| `/subscription` | Plan & billing |
| `/invoices` | Invoice history |
| `/settings` | Org, appearance (theme), profile, security |

---

## Mobile app (`mobile/`)

React Native · Expo (expo-router) · @expo/vector-icons. Matches the real CALLOS employee app.

### Run (development)

```bash
cd mobile
npm install
npx expo start        # scan QR with Expo Go, or press "a" for Android emulator
```

### Screens

- **Dashboard tab** — Total / Connected / Incoming / Outgoing / Missed / Rejected cards, range pills (Today / Yesterday / Last Week / Last 30)
- **Logs tab** — searchable call list with call/SMS/WhatsApp/copy/play actions + dial pad FAB
- **Analytics tab** — Top Caller, Longest Call, Average Duration, Daily Avg Calls
- **Settings tab** — profile, company code, SIM configuration, call recordings, send logs
- **Onboarding** (`/onboarding`) — Permissions → Sign Up → SIM Selection → SIM Verification → Dashboard

### Build an installable APK

The real feature (reading the phone call log + recordings) needs native Android permissions, already declared in `app.json`:
`READ_CALL_LOG`, `READ_PHONE_STATE`, `READ_CONTACTS`, `READ_EXTERNAL_STORAGE`.

Build with EAS:

```bash
npm install -g eas-cli
cd mobile
eas build -p android --profile preview   # produces a downloadable .apk
```

> Reading the actual device call log is the next implementation phase (native module / `expo-call-log`-style integration). The current build ships the full UI on mock data.

---

## Roadmap

1. ✅ Web dashboard UI (mock data)
2. ✅ Mobile app UI (mock data)
3. ⬜ Backend (FastAPI + PostgreSQL): `GET /calls`, `GET /agents`, `GET /leads`, `POST /sync`
4. ⬜ Mobile: read real call log + upload recordings
5. ⬜ Auth (company code + employee accounts), live sync
6. ⬜ AI transcript / transcribe
```

# CallingOS — Complete Project Documentation

> Sales Call Monitoring Platform for organizations.  
> Managers monitor employee calls via web dashboard. Employees sync calls via mobile app.

---

## Table of Contents

1. [What This System Does](#1-what-this-system-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Tech Stack](#4-tech-stack)
5. [How Everything Connects](#5-how-everything-connects)
6. [Backend API](#6-backend-api)
7. [Web Dashboard](#7-web-dashboard)
8. [Mobile App](#8-mobile-app)
9. [Database](#9-database)
10. [Authentication Flow](#10-authentication-flow)
11. [Call Sync Flow](#11-call-sync-flow)
12. [VPS Deployment](#12-vps-deployment)
13. [DNS Setup](#13-dns-setup)
14. [Environment Variables](#14-environment-variables)
15. [Local Development](#15-local-development)
16. [Common Issues & Fixes](#16-common-issues--fixes)

---

## 1. What This System Does

```
ORGANIZATION MANAGER                    EMPLOYEE (Field Sales)
      │                                        │
      │  Creates org on web dashboard          │  Installs mobile APK
      │  Gets company code e.g. TZM-2026-5823  │  Enters company code to join
      │  Sees all employees' calls             │  App reads call log from phone
      │  Analytics, leaderboard, reports       │  Syncs calls to backend
      └──────────────── BACKEND API ───────────┘
```

- Manager registers on web → gets a unique **company code**
- Employee installs mobile app → enters company code → joins the org
- Mobile app reads phone call logs → syncs to backend every session
- Manager sees all calls, analytics, recordings on web dashboard in real time

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        VPS (Hostinger)                       │
│                                                             │
│  ┌─────────┐    ┌──────────────────┐   ┌────────────────┐  │
│  │ Traefik │───▶│ callingos-backend│   │ callingos-web  │  │
│  │ (proxy) │    │ FastAPI :8000    │   │ React + Nginx  │  │
│  │ SSL/TLS │───▶│                  │   │ :80            │  │
│  └─────────┘    └────────┬─────────┘   └────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │ PostgreSQL  │
                    │  (cloud DB) │
                    └─────────────┘

Domains:
  callingos.tzmicha.com       → backend API
  app.callingos.tzmicha.com   → web dashboard

Mobile App:
  Expo (React Native) → hits https://callingos.tzmicha.com/api/v1
```

---

## 3. Project Structure

```
CALL OSS/
├── backend/                    ← FastAPI backend
│   ├── app/
│   │   ├── auth/               ← JWT, password hashing, dependencies
│   │   ├── models/             ← SQLAlchemy DB models
│   │   ├── routers/            ← API route handlers
│   │   ├── schemas/            ← Pydantic request/response schemas
│   │   ├── config.py           ← Settings from .env
│   │   ├── database.py         ← DB engine + session
│   │   ├── main.py             ← FastAPI app entry point
│   │   └── seed.py             ← Demo data seeder
│   ├── Dockerfile              ← Docker build for backend
│   ├── docker-compose.yml      ← Deploy backend + web together
│   ├── requirements.txt        ← Python dependencies
│   ├── .env                    ← Local dev environment variables
│   └── .env.production         ← Production environment variables
│
├── web/                        ← React web dashboard (manager)
│   ├── src/
│   │   ├── api/                ← Axios client + resource wrappers
│   │   ├── components/         ← Sidebar, Topbar, UI components
│   │   ├── context/            ← AuthContext, ThemeContext, ToastContext
│   │   ├── pages/              ← All dashboard pages
│   │   └── App.jsx             ← Routes + layout
│   ├── Dockerfile              ← Docker build for web (nginx)
│   ├── nginx.conf              ← Nginx config for SPA routing
│   ├── .env                    ← Local dev env
│   └── .env.production         ← Production env (points to live API)
│
├── mobile/                     ← React Native mobile app (employee)
│   ├── app/
│   │   ├── (tabs)/             ← Dashboard, Logs, Insights, Settings tabs
│   │   ├── _layout.jsx         ← Root layout + AuthGate
│   │   ├── login.jsx           ← Login + Register screen
│   │   └── onboarding.jsx      ← 5-step onboarding flow
│   ├── src/
│   │   ├── api.js              ← All API calls + BASE_URL
│   │   ├── AuthContext.jsx     ← Auth state + device registration
│   │   ├── theme.js            ← Dark/light theme
│   │   ├── components.jsx      ← Shared UI components
│   │   └── mockData.js         ← Fallback mock data
│   └── app.json                ← Expo config + Android permissions
│
└── docs/                       ← All documentation
    ├── DEPLOYMENT.md           ← This file
    ├── CALLOS_API_PLAN.md
    ├── CALLOS_ARCHITECTURE.md
    └── CALLOS_DATABASE_PLAN.md
```

---

## 4. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Backend | FastAPI (Python) | Fast, async, auto docs at /docs |
| Database | PostgreSQL via Supabase | Managed cloud DB, no maintenance |
| ORM | SQLAlchemy 2.0 | Industry standard Python ORM |
| Auth | JWT (python-jose) + bcrypt | Stateless, secure |
| Web Frontend | React 19 + Vite + Tailwind 4 | Fast build, modern UI |
| Mobile | React Native + Expo | Cross-platform, easy build |
| Reverse Proxy | Traefik | Auto SSL, Docker-native routing |
| Containerization | Docker + Docker Compose | Same pattern as all other apps on VPS |
| Firebase | Firebase Admin | Google login + OTP login |

---

## 5. How Everything Connects

### Manager Flow
```
1. Manager opens app.callingos.tzmicha.com
2. Registers → POST /api/v1/auth/register
   → Creates Organization + User + Employee in DB
   → Gets company code e.g. TZM-2026-5823
3. Shares company code with employees
4. Sees dashboard → GET /api/v1/analytics/dashboard
5. Sees call logs → GET /api/v1/calls
```

### Employee Flow
```
1. Employee installs APK on Android phone
2. Opens app → Register screen
3. Enters name, email, password, company code
4. POST /api/v1/auth/register/employee
   → Validates company code → finds org
   → Creates User + Employee in that org
   → Returns JWT token
5. App registers device → POST /api/v1/devices/register
6. Employee makes calls on phone
7. App reads call log → POST /api/v1/calls/sync
8. Manager sees calls on dashboard instantly
```

---

## 6. Backend API

**Base URL (production):** `https://callingos.tzmicha.com/api/v1`  
**Swagger docs:** `https://callingos.tzmicha.com/docs`  
**Health check:** `https://callingos.tzmicha.com/health`

### Auth Endpoints

| Method | Endpoint | Who uses it | What it does |
|---|---|---|---|
| POST | `/auth/register` | Web (manager) | Create org + admin account |
| POST | `/auth/register/employee` | Mobile | Join org via company code |
| POST | `/auth/login` | Web + Mobile | Login, get JWT token |
| GET | `/auth/me` | Web + Mobile | Get current user info |
| POST | `/auth/refresh` | Web + Mobile | Refresh access token |
| POST | `/auth/google` | Web | Google OAuth login |
| POST | `/auth/otp` | Web | Phone OTP login |

### Key Endpoints

| Method | Endpoint | What it does |
|---|---|---|
| POST | `/devices/register` | Register employee's phone |
| POST | `/calls/sync` | Upload call logs from mobile |
| GET | `/calls` | List all calls (manager) |
| GET | `/analytics/dashboard` | KPIs + charts data |
| GET | `/employees` | List all employees |
| GET | `/superadmin/organizations` | All orgs (super admin only) |

### Employee Register Request (Mobile)
```json
POST /api/v1/auth/register/employee
{
  "name": "Rahul Sharma",
  "email": "rahul@company.com",
  "password": "Test@1234",
  "company_code": "TZM-2026-5823"
}
```

### Call Sync Request (Mobile)
```json
POST /api/v1/calls/sync
{
  "device_id": "tzm_dev_xxx",
  "calls": [
    {
      "client_event_id": "unique-id-from-device",
      "phone_number": "+919876543210",
      "contact_name": "John Smith",
      "call_type": "outgoing",
      "start_time": "2026-01-01T09:00:00Z",
      "end_time": "2026-01-01T09:05:00Z",
      "duration_seconds": 300,
      "sim_slot": 1,
      "source": "SIM 1",
      "recording_available": false
    }
  ]
}
```

---

## 7. Web Dashboard

**URL:** `https://app.callingos.tzmicha.com`

### Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | KPIs, charts, leaderboard |
| `/call-logs` | Call Logs | All employees' calls |
| `/analytics` | Analytics | Charts + trends |
| `/manage/employees` | Employees | Add/manage team |
| `/leads` | Leads | Lead tracking |
| `/opportunities` | Opportunities | Pipeline |
| `/device-health` | Device Health | Employee phones status |
| `/reports` | Reports | Exportable reports |
| `/settings` | Settings | Org settings, theme |
| `/superadmin` | Super Admin | All orgs (admin only) |

### Key Files
- `src/api/client.js` — Axios instance with JWT interceptor
- `src/api/resources.js` — All API call wrappers
- `src/context/AuthContext.jsx` — Login, register, logout, org switcher
- `src/components/Topbar.jsx` — Org switcher (switch between multiple orgs)

---

## 8. Mobile App

### Screens
- **Login** — Sign In / Register with company code
- **Onboarding** — 5 steps: Permissions → Sign Up → SIM → Verify → Done
- **Dashboard tab** — Call KPIs, charts, momentum
- **Logs tab** — Searchable call list with filters
- **Insights tab** — Analytics charts
- **Settings tab** — Profile, sync button, theme toggle, sign out

### Key Files
- `src/api.js` — All API calls, BASE_URL, 10s timeout
- `src/AuthContext.jsx` — Auth state, device registration, syncCalls
- `app/login.jsx` — Login + Register screen
- `app/onboarding.jsx` — 5-step onboarding with real register form

### Android Permissions (app.json)
```
READ_CALL_LOG       — Read phone call history
READ_PHONE_STATE    — Detect active calls
READ_CONTACTS       — Match contact names to numbers
READ_EXTERNAL_STORAGE — Access call recordings
```

### Build APK
```bash
cd mobile
npm install -g eas-cli
eas build -p android --profile preview
```

---

## 9. Database

**Provider:** Supabase (PostgreSQL)  
**Connection:** Already configured in `.env`

### Tables

| Table | Description |
|---|---|
| `organizations` | Each company using CallingOS |
| `users` | Login accounts (managers + employees) |
| `employees` | Employee profiles linked to users |
| `devices` | Employee phones registered |
| `calls` | All call records synced from mobile |
| `leads` | Sales leads |
| `opportunities` | Sales pipeline |
| `excluded_numbers` | Numbers to ignore in analytics |
| `invoices` | Billing records |

### Key Relationships
```
Organization
  └── Users (ADMIN, EMPLOYEE roles)
  └── Employees (profile with name, phone, code)
       └── Devices (registered phones)
            └── Calls (synced call logs)
  └── Leads
  └── Opportunities
```

---

## 10. Authentication Flow

### Manager (Web)
```
Register → POST /auth/register
  → Creates: Organization + User(ADMIN) + Employee
  → Returns: JWT access_token + refresh_token
  → Stores in: localStorage (callos_token, callos_user)
```

### Employee (Mobile)
```
Register → POST /auth/register/employee
  → Validates company_code → finds Organization
  → Creates: User(EMPLOYEE) + Employee
  → Returns: JWT access_token
  → Stores in: AsyncStorage (callos_token, callos_user)
  → Then: POST /devices/register → stores device_id
```

### JWT Token Structure
```json
{
  "sub": "user_id",
  "org": "organization_id",
  "role": "ADMIN | EMPLOYEE",
  "type": "access",
  "exp": 1234567890
}
```

---

## 11. Call Sync Flow

```
1. Employee makes phone calls during the day
2. Opens CallingOS mobile app
3. App reads Android call log (READ_CALL_LOG permission)
4. Taps "Sync Calls Now" in Settings tab
   OR auto-syncs on app open (future)
5. POST /api/v1/calls/sync with device_id + calls array
6. Backend checks client_event_id for duplicates (idempotent)
7. Saves new calls to DB linked to employee + organization
8. Manager refreshes web dashboard → sees new calls instantly
```

### Idempotency
Each call has a `client_event_id` generated on the device.
If the same call is synced twice, the backend ignores the duplicate.
Safe to sync multiple times.

---

## 12. VPS Deployment

**VPS:** Hostinger Ubuntu 24.04  
**Reverse Proxy:** Traefik (already running, handles all apps)  
**Pattern:** Same Docker + Traefik labels as all other apps

### First Time Deploy

```bash
# 1. SSH into VPS
ssh root@YOUR_VPS_IP

# 2. Clone repo
cd /opt
git clone https://github.com/tzmichasureshmd-bit/CALLING-OS.git callingos
cd callingos/backend

# 3. Set up environment
cp .env.production .env
# Edit .env if needed:
nano .env

# 4. Make sure traefik-net exists
docker network create traefik-net 2>/dev/null || true

# 5. Build and start
docker compose up -d --build

# 6. Check it's running
docker ps | grep callingos
docker logs callingos-backend --tail 50
```

### Update / Redeploy

```bash
cd /opt/callingos
git pull
docker compose up -d --build
```

### Check Logs

```bash
# Backend logs
docker logs callingos-backend --tail 100 -f

# Web logs
docker logs callingos-web --tail 50
```

### Stop / Restart

```bash
docker compose down        # stop
docker compose up -d       # start (no rebuild)
docker compose restart     # restart
```

---

## 13. DNS Setup

Go to **Hostinger DNS Manager** for `tzmicha.com` and add:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | callingos | YOUR_VPS_IP | 300 |
| A | app.callingos | YOUR_VPS_IP | 300 |

After adding DNS records, Traefik automatically:
- Routes `callingos.tzmicha.com` → backend container port 8000
- Routes `app.callingos.tzmicha.com` → web container port 80
- Gets SSL certificate from Let's Encrypt automatically
- Redirects HTTP → HTTPS automatically

DNS propagation takes 2-10 minutes.

---

## 14. Environment Variables

### Backend `.env`

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection | `postgresql+psycopg://...` |
| `JWT_SECRET_KEY` | Secret for signing JWT tokens | Long random string |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime | `60` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime | `30` |
| `APP_ENV` | Environment | `production` |
| `APP_DEBUG` | Debug logging | `false` |
| `CORS_ORIGINS` | Allowed frontend origins | `https://app.callingos.tzmicha.com` |
| `SEED_DEMO_DATA` | Auto-seed demo data on startup | `false` |
| `GOOGLE_CLIENT_ID` | Firebase Google OAuth | From Firebase console |

### Web `.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL |
| `VITE_FIREBASE_*` | Firebase config for Google/OTP login |

### Mobile `src/api.js`

```js
export const BASE_URL = "https://callingos.tzmicha.com/api/v1";
```
Change this if the domain changes.

---

## 15. Local Development

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Swagger UI: http://localhost:8000/docs
```

### Web Dashboard
```bash
cd web
npm install
npm run dev
# Opens: http://localhost:5173
```

### Mobile (Expo Go)
```bash
cd mobile
npm install
npx expo start --clear
# Scan QR with Expo Go app
```

### Mobile on Real Device
Update `mobile/src/api.js`:
```js
export const BASE_URL = "http://YOUR_PC_IP:8000/api/v1";
```
Make sure phone and PC are on same WiFi.
Run backend with `--host 0.0.0.0`.

---

## 16. Common Issues & Fixes

### Mobile — "Network Request Failed"
- Android blocks plain HTTP by default
- Fix: Use HTTPS (production URL) or same WiFi with correct PC IP
- Make sure backend runs with `--host 0.0.0.0` not `127.0.0.1`

### Mobile — Infinite Loading on Register
- No timeout on fetch → hangs for 2-3 mins
- Fixed: 10s AbortController timeout in `src/api.js`
- Check `BASE_URL` is correct in `src/api.js`

### Web — Org Switcher Not Working
- `organization_id` must come from `/auth/me` response not login response
- Fixed in `Topbar.jsx` `handleAdd` function

### Backend — 404 on `/auth/register/employee`
- Old backend version running
- Fix: Restart uvicorn after code changes

### Docker — Container Won't Start
```bash
docker logs callingos-backend --tail 50
```
Usually a missing env variable or DB connection issue.

### Traefik — SSL Certificate Not Issued
- DNS must propagate first (wait 5-10 mins after adding A record)
- Check Traefik logs: `docker logs traefik-traefik-1 --tail 50`

### Database — Table Does Not Exist
- Tables are auto-created on startup via `Base.metadata.create_all()`
- If missing, restart the backend container

---

## Roles

| Role | Access |
|---|---|
| `SUPER_ADMIN` | All organizations, platform stats |
| `ADMIN` | Own organization, all employees |
| `MANAGER` | Own organization, assigned employees |
| `EMPLOYEE` | Own calls only |

---

## Company Code Format

```
TZM - 2026 - 5823
 │     │      │
 │     │      └── 4 random digits
 │     └── Current year
 └── First 3 letters of company name
```

Generated automatically when manager registers.
Shared with employees to join the organization.

---

*Last updated: 2026 — CallingOS by Tzmicha IT Solutions*

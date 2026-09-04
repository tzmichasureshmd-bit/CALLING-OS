# CALLOS — Production Roadmap

Sequencing follows the user's order: **Web → Mobile → Connect → Backend → the rest.** Each phase ends with: run, test, build, verify existing pages still work, document.

---

## Phase 1 — Audit & Foundations (current)
- [x] Repository audit (`docs/`)
- [x] Architecture, API, DB, Android, Security plans
- [ ] Web: reusable state components (Loading/Error/Empty/Toast), route code-splitting
- [ ] Web: centralized API client (`src/api/`) + `VITE_API_URL` env, no silent mock fallback
- [ ] Mobile: verify Expo bundle; permission-status screen honesty

Exit: web build passes, mobile bundles, docs committed.

## Phase 2 — Auth, Org, Employees, Devices, SIM (backend begins)
- FastAPI skeleton, PostgreSQL, SQLAlchemy, Alembic, Pydantic, JWT, password hashing, `.env`.
- Models: organizations, users, employees, roles, devices, device_sessions, sims.
- Endpoints: `/auth/*`, `/organizations`, `/employees`, `/devices/*`, `/sims`.
- Multi-tenant scoping + RBAC enforced server-side.

## Phase 3 — Calls API + Analytics
- Models: calls, call_sync_events, excluded_phone_numbers.
- `POST /calls/sync` (idempotent), `GET /calls` (pagination/filter/sort/date-range).
- `GET /analytics/dashboard|employees|team|calls` (centralized analytics engine).

## Phase 4 — Mobile call collection
- Local DB (SQLite), sync queue, offline mode, retry/backoff, duplicate prevention.
- Android call-log read, SIM detection, background/foreground service, device heartbeat.
- Development build (not Expo Go) — see Android plan.

## Phase 5 — Connect web to real API
- Swap web data source from mock → API per page.
- Remove production dependency on mock data (env-gated).

## Phase 6 — Leads / Follow-ups / Opportunities
- Models + endpoints + pipeline; weighted pipeline value; overdue follow-ups.

## Phase 7 — Recordings / Transcription / AI
- Private object storage, signed URLs, retention, access logs.
- Transcription worker (background job), transcript states.
- AI insights + manager summary, clearly labeled as AI (not fact).

## Phase 8 — Reports / Subscription / Invoices / Audit / Notifications
- CSV/Excel/PDF export; plans as data; invoice generation; audit log; notifications backend.

## Phase 9 — Hardening
- Security audit, performance audit, tests, Docker, deployment, backups, monitoring, health endpoints.

---

## Future (documented, NOT to build yet)
AI Call Coach, advanced sentiment, lead/agent prediction, CRM/WhatsApp/email integrations, click-to-call, power dialer, targets, commissions, forecasting, white-label, multi-language AI.

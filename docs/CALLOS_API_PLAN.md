# CALLOS — API Plan

Versioned under `/api/v1`. FastAPI + Pydantic schemas + JWT. All list endpoints: pagination, filtering, sorting, date-range. All org-owned data scoped to the caller's organization. RBAC enforced server-side.

---

## Conventions
- **Pagination:** `?page=1&page_size=50` → `{ items, page, page_size, total, total_pages }`.
- **Filtering:** entity-specific query params (e.g. calls: `employee_id`, `call_type`, `call_status`, `from`, `to`, `q`).
- **Auth:** `Authorization: Bearer <access_token>`. Refresh via `/auth/refresh`.
- **Errors:** structured `{ error_code, message, details? }`; codes: `AUTH_ERROR`, `PERMISSION_ERROR`, `VALIDATION_ERROR`, `NOT_FOUND`, `SYNC_ERROR`, `SERVER_ERROR`.
- **Idempotency:** `POST /calls/sync` uses a deterministic `client_event_id` per call to prevent duplicates.

---

## Auth
```
POST /api/v1/auth/login          { email, password } | { company_code, employee_code, password }
POST /api/v1/auth/refresh        { refresh_token }
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

## Organizations
```
GET   /api/v1/organizations/current
PATCH /api/v1/organizations/current        (ADMIN+)
```

## Employees
```
GET    /api/v1/employees        ?page&page_size&q&status
POST   /api/v1/employees
GET    /api/v1/employees/{id}
PATCH  /api/v1/employees/{id}
DELETE /api/v1/employees/{id}   (soft delete)
```

## Devices & SIMs
```
POST /api/v1/devices/register            { device_identifier, manufacturer, model, android_version, app_version }
GET  /api/v1/devices                     ?employee_id&is_online
GET  /api/v1/devices/{id}
POST /api/v1/devices/{id}/heartbeat      { battery_level, permissions_status, is_online }
GET  /api/v1/sims                        ?device_id
```

## Calls
```
POST /api/v1/calls/sync         { device_id, calls: [ { client_event_id, phone_number, contact_name,
                                   call_type, call_status, start_time, end_time, duration_seconds,
                                   sim_slot, recording_available } ] }
                                 → { accepted, duplicates, failed }
GET  /api/v1/calls              ?page&page_size&employee_id&device_id&call_type&call_status&from&to&q
GET  /api/v1/calls/{id}
```

## Analytics (centralized engine, consistent everywhere)
```
GET /api/v1/analytics/dashboard   ?range=today|yesterday|7d|30d|custom&from&to
GET /api/v1/analytics/employees   ?range
GET /api/v1/analytics/team        ?range
GET /api/v1/analytics/calls       ?range
```
Returns metrics: total, connected, missed, rejected, incoming, outgoing, avg_duration, talk_time, connection_rate, follow_up_rate, lead_conversion, opportunity_conversion, duration_distribution, daily_series.

## Leads / Follow-ups / Opportunities
```
GET/POST/PATCH /api/v1/leads            status: new|contacted|interested|follow_up|hot|qualified|converted|lost
GET/POST/PATCH /api/v1/follow-ups       status: pending|completed|overdue|cancelled
GET/POST/PATCH /api/v1/opportunities    stage: new|qualified|proposal|negotiation|won|lost
```

## Recordings / Transcripts
```
GET /api/v1/call-recordings/{id}/url     → short-lived signed URL (access-logged)
GET /api/v1/transcripts                  ?status
GET /api/v1/transcripts/{id}
```

## Reports / Subscription / Invoices / Audit / Notifications / Health
```
GET  /api/v1/reports/{type}              ?format=json|csv|xlsx|pdf
GET  /api/v1/subscriptions/current
GET  /api/v1/invoices                    ?page&page_size
GET  /api/v1/audit-logs                  ?page&page_size (ADMIN+)
GET  /api/v1/notifications
GET  /health        → { status }
GET  /health/db     → { status, database }
```

---

## Frontend API client (web)
```
web/src/api/
  client.js        axios instance (baseURL = import.meta.env.VITE_API_URL, interceptors: auth, refresh, errors)
  auth.js  employees.js  devices.js  calls.js  leads.js
  opportunities.js  followups.js  analytics.js  reports.js
```
No raw axios in components. A `dataSource` layer returns mock in dev when `VITE_USE_MOCK=true`, never silently in production.

# CALLOS — Database Plan (PostgreSQL)

Multi-tenant. Every org-owned table carries `organization_id` and is indexed on it. Timestamps stored in **UTC**; converted to org/user timezone (default `Asia/Kolkata`) in the UI. SQLAlchemy models + Alembic migrations.

---

## Entity hierarchy
```
organizations
  ├── users ── roles
  ├── employees ── devices ── sims
  ├── calls ── call_recordings ── transcripts ── ai_call_insights
  │        └── call_sync_events
  ├── leads ── follow_ups
  ├── opportunities
  ├── excluded_phone_numbers
  ├── subscriptions ── subscription_usage ── invoices
  ├── notifications
  └── audit_logs
```

---

## Core tables (key columns)

### organizations
`id, name, code (unique), email, phone, address, timezone (default 'Asia/Kolkata'), status, created_at, updated_at`

### users
`id, organization_id, email (unique per org), password_hash, role_id, status, last_login_at, created_at, updated_at`

### roles
`id, name (SUPER_ADMIN|ADMIN|MANAGER|TEAM_LEAD|EMPLOYEE), permissions (jsonb)`

### employees
`id, organization_id, user_id, name, email, phone, employee_code (unique per org), status, joining_date, last_active_at, created_at, updated_at`

### devices
`id, organization_id, employee_id, device_identifier (unique per org), manufacturer, model, android_version, app_version, last_seen_at, battery_level, is_online, permissions_status (jsonb), created_at, updated_at`

### device_sessions
`id, device_id, token_id, created_at, expires_at, revoked_at`

### sims
`id, device_id, slot, carrier, phone_number, status`

### calls
`id, organization_id, employee_id, device_id, sim_id, client_event_id, phone_number, phone_number_normalized, contact_name, call_type (incoming|outgoing|missed|blocked|rejected), call_status (connected|missed|...), start_time, end_time, duration_seconds, recording_available, sync_status (pending|synced|failed), created_at`
Unique: `(organization_id, client_event_id)` → idempotent sync.

### call_recordings
`id, organization_id, call_id, storage_key (private), size_bytes, format, duration_seconds, status, created_at`

### call_sync_events
`id, organization_id, device_id, batch_id, received_count, accepted_count, duplicate_count, failed_count, created_at`

### leads
`id, organization_id, employee_id, name, phone, phone_normalized, source, status, priority, notes, last_contact_at, next_follow_up_at, expected_value, created_at, updated_at`

### follow_ups
`id, organization_id, lead_id, employee_id, due_at, priority, status, notes, completed_at, created_at`

### opportunities
`id, organization_id, lead_id, employee_id, customer, expected_value, probability, stage, expected_close_date, last_contact_at, next_action, created_at, updated_at`
Weighted value = `expected_value * probability`.

### transcripts
`id, organization_id, call_id, status (pending|processing|completed|failed), language, text, created_at, completed_at`

### ai_call_insights
`id, organization_id, call_id, transcript_id, call_score, interest_pct, sentiment, objections (jsonb), buying_signals (jsonb), next_best_action, summary, model, created_at`
(AI output — labeled non-authoritative in UI.)

### excluded_phone_numbers
`id, organization_id, phone_number, phone_normalized, reason, created_by, status, created_at`

### subscriptions / subscription_usage / invoices
`subscriptions: id, organization_id, plan_id, price, user_limit, billing_cycle, status, start_date, renewal_date`
`invoices: id, organization_id, invoice_number, period, users, subtotal, tax, total, status, due_date, paid_at`
Plans stored as data/config — never hardcode ₹99.

### notifications
`id, organization_id, user_id, type, payload (jsonb), read_at, created_at`

### audit_logs
`id, organization_id, user_id, action, entity, entity_id, ip, device, result, created_at` (append-only; not user-editable)

---

## Indexes (minimum)
- `calls`: `organization_id`, `employee_id`, `device_id`, `phone_number_normalized`, `start_time`, `call_status`, `call_type`, unique `(organization_id, client_event_id)`.
- `leads`: `organization_id`, `phone_normalized`, `status`, `next_follow_up_at`.
- `follow_ups`: `organization_id`, `due_at`, `status`.
- All org-owned tables: `organization_id`.

## Rules
- Avoid N+1 (eager-load/join where needed). Connection pooling. Server-side pagination for large call tables.
- Phone normalization before matching (`+91XXXXXXXXXX` canonical) so representations don't create duplicate leads.

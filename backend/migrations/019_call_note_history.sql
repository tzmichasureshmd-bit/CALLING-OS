-- Migration: call note history log
CREATE TABLE IF NOT EXISTS call_note_history (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL,
    employee_id     TEXT,
    call_id         TEXT,
    phone_number    TEXT NOT NULL,
    status          TEXT,
    notes           TEXT,
    changed_by_id   TEXT,
    changed_by_name TEXT,
    changed_by_role TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_note_history_org_phone
    ON call_note_history (organization_id, phone_number);

CREATE INDEX IF NOT EXISTS idx_call_note_history_call_id
    ON call_note_history (call_id);

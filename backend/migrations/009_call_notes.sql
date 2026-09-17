-- Migration 009: Call progress notes (salesperson entries from mobile)
-- Stores status + notes per phone number per employee, synced from mobile app.

CREATE TABLE IF NOT EXISTS call_notes (
    id              VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id     VARCHAR(50)  REFERENCES employees(id) ON DELETE SET NULL,
    call_id         VARCHAR(50)  REFERENCES calls(id) ON DELETE SET NULL,
    phone_number    VARCHAR(30)  NOT NULL,
    status          VARCHAR(50),   -- interested | asked_details | follow_up | callback | proposal_sent | converted | not_interested
    notes           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_call_notes_org        ON call_notes (organization_id);
CREATE INDEX IF NOT EXISTS ix_call_notes_employee   ON call_notes (employee_id);
CREATE INDEX IF NOT EXISTS ix_call_notes_phone      ON call_notes (organization_id, phone_number);
CREATE INDEX IF NOT EXISTS ix_call_notes_call       ON call_notes (call_id);

-- Upsert function: one note per employee per phone number
CREATE UNIQUE INDEX IF NOT EXISTS ix_call_notes_emp_phone
    ON call_notes (organization_id, employee_id, phone_number);

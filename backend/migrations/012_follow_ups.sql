CREATE TABLE IF NOT EXISTS follow_ups (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_prefixed_id('tzm','fup'),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
    call_id VARCHAR(50) REFERENCES calls(id) ON DELETE SET NULL,
    lead_id VARCHAR(36) REFERENCES leads(id) ON DELETE SET NULL,
    opportunity_id VARCHAR(36) REFERENCES opportunities(id) ON DELETE SET NULL,
    created_by VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    follow_up_type VARCHAR(40) NOT NULL DEFAULT 'call',
    due_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    idempotency_key VARCHAR(160) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_followups_org_due ON follow_ups (organization_id, due_at);
CREATE INDEX IF NOT EXISTS ix_followups_employee_status ON follow_ups (employee_id, status);

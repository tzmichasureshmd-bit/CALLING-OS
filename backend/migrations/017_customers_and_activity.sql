-- Migration 017: tenant-scoped customers, append-only activity, and FollowUp linkage.

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_prefixed_id('tzm','cus'),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    phone_normalized VARCHAR(30) NOT NULL,
    email VARCHAR(200),
    company VARCHAR(200),
    status VARCHAR(30) NOT NULL DEFAULT 'new',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_contact_at TIMESTAMPTZ,
    next_follow_up TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customers_org_phone_normalized UNIQUE (organization_id, phone_normalized)
);

CREATE INDEX IF NOT EXISTS ix_customers_org_status ON customers (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_customers_org_employee ON customers (organization_id, employee_id);
CREATE INDEX IF NOT EXISTS ix_customers_org_last_contact ON customers (organization_id, last_contact_at);

ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50) REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ix_followups_customer ON follow_ups (customer_id);

CREATE TABLE IF NOT EXISTS customer_activities (
    id VARCHAR(50) PRIMARY KEY DEFAULT generate_prefixed_id('tzm','act'),
    organization_id VARCHAR(50) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id VARCHAR(50) NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    call_id VARCHAR(50) REFERENCES calls(id) ON DELETE SET NULL,
    lead_id VARCHAR(36) REFERENCES leads(id) ON DELETE SET NULL,
    opportunity_id VARCHAR(36) REFERENCES opportunities(id) ON DELETE SET NULL,
    follow_up_id VARCHAR(50) REFERENCES follow_ups(id) ON DELETE SET NULL,
    actor_id VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
    employee_id VARCHAR(50) REFERENCES employees(id) ON DELETE SET NULL,
    event_type VARCHAR(60) NOT NULL,
    description TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    idempotency_key VARCHAR(160),
    CONSTRAINT uq_customer_activities_org_idempotency UNIQUE (organization_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_customer_activities_org_customer_event
    ON customer_activities (organization_id, customer_id, event_at DESC);
CREATE INDEX IF NOT EXISTS ix_customer_activities_org_employee
    ON customer_activities (organization_id, employee_id, event_at DESC);

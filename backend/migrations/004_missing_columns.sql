-- Migration 004: Add all missing columns and tables
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS checks)

-- devices: location + network health columns
ALTER TABLE devices ADD COLUMN IF NOT EXISTS permissions_status      JSONB DEFAULT '{}';
ALTER TABLE devices ADD COLUMN IF NOT EXISTS latitude                DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS longitude               DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS location_accuracy       DOUBLE PRECISION;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS wifi_ssid               VARCHAR(100);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS network_type            VARCHAR(20);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS background_sync_status  VARCHAR(50);

-- calls: transcript columns
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_status  VARCHAR(20);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_text    TEXT;

-- calls: recording_size_bytes
ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_size_bytes BIGINT;

-- audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id              VARCHAR(50)  PRIMARY KEY,
    organization_id VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id        VARCHAR(50),
    actor_email     VARCHAR(200),
    actor_role      VARCHAR(30),
    action          VARCHAR(100) NOT NULL,
    resource        VARCHAR(100),
    resource_id     VARCHAR(100),
    ip_address      VARCHAR(50),
    user_agent      VARCHAR(500),
    extra_data      JSONB        DEFAULT '{}',
    created_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_audit_logs_organization_id ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action          ON audit_logs (action);
CREATE INDEX IF NOT EXISTS ix_audit_org_action           ON audit_logs (organization_id, action);
CREATE INDEX IF NOT EXISTS ix_audit_org_created          ON audit_logs (organization_id, created_at);

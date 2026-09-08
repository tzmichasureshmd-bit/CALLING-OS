-- Migration 005: SuperAdmin feature tables
-- sim_change_history, platform_alerts
-- Safe to run multiple times (IF NOT EXISTS)

-- ── SIM change history ────────────────────────────────────────────────────────
-- Persists every SIM INSERTED / REMOVED / REPLACED / CARRIER_CHANGED event
-- so SuperAdmin can audit SIM swaps across all orgs.
CREATE TABLE IF NOT EXISTS sim_change_history (
    id                       VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id          VARCHAR(50)  NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    device_id                VARCHAR(50)  REFERENCES devices(id) ON DELETE SET NULL,
    employee_id              VARCHAR(50)  REFERENCES employees(id) ON DELETE SET NULL,
    sim_id                   VARCHAR(50)  REFERENCES sims(id) ON DELETE SET NULL,
    slot                     SMALLINT     NOT NULL,
    change_type              VARCHAR(30)  NOT NULL,   -- INSERTED | REMOVED | REPLACED | CARRIER_CHANGED
    previous_carrier         VARCHAR(100),
    new_carrier              VARCHAR(100),
    previous_subscription_id VARCHAR(50),
    new_subscription_id      VARCHAR(50),
    previous_phone_number    VARCHAR(30),
    new_phone_number         VARCHAR(30),
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_sim_change_org        ON sim_change_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_sim_change_device     ON sim_change_history (device_id);
CREATE INDEX IF NOT EXISTS ix_sim_change_created    ON sim_change_history (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_sim_change_type       ON sim_change_history (change_type);

-- ── Platform alerts ───────────────────────────────────────────────────────────
-- SuperAdmin-level alerts: sync failures, offline devices, storage issues, etc.
CREATE TABLE IF NOT EXISTS platform_alerts (
    id              VARCHAR(50)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id VARCHAR(50)  REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type      VARCHAR(50)  NOT NULL,   -- sync_failure | device_offline | recording_failure | storage_issue | auth_failure
    severity        VARCHAR(20)  NOT NULL DEFAULT 'medium',  -- low | medium | high | critical
    title           VARCHAR(200) NOT NULL,
    detail          TEXT,
    resource_type   VARCHAR(50),             -- device | call | employee | organization
    resource_id     VARCHAR(50),
    resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_platform_alerts_org      ON platform_alerts (organization_id);
CREATE INDEX IF NOT EXISTS ix_platform_alerts_type     ON platform_alerts (alert_type);
CREATE INDEX IF NOT EXISTS ix_platform_alerts_resolved ON platform_alerts (resolved);
CREATE INDEX IF NOT EXISTS ix_platform_alerts_created  ON platform_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_platform_alerts_severity ON platform_alerts (severity);

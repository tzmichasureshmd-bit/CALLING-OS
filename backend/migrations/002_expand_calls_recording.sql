-- Migration 002: Expand calls table with recording status fields and SIM reference
-- Safe: all new columns are nullable, no existing data is modified.

ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS recording_status           VARCHAR(30) DEFAULT 'not_available',
    ADD COLUMN IF NOT EXISTS recording_mime_type        VARCHAR(100),
    ADD COLUMN IF NOT EXISTS recording_duration_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS recording_uploaded_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS recording_error            TEXT,
    ADD COLUMN IF NOT EXISTS subscription_id            VARCHAR(50),
    ADD COLUMN IF NOT EXISTS sim_id                     VARCHAR(50) REFERENCES sims(id) ON DELETE SET NULL;

UPDATE calls
SET recording_status = CASE
    WHEN recording_available = TRUE THEN 'uploaded'
    ELSE 'not_available'
END
WHERE recording_status = 'not_available' OR recording_status IS NULL;

CREATE INDEX IF NOT EXISTS ix_calls_recording_status
    ON calls (organization_id, recording_status)
    WHERE recording_status != 'not_available';

CREATE INDEX IF NOT EXISTS ix_calls_subscription_id
    ON calls (subscription_id)
    WHERE subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_calls_sim_id
    ON calls (sim_id)
    WHERE sim_id IS NOT NULL;

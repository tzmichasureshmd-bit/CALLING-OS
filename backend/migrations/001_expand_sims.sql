-- Migration 001: Expand sims table
-- Each ADD COLUMN is a separate statement to avoid statement timeout.

ALTER TABLE sims ADD COLUMN IF NOT EXISTS mcc               VARCHAR(10);
ALTER TABLE sims ADD COLUMN IF NOT EXISTS mnc               VARCHAR(10);
ALTER TABLE sims ADD COLUMN IF NOT EXISTS country_iso       VARCHAR(5);
ALTER TABLE sims ADD COLUMN IF NOT EXISTS subscription_id   VARCHAR(50);
ALTER TABLE sims ADD COLUMN IF NOT EXISTS network_type      VARCHAR(20);
ALTER TABLE sims ADD COLUMN IF NOT EXISTS first_detected_at TIMESTAMPTZ;
ALTER TABLE sims ADD COLUMN IF NOT EXISTS last_detected_at  TIMESTAMPTZ;
ALTER TABLE sims ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ DEFAULT NOW();

UPDATE sims SET first_detected_at = created_at WHERE first_detected_at IS NULL;
UPDATE sims SET last_detected_at  = created_at WHERE last_detected_at  IS NULL;

ALTER TABLE sims DROP CONSTRAINT IF EXISTS uq_sims_device_slot;
ALTER TABLE sims ADD CONSTRAINT uq_sims_device_slot UNIQUE (device_id, slot);

CREATE INDEX IF NOT EXISTS ix_sims_subscription_id ON sims (subscription_id);
CREATE INDEX IF NOT EXISTS ix_sims_last_detected    ON sims (device_id, last_detected_at);

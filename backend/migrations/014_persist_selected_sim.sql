-- Migration 014: Persist the employee-selected SIM sent by mobile clients.

ALTER TABLE sims
    ADD COLUMN IF NOT EXISTS is_selected BOOLEAN NOT NULL DEFAULT FALSE;

-- At most one SIM per device can be selected.
CREATE UNIQUE INDEX IF NOT EXISTS ix_sims_one_selected_per_device
    ON sims (device_id)
    WHERE is_selected = TRUE;

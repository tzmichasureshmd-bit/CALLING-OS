-- Migration 010: Add notes, updated_at, sync_confirmed_at to calls table
-- Safe: all ADD COLUMN IF NOT EXISTS — no existing data is modified.

ALTER TABLE calls ADD COLUMN IF NOT EXISTS notes               TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS updated_at          TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE calls ADD COLUMN IF NOT EXISTS sync_confirmed_at   TIMESTAMPTZ;

-- Back-fill updated_at for existing rows
UPDATE calls SET updated_at = created_at WHERE updated_at IS NULL;

-- Index for dashboard queries sorted by updated_at
CREATE INDEX IF NOT EXISTS ix_calls_org_updated ON calls (organization_id, updated_at DESC);

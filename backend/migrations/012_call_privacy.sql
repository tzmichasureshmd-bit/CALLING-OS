-- Migration 012: Add call_privacy column for business/personal/unclassified classification.
-- Safe: ADD COLUMN IF NOT EXISTS — no existing data is modified.
-- Default is 'unclassified' so all existing calls remain unclassified until the user acts.

ALTER TABLE calls ADD COLUMN IF NOT EXISTS call_privacy VARCHAR(20) DEFAULT 'unclassified';

-- Index for fast privacy-filtered queries (e.g. exclude personal calls from analytics)
CREATE INDEX IF NOT EXISTS ix_calls_privacy ON calls (organization_id, call_privacy);

COMMENT ON COLUMN calls.call_privacy IS
  'User-assigned privacy classification: unclassified | business | personal. '
  'Personal calls are excluded from recording, upload, transcription, and AI analysis. '
  'Unclassified calls are not automatically recorded or uploaded.';

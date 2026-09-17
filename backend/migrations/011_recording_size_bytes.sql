-- Migration 011: Ensure recording_size_bytes column exists
-- Safe: ADD COLUMN IF NOT EXISTS — no existing data modified.

ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_size_bytes BIGINT;

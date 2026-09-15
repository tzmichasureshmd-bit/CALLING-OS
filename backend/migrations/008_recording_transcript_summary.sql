-- Migration 008: Add missing recording, transcript, and summary columns
-- Safe: all ADD COLUMN IF NOT EXISTS — no existing data is modified.

-- Transcript detail columns
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript_error           TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription_started_at   TIMESTAMPTZ;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcription_completed_at TIMESTAMPTZ;

-- AI Summary columns
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_status  VARCHAR(20);
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_text    TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_error   TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS summary_data    JSONB;

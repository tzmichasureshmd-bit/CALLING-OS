-- Migration 006: Device reconnect command column
ALTER TABLE devices ADD COLUMN IF NOT EXISTS reconnect_requested_at TIMESTAMPTZ;

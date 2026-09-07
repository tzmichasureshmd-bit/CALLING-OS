-- Migration 003: Add network_type and background_sync_status to devices
-- Run each statement individually in Supabase SQL Editor

ALTER TABLE devices ADD COLUMN IF NOT EXISTS network_type VARCHAR(20);

ALTER TABLE devices ADD COLUMN IF NOT EXISTS background_sync_status VARCHAR(50);

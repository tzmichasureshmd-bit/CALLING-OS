-- Migration 007: add display_name to sims table
ALTER TABLE sims ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);

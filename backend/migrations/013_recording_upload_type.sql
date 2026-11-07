-- Add recording_upload_type column to track if recording was uploaded automatically or manually
-- Migration 013: Recording Upload Type

-- Add column to calls table
ALTER TABLE calls 
ADD COLUMN IF NOT EXISTS recording_upload_type VARCHAR(10) DEFAULT 'auto' CHECK (recording_upload_type IN ('auto', 'manual'));

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_calls_recording_upload_type ON calls(recording_upload_type);

-- Update existing calls with recordings to 'auto' (backward compatibility)
UPDATE calls SET recording_upload_type = 'auto' WHERE recording_available = true AND recording_upload_type IS NULL;

-- Add comment
COMMENT ON COLUMN calls.recording_upload_type IS 'Type of recording upload: auto (automatic via app) or manual (user uploaded)';

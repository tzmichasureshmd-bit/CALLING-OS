-- Add FCM token column for push notifications
ALTER TABLE devices ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS fcm_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_devices_fcm_token ON devices(fcm_token) WHERE fcm_token IS NOT NULL;

COMMENT ON COLUMN devices.fcm_token IS 'Firebase Cloud Messaging token for push notifications';
COMMENT ON COLUMN devices.fcm_updated_at IS 'Last time FCM token was updated';

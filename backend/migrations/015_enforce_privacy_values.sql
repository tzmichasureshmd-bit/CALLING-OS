-- Migration 015: Fail closed for call privacy at the database boundary.

UPDATE calls
SET call_privacy = 'unclassified'
WHERE call_privacy IS NULL
   OR call_privacy NOT IN ('unclassified', 'business', 'personal');

ALTER TABLE calls
    ALTER COLUMN call_privacy SET DEFAULT 'unclassified',
    ALTER COLUMN call_privacy SET NOT NULL;

ALTER TABLE calls
    DROP CONSTRAINT IF EXISTS ck_calls_privacy;

ALTER TABLE calls
    ADD CONSTRAINT ck_calls_privacy
    CHECK (call_privacy IN ('unclassified', 'business', 'personal'));

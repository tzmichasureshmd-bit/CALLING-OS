-- Migration 013: Scope Android client event IDs to the source device.
-- Android CallLog row IDs are local to a device, so organization-wide uniqueness
-- can incorrectly collapse calls from two phones that both report "android-1".
-- Existing organization-wide uniqueness guarantees this replacement index can be
-- created without first resolving duplicate rows.

ALTER TABLE calls
    DROP CONSTRAINT IF EXISTS calls_organization_id_client_event_id_key;

DROP INDEX IF EXISTS ix_calls_org_event_id;

CREATE UNIQUE INDEX IF NOT EXISTS ix_calls_org_device_event_id
    ON calls (organization_id, device_id, client_event_id);

/**
 * callStatusStore.js
 *
 * In-memory call status tracker — session lifetime only.
 * NO AsyncStorage, NO SQLite, NO local persistence of call records.
 *
 * Purpose: track in-flight sync/recording/transcript state within the
 * current app session so the UI can show progress. State is NOT persisted
 * across restarts — the backend is the single source of truth.
 *
 * State machine:
 *   DETECTED → SYNCING → SYNCED (backend confirmed inserted or duplicate)
 *   SYNCED → RECORDING_CHECK → RECORDING_UPLOADING → RECORDING_UPLOADED
 *   RECORDING_UPLOADED → TRANSCRIPTION_PENDING → TRANSCRIBING → TRANSCRIPTION_COMPLETED
 *   Failure states: SYNC_FAILED | RECORDING_FAILED | TRANSCRIPTION_FAILED
 */

// ── Status constants ──────────────────────────────────────────────────────────
export const STATUS = {
  DETECTED:                "DETECTED",
  SYNCING:                 "SYNCING",
  SYNCED:                  "SYNCED",
  SYNC_FAILED:             "SYNC_FAILED",
  SYNC_OFFLINE:            "SYNC_OFFLINE",
  RECORDING_CHECK:         "RECORDING_CHECK",
  RECORDING_QUEUED:        "RECORDING_QUEUED",
  RECORDING_UPLOADING:     "RECORDING_UPLOADING",
  RECORDING_UPLOADED:      "RECORDING_UPLOADED",
  RECORDING_NOT_AVAILABLE: "RECORDING_NOT_AVAILABLE",
  RECORDING_FAILED:        "RECORDING_FAILED",
  TRANSCRIPTION_PENDING:          "TRANSCRIPTION_PENDING",
  TRANSCRIBING:                   "TRANSCRIBING",
  TRANSCRIPTION_COMPLETED:        "TRANSCRIPTION_COMPLETED",
  TRANSCRIPTION_FAILED:           "TRANSCRIPTION_FAILED",
  TRANSCRIPTION_STILL_PROCESSING: "TRANSCRIPTION_STILL_PROCESSING",
};

export const STATUS_LABEL = {
  [STATUS.DETECTED]:                "Detected",
  [STATUS.SYNCING]:                 "Syncing…",
  [STATUS.SYNCED]:                  "Synced ✓",
  [STATUS.SYNC_FAILED]:             "Sync failed",
  [STATUS.SYNC_OFFLINE]:            "No internet — not synced",
  [STATUS.RECORDING_CHECK]:         "Checking recording…",
  [STATUS.RECORDING_QUEUED]:        "Recording queued",
  [STATUS.RECORDING_UPLOADING]:     "Uploading recording…",
  [STATUS.RECORDING_UPLOADED]:      "Recording uploaded ✓",
  [STATUS.RECORDING_NOT_AVAILABLE]: "Recording unavailable",
  [STATUS.RECORDING_FAILED]:        "Recording upload failed",
  [STATUS.TRANSCRIPTION_PENDING]:          "Transcription pending",
  [STATUS.TRANSCRIBING]:                   "Transcribing…",
  [STATUS.TRANSCRIPTION_COMPLETED]:        "Transcription complete ✓",
  [STATUS.TRANSCRIPTION_FAILED]:           "Transcription failed",
  [STATUS.TRANSCRIPTION_STILL_PROCESSING]: "Still processing…",
};

// ── In-memory store (session only) ───────────────────────────────────────────
// Map<client_event_id, entry>
const _store = new Map();
const MAX_ENTRIES = 500;

function _now() { return new Date().toISOString(); }

function _trim() {
  if (_store.size <= MAX_ENTRIES) return;
  // Remove oldest entries by updated_at
  const sorted = Array.from(_store.values())
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  const toRemove = sorted.slice(0, _store.size - MAX_ENTRIES);
  toRemove.forEach(e => _store.delete(e.client_event_id));
}

// ── Public API ────────────────────────────────────────────────────────────────

export function upsertCallStatus(clientEventId, fields) {
  const existing = _store.get(clientEventId) || {};
  const entry = {
    ...existing,
    ...fields,
    client_event_id: clientEventId,
    updated_at: _now(),
    created_at: existing.created_at || _now(),
  };
  _store.set(clientEventId, entry);
  _trim();
  return Promise.resolve(entry);
}

export function updateSyncStatus(clientEventId, syncStatus, extra = {}) {
  return upsertCallStatus(clientEventId, { sync_status: syncStatus, ...extra });
}

export function updateRecordingStatus(clientEventId, recordingStatus, extra = {}) {
  return upsertCallStatus(clientEventId, { recording_status: recordingStatus, ...extra });
}

export function updateTranscriptStatus(clientEventId, transcriptStatus) {
  return upsertCallStatus(clientEventId, { transcript_status: transcriptStatus });
}

export function getCallStatus(clientEventId) {
  return Promise.resolve(_store.get(clientEventId) || null);
}

export function getAllCallStatuses() {
  return Promise.resolve(
    Array.from(_store.values()).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
  );
}

export function getPendingCalls() {
  return Promise.resolve(
    Array.from(_store.values()).filter(
      c => c.sync_status === STATUS.SYNCING ||
           c.sync_status === STATUS.SYNC_FAILED
    )
  );
}

export function getPendingRecordings() {
  return Promise.resolve(
    Array.from(_store.values()).filter(
      c => c.recording_status === STATUS.RECORDING_CHECK ||
           c.recording_status === STATUS.RECORDING_UPLOADING ||
           c.recording_status === STATUS.RECORDING_FAILED
    )
  );
}

/**
 * Diagnostic summary — derived from in-memory session state only.
 * For accurate totals the web dashboard reads from the backend.
 */
export async function getSyncHealthSummary() {
  const entries  = Array.from(_store.values());
  const synced   = entries.filter(c => c.sync_status === STATUS.SYNCED).length;
  const failed   = entries.filter(c => c.sync_status === STATUS.SYNC_FAILED).length;
  const syncing  = entries.filter(c => c.sync_status === STATUS.SYNCING).length;
  const recUp    = entries.filter(c => c.recording_status === STATUS.RECORDING_UPLOADED).length;
  const recPend  = entries.filter(c => [STATUS.RECORDING_CHECK, STATUS.RECORDING_UPLOADING].includes(c.recording_status)).length;
  const recFail  = entries.filter(c => c.recording_status === STATUS.RECORDING_FAILED).length;
  const txDone   = entries.filter(c => c.transcript_status === STATUS.TRANSCRIPTION_COMPLETED).length;
  return {
    total:            entries.length,
    synced,
    syncing,
    failed,
    recordingUploaded: recUp,
    recordingPending:  recPend,
    recordingFailed:   recFail,
    transcribed:       txDone,
  };
}

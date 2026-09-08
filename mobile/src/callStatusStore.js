/**
 * callStatusStore.js
 *
 * Persistent local state machine for call synchronization status.
 * Survives app restart, crash, and network loss.
 *
 * State machine:
 *   DETECTED → LOCAL_SAVED → SYNC_QUEUED → SYNCING → SYNCED
 *   SYNCED → RECORDING_CHECK → RECORDING_QUEUED → RECORDING_UPLOADING → RECORDING_UPLOADED
 *   SYNCED/RECORDING_UPLOADED → TRANSCRIPTION_PENDING → TRANSCRIBING → TRANSCRIPTION_COMPLETED
 *
 * Failure states: SYNC_FAILED | RECORDING_FAILED | TRANSCRIPTION_FAILED
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORE_KEY    = "callos_call_status_store";
const MAX_ENTRIES  = 500; // keep last 500 calls to prevent unbounded growth

// ── Status constants (exported for use across the app) ────────────────────────
export const STATUS = {
  DETECTED:                "DETECTED",
  LOCAL_SAVED:             "LOCAL_SAVED",
  SYNC_QUEUED:             "SYNC_QUEUED",
  SYNCING:                 "SYNCING",
  SYNCED:                  "SYNCED",
  SYNC_FAILED:             "SYNC_FAILED",
  RECORDING_CHECK:         "RECORDING_CHECK",
  RECORDING_QUEUED:        "RECORDING_QUEUED",
  RECORDING_UPLOADING:     "RECORDING_UPLOADING",
  RECORDING_UPLOADED:      "RECORDING_UPLOADED",
  RECORDING_NOT_AVAILABLE: "RECORDING_NOT_AVAILABLE",
  RECORDING_FAILED:        "RECORDING_FAILED",
  TRANSCRIPTION_PENDING:   "TRANSCRIPTION_PENDING",
  TRANSCRIBING:            "TRANSCRIBING",
  TRANSCRIPTION_COMPLETED: "TRANSCRIPTION_COMPLETED",
  TRANSCRIPTION_FAILED:    "TRANSCRIPTION_FAILED",
};

// Human-readable labels for UI display
export const STATUS_LABEL = {
  [STATUS.DETECTED]:                "Detected",
  [STATUS.LOCAL_SAVED]:             "Saved locally",
  [STATUS.SYNC_QUEUED]:             "Queued",
  [STATUS.SYNCING]:                 "Syncing…",
  [STATUS.SYNCED]:                  "Synced ✓",
  [STATUS.SYNC_FAILED]:             "Sync failed",
  [STATUS.RECORDING_CHECK]:         "Checking recording…",
  [STATUS.RECORDING_QUEUED]:        "Recording queued",
  [STATUS.RECORDING_UPLOADING]:     "Uploading recording…",
  [STATUS.RECORDING_UPLOADED]:      "Recording uploaded ✓",
  [STATUS.RECORDING_NOT_AVAILABLE]: "Recording unavailable",
  [STATUS.RECORDING_FAILED]:        "Recording upload failed",
  [STATUS.TRANSCRIPTION_PENDING]:   "Transcription pending",
  [STATUS.TRANSCRIBING]:            "Transcribing…",
  [STATUS.TRANSCRIPTION_COMPLETED]: "Transcription complete ✓",
  [STATUS.TRANSCRIPTION_FAILED]:    "Transcription failed",
};

// ── Store shape ───────────────────────────────────────────────────────────────
// {
//   [client_event_id]: {
//     client_event_id,
//     call_id,           // server-assigned (null until synced)
//     sync_status,       // one of STATUS.*
//     recording_status,  // one of STATUS.RECORDING_*
//     transcript_status, // one of STATUS.TRANSCRIPTION_*
//     sync_attempts,
//     last_sync_attempt, // ISO string
//     last_error,
//     phone_number,
//     contact_name,
//     call_type,
//     duration_seconds,
//     start_time,
//     recording_path,    // local file path
//     created_at,
//     updated_at,
//   }
// }

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _load() {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function _save(store) {
  try {
    // Trim to MAX_ENTRIES — keep most recent by updated_at
    const entries = Object.values(store);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
      const trimmed = entries.slice(0, MAX_ENTRIES);
      const newStore = {};
      trimmed.forEach((e) => { newStore[e.client_event_id] = e; });
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(newStore));
    } else {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(store));
    }
  } catch { /* non-critical — in-memory state still valid */ }
}

function _now() {
  return new Date().toISOString();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create or update a call entry.
 * Call this as soon as a call is detected from the Android CallLog.
 */
export async function upsertCallStatus(clientEventId, fields) {
  const store = await _load();
  const existing = store[clientEventId] || {};
  store[clientEventId] = {
    ...existing,
    ...fields,
    client_event_id: clientEventId,
    updated_at: _now(),
    created_at: existing.created_at || _now(),
  };
  await _save(store);
  return store[clientEventId];
}

/**
 * Update only the sync_status of a call.
 */
export async function updateSyncStatus(clientEventId, syncStatus, extra = {}) {
  return upsertCallStatus(clientEventId, {
    sync_status: syncStatus,
    ...extra,
  });
}

/**
 * Update only the recording_status of a call.
 */
export async function updateRecordingStatus(clientEventId, recordingStatus, extra = {}) {
  return upsertCallStatus(clientEventId, {
    recording_status: recordingStatus,
    ...extra,
  });
}

/**
 * Update only the transcript_status of a call.
 */
export async function updateTranscriptStatus(clientEventId, transcriptStatus) {
  return upsertCallStatus(clientEventId, { transcript_status: transcriptStatus });
}

/**
 * Get a single call's status entry.
 */
export async function getCallStatus(clientEventId) {
  const store = await _load();
  return store[clientEventId] || null;
}

/**
 * Get all call status entries, sorted by updated_at descending.
 */
export async function getAllCallStatuses() {
  const store = await _load();
  return Object.values(store).sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  );
}

/**
 * Get calls that are pending sync (SYNC_QUEUED or SYNC_FAILED with retries remaining).
 */
export async function getPendingCalls() {
  const store = await _load();
  return Object.values(store).filter(
    (c) =>
      c.sync_status === STATUS.SYNC_QUEUED ||
      c.sync_status === STATUS.SYNCING ||
      (c.sync_status === STATUS.SYNC_FAILED && (c.sync_attempts || 0) < 10)
  );
}

/**
 * Get calls with pending recording uploads.
 */
export async function getPendingRecordings() {
  const store = await _load();
  return Object.values(store).filter(
    (c) =>
      c.recording_status === STATUS.RECORDING_QUEUED ||
      c.recording_status === STATUS.RECORDING_UPLOADING ||
      (c.recording_status === STATUS.RECORDING_FAILED && (c.recording_attempts || 0) < 5)
  );
}

/**
 * Get diagnostic summary for the sync health screen.
 * Derives real numbers from the call log + synced-IDs set so it
 * never shows all-zeros just because the status store is empty.
 */
export async function getSyncHealthSummary() {
  // 1. Status-store entries (populated after confirmed backend sync)
  const storeEntries = await getAllCallStatuses();
  const storeSynced  = storeEntries.filter((c) => c.sync_status === STATUS.SYNCED).length;
  const storeFailed  = storeEntries.filter((c) => c.sync_status === STATUS.SYNC_FAILED).length;
  const recUploaded  = storeEntries.filter((c) => c.recording_status === STATUS.RECORDING_UPLOADED).length;
  const recPending   = storeEntries.filter((c) => [STATUS.RECORDING_QUEUED, STATUS.RECORDING_UPLOADING].includes(c.recording_status)).length;
  const recFailed    = storeEntries.filter((c) => c.recording_status === STATUS.RECORDING_FAILED).length;
  const transcribed  = storeEntries.filter((c) => c.transcript_status === STATUS.TRANSCRIPTION_COMPLETED).length;

  // 2. Ground-truth: read actual call log + synced-IDs set
  let total = storeEntries.length, synced = storeSynced, pending = 0, failed = storeFailed;
  try {
    const { getRealCallLog } = require("./callLogService");
    const raw = await getRealCallLog(7);
    const syncedRaw = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
    const syncedSet = syncedRaw ? new Set(JSON.parse(syncedRaw)) : new Set();
    total   = raw.length;
    synced  = Math.max(storeSynced, raw.filter(c => syncedSet.has(c.client_event_id)).length);
    pending = Math.max(0, total - synced - failed);
  } catch { /* fall back to store values */ }

  return { total, synced, pending, failed, recordingUploaded: recUploaded, recordingPending: recPending, recordingFailed: recFailed, transcribed };
}

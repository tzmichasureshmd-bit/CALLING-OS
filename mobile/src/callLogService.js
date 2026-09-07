import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCallLog, readSimInfo } from "./nativeModules";
import { findSimForCall, buildCallSource } from "./simInventoryService";
import { BASE_URL } from "./api";

// ── Storage keys ──────────────────────────────────────────────────────────────
const LAST_SYNC_KEY      = "callos_last_sync_ts";
const SYNCED_IDS_KEY     = "callos_synced_ids";   // Set of client_event_ids confirmed synced
const UPLOAD_QUEUE_KEY   = "callos_upload_queue";

// Android CallLog type → our call_type string
const TYPE_MAP = {
  "1": "incoming",
  "2": "outgoing",
  "3": "missed",
  "5": "rejected",
};

// ── Call log reading ──────────────────────────────────────────────────────────

/**
 * Read real call log from device and map to the backend sync payload shape.
 * Falls back to empty array if permissions not granted or native module absent.
 */
export async function getRealCallLog(limitDays = 30) {
  const raw = await readCallLog(limitDays);
  const results = [];
  for (const c of raw) {
    const startMs     = parseInt(c.date, 10);
    const durationSec = Math.max(0, parseInt(c.duration, 10) || 0);
    const startISO    = new Date(startMs).toISOString();
    const endISO      = durationSec > 0 ? new Date(startMs + durationSec * 1000).toISOString() : null;

    // Android simSlot is 0-indexed; subscriptionId may be present on some devices
    const simSlotAndroid  = c.simSlot !== undefined && c.simSlot !== null ? parseInt(c.simSlot, 10) : null;
    const subscriptionId  = c.subscriptionId ? String(c.subscriptionId) : null;
    const simSlotBackend  = simSlotAndroid !== null ? simSlotAndroid + 1 : null; // 1-indexed for backend
    const source          = await buildCallSource(simSlotAndroid, subscriptionId);

    results.push({
      client_event_id:    `android-${c.id}`,
      phone_number:       c.number || "unknown",
      contact_name:       c.name   || null,
      call_type:          TYPE_MAP[c.type] ?? "incoming",
      start_time:         startISO,
      end_time:           endISO,
      duration_seconds:   durationSec,
      sim_slot:           simSlotBackend,
      subscription_id:    subscriptionId,
      source,
      recording_available: false,
      recording_path:     c.recordingPath || null,
      _start_ms:          startMs,
    });
  }
  return results;
}

// ── Sliding-window sync strategy ──────────────────────────────────────────────
/**
 * STRATEGY: Always re-read the last 7 days from Android CallLog.
 * Filter out calls we have already confirmed synced (by client_event_id).
 * This is safe because the server deduplicates by (org_id, client_event_id).
 *
 * Why not timestamp-only cursor?
 * - Android may write call log entries with a delay
 * - Two calls can share the same millisecond timestamp
 * - Cursor advancement before confirmation can permanently miss calls
 */
export async function getNewCallsSinceLastSync() {
  // Read last 7 days — cheap, covers any gap from background/killed state
  const all = await getRealCallLog(7);
  if (!all.length) return [];

  // Load the set of already-synced IDs
  const syncedSet = await getSyncedIds();

  // Return only calls not yet confirmed synced
  return all.filter((c) => !syncedSet.has(c.client_event_id));
}

// ── Synced ID set (persisted) ─────────────────────────────────────────────────

async function getSyncedIds() {
  try {
    const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

async function addSyncedIds(ids) {
  try {
    const existing = await getSyncedIds();
    ids.forEach((id) => existing.add(id));
    // Keep only last 5000 IDs to prevent unbounded growth
    const arr = Array.from(existing);
    const trimmed = arr.length > 5000 ? arr.slice(arr.length - 5000) : arr;
    await AsyncStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(trimmed));
  } catch { /* non-critical */ }
}

/**
 * Mark a batch of calls as successfully synced.
 * Call this ONLY after the server confirms acceptance.
 */
export async function markCallsSynced(calls) {
  const ids = calls.map((c) => c.client_event_id).filter(Boolean);
  if (ids.length) {
    await addSyncedIds(ids);
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
  }
}

/** Legacy compat — kept so AuthContext.syncCalls still works */
export async function markSyncComplete() {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

// ── Recording upload queue ────────────────────────────────────────────────────

export async function getUploadQueue() {
  try {
    const q = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
    return q ? JSON.parse(q) : [];
  } catch {
    return [];
  }
}

export async function saveUploadQueue(queue) {
  await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueRecordings(calls) {
  const withRec = calls.filter((c) => c.recording_path);
  if (!withRec.length) return;
  const queue = await getUploadQueue();
  const existing = new Set(queue.map((q) => q.client_event_id));
  const toAdd = [];
  for (const c of withRec) {
    if (existing.has(c.client_event_id)) continue;
    // Try to get file info for size/mime
    let fileSize = null;
    try {
      const info = await FileSystem.getInfoAsync(c.recording_path);
      if (info.exists) fileSize = info.size || null;
    } catch {}
    toAdd.push({
      client_event_id: c.client_event_id,
      path:            c.recording_path,
      file_size:       fileSize,
      mime_type:       null,   // determined at upload time from extension
      retry_count:     0,
      status:          "queued",
      last_error:      null,
      created_at:      new Date().toISOString(),
    });
  }
  if (toAdd.length) await saveUploadQueue([...queue, ...toAdd]);
}

/**
 * Upload a recording file to the backend.
 * POST /calls/{callId}/recording  (multipart/form-data)
 */
export async function uploadRecording(callId, filePath, token) {
  if (!filePath || !callId) return null;
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info.exists) return null;

    const result = await FileSystem.uploadAsync(
      `${BASE_URL}/calls/${callId}/recording`,
      filePath,
      {
        httpMethod:  "POST",
        uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
        fieldName:   "file",
        headers:     { Authorization: `Bearer ${token}` },
      }
    );
    return result.status === 200 ? JSON.parse(result.body) : null;
  } catch {
    return null;
  }
}

// ── SIM info ──────────────────────────────────────────────────────────────────

export async function getPrimarySimInfo() {
  const sims = await readSimInfo();
  if (!sims.length) return { sim_phone_number: null, sim_carrier: null };
  const primary = sims.find((s) => s.slot === 0) ?? sims[0];
  return {
    sim_phone_number: primary.phoneNumber || null,
    sim_carrier:      primary.carrierName || null,
  };
}

export async function getAllSimInfo() {
  return readSimInfo();
}

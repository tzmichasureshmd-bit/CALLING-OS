import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCallLog, readSimInfo } from "./nativeModules";
import { findSimForCall, buildCallSource } from "./simInventoryService";
import { BASE_URL } from "./api";
import { upsertCallStatus, STATUS } from "./callStatusStore";

// ── Selected SIM keys (must match simSelectionService.js) ─────────────────────
const SELECTED_SUB_ID_KEY = "callos_selected_subscription_id";
const SELECTED_SLOT_KEY   = "callos_selected_sim_slot";

/**
 * Returns the employee's selected SIM identity.
 * Primary: subscriptionId. Fallback: slot (0-indexed Android slot).
 */
export async function getSelectedSimIdentity() {
  const subId = await AsyncStorage.getItem(SELECTED_SUB_ID_KEY).catch(() => null);
  const slot  = await AsyncStorage.getItem(SELECTED_SLOT_KEY).catch(() => null);
  return {
    subscriptionId: subId || null,
    slot: slot !== null && slot !== "" ? parseInt(slot, 10) : null,
  };
}

/**
 * Returns true if a call belongs to the selected SIM.
 * If no SIM is selected (null), all calls are eligible.
 * If Android did not expose SIM identity for the call, returns null (unknown).
 */
function _callMatchesSelectedSim(call, selectedSubId, selectedSlot) {
  // No SIM selected → all calls eligible
  if (selectedSubId === null && selectedSlot === null) return true;

  // Primary: subscriptionId match
  if (selectedSubId !== null && call.subscription_id !== null) {
    return call.subscription_id === selectedSubId;
  }

  // Fallback: slot match (sim_slot is 1-indexed backend value)
  if (selectedSlot !== null && call.sim_slot !== null) {
    return call.sim_slot === selectedSlot + 1; // sim_slot is 1-indexed
  }

  // SIM identity unavailable for this call — cannot confirm match
  return null; // caller decides policy
}

// -- Storage keys
const LAST_SYNC_KEY    = "callos_last_sync_ts";
const SYNCED_IDS_KEY   = "callos_synced_ids";
const UPLOAD_QUEUE_KEY = "callos_upload_queue";

// -- Android CallLog type -> CallNexa call_type
// ALL types mapped. Zero-duration calls are NEVER filtered out.
const TYPE_MAP = {
  "1": "incoming",  // INCOMING answered
  "2": "outgoing",  // OUTGOING (answered OR unanswered)
  "3": "missed",    // MISSED   -- duration=0, MUST sync
  "4": "incoming",  // VOICEMAIL
  "5": "rejected",  // REJECTED by user -- duration=0, MUST sync
  "6": "rejected",  // BLOCKED
  "7": "incoming",  // ANSWERED_EXTERNALLY
};

function _deriveCallStatus(callType, durationSec) {
  if (callType === "missed")                        return "missed";
  if (callType === "rejected")                      return "rejected";
  if (callType === "outgoing" && durationSec === 0) return "no_answer";
  if (durationSec > 0)                             return "connected";
  return "unknown";
}

// -- Recording file search
const RECORDING_SEARCH_DIRS = [
  "file:///storage/emulated/0/Sounds/CallRecord/",
  "file:///storage/emulated/0/Record/Call/",
  "file:///storage/emulated/0/PhoneRecord/",
  "file:///storage/emulated/0/Vivo/CallRecord/",
  "file:///storage/emulated/0/Recordings/Call/",
  "file:///storage/emulated/0/DCIM/Call Recordings/",
  "file:///storage/emulated/0/MIUI/sound_recorder/call_rec/",
  "file:///storage/emulated/0/Xiaomi/sound_recorder/call_rec/",
  "file:///storage/emulated/0/ColorOS/Recording/",
  "file:///storage/emulated/0/Recordings/",
  "file:///storage/emulated/0/CallRecordings/",
  "file:///storage/emulated/0/Call/",
  "file:///storage/emulated/0/Android/data/com.android.phone/files/",
];
const RECORDING_EXTENSIONS = ["mp3", "mp4", "m4a", "aac", "wav", "3gp", "amr", "ogg"];

async function _findRecordingFile(startMs, phoneNumber) {
  try {
    const startSec = Math.floor(startMs / 1000);
    const windowSec = 60;
    for (const dir of RECORDING_SEARCH_DIRS) {
      try {
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists || !info.isDirectory) continue;
        const contents = await FileSystem.readDirectoryAsync(dir);
        for (const filename of contents) {
          const ext = filename.split(".").pop()?.toLowerCase();
          if (!RECORDING_EXTENSIONS.includes(ext)) continue;
          try {
            const fileInfo = await FileSystem.getInfoAsync(dir + filename, { md5: false });
            if (fileInfo.exists && fileInfo.modificationTime) {
              const fileSec = Math.floor(fileInfo.modificationTime);
              if (Math.abs(fileSec - startSec) <= windowSec) return dir + filename;
            }
          } catch { /* skip */ }
          if (phoneNumber && phoneNumber !== "unknown") {
            const digits = phoneNumber.replace(/\D/g, "").slice(-7);
            if (digits.length >= 7 && filename.includes(digits)) return dir + filename;
          }
        }
      } catch { /* dir not accessible */ }
    }
  } catch { /* silent */ }
  return null;
}

// -- TASK 7: Core normalizer
// Never filters zero-duration calls. Preserves Android _id (TASK 8).
// Full diagnostic logging (TASK 12).
async function _readAndNormalize(limitDays) {
  console.log("[CALLLOG] provider query started -- last " + limitDays + " days");
  const raw = await readCallLog(limitDays);
  console.log("[CALLLOG] records returned = " + raw.length);

  if (raw.length === 0) {
    console.warn("[CALLLOG] EMPTY: 0 records. Check permission, module, and device call log.");
    return [];
  }

  const results = [];
  let skipped = 0;

  for (const c of raw) {
    // Android _id is the primary identifier -- TASK 8
    const androidId = c.id || c._id;
    if (!androidId) { skipped++; continue; }
    if (!c.date)    { skipped++; continue; }

    const startMs = parseInt(c.date, 10);
    if (isNaN(startMs) || startMs <= 0) { skipped++; continue; }

    // duration=0 is VALID -- NEVER skip (missed/rejected always 0)
    const durationSec = Math.max(0, parseInt(c.duration, 10) || 0);
    const startISO    = new Date(startMs).toISOString();
    const endISO      = durationSec > 0 ? new Date(startMs + durationSec * 1000).toISOString() : null;
    const callType    = TYPE_MAP[String(c.type)] ?? "incoming";
    const callStatus  = _deriveCallStatus(callType, durationSec);

    const simSlotAndroid = (c.simSlot !== undefined && c.simSlot !== null) ? parseInt(c.simSlot, 10) : null;
    const subscriptionId = c.subscriptionId ? String(c.subscriptionId) : null;
    const simSlotBackend = simSlotAndroid !== null ? simSlotAndroid + 1 : null;
    const source         = await buildCallSource(simSlotAndroid, subscriptionId);

    const entry = {
      client_event_id:     "android-" + androidId,  // TASK 8: stable collision-safe ID
      phone_number:        c.number || "unknown",
      contact_name:        c.name || c.cachedName || null,
      call_type:           callType,
      call_status:         callStatus,
      start_time:          startISO,
      end_time:            endISO,
      duration_seconds:    durationSec,
      sim_slot:            simSlotBackend,
      subscription_id:     subscriptionId,
      source,
      recording_available: false,
      recording_path:      null,
      _start_ms:           startMs,
      _raw_number:         c.number || null,
      _android_id:         String(androidId),
    };

    if (__DEV__) {
      console.log(
        "[CALLLOG] id=" + entry.client_event_id +
        " type=" + callType + "(" + c.type + ")" +
        " status=" + callStatus +
        " dur=" + durationSec + "s" +
        " num=***" + String(c.number || "").slice(-4)
      );
    }
    results.push(entry);
  }

  if (skipped > 0) console.warn("[CALLLOG] skipped " + skipped + " records (missing id/date)");
  console.log("[CALLLOG] new calls mapped = " + results.length);
  return results;
}

// -- TASK 7: Public API

/** Initial reconciliation -- 90 days. Used on first login and app-start (TASK 10). */
export async function getRealCallLog(limitDays = 90) {
  return _readAndNormalize(limitDays);
}

/** Recent window -- last 2 hours. Used for normal foreground polling (TASK 7). */
export async function getRecentCalls() {
  return _readAndNormalize(2 / 24);
}

/** Calls since a specific timestamp (ms). Used for incremental sync. */
export async function getCallsSince(sinceMs) {
  const days = Math.max(0.1, Math.min((Date.now() - sinceMs) / (24 * 60 * 60 * 1000) + 0.1, 90));
  const all = await _readAndNormalize(days);
  return all.filter((c) => c._start_ms >= sinceMs);
}

/** Calls in last N days. */
export async function getCallsLastDays(days) {
  return _readAndNormalize(days);
}

/** Latest Android call log _id -- used for change detection (TASK 9). */
export async function getLatestCallLogId() {
  const calls = await _readAndNormalize(1);
  return calls.length ? (calls[0]._android_id || null) : null;
}

/** Full diagnostic -- used by diagnostic screen (TASK 5/6). */
export async function getCallLogDiagnostics() {
  const { runCallLogComparison } = require("./callLogDiagnostic");
  return runCallLogComparison(7);
}

// -- TASK 9: Sliding-window -- get unsynced calls
// Re-reads last 7 days. Filters out already-confirmed-synced IDs.
// Applies selected-SIM filter: only calls from the employee's chosen SIM.
// Server deduplicates by client_event_id so re-sending is safe.
export async function getNewCallsSinceLastSync() {
  const all = await getRealCallLog(7);
  if (!all.length) return [];
  const syncedSet = await _getSyncedIds();
  const { subscriptionId: selSubId, slot: selSlot } = await getSelectedSimIdentity();

  const unsync = [];
  let skippedWrongSim = 0, skippedUnknownSim = 0;

  for (const c of all) {
    if (syncedSet.has(c.client_event_id)) continue;
    const match = _callMatchesSelectedSim(c, selSubId, selSlot);
    if (match === false) { skippedWrongSim++; continue; }
    if (match === null)  { skippedUnknownSim++; } // include with unknown SIM tag
    unsync.push(c);
  }

  if (skippedWrongSim > 0 || skippedUnknownSim > 0) {
    console.log(
      "[CALLLOG] SIM filter: kept=" + unsync.length +
      " wrong_sim=" + skippedWrongSim +
      " unknown_sim=" + skippedUnknownSim +
      " selected_sub=" + (selSubId || "none") +
      " selected_slot=" + (selSlot !== null ? selSlot : "none")
    );
  }
  console.log("[CALLLOG] queued calls = " + unsync.length + " (of " + all.length + " total in 7d window)");
  return unsync;
}

// -- Synced ID set

async function _getSyncedIds() {
  try {
    const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

async function _addSyncedIds(ids) {
  try {
    const existing = await _getSyncedIds();
    ids.forEach((id) => existing.add(id));
    const arr = Array.from(existing);
    const trimmed = arr.length > 5000 ? arr.slice(arr.length - 5000) : arr;
    await AsyncStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(trimmed));
  } catch { /* non-critical */ }
}

export async function markCallsSynced(calls) {
  const ids = calls.map((c) => c.client_event_id).filter(Boolean);
  if (ids.length) {
    await _addSyncedIds(ids);
    await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    console.log("[CALLLOG] sync confirmed = " + ids.length + " calls marked synced");
    // Update callStatusStore so Sync Health shows real numbers
    await Promise.all(calls.map((c) =>
      upsertCallStatus(c.client_event_id, {
        sync_status:      STATUS.SYNCED,
        phone_number:     c.phone_number,
        contact_name:     c.contact_name || null,
        call_type:        c.call_type,
        duration_seconds: c.duration_seconds,
        start_time:       c.start_time,
      }).catch(() => {})
    ));
  }
}

export async function markSyncComplete() {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

// -- Recording upload queue

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
  const queue    = await getUploadQueue();
  const existing = new Set(queue.map((q) => q.client_event_id));
  const toAdd    = [];

  for (const c of calls) {
    if (existing.has(c.client_event_id)) continue;

    // Attempt recording detection with retry window (OEM may write file seconds after call)
    let recordingPath = null;
    const startMs = c._start_ms || new Date(c.start_time).getTime();
    const delays = [0, 3000, 8000]; // immediate, 3s, 8s
    for (const delay of delays) {
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
      recordingPath = await _findRecordingFile(startMs, c._raw_number || c.phone_number);
      if (recordingPath) break;
    }

    if (!recordingPath) {
      // No recording found after retries — mark NOT_AVAILABLE, do not fabricate
      await upsertCallStatus(c.client_event_id, {
        recording_status: STATUS.RECORDING_NOT_AVAILABLE,
        recording_error: 'No recording file found in OEM directories after retry',
      }).catch(() => {});
      continue;
    }

    let fileSize = null;
    try {
      const info = await FileSystem.getInfoAsync(recordingPath);
      if (info.exists) fileSize = info.size || null;
    } catch {}

    toAdd.push({
      client_event_id: c.client_event_id,
      path:            recordingPath,
      file_size:       fileSize,
      mime_type:       null,
      retry_count:     0,
      status:          'queued',
      last_error:      null,
      created_at:      new Date().toISOString(),
    });

    // Mark RECORDING_QUEUED in status store
    await upsertCallStatus(c.client_event_id, {
      recording_status: STATUS.RECORDING_QUEUED,
      recording_path:   recordingPath,
    }).catch(() => {});
  }

  if (toAdd.length) {
    await saveUploadQueue([...queue, ...toAdd]);
    console.log("[CALLLOG] recording queued = " + toAdd.length + " files");
  }
}

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

// -- SIM helpers

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

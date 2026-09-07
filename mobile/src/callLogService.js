import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCallLog, readSimInfo } from "./nativeModules";
import { findSimForCall, buildCallSource } from "./simInventoryService";
import { BASE_URL } from "./api";

// ── Storage keys ──────────────────────────────────────────────────────────────
const LAST_SYNC_KEY    = "callos_last_sync_ts";
const SYNCED_IDS_KEY   = "callos_synced_ids";
const UPLOAD_QUEUE_KEY = "callos_upload_queue";

// ── Android CallLog type → CallNexa call_type ─────────────────────────────────
// ALL types mapped. Zero-duration calls are NEVER filtered out.
// Missed calls always have duration=0. Rejected calls always have duration=0.
const TYPE_MAP = {
  "1": "incoming",  // INCOMING answered
  "2": "outgoing",  // OUTGOING (answered OR unanswered — duration may be 0)
  "3": "missed",    // MISSED   — duration=0, MUST sync
  "4": "incoming",  // VOICEMAIL
  "5": "rejected",  // REJECTED by user — duration=0, MUST sync
  "6": "rejected",  // BLOCKED
  "7": "incoming",  // ANSWERED_EXTERNALLY
};

function _deriveCallStatus(callType, durationSec) {
  if (callType === "missed")                          return "missed";
  if (callType === "rejected")                        return "rejected";
  if (callType === "outgoing" && durationSec === 0)   return "no_answer";
  if (durationSec > 0)                               return "connected";
  return "unknown";
}

// ── Recording file search ─────────────────────────────────────────────────────
/**
 * Manufacturer call recording folder paths.
 * Vivo, Samsung, Xiaomi, OPPO, OnePlus all save to different locations.
 * We search all known paths for a file matching the call timestamp.
 *
 * NOTE: Android 9+ blocks MICROPHONE during cellular calls for third-party apps.
 * However, some manufacturers (Vivo, Xiaomi, Samsung) use a system-level
 * recording API that saves files to these folders. We scan for those files.
 */
const RECORDING_SEARCH_DIRS = [
  // Vivo (V29e and other Vivo devices)
  "file:///storage/emulated/0/Sounds/CallRecord/",
  "file:///storage/emulated/0/Record/Call/",
  "file:///storage/emulated/0/PhoneRecord/",
  "file:///storage/emulated/0/Vivo/CallRecord/",
  // Samsung
  "file:///storage/emulated/0/Recordings/Call/",
  "file:///storage/emulated/0/DCIM/Call Recordings/",
  // Xiaomi / MIUI
  "file:///storage/emulated/0/MIUI/sound_recorder/call_rec/",
  "file:///storage/emulated/0/Xiaomi/sound_recorder/call_rec/",
  // OPPO / Realme
  "file:///storage/emulated/0/ColorOS/Recording/",
  "file:///storage/emulated/0/Recordings/",
  // Generic Android
  "file:///storage/emulated/0/CallRecordings/",
  "file:///storage/emulated/0/Call/",
  "file:///storage/emulated/0/Android/data/com.android.phone/files/",
];

const RECORDING_EXTENSIONS = ["mp3", "mp4", "m4a", "aac", "wav", "3gp", "amr", "ogg"];

/**
 * Try to find a recording file for a call by scanning manufacturer folders.
 * Matches by timestamp proximity (within 60 seconds of call start).
 * Returns the file URI if found, null otherwise.
 */
async function _findRecordingFile(startMs, phoneNumber) {
  try {
    const startSec = Math.floor(startMs / 1000);
    const windowSec = 60; // recording may start up to 60s after call

    for (const dir of RECORDING_SEARCH_DIRS) {
      try {
        const info = await FileSystem.getInfoAsync(dir);
        if (!info.exists || !info.isDirectory) continue;

        const contents = await FileSystem.readDirectoryAsync(dir);
        for (const filename of contents) {
          const ext = filename.split(".").pop()?.toLowerCase();
          if (!RECORDING_EXTENSIONS.includes(ext)) continue;

          // Try to match by file modification time
          try {
            const fileInfo = await FileSystem.getInfoAsync(dir + filename, { md5: false });
            if (fileInfo.exists && fileInfo.modificationTime) {
              const fileSec = Math.floor(fileInfo.modificationTime);
              if (Math.abs(fileSec - startSec) <= windowSec) {
                console.log(`[CallNexa] RECORDING_FOUND: ${dir}${filename}`);
                return dir + filename;
              }
            }
          } catch { /* skip this file */ }

          // Also try matching by phone number in filename
          if (phoneNumber && phoneNumber !== "unknown") {
            const digits = phoneNumber.replace(/\D/g, "").slice(-7); // last 7 digits
            if (digits.length >= 7 && filename.includes(digits)) {
              console.log(`[CallNexa] RECORDING_FOUND_BY_NUMBER: ${dir}${filename}`);
              return dir + filename;
            }
          }
        }
      } catch { /* dir not accessible */ }
    }
  } catch { /* recording search failed silently */ }
  return null;
}

// ── Call log reading ──────────────────────────────────────────────────────────

/**
 * Read ALL calls from Android system call log.
 *
 * RULES:
 * - NEVER filter zero-duration calls (missed/rejected = duration 0)
 * - client_event_id = "android-{c.id}" — deterministic, stable
 * - All types: incoming, outgoing, missed, rejected, blocked
 * - Searches manufacturer folders for recording files
 */
export async function getRealCallLog(limitDays = 30) {
  console.log(`[CallNexa] CALLLOG_QUERY_START: last ${limitDays} days`);
  const raw = await readCallLog(limitDays);
  console.log(`[CallNexa] CALLLOG_QUERY_RESULT: ${raw.length} raw entries from Android`);

  if (raw.length === 0) {
    console.warn("[CallNexa] CALLLOG_EMPTY: Either no calls in window, permission denied, or native module missing");
  }

  const results = [];

  for (const c of raw) {
    // Must have Android _id
    if (!c.id) {
      console.warn("[CallNexa] CALL_SKIPPED: reason=missing_id entry=", JSON.stringify(c));
      continue;
    }
    // Must have timestamp
    if (!c.date) {
      console.warn(`[CallNexa] CALL_SKIPPED: id=${c.id} reason=missing_date`);
      continue;
    }

    const startMs = parseInt(c.date, 10);
    if (isNaN(startMs) || startMs <= 0) {
      console.warn(`[CallNexa] CALL_SKIPPED: id=${c.id} reason=invalid_date val=${c.date}`);
      continue;
    }

    // duration=0 is VALID — never skip based on duration
    const durationSec = Math.max(0, parseInt(c.duration, 10) || 0);
    const startISO    = new Date(startMs).toISOString();
    const endISO      = durationSec > 0 ? new Date(startMs + durationSec * 1000).toISOString() : null;

    const callType   = TYPE_MAP[String(c.type)] ?? "incoming";
    const callStatus = _deriveCallStatus(callType, durationSec);

    // SIM: Android 0-indexed → backend 1-indexed
    const simSlotAndroid = (c.simSlot !== undefined && c.simSlot !== null)
      ? parseInt(c.simSlot, 10) : null;
    const subscriptionId = c.subscriptionId ? String(c.subscriptionId) : null;
    const simSlotBackend = simSlotAndroid !== null ? simSlotAndroid + 1 : null;
    const source         = await buildCallSource(simSlotAndroid, subscriptionId);

    // Recording search is done AFTER sync, not during — keeps sync fast
    // _findRecordingFile is called separately by enqueueRecordings
    const entry = {
      client_event_id:     `android-${c.id}`,
      phone_number:        c.number || "unknown",
      contact_name:        c.name   || null,
      call_type:           callType,
      call_status:         callStatus,
      start_time:          startISO,
      end_time:            endISO,
      duration_seconds:    durationSec,
      sim_slot:            simSlotBackend,
      subscription_id:     subscriptionId,
      source,
      recording_available: false,
      recording_path:      null,  // populated later by background recording scan
      _start_ms:           startMs,
      _raw_number:         c.number || null, // kept for recording search
    };

    console.log(
      `[CallNexa] CALL_DETECTED: id=${entry.client_event_id} ` +
      `type=${callType} status=${callStatus} dur=${durationSec}s ` +
      `rec=${!!recordingPath} num=***${String(c.number || "").slice(-4)}`
    );
    results.push(entry);
  }

  console.log(`[CallNexa] CALLLOG_MAPPED: ${results.length} calls ready to sync`);
  return results;
}

// ── Sliding-window: get unsynced calls ────────────────────────────────────────
/**
 * Re-reads last 7 days every time. Filters out already-confirmed-synced IDs.
 * Server deduplicates by client_event_id so re-sending is safe.
 */
export async function getNewCallsSinceLastSync() {
  const all = await getRealCallLog(7);
  if (!all.length) return [];
  const syncedSet = await _getSyncedIds();
  const unsync = all.filter((c) => !syncedSet.has(c.client_event_id));
  console.log(`[CallNexa] SYNC_WINDOW: ${all.length} total, ${unsync.length} unsynced`);
  return unsync;
}

// ── Synced ID set ─────────────────────────────────────────────────────────────

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
  }
}

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
  // Run recording file search in background for each call
  const queue    = await getUploadQueue();
  const existing = new Set(queue.map((q) => q.client_event_id));
  const toAdd    = [];

  for (const c of calls) {
    if (existing.has(c.client_event_id)) continue;
    // Search for recording file now (after sync, non-blocking on main path)
    const recordingPath = await _findRecordingFile(c._start_ms || new Date(c.start_time).getTime(), c._raw_number || c.phone_number);
    if (!recordingPath) continue;

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
      status:          "queued",
      last_error:      null,
      created_at:      new Date().toISOString(),
    });
  }

  if (toAdd.length) {
    await saveUploadQueue([...queue, ...toAdd]);
    console.log(`[CallNexa] RECORDING_QUEUED: ${toAdd.length} files queued for upload`);
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

// ── SIM helpers ───────────────────────────────────────────────────────────────

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

import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCallLog, readSimInfo } from "./nativeModules";
import { findSimForCall, buildCallSource } from "./simInventoryService";
import { BASE_URL } from "./api";

// ── Selected SIM keys (must match simSelectionService.js) ─────────────────────
const SELECTED_SUB_ID_KEY = "callos_selected_subscription_id";
const SELECTED_SLOT_KEY   = "callos_selected_sim_slot";

export async function getSelectedSimIdentity() {
  const subId = await AsyncStorage.getItem(SELECTED_SUB_ID_KEY).catch(() => null);
  const slot  = await AsyncStorage.getItem(SELECTED_SLOT_KEY).catch(() => null);
  return {
    subscriptionId: subId || null,
    slot: slot !== null && slot !== "" ? parseInt(slot, 10) : null,
  };
}

function _callMatchesSelectedSim(call, selectedSubId, selectedSlot) {
  if (selectedSubId === null && selectedSlot === null) return true;
  if (selectedSubId !== null && call.subscription_id !== null) {
    return call.subscription_id === selectedSubId;
  }
  if (selectedSlot !== null && call.sim_slot !== null) {
    return call.sim_slot === selectedSlot + 1;
  }
  return null;
}

// ── Android CallLog type -> call_type ─────────────────────────────────────────
const TYPE_MAP = {
  "1": "incoming",
  "2": "outgoing",
  "3": "missed",
  "4": "incoming",
  "5": "rejected",
  "6": "rejected",
  "7": "incoming",
};

function _deriveCallStatus(callType, durationSec) {
  if (callType === "missed")                        return "missed";
  if (callType === "rejected")                      return "rejected";
  if (callType === "outgoing" && durationSec === 0) return "no_answer";
  if (durationSec > 0)                             return "connected";
  return "unknown";
}

// ── Recording file search ─────────────────────────────────────────────────────
const RECORDING_SEARCH_DIRS = [
  "file:///storage/emulated/0/Recordings/Call/",
  "file:///storage/emulated/0/Recordings/",
  "file:///storage/emulated/0/CallRecordings/",
  "file:///storage/emulated/0/Call/",
  "file:///storage/emulated/0/Record/Call/",
  "file:///storage/emulated/0/PhoneRecord/",
  "file:///storage/emulated/0/MIUI/sound_recorder/call_rec/",
  "file:///storage/emulated/0/Xiaomi/sound_recorder/call_rec/",
  "file:///storage/emulated/0/Sounds/CallRecord/",
  "file:///storage/emulated/0/Vivo/CallRecord/",
  "file:///storage/emulated/0/ColorOS/Recording/",
  "file:///storage/emulated/0/DCIM/Call Recordings/",
  "file:///storage/emulated/0/Sounds/",
  "file:///storage/emulated/0/OnePlus/CallRecord/",
  "file:///storage/emulated/0/Android/data/com.android.phone/files/",
];
const RECORDING_EXTENSIONS = ["mp3", "mp4", "m4a", "aac", "wav", "3gp", "amr", "ogg"];
const RECORDING_MIME_MAP = {
  mp3: "audio/mpeg", mp4: "audio/mp4", m4a: "audio/x-m4a",
  aac: "audio/aac", wav: "audio/wav", "3gp": "audio/3gpp",
  amr: "audio/amr", ogg: "audio/ogg",
};
const MIN_RECORDING_BYTES = 1024;
const MATCH_WINDOW_SEC    = 180;

async function _findRecordingFile(startMs, phoneNumber, durationSec) {
  try {
    const startSec = Math.floor(startMs / 1000);
    const endSec = startSec + (durationSec || 0) + MATCH_WINDOW_SEC;
    const digits = phoneNumber && phoneNumber !== "unknown"
      ? phoneNumber.replace(/\D/g, "").slice(-7)
      : null;

    for (const dir of RECORDING_SEARCH_DIRS) {
      try {
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists || !dirInfo.isDirectory) continue;
        const contents = await FileSystem.readDirectoryAsync(dir);
        for (const filename of contents) {
          const ext = filename.split(".").pop()?.toLowerCase();
          if (!RECORDING_EXTENSIONS.includes(ext)) continue;
          try {
            const fileInfo = await FileSystem.getInfoAsync(dir + filename, { md5: false });
            if (!fileInfo.exists) continue;
            if (!fileInfo.size || fileInfo.size < MIN_RECORDING_BYTES) continue;
            if (fileInfo.modificationTime) {
              const fileSec = Math.floor(fileInfo.modificationTime);
              if (fileSec >= startSec && fileSec <= endSec) {
                return { path: dir + filename, mimeType: RECORDING_MIME_MAP[ext] || "audio/mp4", fileSize: fileInfo.size };
              }
            }
            if (digits && digits.length >= 7 && filename.includes(digits)) {
              return { path: dir + filename, mimeType: RECORDING_MIME_MAP[ext] || "audio/mp4", fileSize: fileInfo.size };
            }
          } catch { /* skip unreadable file */ }
        }
      } catch { /* dir not accessible */ }
    }
  } catch { /* silent */ }
  return null;
}

// ── Core normalizer ───────────────────────────────────────────────────────────
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
    const androidId = c.id || c._id;
    if (!androidId) { skipped++; continue; }
    if (!c.date)    { skipped++; continue; }

    const startMs = parseInt(c.date, 10);
    if (isNaN(startMs) || startMs <= 0) { skipped++; continue; }

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
      client_event_id:     "android-" + androidId,
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
        "[CALL_DETECTED] id=" + entry.client_event_id +
        " type=" + callType + "(" + c.type + ")" +
        " status=" + callStatus +
        " dur=" + durationSec + "s" +
        " num=***" + String(c.number || "").slice(-4)
      );
    }
    results.push(entry);
  }

  if (skipped > 0) console.warn("[CALLLOG] skipped " + skipped + " records (missing id/date)");
  console.log("[CALLLOG] normalized calls = " + results.length);
  return results;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getRealCallLog(limitDays = 90) {
  return _readAndNormalize(limitDays);
}

export async function getRecentCalls() {
  return _readAndNormalize(1); // last 24 hours — covers instant/foreground sync modes
}

export async function getCallsSince(sinceMs) {
  const days = Math.max(0.1, Math.min((Date.now() - sinceMs) / (24 * 60 * 60 * 1000) + 0.1, 90));
  const all = await _readAndNormalize(days);
  return all.filter((c) => c._start_ms >= sinceMs);
}

export async function getCallsLastDays(days) {
  return _readAndNormalize(days);
}

export async function getLatestCallLogId() {
  const calls = await _readAndNormalize(1);
  return calls.length ? (calls[0]._android_id || null) : null;
}

export async function getCallLogDiagnostics() {
  const { runCallLogComparison } = require("./callLogDiagnostic");
  return runCallLogComparison(7);
}

/**
 * Apply SIM filter to a list of normalized calls.
 * Returns only calls matching the employee's selected SIM.
 * No local storage read/write — pure filter.
 */
export async function applySimFilter(calls) {
  const { subscriptionId: selSubId, slot: selSlot } = await getSelectedSimIdentity();
  if (selSubId === null && selSlot === null) return calls;

  const kept = [];
  let skippedWrongSim = 0, skippedUnknownSim = 0;

  for (const c of calls) {
    const match = _callMatchesSelectedSim(c, selSubId, selSlot);
    if (match === false) { skippedWrongSim++; continue; }
    if (match === null)  { skippedUnknownSim++; }
    kept.push(c);
  }

  if (skippedWrongSim > 0 || skippedUnknownSim > 0) {
    console.log(
      "[SIM_FILTER_PASSED] kept=" + kept.length +
      " wrong_sim=" + skippedWrongSim +
      " unknown_sim=" + skippedUnknownSim +
      " selected_sub=" + (selSubId || "none") +
      " selected_slot=" + (selSlot !== null ? selSlot : "none")
    );
  }
  return kept;
}

// ── Recording helpers (no local queue — used by syncService directly) ─────────

/**
 * Deferred recording check — runs in background, never blocks sync cycle.
 * Returns { path, mimeType, fileSize } or null after up to 3 attempts.
 */
export async function findRecordingForCall(c) {
  const startMs = c._start_ms || new Date(c.start_time).getTime();
  const phone   = c._raw_number || c.phone_number;
  const dur     = c.duration_seconds || 0;

  console.log(`[RECORDING_DETECTION_STARTED] client_event_id=${c.client_event_id} dur=${dur}s ts=${Date.now()}`);

  const delays = [0, 10000, 30000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));
    const found = await _findRecordingFile(startMs, phone, dur);
    if (found) {
      console.log(`[RECORDING_FOUND] client_event_id=${c.client_event_id} size=${found.fileSize} mime=${found.mimeType} attempt=${attempt + 1} ts=${Date.now()}`);
      return found;
    }
  }

  console.log(`[RECORDING_NOT_AVAILABLE] client_event_id=${c.client_event_id} reason="no_file_in_oem_dirs" ts=${Date.now()}`);
  return null;
}

export async function uploadRecording(callId, filePath, token) {
  if (!filePath || !callId) return null;
  const info = await FileSystem.getInfoAsync(filePath);
  if (!info.exists) throw new Error("Recording file no longer exists at path: " + filePath);
  if (!info.size || info.size < 1024) throw new Error("Recording file is empty or too small: " + info.size + " bytes");

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
  if (result.status === 200 || result.status === 201) {
    try { return result.body ? JSON.parse(result.body) : { status: "uploaded" }; }
    catch { return { status: "uploaded" }; }
  }
  let detail = "Upload failed";
  try { detail = JSON.parse(result.body)?.detail || detail; } catch {}
  throw new Error(`HTTP ${result.status}: ${detail}`);
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

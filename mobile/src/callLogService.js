import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCallLog, readSimInfo, findRecordingsForCall as nativeFindRecordings } from "./nativeModules";
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
const MATCH_WINDOW_SEC    = 60;  // extra buffer after call end; total window = duration + 60s

async function _findRecordingFileJS(startMs, phoneNumber, durationSec) {
  try {
    const startSec = Math.floor(startMs / 1000);
    // Window: from 30s before call start to duration + 60s after — covers OEMs that
    // save the file before the call ends or up to 1 min after.
    const endSec = startSec + Math.max(durationSec || 0, 0) + MATCH_WINDOW_SEC;
    const windowStart = startSec - 30;
    const digits = phoneNumber && phoneNumber !== "unknown"
      ? phoneNumber.replace(/\D/g, "").slice(-7)
      : null;
    // The JS fallback has no reliable duration metadata. Require both a phone
    // hint and the call time window rather than uploading the first nearby file.
    if (!digits || digits.length < 7) return null;

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
              if (fileSec >= windowStart && fileSec <= endSec && filename.includes(digits)) {
                return { path: dir + filename, mimeType: RECORDING_MIME_MAP[ext] || "audio/mp4", fileSize: fileInfo.size };
              }
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
  // No cap — the caller (syncService) is responsible for choosing the window.
  // Capping here caused calls from days 3-7 to be silently dropped after
  // any offline period longer than 2 days.
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

// ── Recording helpers ───────────────────────────────────────────────────────────────────

/**
 * findRecordingForCall
 *
 * Strategy (in priority order):
 *   1. Native RecordingModule (Kotlin) — queries MediaStore then OEM filesystem.
 *      Returns a confidence-scored list. We take the highest-scoring match.
 *      If two candidates share the top score, we return null (ambiguous) rather
 *      than uploading the wrong file.
 *   2. JS filesystem fallback — used only when RecordingModule is unavailable
 *      (e.g. dev build without native module). Same time-window heuristic as
 *      before but with the modificationTime unit bug fixed.
 *
 * Returns { path, contentUri, mimeType, fileSize, durationSec, fingerprint }
 * or null if no reliable match is found.
 *
 * NEVER returns a match with confidence_score <= 0.
 * NEVER returns an ambiguous match (two files with equal top score).
 */
export async function findRecordingForCall(c) {
  const startMs = c._start_ms || new Date(c.start_time).getTime();
  const endMs   = c.duration_seconds > 0 ? startMs + c.duration_seconds * 1000 : 0;
  const phone   = c._raw_number || c.phone_number;
  const dur     = c.duration_seconds || 0;

  console.log(`[RECORDING_DETECTION_STARTED] client_event_id=${c.client_event_id} dur=${dur}s ts=${Date.now()}`);

  // ── Attempt 1: native RecordingModule (MediaStore + filesystem) ────────────
  const delays = [0, 10_000, 30_000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await new Promise(r => setTimeout(r, delays[attempt]));

    const result = await nativeFindRecordings(startMs, endMs, dur, phone);

    if (!result.success) {
      // Module unavailable — fall through to JS fallback
      console.warn(`[RECORDING_NATIVE_UNAVAILABLE] client_event_id=${c.client_event_id} error=${result.error} ts=${Date.now()}`);
      break;
    }

    const recordings = result.recordings || [];

    if (recordings.length === 0) {
      console.log(`[RECORDING_NOT_FOUND_ATTEMPT] client_event_id=${c.client_event_id} attempt=${attempt + 1} source=${result.source} ts=${Date.now()}`);
      continue; // try again after delay
    }

    // Check for ambiguity: if top two candidates share the same score, do not upload
    const top = recordings[0];
    const second = recordings[1];
    if (!top || top.confidence_score < 3) {
      console.warn(`[RECORDING_WEAK_MATCH_REJECTED] client_event_id=${c.client_event_id} score=${top?.confidence_score ?? 0} ts=${Date.now()}`);
      return null;
    }
    if (second && second.confidence_score === top.confidence_score) {
      console.warn(
        `[RECORDING_AMBIGUOUS] client_event_id=${c.client_event_id} ` +
        `top_score=${top.confidence_score} candidates=${recordings.length} ts=${Date.now()}`
      );
      // Return null — do not upload an ambiguous match
      return null;
    }

    // Resolve the usable path: prefer content_uri on API 29+, fall back to file_path
    const usablePath = top.content_uri || top.file_path;
    if (!usablePath) {
      console.warn(`[RECORDING_NO_PATH] client_event_id=${c.client_event_id} fingerprint=${top.fingerprint} ts=${Date.now()}`);
      continue;
    }

    console.log(
      `[RECORDING_FOUND] client_event_id=${c.client_event_id} ` +
      `score=${top.confidence_score} source=${top.source} ` +
      `size=${top.size_bytes} mime=${top.mime_type} ` +
      `fingerprint=${top.fingerprint} attempt=${attempt + 1} ts=${Date.now()}`
    );

    return {
      path:        usablePath,
      contentUri:  top.content_uri  || null,
      filePath:    top.file_path    || null,
      mimeType:    top.mime_type    || "audio/mp4",
      fileSize:    top.size_bytes   || 0,
      durationSec: top.duration_sec || 0,
      fingerprint: top.fingerprint,
      source:      top.source,
    };
  }

  // ── Attempt 2: JS filesystem fallback (when native module not in build) ────
  console.log(`[RECORDING_JS_FALLBACK] client_event_id=${c.client_event_id} ts=${Date.now()}`);
  const jsFallback = await _findRecordingFileJS(startMs, phone, dur);
  if (jsFallback) {
    console.log(`[RECORDING_FOUND] client_event_id=${c.client_event_id} source=js_fallback size=${jsFallback.fileSize} ts=${Date.now()}`);
    return {
      path:        jsFallback.path,
      contentUri:  null,
      filePath:    jsFallback.path,
      mimeType:    jsFallback.mimeType,
      fileSize:    jsFallback.fileSize,
      durationSec: 0,
      fingerprint: `js:${jsFallback.path}:${jsFallback.fileSize}`,
      source:      "js_fallback",
    };
  }

  console.log(`[RECORDING_NOT_AVAILABLE] client_event_id=${c.client_event_id} reason=no_file_found ts=${Date.now()}`);
  return null;
}

export async function uploadRecording(callId, filePath, token, mimeType = "audio/mp4") {
  if (!filePath || !callId) return null;

  // uploadAsync cannot read content:// URIs (MediaStore paths on Android 10+).
  // Copy into the app cache first — copyAsync supports content:// sources.
  let uploadPath = filePath;
  let tempPath   = null;
  if (filePath.startsWith("content://")) {
    const extension = {
      "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav",
      "audio/aac": "aac", "audio/webm": "webm", "audio/x-m4a": "m4a",
      "audio/3gpp": "3gp", "audio/amr": "amr", "video/mp4": "mp4",
    }[mimeType] || "mp4";
    tempPath = `${FileSystem.cacheDirectory}rec-upload-${Date.now()}.${extension}`;
    try {
      await FileSystem.copyAsync({ from: filePath, to: tempPath });
      uploadPath = tempPath;
    } catch (e) {
      throw new Error("Could not read recording from MediaStore: " + (e?.message || "copy failed"));
    }
  }

  try {
    const info = await FileSystem.getInfoAsync(uploadPath);
    if (!info.exists) throw new Error("Recording file no longer exists at path: " + filePath);
    if (!info.size || info.size < 1024) throw new Error("Recording file is empty or too small: " + info.size + " bytes");

    const result = await FileSystem.uploadAsync(
      `${BASE_URL}/calls/${callId}/recording`,
      uploadPath,
      {
        httpMethod:  "POST",
        uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
        fieldName:   "file",
        headers:     { Authorization: `Bearer ${token}` },
      }
    );

    if (result.status === 200 || result.status === 201) {
      // Strict confirmation: the backend returns {"status":"uploaded","recording_available":true,...}.
      // Anything else — unparseable body, missing flag — is NOT a confirmed upload.
      let parsed = null;
      try { parsed = result.body ? JSON.parse(result.body) : null; } catch { parsed = null; }
      if (!parsed || parsed.status !== "uploaded" || parsed.recording_available !== true) {
        throw new Error("Upload not confirmed by backend (invalid response body)");
      }
      return parsed;
    }
    let detail = "Upload failed";
    try { detail = JSON.parse(result.body)?.detail || detail; } catch {}
    throw new Error(`HTTP ${result.status}: ${detail}`);
  } finally {
    if (tempPath) FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
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

import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { readCallLog, readSimInfo } from "./nativeModules";
import { BASE_URL } from "./api";

const LAST_SYNC_KEY = "callos_last_sync_ts";

// Android CallLog type → our call_type string
const TYPE_MAP = { "1": "incoming", "2": "outgoing", "3": "missed", "5": "rejected" };

/**
 * Read real call log from device and map to the backend sync payload shape.
 * Falls back to empty array if permissions not granted or native module absent.
 */
export async function getRealCallLog(limitDays = 30) {
  const raw = await readCallLog(limitDays);
  return raw.map((c) => {
    const startMs = parseInt(c.date, 10);
    const durationSec = parseInt(c.duration, 10) || 0;
    const startISO = new Date(startMs).toISOString();
    const endISO = durationSec > 0 ? new Date(startMs + durationSec * 1000).toISOString() : null;
    return {
      client_event_id: `android-${c.id}`,
      phone_number: c.number || "unknown",
      contact_name: c.name || null,
      call_type: TYPE_MAP[c.type] ?? "incoming",
      start_time: startISO,
      end_time: endISO,
      duration_seconds: durationSec,
      sim_slot: parseInt(c.simSlot, 10) + 1, // Android is 0-indexed, backend is 1-indexed
      source: `SIM ${parseInt(c.simSlot, 10) + 1}`,
      recording_available: c.hasRecording === "true",
      recording_path: c.recordingPath || null,
    };
  });
}

/**
 * Get only calls newer than the last successful sync timestamp.
 */
export async function getNewCallsSinceLastSync() {
  const ts = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const since = ts ? parseInt(ts, 10) : 0;
  const all = await getRealCallLog(90);
  return all.filter((c) => new Date(c.start_time).getTime() > since);
}

export async function markSyncComplete() {
  await AsyncStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}

/**
 * Upload a recording file to the backend.
 * POST /calls/{callId}/recording  (multipart/form-data)
 * Returns the upload result or null on failure.
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
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    return result.status === 200 ? JSON.parse(result.body) : null;
  } catch {
    return null;
  }
}

/**
 * Read SIM info and return the primary SIM phone number + carrier.
 */
export async function getPrimarySimInfo() {
  const sims = await readSimInfo();
  if (!sims.length) return { sim_phone_number: null, sim_carrier: null };
  const primary = sims.find((s) => s.slot === 0) ?? sims[0];
  return { sim_phone_number: primary.phoneNumber || null, sim_carrier: primary.carrierName || null };
}

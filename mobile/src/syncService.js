import { useEffect, useRef } from "react";
import { AppState, NativeEventEmitter, NativeModules, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { useAuth } from "./AuthContext";
import {
  getRealCallLog,
  getRecentCalls,
  getCallsLastDays,
  applySimFilter,
  findRecordingForCall,
  uploadRecording,
} from "./callLogService";
import {
  upsertCallStatus,
  updateSyncStatus,
  updateRecordingStatus,
  updateTranscriptStatus,
  STATUS,
} from "./callStatusStore";
import {
  setupNotificationChannels,
  requestNotificationPermission,
  notifyCallCompleted,
  notifyRecordingUploading,
  notifyRecordingUploaded,
} from "./notificationManager";
import { checkPermissions, startCallLogObserver, stopCallLogObserver } from "./nativeModules";
import { api, BASE_URL } from "./api";

const BG_TASK_NAME   = "CALLNEXA_BG_SYNC";
const BATCH_SIZE     = 50;
const BATCH_DELAY_MS = 600;
const FALLBACK_POLL_MS = 15_000;

const INSTALL_DATE_KEY   = "callos_install_date";
const RECORDING_PREF_KEY = "callos_recording_enabled";

// ── Recording enabled check ───────────────────────────────────────────────────
// Returns true only when the user has explicitly enabled recording in Settings.
async function isRecordingEnabled() {
  try {
    const val = await AsyncStorage.getItem(RECORDING_PREF_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

// ── Excluded-number check (local cache, refreshed per sync cycle) ─────────────
const EXCLUDED_CACHE_KEY = "callos_excluded_numbers_cache";
const EXCLUDED_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getExcludedNumbers() {
  try {
    const raw = await AsyncStorage.getItem(EXCLUDED_CACHE_KEY);
    if (raw) {
      const { numbers, ts } = JSON.parse(raw);
      if (Date.now() - ts < EXCLUDED_CACHE_TTL) return numbers;
    }
  } catch {}
  // Fetch from backend
  try {
    const res = await api.getExcludedNumbers();
    const numbers = (res?.items || []).map((n) => n.number);
    await AsyncStorage.setItem(EXCLUDED_CACHE_KEY, JSON.stringify({ numbers, ts: Date.now() }));
    return numbers;
  } catch {
    return [];
  }
}

function _normalizePhone(phone) {
  if (!phone || phone === "unknown") return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

async function isExcludedNumber(phoneNumber) {
  if (!phoneNumber || phoneNumber === "unknown") return false;
  const excluded = await getExcludedNumbers();
  const normalized = _normalizePhone(phoneNumber);
  return excluded.some((n) => n === phoneNumber || n === normalized);
}

// ── Install-time cutoff ───────────────────────────────────────────────────────
// Returns the ms timestamp of app installation.
// Written once on first launch (AuthContext.ensureInstallDate), never overwritten.
// On reinstall AsyncStorage is cleared so a new timestamp is written.
export async function getInstallCutoffMs() {
  try {
    const stored = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    if (stored) return new Date(stored).getTime();
  } catch {}
  // Fallback: write now so future calls have a value
  const now = new Date().toISOString();
  try { await AsyncStorage.setItem(INSTALL_DATE_KEY, now); } catch {}
  return Date.now();
}

// ── Session-only dedup set ────────────────────────────────────────────────────
// Tracks client_event_ids confirmed by the backend this session.
// NOT persisted — backend is the source of truth across restarts.
const _sessionConfirmed = new Set();

// ── Battery ───────────────────────────────────────────────────────────────────
async function getBatteryLevel() {
  try {
    const Battery = require("expo-battery");
    const level = await Battery.getBatteryLevelAsync();
    return typeof level === "number" ? Math.round(level * 100) : null;
  } catch { return null; }
}

// ── Direct API sync — no local queue, strict confirmation ────────────────────
/**
 * Syncs a batch of calls directly to the backend.
 * A call is only marked confirmed when the backend response contains
 * status === "accepted" (inserted) or status === "duplicate" (already persisted).
 * Any other response is treated as a failure — no local save, no false sync mark.
 */
async function directSync(deviceId, calls) {
  if (!calls.length) return;

  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);

    batch.forEach(c => updateSyncStatus(c.client_event_id, STATUS.SYNCING, {
      phone_number:     c.phone_number,
      contact_name:     c.contact_name || null,
      call_type:        c.call_type,
      duration_seconds: c.duration_seconds,
      start_time:       c.start_time,
    }));

    const syncUrl = `${BASE_URL}/calls/sync`;
    console.log(`[CALL_SYNC_REQUEST] method=POST url=${syncUrl} batch=${Math.floor(i / BATCH_SIZE) + 1} count=${batch.length} device=${deviceId} ts=${Date.now()}`);

    let res;
    try {
      res = await api.syncCalls(deviceId, batch);
      console.log(`[CALL_SYNC_RESPONSE] url=${syncUrl} status=200 accepted=${res.accepted} dup=${res.duplicates} failed=${res.failed} ts=${Date.now()}`);
    } catch (e) {
      const msg = e?.message || "unknown error";
      const isOffline = msg.includes("Network request failed") ||
                        msg.includes("timed out") ||
                        msg.includes("network") ||
                        msg.includes("internet") ||
                        e?.name === "AbortError";
      const is404    = msg.includes("404") || msg.includes("Not Found");
      const isAuth   = msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized") || msg.includes("Forbidden");
      const isServer = msg.includes("500") || msg.includes("502") || msg.includes("503");

      if (is404) {
        console.warn(`[CALL_SYNC_404] url=${syncUrl} error=${msg} ts=${Date.now()}`);
      } else if (isAuth) {
        console.warn(`[CALL_SYNC_AUTH_ERROR] url=${syncUrl} error=${msg} ts=${Date.now()}`);
      } else if (isServer) {
        console.warn(`[CALL_SYNC_SERVER_ERROR] url=${syncUrl} error=${msg} ts=${Date.now()}`);
      } else if (isOffline) {
        console.warn(`[SYNC_OFFLINE] url=${syncUrl} error=${msg} ts=${Date.now()}`);
      } else {
        console.warn(`[SYNC_FAILED] url=${syncUrl} error=${msg} ts=${Date.now()}`);
      }

      const errStatus = isOffline ? STATUS.SYNC_OFFLINE : STATUS.SYNC_FAILED;
      const errMsg    = isOffline ? "No internet connection — will retry when online" : msg;
      batch.forEach(c => updateSyncStatus(c.client_event_id, errStatus, { last_error: errMsg }));

      if (i + BATCH_SIZE < calls.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      continue;
    }

    // Process per-call results — only accept "accepted" or "duplicate" as confirmed
    const confirmed = [];
    for (const r of (res.results || [])) {
      if (r.status === "accepted") {
        // Backend confirmed INSERT
        console.log(`[BACKEND_INSERT_CONFIRMED] client_event_id=${r.client_event_id} call_id=${r.call_id} ts=${Date.now()}`);
        _sessionConfirmed.add(r.client_event_id);
        updateSyncStatus(r.client_event_id, STATUS.SYNCED, { call_id: r.call_id });
        confirmed.push({ ...batch.find(c => c.client_event_id === r.client_event_id), call_id: r.call_id });
      } else if (r.status === "duplicate") {
        // Backend confirmed already persisted
        console.log(`[BACKEND_DUPLICATE_CONFIRMED] client_event_id=${r.client_event_id} call_id=${r.call_id} ts=${Date.now()}`);
        _sessionConfirmed.add(r.client_event_id);
        updateSyncStatus(r.client_event_id, STATUS.SYNCED, { call_id: r.call_id });
        confirmed.push({ ...batch.find(c => c.client_event_id === r.client_event_id), call_id: r.call_id });
      } else {
        // status === "failed" or unexpected — do NOT mark synced
        console.warn(`[SYNC_FAILED] client_event_id=${r.client_event_id} status=${r.status} error=${r.error || "none"} ts=${Date.now()}`);
        updateSyncStatus(r.client_event_id, STATUS.SYNC_FAILED, { last_error: r.error || "backend rejected" });
      }
    }

    // Handle calls with no result entry (backend didn't return a result for them)
    const resultIds = new Set((res.results || []).map(r => r.client_event_id));
    batch.filter(c => !resultIds.has(c.client_event_id)).forEach(c => {
      console.warn(`[SYNC_FAILED] no result for client_event_id=${c.client_event_id} ts=${Date.now()}`);
      updateSyncStatus(c.client_event_id, STATUS.SYNC_FAILED, { last_error: "no result in backend response" });
    });

    // Notify and kick off recording check for confirmed calls
    for (const c of confirmed) {
      notifyCallCompleted(c).catch(() => {});
      _checkAndUploadRecording(c).catch(() => {});
    }

    if (i + BATCH_SIZE < calls.length) await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
}

// ── Recording upload (with one auto-retry) ───────────────────────────────────
/**
 * PRIVACY RULES enforced before any file is touched:
 *   1. Recording must be explicitly enabled by the user (callos_recording_enabled=true).
 *   2. The call's phone number must not be on the excluded list.
 *   3. The backend also enforces: call must be classified 'business' (HTTP 403 otherwise).
 *
 * Call-log sync is NEVER blocked by these checks — only recording upload is.
 */
async function _checkAndUploadRecording(call, isRetry = false) {
  if (!call.call_id) return;

  // Step 0a: recording must be enabled by the user
  const recEnabled = await isRecordingEnabled();
  if (!recEnabled) {
    console.log(`[RECORDING_SKIPPED] client_event_id=${call.client_event_id} reason=recording_disabled ts=${Date.now()}`);
    updateRecordingStatus(call.client_event_id, STATUS.RECORDING_NOT_AVAILABLE, {
      recording_error: "Recording is disabled in Settings. Enable it to upload recordings.",
    });
    return;
  }

  // Step 0b: excluded-number check
  const excluded = await isExcludedNumber(call.phone_number || call._raw_number);
  if (excluded) {
    console.log(`[RECORDING_SKIPPED] client_event_id=${call.client_event_id} reason=excluded_number ts=${Date.now()}`);
    updateRecordingStatus(call.client_event_id, STATUS.RECORDING_NOT_AVAILABLE, {
      recording_error: "This number is on the excluded list — recording not uploaded.",
    });
    return;
  }

  // Step 1: detect
  updateRecordingStatus(call.client_event_id, STATUS.RECORDING_CHECK);
  const found = await findRecordingForCall(call);

  if (!found) {
    updateRecordingStatus(call.client_event_id, STATUS.RECORDING_NOT_AVAILABLE, {
      recording_error: "Recording unavailable on this device or for this call.",
    });
    return;
  }

  // Step 2: queued — store fingerprint for dedup
  updateRecordingStatus(call.client_event_id, STATUS.RECORDING_QUEUED, {
    recording_path:        found.path,
    recording_fingerprint: found.fingerprint || null,
  });

  // Step 3: get token
  let token = null;
  try { token = await require("expo-secure-store").getItemAsync("callos_token"); } catch {}
  if (!token) token = await AsyncStorage.getItem("callos_token").catch(() => null);
  if (!token) {
    console.warn(`[RECORDING_UPLOAD_FAILED] client_event_id=${call.client_event_id} reason=no_auth_token ts=${Date.now()}`);
    updateRecordingStatus(call.client_event_id, STATUS.RECORDING_FAILED, {
      recording_error: "Authentication token not available.",
    });
    return;
  }

  // Step 4: upload
  updateRecordingStatus(call.client_event_id, STATUS.RECORDING_UPLOADING);
  notifyRecordingUploading({ client_event_id: call.client_event_id, contact_name: null, phone_number: null }).catch(() => {});
  console.log(`[RECORDING_UPLOAD_STARTED] client_event_id=${call.client_event_id} call_id=${call.call_id} size=${found.fileSize} ts=${Date.now()}`);

  let uploadResult;
  try {
    uploadResult = await uploadRecording(call.call_id, found.path, token);
  } catch (e) {
    const errMsg = e?.message || "unknown upload error";
    // HTTP 403 = privacy/excluded block from backend — do not retry
    const isPrivacyBlock = errMsg.includes("403") || errMsg.includes("personal") ||
                           errMsg.includes("unclassified") || errMsg.includes("excluded");
    console.warn(`[RECORDING_UPLOAD_FAILED] client_event_id=${call.client_event_id} call_id=${call.call_id} error=${errMsg} retry=${isRetry} privacy_block=${isPrivacyBlock} ts=${Date.now()}`);
    if (!isRetry && !isPrivacyBlock) {
      console.log(`[RECORDING_UPLOAD_RETRY_SCHEDULED] client_event_id=${call.client_event_id} delay=60s ts=${Date.now()}`);
      setTimeout(() => _checkAndUploadRecording(call, true).catch(() => {}), 60_000);
    } else {
      updateRecordingStatus(call.client_event_id, STATUS.RECORDING_FAILED, {
        recording_error: isPrivacyBlock
          ? "Upload blocked by privacy policy. Classify this call as Business on the dashboard first."
          : errMsg,
      });
    }
    return;
  }

  // Step 5: confirmed
  console.log(`[RECORDING_UPLOAD_CONFIRMED] client_event_id=${call.client_event_id} call_id=${call.call_id} ts=${Date.now()}`);
  updateRecordingStatus(call.client_event_id, STATUS.RECORDING_UPLOADED, {
    call_id:               call.call_id,
    recording_path:        found.path,
    recording_fingerprint: found.fingerprint || null,
    recording_uploaded_at: new Date().toISOString(),
  });
  notifyRecordingUploaded({
    client_event_id: call.client_event_id,
    call_id: call.call_id,
    contact_name: null,
    phone_number: null,
  }).catch(() => {});

  updateTranscriptStatus(call.client_event_id, STATUS.TRANSCRIPTION_PENDING);
}

// ── Main sync cycle ───────────────────────────────────────────────────────────
export async function runSyncCycle(deviceId, mode) {
  if (!deviceId) return;
  try {
    let candidates;
    if (mode === "instant" || mode === "foreground") {
      candidates = await getRecentCalls();
    } else {
      candidates = await getCallsLastDays(7);
    }

    // ── Install-time cutoff ───────────────────────────────────────────────────
    // Never sync calls that existed before this app was installed.
    // Prevents importing the device's full call history on first launch.
    const cutoffMs = await getInstallCutoffMs();
    const afterCutoff = candidates.filter(c => c._start_ms >= cutoffMs);
    const filteredOut = candidates.length - afterCutoff.length;
    if (filteredOut > 0) {
      console.log(`[CALL_SYNC_CUTOFF] mode=${mode} cutoff=${new Date(cutoffMs).toISOString()} filtered_out=${filteredOut} eligible=${afterCutoff.length} ts=${Date.now()}`);
    }

    // Apply SIM filter
    const simFiltered = await applySimFilter(afterCutoff);

    // Filter out calls already confirmed this session
    const newCalls = simFiltered.filter(c => !_sessionConfirmed.has(c.client_event_id));

    if (!newCalls.length) return;

    console.log(`[CALL_SYNC_ELIGIBLE] mode=${mode} new_calls=${newCalls.length} ts=${Date.now()}`);
    newCalls.forEach(c => upsertCallStatus(c.client_event_id, {
      sync_status:      STATUS.DETECTED,
      phone_number:     c.phone_number,
      call_type:        c.call_type,
      duration_seconds: c.duration_seconds,
      start_time:       c.start_time,
    }));

    await directSync(deviceId, newCalls);
  } catch (e) {
    console.warn(`[SYNC_CYCLE_ERROR] mode=${mode} error=${e?.message} ts=${Date.now()}`);
  }
}

// ── Background task ───────────────────────────────────────────────────────────
TaskManager.defineTask(BG_TASK_NAME, async () => {
  try {
    const deviceId = await AsyncStorage.getItem("callos_device_id");
    if (!deviceId) return BackgroundFetch.BackgroundFetchResult.NoData;
    try {
      const perms = await checkPermissions().catch(() => ({}));
      const level = await getBatteryLevel();
      const res = await api.heartbeat(deviceId, {
        is_online: true, battery_level: level,
        permissions_status: { callLog: perms.callLog ?? false, phoneState: perms.phoneState ?? false, contacts: perms.contacts ?? false, recording: perms.recording ?? false },
        background_sync_status: "active",
      });
      if (res?.sync_now) {
        const { doFirstFullSync } = require("./AuthContext");
        doFirstFullSync(deviceId).catch(() => {});
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    } catch {}
    await runSyncCycle(deviceId, "reconcile");
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Restricted || status === BackgroundFetch.BackgroundFetchStatus.Denied) return false;
    await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, { minimumInterval: 15 * 60, stopOnTerminate: false, startOnBoot: true });
    return true;
  } catch (e) {
    if (e.message?.includes("already")) return true;
    return false;
  }
}

// ── useAutoSync hook ──────────────────────────────────────────────────────────
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState       = useRef(AppState.currentState);
  const heartbeatRef   = useRef(null);
  const fallbackRef    = useRef(null);
  const syncingRef     = useRef(false);
  const pendingSyncRef = useRef(false);
  const deviceIdRef    = useRef(deviceId);
  const observerSub    = useRef(null);
  const mountedRef     = useRef(true);

  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;
    mountedRef.current = true;

    setupNotificationChannels();
    requestNotificationPermission();
    registerBackgroundSync();

    async function doHeartbeat() {
      const dId = deviceIdRef.current;
      if (!dId) return;
      try {
        const [perms, battery] = await Promise.all([checkPermissions(), getBatteryLevel()]);
        const res = await api.heartbeat(dId, {
          is_online: true, battery_level: battery,
          permissions_status: { callLog: perms.callLog ?? false, phoneState: perms.phoneState ?? false, contacts: perms.contacts ?? false, recording: perms.recording ?? false },
          background_sync_status: "active", app_version: "1.0.0",
        });
        if (res?.sync_now) {
          const { doFirstFullSync } = require("./AuthContext");
          doFirstFullSync(dId).catch(() => {});
        }
      } catch {}
    }

    async function runSync(mode) {
      if (syncingRef.current) {
        if (mode === "instant") {
          pendingSyncRef.current = true;
          console.log(`[DIRECT_API_SYNC_STARTED] queued pending sync (mode=instant) ts=${Date.now()}`);
        }
        return;
      }
      syncingRef.current = true;
      pendingSyncRef.current = false;
      try {
        console.log(`[DIRECT_API_SYNC_STARTED] mode=${mode} ts=${Date.now()}`);
        await runSyncCycle(deviceIdRef.current, mode);
      } catch (e) {
        console.warn(`[SYNC_CYCLE_ERROR] mode=${mode} error=${e?.message} ts=${Date.now()}`);
      } finally {
        syncingRef.current = false;
        if (pendingSyncRef.current && mountedRef.current) {
          pendingSyncRef.current = false;
          console.log(`[DIRECT_API_SYNC_STARTED] running deferred instant sync ts=${Date.now()}`);
          runSync("instant");
        }
      }
    }

    doHeartbeat();
    runSync("reconcile");

    // PRIMARY: ContentObserver native event
    if (Platform.OS === "android" && NativeModules.CallLogModule) {
      startCallLogObserver().then(started => {
        if (!started) return;
        if (!mountedRef.current) { stopCallLogObserver().catch(() => {}); return; }
        const emitter = new NativeEventEmitter(NativeModules.CallLogModule);
        const sub = emitter.addListener("callLogChanged", (latestId) => {
          console.log(`[CALL_DETECTED] callLogChanged id=${latestId} ts=${Date.now()}`);
          runSync("instant");
        });
        if (mountedRef.current) {
          observerSub.current = sub;
        } else {
          sub.remove();
          stopCallLogObserver().catch(() => {});
        }
      });
    }

    // FALLBACK: 15s poll
    fallbackRef.current = setInterval(() => runSync("foreground"), FALLBACK_POLL_MS);
    heartbeatRef.current = setInterval(doHeartbeat, 60_000);

    const appStateSub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        doHeartbeat();
        runSync("reconcile");
      }
      appState.current = next;
    });

    return () => {
      mountedRef.current = false;
      clearInterval(fallbackRef.current);
      clearInterval(heartbeatRef.current);
      appStateSub.remove();
      observerSub.current?.remove();
      observerSub.current = null;
      stopCallLogObserver().catch(() => {});
    };
  }, [deviceId]);
}

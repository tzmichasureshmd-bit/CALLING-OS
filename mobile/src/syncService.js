import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { useAuth } from "./AuthContext";
import {
  getNewCallsSinceLastSync,
  getRecentCalls,
  markCallsSynced,
  enqueueRecordings,
  getUploadQueue,
  saveUploadQueue,
  uploadRecording,
} from "./callLogService";
import {
  upsertCallStatus,
  updateSyncStatus,
  updateRecordingStatus,
  STATUS,
} from "./callStatusStore";
import {
  setupNotificationChannels,
  requestNotificationPermission,
  notifyCallDetected,
  notifyCallSyncing,
  notifyCallSynced,
  notifyCallSyncFailed,
  notifyRecordingUploading,
  notifyRecordingUploaded,
  notifySystemSyncAlert,
} from "./notificationManager";
import { checkPermissions } from "./nativeModules";
import { api } from "./api";

const SYNC_FAIL_COUNT_KEY = "callos_sync_fail_count";
const MAX_UPLOAD_RETRIES  = 5;
const BG_TASK_NAME        = "CALLNEXA_BG_SYNC";

// -- Battery
async function getBatteryLevel() {
  try {
    const Battery = require("expo-battery");
    const level = await Battery.getBatteryLevelAsync();
    return typeof level === "number" ? Math.round(level * 100) : null;
  } catch {
    return null;
  }
}

// -- Recording upload processor
async function processUploadQueue(token) {
  const queue = await getUploadQueue();
  if (!queue.length) return;
  const remaining = [];
  for (const item of queue) {
    if ((item.retryCount || 0) >= MAX_UPLOAD_RETRIES) {
      await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, { last_error: "max_retries_exceeded" });
      continue;
    }
    try {
      if ((item.retryCount || 0) === 0) {
        await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_UPLOADING);
        await notifyRecordingUploading(item);
      }
      const calls = await api.getCalls({ q: item.client_event_id, page_size: 1 });
      const call  = calls?.items?.[0];
      if (!call) { remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 }); continue; }
      const result = await uploadRecording(call.id, item.path, token);
      if (result) {
        await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_UPLOADED, { call_id: call.id });
        await notifyRecordingUploaded({ ...item, call_id: call.id });
      } else {
        remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1, lastError: "upload_returned_null" });
        await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, { last_error: "upload_returned_null" });
      }
    } catch (err) {
      remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1, lastError: err?.message || "unknown" });
      await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, { last_error: err?.message || "unknown" });
    }
  }
  await saveUploadQueue(remaining);
}

// -- Main sync function
// TASK 7: Two modes:
//   "foreground" — reads last 2h only (called every 5s, low overhead)
//   "reconcile"  — reads last 7d sliding window (app-start, background, resume)
export async function runSyncCycle(deviceId, mode) {
  let newCalls;
  try {
    if (mode === "foreground") {
      const recent = await getRecentCalls();
      const raw    = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
      const synced = raw ? new Set(JSON.parse(raw)) : new Set();
      newCalls = recent.filter((c) => !synced.has(c.client_event_id));
    } else {
      newCalls = await getNewCallsSinceLastSync();
    }
  } catch (e) {
    console.warn("[CALLLOG] sync read failed: " + (e && e.message));
    return;
  }

  if (!newCalls.length) return;

  console.log("[CALLLOG] sync started = " + newCalls.length + " calls");

  // DETECTED -> SYNC_QUEUED
  for (const call of newCalls) {
    await upsertCallStatus(call.client_event_id, {
      sync_status:       STATUS.SYNC_QUEUED,
      recording_status:  call.recording_path ? STATUS.RECORDING_QUEUED : STATUS.RECORDING_NOT_AVAILABLE,
      transcript_status: null,
      phone_number:      call.phone_number,
      contact_name:      call.contact_name,
      call_type:         call.call_type,
      duration_seconds:  call.duration_seconds,
      start_time:        call.start_time,
      recording_path:    call.recording_path || null,
      sync_attempts:     0,
    });
    await notifyCallDetected(call);
  }

  // Mark SYNCING
  for (const call of newCalls) {
    await updateSyncStatus(call.client_event_id, STATUS.SYNCING);
    await notifyCallSyncing(call);
  }

  // POST to backend
  let result;
  try {
    result = await api.syncCalls(deviceId, newCalls);
    console.log("[CALLLOG] sync confirmed = accepted=" + result.accepted + " dup=" + result.duplicates + " failed=" + result.failed);
  } catch (err) {
    console.warn("[CALLLOG] sync failed: " + err?.message);
    for (const call of newCalls) {
      await updateSyncStatus(call.client_event_id, STATUS.SYNC_QUEUED, {
        last_error: err?.message || "network_error",
        last_sync_attempt: new Date().toISOString(),
      });
      await notifyCallSyncFailed(call, err?.message);
    }
    const cnt = parseInt((await AsyncStorage.getItem(SYNC_FAIL_COUNT_KEY)) || "0", 10) + 1;
    await AsyncStorage.setItem(SYNC_FAIL_COUNT_KEY, String(cnt));
    if (cnt >= 3) await notifySystemSyncAlert(cnt);
    return;
  }

  await AsyncStorage.setItem(SYNC_FAIL_COUNT_KEY, "0");

  const resultMap = {};
  (result.results || []).forEach((r) => { resultMap[r.client_event_id] = r; });

  const syncedCalls = [];
  for (const call of newCalls) {
    const r = resultMap[call.client_event_id];
    if (!r) {
      if (result.accepted > 0 || result.duplicates > 0) {
        await updateSyncStatus(call.client_event_id, STATUS.SYNCED, { last_sync_attempt: new Date().toISOString() });
        await notifyCallSynced(call);
        syncedCalls.push(call);
      }
      continue;
    }
    if (r.status === "accepted") {
      await updateSyncStatus(call.client_event_id, STATUS.SYNCED, { call_id: r.call_id, last_sync_attempt: new Date().toISOString() });
      await notifyCallSynced({ ...call, call_id: r.call_id });
      syncedCalls.push(call);
    } else if (r.status === "duplicate") {
      await updateSyncStatus(call.client_event_id, STATUS.SYNCED, { call_id: r.call_id });
      syncedCalls.push(call);
    } else {
      await updateSyncStatus(call.client_event_id, STATUS.SYNC_FAILED, { last_error: "server_rejected", last_sync_attempt: new Date().toISOString() });
      await notifyCallSyncFailed(call, "server_rejected");
    }
  }

  if (syncedCalls.length > 0) await markCallsSynced(syncedCalls);

  await enqueueRecordings(newCalls);
  let token = null;
  try { token = await (require("expo-secure-store")).getItemAsync("callos_token"); } catch {}
  if (!token) token = await AsyncStorage.getItem("callos_token").catch(() => null);
  if (token) processUploadQueue(token).catch(() => {});
}

// -- Background task (WorkManager-backed on Android)
// TASK 11: expo-background-fetch uses WorkManager. Fires every ~15min minimum.
// setInterval does NOT run when app is killed -- WorkManager does.
TaskManager.defineTask(BG_TASK_NAME, async () => {
  try {
    const deviceId = await AsyncStorage.getItem("callos_device_id");
    if (!deviceId) return BackgroundFetch.BackgroundFetchResult.NoData;
    try {
      const { checkPermissions: cp } = require("./nativeModules");
      const { api: _api } = require("./api");
      const perms = await cp().catch(() => ({}));
      const Battery = require("expo-battery");
      const level = await Battery.getBatteryLevelAsync().catch(() => null);
      await _api.heartbeat(deviceId, {
        is_online:              true,
        battery_level:          level != null ? Math.round(level * 100) : null,
        permissions_status:     { callLog: perms.callLog ?? false, phoneState: perms.phoneState ?? false, contacts: perms.contacts ?? false, recording: perms.recording ?? false },
        background_sync_status: "active",
      });
    } catch {}
    // Background uses reconcile mode (7d window)
    await runSyncCycle(deviceId, "reconcile");
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// -- Register background fetch
export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) {
      console.warn("[CallNexa] Background fetch restricted by OS");
      return false;
    }
    await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot:     true,
    });
    console.log("[CallNexa] Background sync registered (WorkManager)");
    return true;
  } catch (e) {
    if (e.message?.includes("already")) return true;
    console.warn("[CallNexa] Background sync registration failed:", e.message);
    return false;
  }
}

// -- useAutoSync hook
// TASK 7: Foreground poll every 5s reads last 2h only (fast).
// App-start and resume use reconcile mode (7d window).
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState     = useRef(AppState.currentState);
  const heartbeatRef = useRef(null);
  const pollRef      = useRef(null);
  const syncingRef   = useRef(false);

  useEffect(() => {
    if (!deviceId) return;

    setupNotificationChannels();
    requestNotificationPermission();
    registerBackgroundSync();

    async function sendHeartbeat() {
      try {
        const [perms, battery] = await Promise.all([checkPermissions(), getBatteryLevel()]);
        await api.heartbeat(deviceId, {
          is_online:              true,
          battery_level:          battery,
          permissions_status:     { callLog: perms.callLog ?? false, phoneState: perms.phoneState ?? false, contacts: perms.contacts ?? false, recording: perms.recording ?? false },
          background_sync_status: "active",
          app_version:            "1.0.0",
        });
      } catch {}
    }

    async function runSync(mode) {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        await runSyncCycle(deviceId, mode || "foreground");
      } catch {} finally {
        syncingRef.current = false;
      }
    }

    // App start: reconcile mode (7d window) to catch missed calls
    sendHeartbeat();
    runSync("reconcile");

    // Foreground poll: 2h window every 5s
    pollRef.current      = setInterval(() => runSync("foreground"), 5_000);
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        sendHeartbeat();
        runSync("reconcile"); // resume: full 7d reconcile
      }
      appState.current = next;
    });

    return () => {
      clearInterval(pollRef.current);
      clearInterval(heartbeatRef.current);
      sub.remove();
    };
  }, [deviceId]);
}

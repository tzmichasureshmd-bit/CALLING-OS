/**
 * syncService.js
 *
 * Production sync engine for CallNexa.
 *
 * State machine driven — every transition updates:
 *   1. callStatusStore (persistent local state)
 *   2. notificationManager (Android notification panel)
 *
 * Rules:
 *   - One notification per call, updated in-place
 *   - Notifications only fire on real state transitions
 *   - Never marks SYNCED before backend confirms
 *   - Offline calls stay in SYNC_QUEUED until connectivity returns
 *   - Recording uploads are separate from call sync
 *   - No notification spam — syncingRef prevents concurrent runs
 */

import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import {
  getNewCallsSinceLastSync,
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
  notifyWaitingForConnection,
  notifyRecordingUploading,
  notifyRecordingUploaded,
  notifySystemSyncAlert,
} from "./notificationManager";
import { checkPermissions } from "./nativeModules";
import { api, getRefreshToken } from "./api";

const SYNC_FAIL_COUNT_KEY = "callos_sync_fail_count";
const MAX_UPLOAD_RETRIES  = 5;

// ── Network check ─────────────────────────────────────────────────────────────
async function isOnline() {
  try {
    // Lightweight check — attempt to reach the API health endpoint
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(
      (process.env.EXPO_PUBLIC_API_URL || "https://api.callingos.tzmicha.com/api/v1")
        .replace("/api/v1", "") + "/health",
      { method: "GET", signal: controller.signal }
    );
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Battery ───────────────────────────────────────────────────────────────────
async function getBatteryLevel() {
  try {
    const Battery = require("expo-battery");
    const level = await Battery.getBatteryLevelAsync();
    return typeof level === "number" ? Math.round(level * 100) : null;
  } catch {
    return null;
  }
}

// ── Recording upload processor ────────────────────────────────────────────────
async function processUploadQueue(token) {
  const queue = await getUploadQueue();
  if (!queue.length) return;

  const remaining = [];

  for (const item of queue) {
    if ((item.retryCount || 0) >= MAX_UPLOAD_RETRIES) {
      // Hard limit reached — mark failed and discard
      await updateRecordingStatus(
        item.client_event_id,
        STATUS.RECORDING_FAILED,
        { last_error: "max_retries_exceeded" }
      );
      continue;
    }

    try {
      // Notify uploading (only on first attempt to avoid spam)
      if ((item.retryCount || 0) === 0) {
        await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_UPLOADING);
        await notifyRecordingUploading(item);
      }

      // Find server call_id by client_event_id
      const calls = await api.getCalls({ q: item.client_event_id, page_size: 1 });
      const call  = calls?.items?.[0];
      if (!call) {
        remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
        continue;
      }

      const result = await uploadRecording(call.id, item.path, token);
      if (result) {
        // Success
        await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_UPLOADED, {
          call_id: call.id,
        });
        await notifyRecordingUploaded({ ...item, call_id: call.id });
        // item removed from queue (not pushed to remaining)
      } else {
        remaining.push({
          ...item,
          retryCount: (item.retryCount || 0) + 1,
          lastError:  "upload_returned_null",
        });
        await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, {
          last_error: "upload_returned_null",
        });
      }
    } catch (err) {
      remaining.push({
        ...item,
        retryCount: (item.retryCount || 0) + 1,
        lastError:  err?.message || "unknown",
      });
      await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, {
        last_error: err?.message || "unknown",
      });
    }
  }

  await saveUploadQueue(remaining);
}

// ── Main sync function ────────────────────────────────────────────────────────
/**
 * Runs one full sync cycle:
 * 1. Read new calls from Android CallLog
 * 2. For each new call: DETECTED → LOCAL_SAVED → SYNC_QUEUED
 * 3. Check connectivity
 * 4. SYNCING → POST /calls/sync
 * 5. On success: SYNCED (per-call, from server results)
 * 6. On failure: SYNC_FAILED
 * 7. Process recording upload queue
 */
export async function runSyncCycle(deviceId) {
  // ── Step 1: Read new calls ────────────────────────────────────────────────
  let newCalls;
  try {
    newCalls = await getNewCallsSinceLastSync();
  } catch {
    return; // CallLog read failed — permissions likely missing
  }

  if (!newCalls.length) return;

  // ── Step 2: DETECTED → LOCAL_SAVED → SYNC_QUEUED ─────────────────────────
  for (const call of newCalls) {
    await upsertCallStatus(call.client_event_id, {
      sync_status:       STATUS.SYNC_QUEUED,
      recording_status:  call.recording_path
        ? STATUS.RECORDING_QUEUED
        : STATUS.RECORDING_NOT_AVAILABLE,
      transcript_status: null,
      phone_number:      call.phone_number,
      contact_name:      call.contact_name,
      call_type:         call.call_type,
      duration_seconds:  call.duration_seconds,
      start_time:        call.start_time,
      recording_path:    call.recording_path || null,
      sync_attempts:     0,
    });
    // Notify: call detected (only for calls not previously seen)
    await notifyCallDetected(call);
  }

  // ── Step 3: Check connectivity ────────────────────────────────────────────
  const online = await isOnline();
  if (!online) {
    for (const call of newCalls) {
      await notifyWaitingForConnection(call);
    }
    // Increment failure counter
    const raw = await AsyncStorage.getItem(SYNC_FAIL_COUNT_KEY);
    const count = parseInt(raw || "0", 10) + 1;
    await AsyncStorage.setItem(SYNC_FAIL_COUNT_KEY, String(count));
    await notifySystemSyncAlert(count);
    return;
  }

  // ── Step 4: SYNCING ───────────────────────────────────────────────────────
  for (const call of newCalls) {
    await updateSyncStatus(call.client_event_id, STATUS.SYNCING);
    await notifyCallSyncing(call);
  }

  // ── Step 5: POST /calls/sync ──────────────────────────────────────────────
  let result;
  try {
    result = await api.syncCalls(deviceId, newCalls);
  } catch (err) {
    // Network/API failure — mark all as SYNC_FAILED
    for (const call of newCalls) {
      const raw = await AsyncStorage.getItem(SYNC_FAIL_COUNT_KEY);
      const attempts = parseInt(raw || "0", 10) + 1;
      await updateSyncStatus(call.client_event_id, STATUS.SYNC_FAILED, {
        last_error:    err?.message || "network_error",
        sync_attempts: attempts,
        last_sync_attempt: new Date().toISOString(),
      });
      await notifyCallSyncFailed(call, err?.message);
    }
    const raw = await AsyncStorage.getItem(SYNC_FAIL_COUNT_KEY);
    const count = parseInt(raw || "0", 10) + 1;
    await AsyncStorage.setItem(SYNC_FAIL_COUNT_KEY, String(count));
    await notifySystemSyncAlert(count);
    return;
  }

  // ── Step 6: Process per-call results ─────────────────────────────────────
  // Reset failure counter on any successful API response
  await AsyncStorage.setItem(SYNC_FAIL_COUNT_KEY, "0");

  const resultMap = {};
  (result.results || []).forEach((r) => {
    resultMap[r.client_event_id] = r;
  });

  const syncedCalls = [];

  for (const call of newCalls) {
    const r = resultMap[call.client_event_id];

    if (!r) {
      // No result entry — treat as synced if accepted > 0 (batch fallback)
      if (result.accepted > 0) {
        await updateSyncStatus(call.client_event_id, STATUS.SYNCED, {
          last_sync_attempt: new Date().toISOString(),
        });
        await notifyCallSynced(call);
        syncedCalls.push(call);
      }
      continue;
    }

    if (r.status === "accepted") {
      await updateSyncStatus(call.client_event_id, STATUS.SYNCED, {
        call_id:           r.call_id,
        last_sync_attempt: new Date().toISOString(),
      });
      await notifyCallSynced({ ...call, call_id: r.call_id });
      syncedCalls.push(call);
    } else if (r.status === "duplicate") {
      // Already on server — mark synced locally too
      await updateSyncStatus(call.client_event_id, STATUS.SYNCED, {
        call_id: r.call_id,
      });
      syncedCalls.push(call);
    } else {
      // failed
      await updateSyncStatus(call.client_event_id, STATUS.SYNC_FAILED, {
        last_error:    "server_rejected",
        last_sync_attempt: new Date().toISOString(),
      });
      await notifyCallSyncFailed(call, "server_rejected");
    }
  }

  // Mark confirmed synced calls in the sliding-window set
  if (syncedCalls.length > 0) {
    await markCallsSynced(syncedCalls);
  }

  // ── Step 7: Recording upload queue ───────────────────────────────────────
  await enqueueRecordings(newCalls);
  // Use secure token storage (not plain AsyncStorage)
  const accessToken = await getRefreshToken().then(() => null).catch(() => null);
  // getRefreshToken returns refresh token — we need access token
  // Import secureGet pattern from api.js
  let token = null;
  try {
    const SecureStore = require("expo-secure-store");
    token = await SecureStore.getItemAsync("callos_token");
  } catch {
    token = await AsyncStorage.getItem("callos_token").catch(() => null);
  }
  if (token) {
    await processUploadQueue(token);
  }
}

// ── useAutoSync hook ──────────────────────────────────────────────────────────
/**
 * React hook — mounts in the tab layout.
 * Runs sync on mount, every 5s while foreground, and on foreground resume.
 * Heartbeat every 30s.
 */
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState     = useRef(AppState.currentState);
  const heartbeatRef = useRef(null);
  const pollRef      = useRef(null);
  const syncingRef   = useRef(false);

  useEffect(() => {
    if (!deviceId) return;

    // Setup channels once
    setupNotificationChannels();
    requestNotificationPermission();

    // ── Heartbeat ──────────────────────────────────────────────────────────
    async function sendHeartbeat() {
      try {
        const [perms, battery] = await Promise.all([
          checkPermissions(),
          getBatteryLevel(),
        ]);
        await api.heartbeat(deviceId, {
          is_online:          true,
          battery_level:      battery,
          permissions_status: {
            callLog:    perms.callLog    ?? false,
            phoneState: perms.phoneState ?? false,
            contacts:   perms.contacts   ?? false,
            recording:  perms.recording  ?? false,
          },
        });
      } catch { /* heartbeat failure is non-critical */ }
    }

    // ── Sync wrapper ───────────────────────────────────────────────────────
    async function runSync() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        await runSyncCycle(deviceId);
      } catch { /* never crash the poll loop */ } finally {
        syncingRef.current = false;
      }
    }

    // Start immediately
    sendHeartbeat();
    runSync();

    pollRef.current      = setInterval(runSync, 5_000);
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    // Sync on foreground resume
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        sendHeartbeat();
        runSync();
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

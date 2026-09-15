import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import { useAuth } from "./AuthContext";
import {
  getRecentCalls,
  getCallsLastDays,
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
  updateTranscriptStatus,
  STATUS,
} from "./callStatusStore";
import {
  setupNotificationChannels,
  requestNotificationPermission,
  notifyCallSyncing,
  notifyCallSynced,
  notifyCallCompleted,
  notifyRecordingUploading,
  notifyRecordingUploaded,
  notifyTranscriptionCompleted,
} from "./notificationManager";
import { checkPermissions } from "./nativeModules";
import { api } from "./api";

const BG_TASK_NAME        = "CALLNEXA_BG_SYNC";
const SYNCED_IDS_KEY      = "callos_synced_ids";
const LAST_SYNC_TS_KEY    = "callos_last_sync_ts";
const LAST_ANDROID_ID_KEY = "callos_last_android_id";
const BATCH_SIZE          = 50;
const BATCH_DELAY_MS      = 600;
const INSTANT_POLL_MS     = 8_000;  // check for new call log entry every 8s

let _lastKnownAndroidId = null;

async function _hasNewCallLogEntry() {
  try {
    const { getLatestCallLogId } = require("./callLogService");
    const latest = await getLatestCallLogId();
    if (!latest) return false;
    if (_lastKnownAndroidId === null) {
      const stored = await AsyncStorage.getItem(LAST_ANDROID_ID_KEY).catch(() => null);
      _lastKnownAndroidId = stored || latest;
      await AsyncStorage.setItem(LAST_ANDROID_ID_KEY, latest);
      return false;
    }
    if (latest !== _lastKnownAndroidId) {
      _lastKnownAndroidId = latest;
      await AsyncStorage.setItem(LAST_ANDROID_ID_KEY, latest);
      return true;
    }
    return false;
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
  } catch { return null; }
}

// ── Filter unsynced calls ─────────────────────────────────────────────────────
async function filterUnsynced(calls) {
  const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY).catch(() => null);
  const synced = raw ? new Set(JSON.parse(raw)) : new Set();
  return calls.filter(c => !synced.has(c.client_event_id));
}

// ── Batch POST to backend ─────────────────────────────────────────────────────
async function batchPost(deviceId, calls) {
  if (!calls.length) return;
  const confirmed = [];
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    // Mark SYNCING in status store before request
    await Promise.all(batch.map(c =>
      updateSyncStatus(c.client_event_id, STATUS.SYNCING, {
        phone_number: c.phone_number,
        contact_name: c.contact_name || null,
        call_type: c.call_type,
        duration_seconds: c.duration_seconds,
        start_time: c.start_time,
      }).catch(() => {})
    ));
    try {
      const res = await api.syncCalls(deviceId, batch);
      if ((res.accepted || 0) + (res.duplicates || 0) > 0) {
        confirmed.push(...batch);
        // Update per-call status with server-assigned call_id
        if (res.results?.length) {
          await Promise.all(res.results.map(r =>
            updateSyncStatus(r.client_event_id, STATUS.SYNCED, { call_id: r.call_id }).catch(() => {})
          ));
        }
        // Fire "CallNexa — New Call" notification for each confirmed call
        await Promise.all(batch.map(c =>
          notifyCallCompleted({ ...c, call_id: res.results?.find(r => r.client_event_id === c.client_event_id)?.call_id }).catch(() => {})
        ));
      } else {
        await Promise.all(batch.map(c =>
          updateSyncStatus(c.client_event_id, STATUS.SYNC_FAILED).catch(() => {})
        ));
      }
      console.log(`[SYNC] batch ${Math.floor(i / BATCH_SIZE) + 1}: +${res.accepted} dup=${res.duplicates} failed=${res.failed}`);
    } catch (e) {
      console.warn(`[SYNC] batch failed: ${e?.message}`);
      await Promise.all(batch.map(c =>
        updateSyncStatus(c.client_event_id, STATUS.SYNC_FAILED, { last_error: e?.message }).catch(() => {})
      ));
    }
    if (i + BATCH_SIZE < calls.length)
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
  if (confirmed.length) {
    await markCallsSynced(confirmed);
    await AsyncStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
  }
}

// ── Recording upload queue ────────────────────────────────────────────────────
async function processUploadQueue(token) {
  const queue = await getUploadQueue();
  if (!queue.length) return;
  const remaining = [];
  const MAX_RETRIES = 5;

  for (const item of queue) {
    if ((item.retryCount || 0) >= MAX_RETRIES) {
      await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, {
        last_error: `Max retries (${MAX_RETRIES}) exceeded`,
      }).catch(() => {});
      continue;
    }

    // Exponential backoff: skip items that failed recently (fixes Bug 4)
    if (item.last_attempt_at && item.retryCount > 0) {
      const backoffMs = Math.min(Math.pow(2, item.retryCount) * 10000, 300000); // 10s, 20s, 40s … max 5min
      const elapsed = Date.now() - new Date(item.last_attempt_at).getTime();
      if (elapsed < backoffMs) {
        remaining.push(item);
        continue;
      }
    }

    // Resolve server call_id: status store first, then backend lookup
    let callId = item.call_id || null;
    if (!callId) {
      try {
        const { getCallStatus } = require("./callStatusStore");
        const st = await getCallStatus(item.client_event_id);
        callId = st?.call_id || null;
      } catch {}
    }
    if (!callId) {
      try {
        const calls = await api.getCalls({ q: item.client_event_id, page_size: 1 });
        callId = calls?.items?.[0]?.id || null;
      } catch {}
    }
    if (!callId) {
      remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1, last_attempt_at: new Date().toISOString() });
      continue;
    }

    // Mark UPLOADING in status store
    await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_UPLOADING).catch(() => {});
    await notifyRecordingUploading({ client_event_id: item.client_event_id, contact_name: null, phone_number: null }).catch(() => {});

    try {
      const result = await uploadRecording(callId, item.path, token);
      // uploadRecording now throws on failure — reaching here means success
      await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_UPLOADED, {
        call_id: callId,
        recording_path: item.path,
      }).catch(() => {});
      await notifyRecordingUploaded({ client_event_id: item.client_event_id, call_id: callId, contact_name: null, phone_number: null }).catch(() => {});

      // Auto-trigger transcription immediately after confirmed upload
      await updateTranscriptStatus(item.client_event_id, STATUS.TRANSCRIPTION_PENDING).catch(() => {});
      _triggerTranscription(callId, item.client_event_id, token).catch(() => {});
    } catch (e) {
      await updateRecordingStatus(item.client_event_id, STATUS.RECORDING_FAILED, {
        last_error: e?.message,
      }).catch(() => {});
      remaining.push({
        ...item,
        call_id: callId,
        retryCount: (item.retryCount || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        last_error: e?.message,
      });
    }
  }
  await saveUploadQueue(remaining);
}

// ── Auto-trigger transcription after confirmed upload ─────────────────────────
async function _triggerTranscription(callId, clientEventId, token) {
  if (!callId || !token) return;
  try {
    const { BASE_URL } = require("./api");
    const resp = await fetch(`${BASE_URL}/transcripts/${callId}/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await resp.json().catch(() => ({}));
    if (resp.ok) {
      await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIBING).catch(() => {});
      console.log(`[TRANSCRIPTION] triggered for call ${callId}: ${data.status}`);
      _pollTranscriptionStatus(callId, clientEventId, token, 0).catch(() => {});
    } else {
      await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIPTION_FAILED).catch(() => {});
      console.warn(`[TRANSCRIPTION] trigger failed for ${callId}: ${data.detail || resp.status}`);
    }
  } catch (e) {
    await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIPTION_FAILED).catch(() => {});
    console.warn(`[TRANSCRIPTION] trigger error: ${e?.message}`);
  }
}

// Active poll set — prevents duplicate polling chains for same call
const _activePolls = new Set();

// Poll backend until transcription completes or fails.
// Extended: up to 40 attempts × 10s = ~6.5 minutes (fixes Bug 6).
// After initial window, marks TRANSCRIPTION_STILL_PROCESSING instead of FAILED.
async function _pollTranscriptionStatus(callId, clientEventId, token, attempt) {
  const MAX_ATTEMPTS      = 40;   // 40 × 10s = ~6.5 min
  const STILL_PROC_AFTER  = 12;   // after 12 attempts (~2 min), show "still processing"
  const pollKey = `${callId}-${clientEventId}`;

  if (attempt === 0) {
    if (_activePolls.has(pollKey)) return;
    _activePolls.add(pollKey);
  }

  if (attempt >= MAX_ATTEMPTS) {
    _activePolls.delete(pollKey);
    // Do NOT mark as failed — backend may still be processing a long recording
    await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIPTION_STILL_PROCESSING).catch(() => {});
    return;
  }

  await new Promise(r => setTimeout(r, 10000));
  try {
    const { BASE_URL } = require("./api");
    const resp = await fetch(`${BASE_URL}/transcripts/${callId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      _pollTranscriptionStatus(callId, clientEventId, token, attempt + 1).catch(() => {});
      return;
    }
    const data = await resp.json().catch(() => ({}));
    const status = data.transcript_status;
    if (status === 'completed') {
      _activePolls.delete(pollKey);
      await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIPTION_COMPLETED).catch(() => {});
      console.log(`[TRANSCRIPTION] completed for call ${callId}`);
      await notifyTranscriptionCompleted({ client_event_id: clientEventId, call_id: callId, contact_name: null }).catch(() => {});
    } else if (status === 'failed') {
      _activePolls.delete(pollKey);
      await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIPTION_FAILED).catch(() => {});
    } else {
      // Still processing — update status label after threshold
      if (attempt >= STILL_PROC_AFTER) {
        await updateTranscriptStatus(clientEventId, STATUS.TRANSCRIPTION_STILL_PROCESSING).catch(() => {});
      }
      _pollTranscriptionStatus(callId, clientEventId, token, attempt + 1).catch(() => {});
    }
  } catch {
    _pollTranscriptionStatus(callId, clientEventId, token, attempt + 1).catch(() => {});
  }
}

// ── Main sync cycle ─────────────────────────────────────────────────────────
// instant    = new call log entry detected — sync immediately
// foreground = last 2h fallback while app open
// reconcile  = since last sync ts (app-start / resume / background)
export async function runSyncCycle(deviceId, mode) {
  if (!deviceId) return;
  try {
    let candidates;
    if (mode === "instant" || mode === "foreground") {
      candidates = await getRecentCalls();
    } else {
      const lastTs = await AsyncStorage.getItem(LAST_SYNC_TS_KEY).catch(() => null);
      const msSince = lastTs ? Date.now() - parseInt(lastTs) : 24 * 60 * 60 * 1000;
      const daysSince = Math.min(30, Math.max(2 / 24, msSince / 86400000 + 0.05));
      candidates = await getCallsLastDays(daysSince);
    }

    // Apply selected-SIM filter before sync
    let filtered = candidates;
    try {
      const { getSelectedSimIdentity } = require("./callLogService");
      const { subscriptionId: selSubId, slot: selSlot } = await getSelectedSimIdentity();
      if (selSubId !== null || selSlot !== null) {
        filtered = candidates.filter((c) => {
          if (selSubId && c.subscription_id) return c.subscription_id === selSubId;
          if (selSlot !== null && c.sim_slot !== null) return c.sim_slot === selSlot + 1;
          return true;
        });
      }
    } catch { /* fallback: use all candidates */ }

    const newCalls = await filterUnsynced(filtered);
    if (!newCalls.length) return;

    console.log(`[SYNC] ${mode}: ${newCalls.length} new calls`);
    await batchPost(deviceId, newCalls);
    await enqueueRecordings(newCalls);

    let token = null;
    try { token = await require("expo-secure-store").getItemAsync("callos_token"); } catch {}
    if (!token) token = await AsyncStorage.getItem("callos_token").catch(() => null);
    if (token) processUploadQueue(token).catch(() => {});
  } catch (e) {
    console.warn(`[SYNC] runSyncCycle error: ${e?.message}`);
  }
}

// ── Background task (WorkManager) ────────────────────────────────────────────
TaskManager.defineTask(BG_TASK_NAME, async () => {
  try {
    const deviceId = await AsyncStorage.getItem("callos_device_id");
    if (!deviceId) return BackgroundFetch.BackgroundFetchResult.NoData;
    try {
      const perms = await checkPermissions().catch(() => ({}));
      const level = await getBatteryLevel();
      const res = await api.heartbeat(deviceId, {
        is_online: true,
        battery_level: level,
        permissions_status: {
          callLog: perms.callLog ?? false,
          phoneState: perms.phoneState ?? false,
          contacts: perms.contacts ?? false,
          recording: perms.recording ?? false,
        },
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

// ── Register background fetch ─────────────────────────────────────────────────
export async function registerBackgroundSync() {
  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Restricted ||
      status === BackgroundFetch.BackgroundFetchStatus.Denied
    ) return false;
    await BackgroundFetch.registerTaskAsync(BG_TASK_NAME, {
      minimumInterval: 15 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (e) {
    if (e.message?.includes("already")) return true;
    return false;
  }
}

// ── useAutoSync hook ──────────────────────────────────────────────────────────
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState     = useRef(AppState.currentState);
  const heartbeatRef = useRef(null);
  const pollRef      = useRef(null);
  const syncingRef   = useRef(false);
  const deviceIdRef  = useRef(deviceId);

  // Keep ref in sync so AppState closure always has latest deviceId
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);

  useEffect(() => {
    if (!deviceId) return;

    setupNotificationChannels();
    requestNotificationPermission();
    registerBackgroundSync();

    async function doHeartbeat() {
      const dId = deviceIdRef.current;
      if (!dId) return;
      try {
        const [perms, battery] = await Promise.all([checkPermissions(), getBatteryLevel()]);
        const res = await api.heartbeat(dId, {
          is_online: true,
          battery_level: battery,
          permissions_status: {
            callLog:    perms.callLog    ?? false,
            phoneState: perms.phoneState ?? false,
            contacts:   perms.contacts   ?? false,
            recording:  perms.recording  ?? false,
          },
          background_sync_status: "active",
          app_version: "1.0.0",
        });
        if (res?.sync_now) {
          console.log("[SYNC] sync_now received from server — triggering full sync");
          const { doFirstFullSync } = require("./AuthContext");
          doFirstFullSync(dId).catch(() => {});
        }
      } catch {}
    }

    async function runSync(mode) {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try { await runSyncCycle(deviceIdRef.current, mode); }
      catch {} finally { syncingRef.current = false; }
    }

    doHeartbeat();
    runSync("reconcile");

    // Instant detection: poll call log ID every 8s.
    // The moment Android writes a new call log entry (seconds after call ends)
    // _hasNewCallLogEntry() returns true and we sync immediately.
    pollRef.current = setInterval(async () => {
      const hasNew = await _hasNewCallLogEntry();
      if (hasNew) {
        console.log("[SYNC] new call log entry — instant sync");
        runSync("instant");
      } else {
        runSync("foreground");
      }
    }, INSTANT_POLL_MS);
    heartbeatRef.current = setInterval(doHeartbeat, 60_000);

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        doHeartbeat();
        runSync("reconcile");
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

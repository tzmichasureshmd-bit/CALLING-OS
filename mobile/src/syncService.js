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
  setupNotificationChannels,
  requestNotificationPermission,
} from "./notificationManager";
import { checkPermissions } from "./nativeModules";
import { api } from "./api";

const BG_TASK_NAME     = "CALLNEXA_BG_SYNC";
const SYNCED_IDS_KEY   = "callos_synced_ids";
const LAST_SYNC_TS_KEY = "callos_last_sync_ts";
const BATCH_SIZE       = 50;
const BATCH_DELAY_MS   = 600;

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
    try {
      const res = await api.syncCalls(deviceId, batch);
      // Only mark synced if server confirmed (accepted or duplicate = already in DB)
      if ((res.accepted || 0) + (res.duplicates || 0) > 0) {
        confirmed.push(...batch);
      }
      console.log(`[SYNC] batch ${Math.floor(i / BATCH_SIZE) + 1}: +${res.accepted} dup=${res.duplicates} failed=${res.failed}`);
    } catch (e) {
      console.warn(`[SYNC] batch failed: ${e?.message}`);
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
  for (const item of queue) {
    if ((item.retryCount || 0) >= 3) continue;
    try {
      const calls = await api.getCalls({ q: item.client_event_id, page_size: 1 });
      const call  = calls?.items?.[0];
      if (!call) { remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 }); continue; }
      const result = await uploadRecording(call.id, item.path, token);
      if (!result) remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
    } catch {
      remaining.push({ ...item, retryCount: (item.retryCount || 0) + 1 });
    }
  }
  await saveUploadQueue(remaining);
}

// ── Main sync cycle ───────────────────────────────────────────────────────────
// foreground = last 2h only (every 30s while app open)
// reconcile  = since last sync ts (app-start / resume / background)
export async function runSyncCycle(deviceId, mode) {
  if (!deviceId) return;
  try {
    let candidates;
    if (mode === "foreground") {
      candidates = await getRecentCalls();
    } else {
      const lastTs = await AsyncStorage.getItem(LAST_SYNC_TS_KEY).catch(() => null);
      const msSince = lastTs ? Date.now() - parseInt(lastTs) : 24 * 60 * 60 * 1000;
      // Look back at least 2h, at most 2 days
      const daysSince = Math.min(2, Math.max(2 / 24, msSince / 86400000 + 0.05));
      candidates = await getCallsLastDays(daysSince);
    }

    const newCalls = await filterUnsynced(candidates);
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
      await api.heartbeat(deviceId, {
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

  useEffect(() => {
    if (!deviceId) return;

    setupNotificationChannels();
    requestNotificationPermission();
    registerBackgroundSync();

    async function sendHeartbeat() {
      try {
        const [perms, battery] = await Promise.all([checkPermissions(), getBatteryLevel()]);
        await api.heartbeat(deviceId, {
          is_online: true,
          battery_level: battery,
          permissions_status: {
            callLog: perms.callLog ?? false,
            phoneState: perms.phoneState ?? false,
            contacts: perms.contacts ?? false,
            recording: perms.recording ?? false,
          },
          background_sync_status: "active",
          app_version: "1.0.0",
        });
      } catch {}
    }

    async function runSync(mode) {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try { await runSyncCycle(deviceId, mode); }
      catch {} finally { syncingRef.current = false; }
    }

    sendHeartbeat();
    runSync("reconcile");

    pollRef.current      = setInterval(() => runSync("foreground"), 30_000);
    heartbeatRef.current = setInterval(sendHeartbeat, 60_000);

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        sendHeartbeat();
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

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { getNewCallsSinceLastSync, markSyncComplete, uploadRecording } from "./callLogService";
import { checkPermissions } from "./nativeModules";
import { api } from "./api";

const UPLOAD_QUEUE_KEY = "callos_upload_queue";

async function getBatteryLevel() {
  try {
    const Battery = require("expo-battery");
    const level = await Battery.getBatteryLevelAsync();
    return Math.round((level ?? 0) * 100);
  } catch { return null; }
}

async function getUploadQueue() {
  try {
    const q = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
    return q ? JSON.parse(q) : [];
  } catch { return []; }
}

async function saveUploadQueue(queue) {
  await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
}

async function processUploadQueue(token) {
  const queue = await getUploadQueue();
  if (!queue.length) return;

  const remaining = [];
  for (const item of queue) {
    try {
      const calls = await api.getCalls({ q: item.client_event_id, page_size: 1 });
      const call = calls?.items?.[0];
      if (!call) { remaining.push(item); continue; }
      const result = await uploadRecording(call.id, item.path, token);
      if (!result) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }
  await saveUploadQueue(remaining);
}

/**
 * Hook — call once inside the tab layout.
 * - Heartbeat every 30s: battery + permissions → backend
 * - Auto-syncs call log on foreground
 * - Processes pending recording uploads
 */
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState = useRef(AppState.currentState);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    if (!deviceId) return;

    async function sendHeartbeat() {
      try {
        const [perms, battery] = await Promise.all([
          checkPermissions(),
          getBatteryLevel(),
        ]);
        await api.heartbeat(deviceId, {
          is_online: true,
          battery_level: battery,
          permissions_status: {
            callLog:    perms.callLog    ?? false,
            phoneState: perms.phoneState ?? false,
            contacts:   perms.contacts   ?? false,
            recording:  perms.recording  ?? false,
          },
        });
      } catch { /* silent */ }
    }

    async function runSync() {
      try {
        const calls = await getNewCallsSinceLastSync();
        if (calls.length) {
          const result = await api.syncCalls(deviceId, calls);
          if (result.accepted > 0) await markSyncComplete();

          const withRecordings = calls.filter((c) => c.recording_available && c.recording_path);
          if (withRecordings.length) {
            const queue = await getUploadQueue();
            await saveUploadQueue([...queue, ...withRecordings.map((c) => ({
              client_event_id: c.client_event_id,
              path: c.recording_path,
            }))]);
          }
          const token = await AsyncStorage.getItem("callos_token");
          if (token) await processUploadQueue(token);
        }
      } catch { /* silent */ }
    }

    // Send heartbeat immediately on mount, then every 30s
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    // Sync calls on mount
    runSync();

    // Sync calls + heartbeat on foreground
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        sendHeartbeat();
        runSync();
      }
      appState.current = next;
    });

    return () => {
      clearInterval(heartbeatRef.current);
      sub.remove();
    };
  }, [deviceId]);
}

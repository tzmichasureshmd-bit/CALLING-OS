import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { getNewCallsSinceLastSync, markSyncComplete, uploadRecording } from "./callLogService";
import { api } from "./api";

const UPLOAD_QUEUE_KEY = "callos_upload_queue";

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
      // Resolve call ID from backend using client_event_id
      const calls = await api.getCalls({ q: item.client_event_id, page_size: 1 });
      const call = calls?.items?.[0];
      if (!call) { remaining.push(item); continue; }

      const result = await uploadRecording(call.id, item.path, token);
      if (!result) remaining.push(item); // retry next time
    } catch {
      remaining.push(item); // retry next time
    }
  }
  await saveUploadQueue(remaining);
}

/**
 * Hook — call once inside the tab layout.
 * Auto-syncs call log whenever app comes to foreground.
 * Also processes pending recording uploads.
 */
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (!deviceId) return;

    async function runSync() {
      try {
        const calls = await getNewCallsSinceLastSync();
        if (!calls.length) return;

        const result = await api.syncCalls(deviceId, calls);
        if (result.accepted > 0) await markSyncComplete();

        // Queue recordings for upload
        const withRecordings = calls.filter((c) => c.recording_available && c.recording_path);
        if (withRecordings.length) {
          const queue = await getUploadQueue();
          const newItems = withRecordings.map((c) => ({
            client_event_id: c.client_event_id,
            path: c.recording_path,
          }));
          await saveUploadQueue([...queue, ...newItems]);
        }

        // Process upload queue (recordings)
        const token = await AsyncStorage.getItem("callos_token");
        if (token) await processUploadQueue(token);
      } catch {
        // Silent — will retry next foreground
      }
    }

    runSync();

    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        runSync();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [deviceId]);
}

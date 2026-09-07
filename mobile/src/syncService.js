import { useEffect, useRef } from "react";
import { AppState, Platform, NativeModules } from "react-native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useAuth } from "./AuthContext";
import { getNewCallsSinceLastSync, markSyncComplete, uploadRecording } from "./callLogService";
import { checkPermissions } from "./nativeModules";
import { api } from "./api";

const UPLOAD_QUEUE_KEY = "callos_upload_queue";
const LAST_NOTIF_KEY   = "callos_last_notif_id";

// ── Notification setup ────────────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge:  true,
  }),
});

export async function setupNotifications() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("calls", {
    name:       "Call Sync",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 150],
    lightColor: "#14b8a6",
  });
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function showCallNotification(call) {
  const typeLabel =
    call.call_type === "incoming" ? "📞 Incoming"
    : call.call_type === "outgoing" ? "📤 Outgoing"
    : call.call_type === "missed"   ? "📵 Missed"
    : "📞 Call";

  const name = call.contact_name || call.phone_number;
  const dur  = call.duration_seconds > 0
    ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s`
    : "";

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${typeLabel} · ${name}`,
      body:  dur ? `Duration: ${dur} · Synced to dashboard` : "Synced to dashboard",
      data:  { callId: call.client_event_id },
      ...(Platform.OS === "android" && { channelId: "calls" }),
    },
    trigger: null, // show immediately
  });
}

// ── Upload queue ──────────────────────────────────────────────────────────────
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
      const call  = calls?.items?.[0];
      if (!call) { remaining.push(item); continue; }
      const result = await uploadRecording(call.id, item.path, token);
      if (!result) remaining.push(item);
    } catch { remaining.push(item); }
  }
  await saveUploadQueue(remaining);
}

// ── Location + WiFi ──────────────────────────────────────────────────────────
async function getLocationAndWifi() {
  const result = { latitude: null, longitude: null, location_accuracy: null, wifi_ssid: null };
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === "granted") {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      result.latitude          = loc.coords.latitude;
      result.longitude         = loc.coords.longitude;
      result.location_accuracy = loc.coords.accuracy;
    }
  } catch { /* silent */ }
  try {
    const wifi = NativeModules.WifiManager || NativeModules.RNWifi;
    if (wifi?.getSSID) {
      result.wifi_ssid = await new Promise((res) => wifi.getSSID(res, () => res(null)));
    }
  } catch { /* silent */ }
  return result;
}

// ── Battery ───────────────────────────────────────────────────────────────────
async function getBatteryLevel() {
  try {
    const Battery = require("expo-battery");
    const level = await Battery.getBatteryLevelAsync();
    return typeof level === "number" ? Math.round(level * 100) : null;
  } catch { return null; }
}

// ── Main hook ─────────────────────────────────────────────────────────────────
/**
 * - Polls for new calls every 5 seconds (instant detection after any call)
 * - Shows Android notification for each new call synced
 * - Heartbeat every 30s: battery + permissions → backend
 * - Syncs on foreground resume
 */
export function useAutoSync() {
  const { deviceId } = useAuth();
  const appState     = useRef(AppState.currentState);
  const heartbeatRef = useRef(null);
  const pollRef      = useRef(null);

  useEffect(() => {
    if (!deviceId) return;

    setupNotifications();

    // ── Heartbeat ──────────────────────────────────────────────────────────
    async function sendHeartbeat() {
      try {
        const [perms, battery, loc] = await Promise.all([
          checkPermissions(),
          getBatteryLevel(),
          getLocationAndWifi(),
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
          latitude:          loc.latitude,
          longitude:         loc.longitude,
          location_accuracy: loc.location_accuracy,
          wifi_ssid:         loc.wifi_ssid,
        });
      } catch { /* silent */ }
    }

    // ── Sync + notify ──────────────────────────────────────────────────────
    async function runSync() {
      try {
        const newCalls = await getNewCallsSinceLastSync();
        if (!newCalls.length) return;

        const result = await api.syncCalls(deviceId, newCalls);
        if (result.accepted > 0) {
          await markSyncComplete();

          // Show notification for each new call
          for (const call of newCalls) {
            await showCallNotification(call);
          }

          // Queue recordings
          const withRec = newCalls.filter((c) => c.recording_available && c.recording_path);
          if (withRec.length) {
            const queue = await getUploadQueue();
            await saveUploadQueue([...queue, ...withRec.map((c) => ({
              client_event_id: c.client_event_id,
              path: c.recording_path,
            }))]);
          }
          const token = await AsyncStorage.getItem("callos_token");
          if (token) await processUploadQueue(token);
        }
      } catch { /* silent */ }
    }

    // Start immediately
    sendHeartbeat();
    runSync();

    // Poll every 5 seconds for new calls (catches calls made in any dialer)
    pollRef.current = setInterval(runSync, 5_000);

    // Heartbeat every 30 seconds
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);

    // Also sync on foreground
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

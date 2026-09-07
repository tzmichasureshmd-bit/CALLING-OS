/**
 * notificationManager.js
 *
 * Production notification system for CallNexa.
 *
 * Channels:
 *   call_status    — HIGH importance, heads-up for call detected/synced
 *   sync_status    — DEFAULT importance, sync progress
 *   recording      — LOW importance, recording upload status
 *   system_alerts  — HIGH importance, errors requiring user action
 *
 * Rules:
 *   - One notification per call, updated in-place (stable identifier)
 *   - No notification spam — state must actually change to trigger update
 *   - Respects user notification preferences stored in AsyncStorage
 *   - Lock screen shows minimal info (no phone numbers)
 */

import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { STATUS } from "./callStatusStore";

// ── Preference keys ───────────────────────────────────────────────────────────
const PREF_CALL_NOTIF    = "callos_notif_calls";
const PREF_SYNC_NOTIF    = "callos_notif_sync";
const PREF_REC_NOTIF     = "callos_notif_recording";
const PREF_TRANS_NOTIF   = "callos_notif_transcription";

// ── Notification handler (must be set before any scheduling) ──────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge:  false,
  }),
});

// ── Channel setup ─────────────────────────────────────────────────────────────
export async function setupNotificationChannels() {
  if (Platform.OS !== "android") return;

  await Promise.all([
    Notifications.setNotificationChannelAsync("call_status", {
      name:             "Call Status",
      description:      "Notifications when calls are detected and synced",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200],
      lightColor:       "#14b8a6",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync("sync_status", {
      name:             "Sync Status",
      description:      "Background synchronization progress",
      importance:       Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0],
      lightColor:       "#8b5cf6",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync("recording", {
      name:             "Recording Upload",
      description:      "Call recording upload status",
      importance:       Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      lightColor:       "#22d3ee",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    }),
    Notifications.setNotificationChannelAsync("system_alerts", {
      name:             "System Alerts",
      description:      "Important issues requiring your attention",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 100, 300],
      lightColor:       "#ef4444",
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }),
  ]);
}

// ── Permission request ────────────────────────────────────────────────────────
export async function requestNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return "granted";
  if (existing === "denied") return "denied";  // permanently denied — don't re-ask
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function getNotificationPermissionStatus() {
  const { status } = await Notifications.getPermissionsAsync();
  return status; // "granted" | "denied" | "undetermined"
}

// ── Preferences ───────────────────────────────────────────────────────────────
export async function getNotificationPreferences() {
  const [calls, sync, recording, transcription] = await Promise.all([
    AsyncStorage.getItem(PREF_CALL_NOTIF),
    AsyncStorage.getItem(PREF_SYNC_NOTIF),
    AsyncStorage.getItem(PREF_REC_NOTIF),
    AsyncStorage.getItem(PREF_TRANS_NOTIF),
  ]);
  return {
    calls:         calls         !== "false",  // default ON
    sync:          sync          !== "false",  // default ON
    recording:     recording     !== "false",  // default ON
    transcription: transcription !== "false",  // default ON
  };
}

export async function setNotificationPreference(key, value) {
  const keyMap = {
    calls:         PREF_CALL_NOTIF,
    sync:          PREF_SYNC_NOTIF,
    recording:     PREF_REC_NOTIF,
    transcription: PREF_TRANS_NOTIF,
  };
  if (keyMap[key]) {
    await AsyncStorage.setItem(keyMap[key], String(value));
  }
}

// ── Stable notification identifier ───────────────────────────────────────────
// expo-notifications uses string identifiers for cancellation but integer for
// Android notification ID. We derive a stable integer from the client_event_id.
function _notifId(clientEventId) {
  // Simple hash to integer — stable for same input
  let hash = 0;
  for (let i = 0; i < clientEventId.length; i++) {
    hash = ((hash << 5) - hash + clientEventId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function _notifIdentifier(clientEventId) {
  return `callos-call-${clientEventId}`;
}

// ── Call type labels ──────────────────────────────────────────────────────────
function _typeLabel(callType) {
  switch (callType) {
    case "incoming": return "📞 Incoming";
    case "outgoing": return "📤 Outgoing";
    case "missed":   return "📵 Missed";
    case "rejected": return "🚫 Rejected";
    default:         return "📞 Call";
  }
}

function _fmtDuration(seconds) {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

// ── Core notification scheduler ───────────────────────────────────────────────
async function _schedule(identifier, content, channelId) {
  try {
    // Cancel existing notification with same identifier before re-scheduling
    await Notifications.dismissNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        ...content,
        ...(Platform.OS === "android" && { channelId }),
      },
      trigger: null, // immediate
    });
  } catch { /* notification failure must never crash the sync engine */ }
}

// ── Public notification functions ─────────────────────────────────────────────

/**
 * Show "Call detected" — fires immediately when a new call is found in CallLog.
 */
export async function notifyCallDetected(call) {
  const prefs = await getNotificationPreferences();
  if (!prefs.calls) return;

  const name = call.contact_name || call.phone_number || "Unknown";
  const typeLabel = _typeLabel(call.call_type);

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: `${typeLabel} call detected`,
      body:  `${name} · Preparing to sync…`,
      data:  { clientEventId: call.client_event_id, screen: "call_detail" },
      // Lock screen shows generic text — no phone number
      android: { publicVersion: { title: "CallNexa", body: "Call detected" } },
    },
    "call_status"
  );
}

/**
 * Show "Syncing call…" — fires when sync request is sent to backend.
 */
export async function notifyCallSyncing(call) {
  const prefs = await getNotificationPreferences();
  if (!prefs.sync) return;

  const name = call.contact_name || call.phone_number || "Unknown";
  const typeLabel = _typeLabel(call.call_type);

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: `${typeLabel} · Syncing…`,
      body:  `${name} · Uploading to dashboard`,
      data:  { clientEventId: call.client_event_id, screen: "call_detail" },
      android: { publicVersion: { title: "CallNexa", body: "Syncing call…" } },
    },
    "sync_status"
  );
}

/**
 * Show "Call synced ✓" — fires ONLY after backend confirms acceptance.
 */
export async function notifyCallSynced(call) {
  const prefs = await getNotificationPreferences();
  if (!prefs.calls) return;

  const name = call.contact_name || call.phone_number || "Unknown";
  const typeLabel = _typeLabel(call.call_type);
  const dur = _fmtDuration(call.duration_seconds);

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: `${typeLabel} synced ✓`,
      body:  dur ? `${name} · ${dur}` : `${name} · Synced to dashboard`,
      data:  { clientEventId: call.client_event_id, callId: call.call_id, screen: "call_detail" },
      android: { publicVersion: { title: "CallNexa", body: "Call synced successfully" } },
    },
    "call_status"
  );
}

/**
 * Show "Sync failed" — fires after a sync failure.
 */
export async function notifyCallSyncFailed(call, errorMsg) {
  const prefs = await getNotificationPreferences();
  if (!prefs.sync) return;

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: "Call sync failed",
      body:  "Saved locally · will retry automatically when connected",
      data:  { clientEventId: call.client_event_id, screen: "sync_health" },
      android: { publicVersion: { title: "CallNexa", body: "Call sync failed" } },
    },
    "system_alerts"
  );
}

/**
 * Show "Waiting for internet" — fires when offline during sync attempt.
 */
export async function notifyWaitingForConnection(call) {
  const prefs = await getNotificationPreferences();
  if (!prefs.sync) return;

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: "Call saved · waiting for internet",
      body:  "Will sync automatically when connection is restored",
      data:  { clientEventId: call.client_event_id, screen: "sync_health" },
      android: { publicVersion: { title: "CallNexa", body: "Waiting for internet" } },
    },
    "sync_status"
  );
}

/**
 * Show "Recording uploading…"
 */
export async function notifyRecordingUploading(call) {
  const prefs = await getNotificationPreferences();
  if (!prefs.recording) return;

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: "Recording uploading…",
      body:  `${call.contact_name || call.phone_number || "Call"} · Uploading audio`,
      data:  { clientEventId: call.client_event_id, screen: "call_detail" },
      android: { publicVersion: { title: "CallNexa", body: "Uploading recording…" } },
    },
    "recording"
  );
}

/**
 * Show "Recording uploaded ✓"
 */
export async function notifyRecordingUploaded(call) {
  const prefs = await getNotificationPreferences();
  if (!prefs.recording) return;

  await _schedule(
    _notifIdentifier(call.client_event_id),
    {
      title: "Recording uploaded ✓",
      body:  `${call.contact_name || call.phone_number || "Call"} · Audio available on dashboard`,
      data:  { clientEventId: call.client_event_id, callId: call.call_id, screen: "call_detail" },
      android: { publicVersion: { title: "CallNexa", body: "Recording uploaded" } },
    },
    "recording"
  );
}

/**
 * Show persistent system alert when sync fails 3+ times in a row.
 */
export async function notifySystemSyncAlert(failCount) {
  if (failCount < 3) return;
  await _schedule(
    "callos-system-sync-alert",
    {
      title: "⚠️ CallNexa: Sync not working",
      body:  "Calls are not syncing. Open the app to check your connection.",
      data:  { screen: "sync_health" },
    },
    "system_alerts"
  );
}

/**
 * Dismiss the notification for a specific call (e.g. when user views it).
 */
export async function dismissCallNotification(clientEventId) {
  try {
    await Notifications.dismissNotificationAsync(_notifIdentifier(clientEventId));
  } catch { /* ignore */ }
}

/**
 * Dismiss all CallNexa notifications.
 */
export async function dismissAllNotifications() {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch { /* ignore */ }
}

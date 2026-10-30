import { NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { callRecorder } from "./callRecorder";
import { updateRecordingStatus, STATUS } from "./callStatusStore";

const RECORDING_ENABLED_KEY = "callos_recording_enabled";

// Track active recordings by phone number
const _activeRecordings = new Map();

/**
 * Enable automatic call recording
 */
export async function enableAutoRecording() {
  try {
    const perms = await callRecorder.checkPermissions();
    if (!perms.recordAudioGranted || !perms.phoneStateGranted) {
      console.warn("[RECORDER] Missing permissions for recording");
      return false;
    }
    await AsyncStorage.setItem(RECORDING_ENABLED_KEY, "true");
    console.log("[RECORDER] Auto-recording enabled");
    return true;
  } catch (e) {
    console.error("[RECORDER] Error enabling: " + e?.message);
    return false;
  }
}

/**
 * Disable automatic call recording
 */
export async function disableAutoRecording() {
  try {
    await AsyncStorage.setItem(RECORDING_ENABLED_KEY, "false");
    console.log("[RECORDER] Auto-recording disabled");
    return true;
  } catch (e) {
    console.error("[RECORDER] Error disabling: " + e?.message);
    return false;
  }
}

/**
 * Check if auto-recording is enabled
 */
export async function isAutoRecordingEnabled() {
  try {
    const val = await AsyncStorage.getItem(RECORDING_ENABLED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/**
 * Start recording a call
 * Called when call is detected
 */
export async function startCallRecording(phoneNumber, clientEventId) {
  try {
    const enabled = await isAutoRecordingEnabled();
    if (!enabled) {
      console.log("[RECORDER] Auto-recording disabled, skipping");
      return null;
    }

    console.log(`[RECORDER_START] phone=${phoneNumber} eventId=${clientEventId}`);

    const result = await callRecorder.startRecording(phoneNumber);
    
    if (result.success) {
      _activeRecordings.set(phoneNumber, {
        filepath: result.filepath,
        clientEventId: clientEventId,
        startedAt: Date.now(),
      });

      updateRecordingStatus(clientEventId, STATUS.RECORDING_ACTIVE, {
        filepath: result.filepath,
      }).catch(() => {});

      console.log(`[RECORDER_STARTED] filepath=${result.filepath}`);
      return result.filepath;
    } else {
      console.warn("[RECORDER_ERROR] Failed to start: " + result.error);
      return null;
    }
  } catch (e) {
    console.error("[RECORDER_ERROR] " + e?.message);
    return null;
  }
}

/**
 * Stop recording a call
 * Called when call ends
 */
export async function stopCallRecording(phoneNumber, clientEventId) {
  try {
    if (!_activeRecordings.has(phoneNumber)) {
      console.log(`[RECORDER] No active recording for ${phoneNumber}`);
      return null;
    }

    console.log(`[RECORDER_STOP] phone=${phoneNumber}`);

    const result = await callRecorder.stopRecording();

    if (result.success && result.filepath) {
      _activeRecordings.delete(phoneNumber);

      updateRecordingStatus(clientEventId, STATUS.RECORDING_QUEUED, {
        filepath: result.filepath,
      }).catch(() => {});

      console.log(`[RECORDER_STOPPED] filepath=${result.filepath}`);
      return result.filepath;
    } else {
      console.warn("[RECORDER_ERROR] Failed to stop");
      return null;
    }
  } catch (e) {
    console.error("[RECORDER_ERROR] " + e?.message);
    return null;
  }
}

/**
 * Get active recordings
 */
export async function getActiveRecordings() {
  return Array.from(_activeRecordings.entries()).map(([phone, data]) => ({
    phoneNumber: phone,
    ...data,
  }));
}

/**
 * Listen to recording events and update UI
 */
export function setupRecordingEventListener() {
  try {
    return callRecorder.addListener((event) => {
      console.log(`[RECORDING_EVENT] ${event.type}`, event);
      
      if (event.type === "started") {
        console.log(`[RECORDING] Started: ${event.phoneNumber}`);
      } else if (event.type === "stopped") {
        console.log(`[RECORDING] Stopped: ${event.phoneNumber}`);
      }
    });
  } catch (e) {
    console.warn("[RECORDING] Event listener error: " + e?.message);
    return null;
  }
}

/**
 * callRecorder.js
 * 
 * Integrates CallRecorderModule with phone state monitoring
 * to automatically record all calls.
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import {
  isRecordingEnabled as getRecordingEnabledPreference,
  setRecordingEnabled as setRecordingEnabledPreference,
} from "./recordingPreferences";

const { CallRecorderModule } = NativeModules;

let recordingEmitter = null;
if (CallRecorderModule && Platform.OS === "android") {
  recordingEmitter = new NativeEventEmitter(CallRecorderModule);
}

// Track recording state
let currentRecording = null;

/**
 * Check if native call recorder is available
 */
export async function isRecorderAvailable() {
  if (!CallRecorderModule || Platform.OS !== "android") {
    return false;
  }
  
  try {
    const perms = await CallRecorderModule.checkRecordingPermissions();
    return perms.recordAudioGranted && perms.phoneStateGranted;
  } catch {
    return false;
  }
}

/**
 * Read and write the same explicit setting used by Settings and the upload flow.
 * A missing value is intentionally OFF.
 */
export const isRecordingEnabled = getRecordingEnabledPreference;
export const setRecordingEnabled = setRecordingEnabledPreference;

/**
 * Start recording a call
 * @param {string} phoneNumber - The phone number being called
 * @param {string} clientEventId - Unique call identifier
 * @returns {Promise<{success: boolean, filepath?: string}>}
 */
export async function startCallRecording(phoneNumber, clientEventId) {
  if (!CallRecorderModule) {
    console.warn("[RECORDER] Module not available");
    return { success: false, error: "Recorder module not available" };
  }

  const enabled = await isRecordingEnabled();
  if (!enabled) {
    console.log("[RECORDER] Recording disabled in settings");
    return { success: false, error: "Recording disabled" };
  }

  try {
    console.log(`[RECORDER] Starting recording for ${clientEventId}`);
    const result = await CallRecorderModule.startRecording(phoneNumber);
    
    if (result.success) {
      currentRecording = {
        clientEventId,
        phoneNumber,
        filepath: result.filepath,
        startTime: Date.now(),
      };
      console.log(`[RECORDER] Recording started: ${result.filepath}`);
    }
    
    return result;
  } catch (error) {
    console.error(`[RECORDER] Start failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Stop recording the current call
 * @returns {Promise<{success: boolean, filepath?: string}>}
 */
export async function stopCallRecording() {
  if (!CallRecorderModule) {
    return { success: false, error: "Recorder module not available" };
  }

  try {
    console.log("[RECORDER] Stopping recording");
    const result = await CallRecorderModule.stopRecording();
    
    if (result.success && result.filepath) {
      console.log(`[RECORDER] Recording stopped: ${result.filepath}`);
      const recording = currentRecording;
      currentRecording = null;
      return { ...result, metadata: recording };
    }
    
    currentRecording = null;
    return result;
  } catch (error) {
    console.error(`[RECORDER] Stop failed: ${error.message}`);
    currentRecording = null;
    return { success: false, error: error.message };
  }
}

/**
 * Immediately stop and delete a partial recording when the setting is turned
 * off during an active call. Future calls remain blocked by the shared setting.
 */
export async function stopAndDiscardActiveRecording() {
  const status = await getRecordingStatus();
  if (!status?.isRecording) return { success: true, stopped: false };

  const result = await stopCallRecording();
  if (result.success && result.filepath) {
    await deleteRecording(result.filepath);
  }
  return { ...result, stopped: Boolean(result.success) };
}

/**
 * Get current recording status
 */
export async function getRecordingStatus() {
  if (!CallRecorderModule) {
    return { isRecording: false };
  }
  
  try {
    return await CallRecorderModule.getRecordingStatus();
  } catch {
    return { isRecording: false };
  }
}

/**
 * Get recent recordings from app storage
 */
export async function getRecentRecordings(maxResults = 50) {
  if (!CallRecorderModule) {
    return [];
  }
  
  try {
    return await CallRecorderModule.getRecentRecordings(maxResults);
  } catch {
    return [];
  }
}

/**
 * Delete a recording file
 */
export async function deleteRecording(filepath) {
  if (!CallRecorderModule) {
    return { success: false };
  }
  
  try {
    return await CallRecorderModule.deleteRecording(filepath);
  } catch {
    return { success: false };
  }
}

/**
 * Setup event listeners for recording events
 */
export function setupRecordingListeners(callbacks) {
  if (!recordingEmitter) return () => {};

  const startListener = recordingEmitter.addListener(
    "callRecordingStarted",
    (event) => {
      console.log("[RECORDER] Event: recording started", event);
      callbacks?.onRecordingStarted?.(event);
    }
  );

  const stopListener = recordingEmitter.addListener(
    "callRecordingStopped",
    (event) => {
      console.log("[RECORDER] Event: recording stopped", event);
      callbacks?.onRecordingStopped?.(event);
    }
  );

  return () => {
    startListener.remove();
    stopListener.remove();
  };
}

// Auto-export for easy import
export default {
  isRecorderAvailable,
  isRecordingEnabled,
  setRecordingEnabled,
  startCallRecording,
  stopCallRecording,
  stopAndDiscardActiveRecording,
  getRecordingStatus,
  getRecentRecordings,
  deleteRecording,
  setupRecordingListeners,
};

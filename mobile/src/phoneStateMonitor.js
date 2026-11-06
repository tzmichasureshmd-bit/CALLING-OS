/**
 * phoneStateMonitor.js
 * 
 * Monitors phone call state and auto-starts/stops recording with popup notifications
 */

import { NativeModules, NativeEventEmitter, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { startCallRecording, stopCallRecording, isRecordingEnabled } from "./callRecorder";

const { CallRecorderModule } = NativeModules;

let stateEmitter = null;
let listeners = [];

// Track current call
let currentCall = null;

/**
 * Initialize phone state monitoring
 */
export function startPhoneStateMonitoring() {
  if (Platform.OS !== "android" || !CallRecorderModule) {
    console.log("[PHONE_STATE] Monitoring not available on this platform");
    return;
  }

  // Create emitter for native events
  if (!stateEmitter) {
    stateEmitter = new NativeEventEmitter(CallRecorderModule);
  }

  // Listen for call started
  const callStartedListener = stateEmitter.addListener("callStarted", async (event) => {
    console.log("[PHONE_STATE] Call started:", event);
    
    const enabled = await isRecordingEnabled();
    if (!enabled) {
      console.log("[PHONE_STATE] Recording disabled, skipping");
      return;
    }

    const phoneNumber = event.phoneNumber || "unknown";
    const clientEventId = `call_${Date.now()}_${phoneNumber}`;

    // Start recording
    const result = await startCallRecording(phoneNumber, clientEventId);
    
    if (result.success) {
      currentCall = {
        clientEventId,
        phoneNumber,
        filepath: result.filepath,
        startTime: Date.now(),
      };

      // Show recording popup notification
      showRecordingNotification(phoneNumber);
    }
  });

  // Listen for call ended
  const callEndedListener = stateEmitter.addListener("callEnded", async (event) => {
    console.log("[PHONE_STATE] Call ended:", event);
    
    if (currentCall) {
      // Stop recording
      const result = await stopCallRecording();
      
      if (result.success) {
        // Show recording saved notification
        showRecordingSavedNotification(currentCall.phoneNumber, result.filepath);
      }
      
      currentCall = null;
    }
  });

  listeners.push(callStartedListener, callEndedListener);
  console.log("[PHONE_STATE] Monitoring started");
}

/**
 * Stop phone state monitoring
 */
export function stopPhoneStateMonitoring() {
  listeners.forEach(listener => listener.remove());
  listeners = [];
  console.log("[PHONE_STATE] Monitoring stopped");
}

/**
 * Show "Recording..." popup notification during call
 */
async function showRecordingNotification(phoneNumber) {
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: "recording-active",
      content: {
        title: "🔴 Recording Call",
        body: `Call with ${phoneNumber} is being recorded`,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        android: {
          channelId: "call_status",
          color: "#ef4444",
          ongoing: true, // Can't be dismissed while recording
          actions: [
            {
              identifier: "stop_recording",
              buttonTitle: "Stop Recording",
              textInput: false,
            },
          ],
        },
      },
      trigger: null, // Show immediately
    });
    console.log("[PHONE_STATE] Recording notification shown");
  } catch (error) {
    console.error("[PHONE_STATE] Failed to show recording notification:", error);
  }
}

/**
 * Show "Recording saved" notification after call ends
 */
async function showRecordingSavedNotification(phoneNumber, filepath) {
  try {
    // Dismiss the "Recording..." notification
    await Notifications.dismissNotificationAsync("recording-active");

    // Show "Recording saved" notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "✅ Recording Saved",
        body: `Call recording saved and will be synced to dashboard`,
        sound: false,
        android: {
          channelId: "recording",
        },
      },
      trigger: null,
    });
    console.log("[PHONE_STATE] Recording saved notification shown");
  } catch (error) {
    console.error("[PHONE_STATE] Failed to show saved notification:", error);
  }
}

/**
 * Get current recording status
 */
export function getCurrentRecording() {
  return currentCall;
}

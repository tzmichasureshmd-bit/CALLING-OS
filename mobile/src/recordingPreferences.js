/**
 * Native source of truth for automatic call recording.
 *
 * Android SharedPreferences is readable by the foreground service even when the
 * React Native screen is not running. A fresh install defaults to OFF.
 */
import { NativeModules, Platform } from "react-native";

const { RecordingModule } = NativeModules;

export async function isRecordingEnabled() {
  if (Platform.OS !== "android" || !RecordingModule?.getRecordingEnabled) return false;
  try {
    return await RecordingModule.getRecordingEnabled();
  } catch {
    return false;
  }
}

export async function setRecordingEnabled(enabled) {
  if (Platform.OS !== "android" || !RecordingModule?.setRecordingEnabled) {
    throw new Error("Native recording controls are unavailable. Install the latest APK.");
  }
  return RecordingModule.setRecordingEnabled(Boolean(enabled));
}

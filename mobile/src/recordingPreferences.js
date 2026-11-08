/**
 * The single source of truth for automatic call recording.
 *
 * A call can be captured or uploaded only after the person using the device
 * explicitly enables this preference in Settings.  The preference defaults to
 * off so a fresh install never starts recording unexpectedly.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

export const RECORDING_PREF_KEY = "callos_recording_enabled";

export async function isRecordingEnabled() {
  try {
    return (await AsyncStorage.getItem(RECORDING_PREF_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setRecordingEnabled(enabled) {
  await AsyncStorage.setItem(RECORDING_PREF_KEY, enabled ? "true" : "false");
}

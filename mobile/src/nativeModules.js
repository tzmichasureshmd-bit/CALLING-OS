import { Platform, PermissionsAndroid } from "react-native";
import * as Device from "expo-device";

// ── Call Log ──────────────────────────────────────────────────────────────────
// Real call log reading requires a custom Expo dev client build with
// react-native-call-log linked. This stub returns [] until that build is used.
// The sync service falls back to mock data automatically.
export async function readCallLog(_limitDays = 30) {
  return [];
}

// ── SIM Info ──────────────────────────────────────────────────────────────────
// Real SIM detection requires react-native-sim-cards-manager in a custom build.
// Returns [] until then — onboarding shows default "SIM 1 / SIM 2" labels.
export async function readSimInfo() {
  return [];
}

// ── Device Info ───────────────────────────────────────────────────────────────
// expo-device works in all Expo builds including managed workflow.
export function getDeviceInfo() {
  return {
    manufacturer: Device.manufacturer || "Unknown",
    model: Device.modelName || "Unknown",
    androidVersion: Device.osVersion || String(Platform.Version || ""),
  };
}

// ── Permissions ───────────────────────────────────────────────────────────────

export async function requestAllPermissions() {
  if (Platform.OS !== "android") {
    return { callLog: true, phoneState: true, contacts: true, storage: true, recording: true, allGranted: true };
  }
  try {
    const P = PermissionsAndroid.PERMISSIONS;
    const results = await PermissionsAndroid.requestMultiple([
      P.READ_CALL_LOG,
      P.READ_PHONE_STATE,
      P.READ_CONTACTS,
      P.READ_EXTERNAL_STORAGE,
      P.RECORD_AUDIO,
    ]);
    const g = (p) => results[p] === PermissionsAndroid.RESULTS.GRANTED;
    return {
      callLog: g(P.READ_CALL_LOG),
      phoneState: g(P.READ_PHONE_STATE),
      contacts: g(P.READ_CONTACTS),
      storage: g(P.READ_EXTERNAL_STORAGE),
      recording: g(P.RECORD_AUDIO),
      allGranted: g(P.READ_CALL_LOG) && g(P.READ_PHONE_STATE),
    };
  } catch {
    return { allGranted: false };
  }
}

export async function checkPermissions() {
  if (Platform.OS !== "android") {
    return { callLog: true, phoneState: true, contacts: true, storage: true, recording: true, allGranted: true };
  }
  try {
    const P = PermissionsAndroid.PERMISSIONS;
    const [callLog, phoneState, contacts, storage, recording] = await Promise.all([
      PermissionsAndroid.check(P.READ_CALL_LOG),
      PermissionsAndroid.check(P.READ_PHONE_STATE),
      PermissionsAndroid.check(P.READ_CONTACTS),
      PermissionsAndroid.check(P.READ_EXTERNAL_STORAGE),
      PermissionsAndroid.check(P.RECORD_AUDIO),
    ]);
    return { callLog, phoneState, contacts, storage, recording, allGranted: callLog && phoneState };
  } catch {
    return { allGranted: false };
  }
}

import { Platform, PermissionsAndroid } from "react-native";
import * as Device from "expo-device";

// ── Safe top-level requires for optional native modules ───────────────────────
// These modules only exist in the custom EAS dev client build.
// Top-level require with try/catch is intentional — these are OPTIONAL native
// modules that don't exist in Expo Go. This is the correct pattern for
// conditional native module loading in React Native.
// eslint-disable-next-line import/no-extraneous-dependencies
let _CallLog = null;
// eslint-disable-next-line import/no-extraneous-dependencies
let _SimCardsManager = null;

try { _CallLog = require("react-native-call-log"); } catch { _CallLog = null; }
try { _SimCardsManager = require("react-native-sim-cards-manager")?.default || null; } catch { _SimCardsManager = null; }

// ── Call Log ──────────────────────────────────────────────────────────────────
export async function readCallLog(limitDays = 30) {
  if (Platform.OS !== "android" || !_CallLog) return [];
  try {
    const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
    if (!granted) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return [];
    }
    const since = Date.now() - limitDays * 24 * 60 * 60 * 1000;
    const logs = await _CallLog.loadAll(String(since));
    return Array.isArray(logs) ? logs : [];
  } catch {
    return [];
  }
}

// ── SIM Info ──────────────────────────────────────────────────────────────────
export async function readSimInfo() {
  if (Platform.OS !== "android" || !_SimCardsManager) return [];
  try {
    const sims = await _SimCardsManager.getSimCards();
    return Array.isArray(sims) ? sims.map((s, i) => ({
      slot:        s.slotIndex ?? i,
      phoneNumber: s.phoneNumber || null,
      carrierName: s.carrierName || s.displayName || null,
      countryIso:  s.countryIso || null,
    })) : [];
  } catch {
    return [];
  }
}

// ── Device Info ───────────────────────────────────────────────────────────────
export function getDeviceInfo() {
  return {
    manufacturer:   Device.manufacturer  || "Unknown",
    model:          Device.modelName     || "Unknown",
    androidVersion: Device.osVersion     || String(Platform.Version || ""),
  };
}

// ── Permissions ───────────────────────────────────────────────────────────────
export async function requestAllPermissions() {
  if (Platform.OS !== "android") {
    return { callLog: true, phoneState: true, contacts: true, storage: true, recording: true, allGranted: true };
  }
  try {
    const P = PermissionsAndroid.PERMISSIONS;
    const androidVersion = parseInt(Platform.Version, 10);

    // Android 13+ uses READ_MEDIA_AUDIO instead of READ_EXTERNAL_STORAGE
    const storagePermission = androidVersion >= 33
      ? P.READ_MEDIA_AUDIO
      : P.READ_EXTERNAL_STORAGE;

    const results = await PermissionsAndroid.requestMultiple([
      P.READ_CALL_LOG,
      P.READ_PHONE_STATE,
      P.READ_CONTACTS,
      storagePermission,
      P.RECORD_AUDIO,
    ]);
    const g = (p) => results[p] === PermissionsAndroid.RESULTS.GRANTED;
    return {
      callLog:    g(P.READ_CALL_LOG),
      phoneState: g(P.READ_PHONE_STATE),
      contacts:   g(P.READ_CONTACTS),
      storage:    g(storagePermission),
      recording:  g(P.RECORD_AUDIO),
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
    const androidVersion = parseInt(Platform.Version, 10);
    const storagePermission = androidVersion >= 33
      ? P.READ_MEDIA_AUDIO
      : P.READ_EXTERNAL_STORAGE;

    const [callLog, phoneState, contacts, storage, recording] = await Promise.all([
      PermissionsAndroid.check(P.READ_CALL_LOG),
      PermissionsAndroid.check(P.READ_PHONE_STATE),
      PermissionsAndroid.check(P.READ_CONTACTS),
      PermissionsAndroid.check(storagePermission),
      PermissionsAndroid.check(P.RECORD_AUDIO),
    ]);
    return { callLog, phoneState, contacts, storage, recording, allGranted: callLog && phoneState };
  } catch {
    return { allGranted: false };
  }
}

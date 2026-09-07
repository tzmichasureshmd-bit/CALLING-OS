import { Platform, PermissionsAndroid } from "react-native";
import * as Device from "expo-device";

let _CallLog = null;
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
  if (Platform.OS !== "android") return [];
  try {
    // Try native SIM manager first
    if (_SimCardsManager) {
      const sims = await _SimCardsManager.getSimCards();
      if (Array.isArray(sims) && sims.length > 0) {
        return sims.map((s, i) => ({
          slot:        s.slotIndex ?? s.simSlotIndex ?? i,
          phoneNumber: s.phoneNumber || s.number || null,
          carrierName: s.carrierName || s.displayName || s.operatorName || s.networkOperatorName || null,
          countryIso:  s.countryIso || s.networkCountryIso || null,
          mcc:         s.mcc || null,
          mnc:         s.mnc || null,
        }));
      }
    }

    // Fallback: use expo-device + TelephonyManager via NativeModules
    try {
      const { NativeModules } = require("react-native");
      const TM = NativeModules.TelephonyManager || NativeModules.RNTelephony;
      if (TM) {
        const line = await TM.getLine1Number?.();
        const carrier = await TM.getNetworkOperatorName?.();
        if (line || carrier) {
          return [{ slot: 0, phoneNumber: line || null, carrierName: carrier || null, countryIso: null }];
        }
      }
    } catch { /* no TelephonyManager native module */ }

    // Return placeholder with slot info so UI shows something
    return [
      { slot: 0, phoneNumber: null, carrierName: null, countryIso: null },
    ];
  } catch {
    return [{ slot: 0, phoneNumber: null, carrierName: null, countryIso: null }];
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

// ── Permissions — request ONE BY ONE like other apps ─────────────────────────
const PERM_DEFS = (androidVersion) => {
  const P = PermissionsAndroid.PERMISSIONS;
  return [
    { key: "callLog",    perm: P.READ_CALL_LOG,      title: "Call Log",    msg: "CallNexa needs to read your call history to sync calls to the dashboard." },
    { key: "phoneState", perm: P.READ_PHONE_STATE,   title: "Phone State", msg: "CallNexa needs phone state access to detect active calls and read SIM info." },
    { key: "contacts",   perm: P.READ_CONTACTS,      title: "Contacts",    msg: "CallNexa needs contacts access to match caller names automatically." },
    { key: "storage",    perm: androidVersion >= 33 ? P.READ_MEDIA_AUDIO : P.READ_EXTERNAL_STORAGE,
                                                      title: "Storage",     msg: "CallNexa needs storage access to read call recordings." },
    { key: "recording",  perm: P.RECORD_AUDIO,       title: "Microphone",  msg: "CallNexa needs microphone access to record calls for transcription." },
  ];
};

export async function requestAllPermissions() {
  if (Platform.OS !== "android") {
    return { callLog: true, phoneState: true, contacts: true, storage: true, recording: true, allGranted: true };
  }
  try {
    const androidVersion = parseInt(Platform.Version, 10);
    const defs = PERM_DEFS(androidVersion);
    const result = { allGranted: false };

    // Request one by one — Android shows individual dialogs
    for (const def of defs) {
      try {
        const status = await PermissionsAndroid.request(def.perm, {
          title:   `Allow ${def.title}`,
          message: def.msg,
          buttonPositive: "Allow",
          buttonNegative: "Deny",
        });
        result[def.key] = status === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        result[def.key] = false;
      }
    }

    result.allGranted = !!(result.callLog && result.phoneState);
    return result;
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
    const storagePermission = androidVersion >= 33 ? P.READ_MEDIA_AUDIO : P.READ_EXTERNAL_STORAGE;

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

/**
 * nativeModules.js
 *
 * Android native API wrappers for CallNexa.
 *
 * SIM detection strategy:
 *   1. react-native-sim-cards-manager (primary — requires custom EAS build)
 *   2. NativeModules.TelephonyManager fallback
 *   3. Placeholder entry so the app still functions
 *
 * ANDROID LIMITATIONS (documented):
 *   - subscriptionId: available on most devices via SubscriptionManager API
 *   - phoneNumber: often null (carrier restriction, Android 11+ privacy)
 *   - networkType: available via TelephonyManager.getDataNetworkType()
 *   - ICCID/IMSI: NOT read — restricted, not required
 *   - Call recording: Android 9+ blocks third-party cellular audio capture
 */

import { Platform, PermissionsAndroid } from "react-native";
import * as Device from "expo-device";

// ── Native module lazy loading ────────────────────────────────────────────────
let _CallLog = null;
let _SimCardsManager = null;

try { _CallLog = require("react-native-call-log"); } catch { _CallLog = null; }
try {
  const mod = require("react-native-sim-cards-manager");
  _SimCardsManager = mod?.default || mod || null;
} catch { _SimCardsManager = null; }

// ── Network type mapping ──────────────────────────────────────────────────────
// Android TelephonyManager network type constants → human-readable
const NETWORK_TYPE_MAP = {
  0:  "UNKNOWN",
  1:  "2G",   // GPRS
  2:  "2G",   // EDGE
  3:  "3G",   // UMTS
  4:  "2G",   // CDMA
  5:  "2G",   // EVDO_0
  6:  "2G",   // EVDO_A
  7:  "2G",   // 1xRTT
  8:  "3G",   // HSDPA
  9:  "3G",   // HSUPA
  10: "3G",   // HSPA
  11: "2G",   // IDEN
  12: "3G",   // EVDO_B
  13: "4G",   // LTE
  14: "3G",   // EHRPD
  15: "3G",   // HSPAP
  16: "2G",   // GSM
  17: "3G",   // TD_SCDMA
  18: "3G",   // IWLAN
  19: "4G",   // LTE_CA
  20: "5G",   // NR (5G)
};

function _mapNetworkType(raw) {
  if (raw === null || raw === undefined) return null;
  const n = parseInt(raw, 10);
  return NETWORK_TYPE_MAP[n] || "UNKNOWN";
}

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
/**
 * Read all available SIM subscriptions from the device.
 *
 * Returns an array of SIM objects. Each object contains only fields
 * that Android legitimately exposes — null for unavailable fields.
 *
 * Shape:
 * {
 *   slot:           number   (0-indexed, Android native)
 *   phoneNumber:    string | null
 *   carrierName:    string | null
 *   countryIso:     string | null
 *   mcc:            string | null
 *   mnc:            string | null
 *   subscriptionId: string | null   (Android subscription ID)
 *   networkType:    string | null   ("2G" | "3G" | "4G" | "5G" | "UNKNOWN")
 *   isActive:       boolean
 * }
 */
export async function readSimInfo() {
  if (Platform.OS !== "android") return [];

  try {
    // ── Primary: react-native-sim-cards-manager ───────────────────────────
    if (_SimCardsManager) {
      try {
        const sims = await _SimCardsManager.getSimCards();
        if (Array.isArray(sims) && sims.length > 0) {
          return sims.map((s, i) => ({
            slot:           s.slotIndex       ?? s.simSlotIndex    ?? i,
            phoneNumber:    s.phoneNumber     || s.number          || null,
            carrierName:    s.carrierName     || s.displayName     || s.operatorName
                            || s.networkOperatorName               || null,
            countryIso:     s.countryIso      || s.networkCountryIso || null,
            mcc:            s.mcc             ? String(s.mcc)      : null,
            mnc:            s.mnc             ? String(s.mnc)      : null,
            // subscriptionId: exposed as subscriptionId or simSerialNumber on some libs
            subscriptionId: s.subscriptionId  ? String(s.subscriptionId)
                            : s.simSerialNumber ? String(s.simSerialNumber)
                            : null,
            networkType:    _mapNetworkType(s.networkType ?? s.dataNetworkType ?? null),
            isActive:       s.isActive !== false,  // default true if not provided
          }));
        }
      } catch { /* fall through to next method */ }
    }

    // ── Fallback: NativeModules.TelephonyManager ──────────────────────────
    try {
      const { NativeModules } = require("react-native");
      const TM = NativeModules.TelephonyManager || NativeModules.RNTelephony;
      if (TM) {
        const [line, carrier, networkTypeRaw] = await Promise.all([
          TM.getLine1Number?.().catch(() => null),
          TM.getNetworkOperatorName?.().catch(() => null),
          TM.getNetworkType?.().catch(() => null),
        ]);
        if (line || carrier) {
          return [{
            slot:           0,
            phoneNumber:    line    || null,
            carrierName:    carrier || null,
            countryIso:     null,
            mcc:            null,
            mnc:            null,
            subscriptionId: null,
            networkType:    _mapNetworkType(networkTypeRaw),
            isActive:       true,
          }];
        }
      }
    } catch { /* no TelephonyManager */ }

    // ── Last resort: placeholder so app still functions ───────────────────
    // Returns a single slot-0 entry with all metadata null.
    // Call sync will still work — SIM info is supplementary.
    return [{
      slot:           0,
      phoneNumber:    null,
      carrierName:    null,
      countryIso:     null,
      mcc:            null,
      mnc:            null,
      subscriptionId: null,
      networkType:    null,
      isActive:       true,
    }];
  } catch {
    return [{
      slot:           0,
      phoneNumber:    null,
      carrierName:    null,
      countryIso:     null,
      mcc:            null,
      mnc:            null,
      subscriptionId: null,
      networkType:    null,
      isActive:       true,
    }];
  }
}

// ── Device Info ───────────────────────────────────────────────────────────────
export function getDeviceInfo() {
  return {
    manufacturer:   Device.manufacturer || "Unknown",
    model:          Device.modelName    || "Unknown",
    androidVersion: Device.osVersion    || String(Platform.Version || ""),
  };
}

// ── Permissions ───────────────────────────────────────────────────────────────
const PERM_DEFS = (androidVersion) => {
  const P = PermissionsAndroid.PERMISSIONS;
  const defs = [
    { key: "callLog",    perm: P.READ_CALL_LOG,    title: "Call Log",    msg: "CallNexa needs to read your call history to sync calls to the dashboard." },
    { key: "phoneState", perm: P.READ_PHONE_STATE, title: "Phone State", msg: "CallNexa needs phone state access to detect active calls and read SIM info." },
    { key: "contacts",   perm: P.READ_CONTACTS,    title: "Contacts",    msg: "CallNexa needs contacts access to match caller names automatically." },
    {
      key: "storage",
      perm: androidVersion >= 33 ? P.READ_MEDIA_AUDIO : P.READ_EXTERNAL_STORAGE,
      title: "Storage",
      msg: "CallNexa needs storage access to read call recordings.",
    },
    { key: "recording",  perm: P.RECORD_AUDIO,     title: "Microphone",  msg: "CallNexa needs microphone access for call transcription." },
  ];
  // POST_NOTIFICATIONS required on Android 13+
  if (androidVersion >= 33 && P.POST_NOTIFICATIONS) {
    defs.push({
      key: "notifications",
      perm: P.POST_NOTIFICATIONS,
      title: "Notifications",
      msg: "CallNexa needs notification permission to show call sync status.",
    });
  }
  return defs;
};

export async function requestAllPermissions() {
  if (Platform.OS !== "android") {
    return { callLog: true, phoneState: true, contacts: true, storage: true, recording: true, allGranted: true };
  }
  try {
    const androidVersion = parseInt(Platform.Version, 10);
    const defs = PERM_DEFS(androidVersion);
    const result = { allGranted: false };

    for (const def of defs) {
      try {
        const status = await PermissionsAndroid.request(def.perm, {
          title:          `Allow ${def.title}`,
          message:        def.msg,
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

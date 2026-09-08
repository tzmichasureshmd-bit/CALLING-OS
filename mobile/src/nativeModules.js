/**
 * nativeModules.js
 *
 * Android native API wrappers for CallNexa.
 *
 * Call Log strategy (priority order):
 *   1. CallLogModule (native Kotlin — direct ContentResolver query, most reliable)
 *   2. react-native-call-log (JS bridge fallback)
 *   3. Empty array (permission denied or module missing)
 *
 * SIM detection strategy:
 *   1. react-native-sim-cards-manager
 *   2. NativeModules.TelephonyManager fallback
 *   3. Placeholder entry
 */

import { Platform, PermissionsAndroid, NativeModules } from "react-native";
import * as Device from "expo-device";

// -- Native module references
const _NativeCallLog    = NativeModules.CallLogModule || null;  // our Kotlin module
let   _RNCallLog        = null;                                  // react-native-call-log fallback
let   _SimCardsManager  = null;

try { _RNCallLog = require("react-native-call-log"); } catch { _RNCallLog = null; }
try {
  const mod = require("react-native-sim-cards-manager");
  _SimCardsManager = mod?.default || mod || null;
} catch { _SimCardsManager = null; }

// -- Android call type constants
const ANDROID_TYPE_MAP = {
  1: "incoming",   // INCOMING_TYPE
  2: "outgoing",   // OUTGOING_TYPE
  3: "missed",     // MISSED_TYPE
  4: "incoming",   // VOICEMAIL_TYPE (treat as incoming)
  5: "rejected",   // REJECTED_TYPE
  6: "rejected",   // BLOCKED_TYPE
  7: "incoming",   // ANSWERED_EXTERNALLY_TYPE
};

// -- Network type mapping
const NETWORK_TYPE_MAP = {
  0:"UNKNOWN",1:"2G",2:"2G",3:"3G",4:"2G",5:"2G",6:"2G",7:"2G",
  8:"3G",9:"3G",10:"3G",11:"2G",12:"3G",13:"4G",14:"3G",15:"3G",
  16:"2G",17:"3G",18:"3G",19:"4G",20:"5G",
};
function _mapNetworkType(raw) {
  if (raw === null || raw === undefined) return null;
  return NETWORK_TYPE_MAP[parseInt(raw, 10)] || "UNKNOWN";
}

// ── TASK 2: Real runtime permission check ─────────────────────────────────────
// Uses Android's actual PackageManager.checkSelfPermission — NOT AsyncStorage.
export async function checkCallLogPermissionNative() {
  if (Platform.OS !== "android") return true;
  if (_NativeCallLog) {
    try {
      return await _NativeCallLog.checkPermission();
    } catch {}
  }
  // Fallback: PermissionsAndroid.check() also calls checkSelfPermission
  try {
    return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
  } catch {
    return false;
  }
}

// ── Call Log — primary: native Kotlin module ──────────────────────────────────
/**
 * Read Android system call log via direct ContentResolver query.
 *
 * Uses CallLogModule (Kotlin) as primary — queries CallLog.Calls.CONTENT_URI directly.
 * Falls back to react-native-call-log if native module not available.
 *
 * Returns normalized array of call records.
 * NEVER filters zero-duration calls (missed/rejected = duration 0).
 */
export async function readCallLog(limitDays = 30) {
  if (Platform.OS !== "android") return [];

  console.log("[CallLog] provider query started -- last " + limitDays + " days");

  // Step 1: Real permission check
  const P = PermissionsAndroid.PERMISSIONS;
  let granted = false;
  try {
    granted = await PermissionsAndroid.check(P.READ_CALL_LOG);
    console.log("[CallLog] permission = " + (granted ? "GRANTED" : "DENIED"));
  } catch (e) {
    console.warn("[CallLog] permission check error: " + e?.message);
    return [];
  }

  if (!granted) {
    try {
      const result = await PermissionsAndroid.request(P.READ_CALL_LOG, {
        title: "Call Log Access",
        message: "CallNexa needs to read your call history to sync calls to the dashboard.",
        buttonPositive: "Allow",
        buttonNegative: "Deny",
      });
      granted = result === PermissionsAndroid.RESULTS.GRANTED;
      console.log("[CallLog] permission after request = " + (granted ? "GRANTED" : "DENIED"));
    } catch (e) {
      console.warn("[CallLog] permission request error: " + e?.message);
    }
    if (!granted) {
      console.warn("[CallLog] READ_CALL_LOG permission denied");
      return [];
    }
  }

  const sinceMs = Date.now() - limitDays * 24 * 60 * 60 * 1000;

  // ── Primary: native Kotlin CallLogModule ─────────────────────────────────
  if (_NativeCallLog) {
    try {
      console.log("[CallLog] querying system CallLog via native module");
      const result = await _NativeCallLog.getCallLogsSince(sinceMs);
      if (result && result.success && Array.isArray(result.records)) {
        console.log("[CallLog] records returned = " + result.records.length + " (native module)");
        // Normalize to match react-native-call-log field names for compatibility
        return result.records.map((r) => ({
          id:             r.id,
          number:         r.number || "",
          name:           r.name || "",
          type:           String(r.type),
          date:           r.date,
          duration:       r.duration,
          new:            r.new,
          simSlot:        null,  // populated from phoneAccountId below
          subscriptionId: r.phoneAccountId || null,
          phoneAccountId: r.phoneAccountId || null,
          cachedName:     r.name || "",
          // Keep raw type name for diagnostics
          _typeName:      r.typeName,
        }));
      }
      if (result && !result.success) {
        console.warn("[CallLog] native module query failed: " + result.error);
      }
    } catch (e) {
      console.warn("[CallLog] native module threw: " + e?.message);
    }
  } else {
    console.warn("[CallLog] native CallLogModule not available — using react-native-call-log fallback");
  }

  // ── Fallback: react-native-call-log ──────────────────────────────────────
  if (!_RNCallLog) {
    console.warn("[CallLog] react-native-call-log also not available. No call log source.");
    return [];
  }

  const sinceStr = String(sinceMs);
  let logs = null;
  const errors = [];

  try {
    const r = await _RNCallLog.loadAll({ minTimestamp: sinceStr });
    if (Array.isArray(r)) { logs = r; }
    else errors.push("form1: non-array: " + typeof r);
  } catch (e) { errors.push("form1: " + e?.message); }

  if (!logs) {
    try {
      const r = await _RNCallLog.loadAll(sinceStr);
      if (Array.isArray(r)) { logs = r; }
      else errors.push("form2: non-array: " + typeof r);
    } catch (e) { errors.push("form2: " + e?.message); }
  }

  if (!logs) {
    try {
      const r = await _RNCallLog.loadAll();
      if (Array.isArray(r)) {
        logs = r.filter((c) => parseInt(c.date, 10) >= sinceMs);
        console.log("[CallLog] form3 no-filter: " + r.length + " total, " + logs.length + " in window");
      } else errors.push("form3: non-array: " + typeof r);
    } catch (e) { errors.push("form3: " + e?.message); }
  }

  if (!logs) {
    console.warn("[CallLog] ALL FORMS FAILED: " + errors.join(" | "));
    return [];
  }

  console.log("[CallLog] records returned = " + logs.length + " (react-native-call-log fallback)");
  return logs;
}

// ── SIM Info ──────────────────────────────────────────────────────────────────
export async function readSimInfo() {
  if (Platform.OS !== "android") return [];
  try {
    if (_SimCardsManager) {
      try {
        const sims = await _SimCardsManager.getSimCards();
        if (Array.isArray(sims) && sims.length > 0) {
          return sims.map((s, i) => ({
            slot:           s.slotIndex       ?? s.simSlotIndex    ?? i,
            phoneNumber:    s.phoneNumber     || s.number          || null,
            carrierName:    s.carrierName     || s.displayName     || s.operatorName || s.networkOperatorName || null,
            countryIso:     s.countryIso      || s.networkCountryIso || null,
            mcc:            s.mcc             ? String(s.mcc)      : null,
            mnc:            s.mnc             ? String(s.mnc)      : null,
            subscriptionId: s.subscriptionId  ? String(s.subscriptionId) : s.simSerialNumber ? String(s.simSerialNumber) : null,
            networkType:    _mapNetworkType(s.networkType ?? s.dataNetworkType ?? null),
            isActive:       s.isActive !== false,
          }));
        }
      } catch {}
    }
    try {
      const { NativeModules: NM } = require("react-native");
      const TM = NM.TelephonyManager || NM.RNTelephony;
      if (TM) {
        const [line, carrier, networkTypeRaw] = await Promise.all([
          TM.getLine1Number?.().catch(() => null),
          TM.getNetworkOperatorName?.().catch(() => null),
          TM.getNetworkType?.().catch(() => null),
        ]);
        if (line || carrier) {
          return [{ slot: 0, phoneNumber: line || null, carrierName: carrier || null, countryIso: null, mcc: null, mnc: null, subscriptionId: null, networkType: _mapNetworkType(networkTypeRaw), isActive: true }];
        }
      }
    } catch {}
    return [{ slot: 0, phoneNumber: null, carrierName: null, countryIso: null, mcc: null, mnc: null, subscriptionId: null, networkType: null, isActive: true }];
  } catch {
    return [{ slot: 0, phoneNumber: null, carrierName: null, countryIso: null, mcc: null, mnc: null, subscriptionId: null, networkType: null, isActive: true }];
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
    { key: "storage",    perm: androidVersion >= 33 ? P.READ_MEDIA_AUDIO : P.READ_EXTERNAL_STORAGE, title: "Storage", msg: "CallNexa needs storage access to read call recordings." },
    { key: "recording",  perm: P.RECORD_AUDIO,     title: "Microphone",  msg: "CallNexa needs microphone access for call transcription." },
  ];
  if (androidVersion >= 33 && P.POST_NOTIFICATIONS) {
    defs.push({ key: "notifications", perm: P.POST_NOTIFICATIONS, title: "Notifications", msg: "CallNexa needs notification permission to show call sync status." });
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
          title: "Allow " + def.title,
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

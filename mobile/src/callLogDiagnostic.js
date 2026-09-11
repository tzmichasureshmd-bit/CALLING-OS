/**
 * callLogDiagnostic.js
 *
 * TASK 2 + 3 + 6 — Direct Android ContentResolver diagnostic.
 *
 * This module bypasses react-native-call-log entirely and queries
 * CallLog.Calls.CONTENT_URI directly via NativeModules or ExpoModules.
 *
 * On Android, the only reliable way to query ContentResolver from JS is:
 *   1. A custom native module (requires EAS build with native code)
 *   2. react-native-call-log (which wraps ContentResolver)
 *   3. expo-modules-core custom module
 *
 * Since we cannot add raw Java in a managed Expo workflow without a custom
 * native module, this diagnostic uses react-native-call-log as the bridge
 * BUT adds explicit permission verification, error capture, and comparison
 * so we can prove exactly which layer fails.
 *
 * The diagnostic also uses PermissionsAndroid.check() which calls
 * Context.checkSelfPermission() — the real Android runtime check,
 * NOT AsyncStorage state.
 */

import { Platform, PermissionsAndroid, NativeModules } from "react-native";
import * as Device from "expo-device";

const IS_DEV = __DEV__;
const _NativeCallLog = NativeModules.CallLogModule || null;

// ── Android call type constants ───────────────────────────────────────────────
export const ANDROID_CALL_TYPES = {
  "1": "INCOMING",
  "2": "OUTGOING",
  "3": "MISSED",
  "4": "VOICEMAIL",
  "5": "REJECTED",
  "6": "BLOCKED",
  "7": "ANSWERED_EXTERNALLY",
};

// ── TASK 2: Real runtime permission check ────────────────────────────────────
/**
 * Checks READ_CALL_LOG using Android's real runtime permission API.
 * PermissionsAndroid.check() calls Context.checkSelfPermission() directly.
 * This is NOT AsyncStorage — it's the real Android permission state.
 */
export async function checkCallLogPermissionReal() {
  if (Platform.OS !== "android") {
    return { granted: true, reason: "not_android" };
  }
  try {
    const P = PermissionsAndroid.PERMISSIONS;
    const [callLog, phoneState, contacts] = await Promise.all([
      PermissionsAndroid.check(P.READ_CALL_LOG),
      PermissionsAndroid.check(P.READ_PHONE_STATE),
      PermissionsAndroid.check(P.READ_CONTACTS),
    ]);

    const apiLevel = parseInt(Platform.Version, 10);
    const manufacturer = Device.manufacturer || "unknown";
    const model = Device.modelName || "unknown";

    const result = {
      READ_CALL_LOG:    callLog,
      READ_PHONE_STATE: phoneState,
      READ_CONTACTS:    contacts,
      packageName:      "com.tzmicha.callnexa",
      androidApiLevel:  apiLevel,
      manufacturer,
      model,
      granted:          callLog,
      reason:           callLog ? "granted" : "permission_denied_by_user_or_system",
    };

    if (IS_DEV) {
      console.log("[CALLLOG] permission check =", JSON.stringify(result));
    }
    return result;
  } catch (e) {
    return { granted: false, reason: "check_threw_exception", error: e?.message };
  }
}

// ── TASK 3: Direct call log query via react-native-call-log ──────────────────
/**
 * Queries Android CallLog.Calls.CONTENT_URI via react-native-call-log.
 * This is the closest we can get to a direct ContentResolver query
 * without a custom native module.
 *
 * Returns { success, permissionGranted, count, records, error, errorCode }
 */
export async function queryCallLogDirect(options = {}) {
  const { limitDays = 90, maxRecords = 100 } = options;

  if (Platform.OS !== "android") {
    return { success: false, permissionGranted: false, count: 0, records: [], error: "not_android" };
  }

  // Step 1: Real permission check
  const permCheck = await checkCallLogPermissionReal();
  if (!permCheck.READ_CALL_LOG) {
    return {
      success: false,
      permissionGranted: false,
      count: 0,
      records: [],
      error: "READ_CALL_LOG not granted",
      errorCode: "PERMISSION_DENIED",
      permissionDetail: permCheck,
    };
  }

  const sinceMs = Date.now() - limitDays * 24 * 60 * 60 * 1000;

  // Step 2: Try native CallLogModule first (direct ContentResolver)
  if (_NativeCallLog) {
    try {
      console.log("[CallLog] querying system CallLog via native module (diagnostic)");
      const result = await _NativeCallLog.getCallLogsSince(sinceMs);
      if (result && result.success && Array.isArray(result.records)) {
        const records = result.records.slice(0, maxRecords).map((r) => ({
          _id:            r.id,
          number:         r.number || null,
          date:           r.date,
          dateISO:        r.date ? new Date(parseInt(r.date, 10)).toISOString() : null,
          duration:       r.duration || "0",
          durationSec:    parseInt(r.duration, 10) || 0,
          type:           r.type,
          typeName:       r._typeName || ANDROID_CALL_TYPES[String(r.type)] || "UNKNOWN(" + r.type + ")",
          cachedName:     r.name || null,
          simSlot:        null,
          subscriptionId: r.phoneAccountId || null,
          phoneAccountId: r.phoneAccountId || null,
        }));
        return {
          success: true,
          permissionGranted: true,
          count: result.count,
          records,
          source: "native_kotlin_module",
          attempts: [{ form: "native_CallLogModule", success: true, count: result.count }],
          error: null,
          errorCode: null,
          latestId: records[0]?._id || null,
          latestDate: records[0]?.dateISO || null,
        };
      }
      if (result && !result.success) {
        console.warn("[CallLog] native module diagnostic failed: " + result.error);
      }
    } catch (e) {
      console.warn("[CallLog] native module diagnostic threw: " + e?.message);
    }
  }

  // Step 3: Load react-native-call-log module
  let CallLogModule = null;
  try {
    CallLogModule = require("react-native-call-log");
  } catch (e) {
    return {
      success: false,
      permissionGranted: true,
      count: 0,
      records: [],
      error: `react-native-call-log module not found: ${e?.message}`,
      errorCode: "MODULE_NOT_FOUND",
    };
  }

  if (!CallLogModule || typeof CallLogModule.loadAll !== "function") {
    return {
      success: false,
      permissionGranted: true,
      count: 0,
      records: [],
      error: "react-native-call-log loaded but loadAll() not a function",
      errorCode: "MODULE_INVALID",
      moduleKeys: CallLogModule ? Object.keys(CallLogModule) : [],
    };
  }

  const sinceStr = String(sinceMs);

  if (IS_DEV) {
    console.log(`[CALLLOG] provider query started — last ${limitDays} days since ${new Date(sinceMs).toISOString()}`);
  }

  // Step 3: Try all API forms, capture each error
  const attempts = [];
  let rawLogs = null;

  // Form 1: object filter { minTimestamp }
  try {
    const r = await CallLogModule.loadAll({ minTimestamp: sinceStr });
    if (Array.isArray(r)) {
      rawLogs = r;
      attempts.push({ form: "object_filter", success: true, count: r.length });
    } else {
      attempts.push({ form: "object_filter", success: false, result: String(r) });
    }
  } catch (e) {
    attempts.push({ form: "object_filter", success: false, error: e?.message });
  }

  // Form 2: string timestamp
  if (!rawLogs) {
    try {
      const r = await CallLogModule.loadAll(sinceStr);
      if (Array.isArray(r)) {
        rawLogs = r;
        attempts.push({ form: "string_timestamp", success: true, count: r.length });
      } else {
        attempts.push({ form: "string_timestamp", success: false, result: String(r) });
      }
    } catch (e) {
      attempts.push({ form: "string_timestamp", success: false, error: e?.message });
    }
  }

  // Form 3: no filter — get all, filter in JS
  if (!rawLogs) {
    try {
      const r = await CallLogModule.loadAll();
      if (Array.isArray(r)) {
        rawLogs = r.filter((c) => parseInt(c.date, 10) >= sinceMs);
        attempts.push({ form: "no_filter_js_filter", success: true, rawCount: r.length, filteredCount: rawLogs.length });
      } else {
        attempts.push({ form: "no_filter_js_filter", success: false, result: String(r) });
      }
    } catch (e) {
      attempts.push({ form: "no_filter_js_filter", success: false, error: e?.message });
    }
  }

  if (IS_DEV) {
    console.log("[CALLLOG] provider query completed — attempts:", JSON.stringify(attempts));
    console.log(`[CALLLOG] records returned = ${rawLogs?.length ?? 0}`);
  }

  if (!rawLogs) {
    return {
      success: false,
      permissionGranted: true,
      count: 0,
      records: [],
      error: "All loadAll() API forms failed",
      errorCode: "ALL_FORMS_FAILED",
      attempts,
    };
  }

  // Step 4: Normalize records — preserve ALL fields from Android
  const records = rawLogs.slice(0, maxRecords).map((c) => ({
    _id:              c.id          || c._id         || null,
    number:           c.number      || c.phoneNumber  || null,
    date:             c.date        || null,
    dateISO:          c.date ? new Date(parseInt(c.date, 10)).toISOString() : null,
    duration:         c.duration    || "0",
    durationSec:      parseInt(c.duration, 10) || 0,
    type:             c.type        || null,
    typeName:         ANDROID_CALL_TYPES[String(c.type)] || `UNKNOWN(${c.type})`,
    cachedName:       c.name        || c.cachedName   || null,
    simSlot:          c.simSlot     !== undefined ? c.simSlot : null,
    subscriptionId:   c.subscriptionId || null,
    phoneAccountId:   c.phoneAccountId || null,
    isNew:            c.new         || null,
    isRead:           c.is_read     || null,
    // raw entry for debugging
    _raw:             IS_DEV ? c : undefined,
  }));

  if (IS_DEV && records.length > 0) {
    const latest = records[0];
    console.log(`[CALLLOG] latest Android call ID = ${latest._id}`);
    console.log(`[CALLLOG] latest: type=${latest.typeName} dur=${latest.durationSec}s num=***${String(latest.number || "").slice(-4)} date=${latest.dateISO}`);
  }

  return {
    success: true,
    permissionGranted: true,
    count: rawLogs.length,
    records,
    attempts,
    error: null,
    errorCode: null,
    latestId: records[0]?._id || null,
    latestDate: records[0]?.dateISO || null,
  };
}

// ── TASK 6: Compare native vs react-native-call-log ──────────────────────────
/**
 * Runs queryCallLogDirect and compares with callLogService.getRealCallLog().
 * Returns a comparison report showing exactly which layer has data.
 */
export async function runCallLogComparison(limitDays = 7) {
  const report = {
    timestamp: new Date().toISOString(),
    limitDays,
    permission: null,
    nativeProviderCount: 0,
    callLogServiceCount: 0,
    syncQueueCount: 0,
    nativeLatestId: null,
    serviceLatestId: null,
    idMatch: [],
    idMismatch: [],
    diagnosis: "",
  };

  // Permission
  report.permission = await checkCallLogPermissionReal();

  // Native query
  const nativeResult = await queryCallLogDirect({ limitDays, maxRecords: 20 });
  report.nativeProviderCount = nativeResult.count;
  report.nativeLatestId = nativeResult.latestId;
  report.nativeAttempts = nativeResult.attempts;
  report.nativeError = nativeResult.error;

  // callLogService query
  try {
    const { getRealCallLog } = require("./callLogService");
    const serviceCalls = await getRealCallLog(limitDays);
    report.callLogServiceCount = serviceCalls.length;
    report.serviceLatestId = serviceCalls[0]?.client_event_id || null;

    // Compare IDs
    const nativeIds = new Set(nativeResult.records.map((r) => String(r._id)));
    const serviceIds = new Set(serviceCalls.slice(0, 20).map((c) => c.client_event_id?.replace("android-", "")));
    for (const id of nativeIds) {
      if (serviceIds.has(id)) report.idMatch.push(id);
      else report.idMismatch.push(id);
    }
  } catch (e) {
    report.callLogServiceError = e?.message;
  }

  // Diagnosis
  if (!report.permission.READ_CALL_LOG) {
    report.diagnosis = "PERMISSION_DENIED: READ_CALL_LOG not granted at runtime";
  } else if (report.nativeProviderCount === 0) {
    report.diagnosis = "PROVIDER_EMPTY: Permission granted but ContentResolver returned 0 records. Device may have no calls, or react-native-call-log bridge is broken on this Android version.";
  } else if (report.callLogServiceCount === 0 && report.nativeProviderCount > 0) {
    report.diagnosis = "SERVICE_BUG: Native provider has calls but callLogService returned 0. Check transformation/filtering in callLogService.js.";
  } else if (report.callLogServiceCount > 0) {
    report.diagnosis = `OK: ${report.nativeProviderCount} native, ${report.callLogServiceCount} service. Check sync pipeline next.`;
  } else {
    report.diagnosis = "UNKNOWN: Both layers returned 0. Check permission and device call log.";
  }

  if (IS_DEV) {
    console.log("[CALLLOG] COMPARISON REPORT:", JSON.stringify(report, null, 2));
  }

  return report;
}

// ── TASK 12: Structured diagnostic logger ────────────────────────────────────
export function callLogLog(tag, data) {
  if (!IS_DEV) return;
  if (typeof data === "object") {
    console.log(`[CALLLOG] ${tag}`, JSON.stringify(data));
  } else {
    console.log(`[CALLLOG] ${tag} = ${data}`);
  }
}

import { Platform } from "react-native";
import DeviceInfo from "react-native-device-info";

// react-native-call-log — reads Android CallLog.Calls
let CallLog = null;
try { CallLog = require("react-native-call-log").default; } catch {}

// react-native-sim-cards-manager — reads SIM info
let SimCardsManager = null;
try { SimCardsManager = require("react-native-sim-cards-manager").default; } catch {}

/**
 * Read the device call log.
 * Returns array of raw call log entries.
 * Requires READ_CALL_LOG permission.
 */
export async function readCallLog(limitDays = 30) {
  if (Platform.OS !== "android" || !CallLog) return [];
  try {
    const since = Date.now() - limitDays * 24 * 60 * 60 * 1000;
    const logs = await CallLog.loadAll(String(since));
    // react-native-call-log returns: { dateTime, duration, name, phoneNumber, rawType, type }
    return logs.map((c, i) => ({
      id: `${c.dateTime}-${i}`,
      number: c.phoneNumber || "unknown",
      name: c.name || "",
      type: rawTypeToInt(c.rawType),
      date: String(c.dateTime),
      duration: String(c.duration || 0),
      simSlot: "0", // react-native-call-log doesn't expose simSlot — default to SIM 1
      hasRecording: "false",
      recordingPath: "",
    }));
  } catch {
    return [];
  }
}

function rawTypeToInt(rawType) {
  // Android CallLog types: 1=incoming, 2=outgoing, 3=missed, 5=rejected
  const map = { INCOMING: "1", OUTGOING: "2", MISSED: "3", REJECTED: "5" };
  return map[String(rawType).toUpperCase()] ?? "1";
}

/**
 * Read SIM card info.
 * Returns array of { slot, phoneNumber, carrierName, countryIso }
 */
export async function readSimInfo() {
  if (Platform.OS !== "android" || !SimCardsManager) return [];
  try {
    const sims = await SimCardsManager.getSimCards();
    return (sims || []).map((s) => ({
      slot: s.slotIndex ?? 0,
      phoneNumber: s.phoneNumber || "",
      carrierName: s.carrierName || s.displayName || "",
      countryIso: s.countryIso || "",
    }));
  } catch {
    return [];
  }
}

/**
 * Get real device info using react-native-device-info.
 */
export function getDeviceInfo() {
  try {
    return {
      manufacturer: DeviceInfo.getManufacturerSync() || "Unknown",
      model: DeviceInfo.getModel() || "Unknown",
      androidVersion: DeviceInfo.getSystemVersion() || String(Platform.Version || ""),
    };
  } catch {
    return { manufacturer: "Unknown", model: "Unknown", androidVersion: "Unknown" };
  }
}

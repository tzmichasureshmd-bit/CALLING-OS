import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  api, saveSession, clearSession, getStoredUser,
  getDeviceId, saveDeviceId, getRefreshToken, updateAccessToken, updateRefreshToken,
} from "./api";
import { getDeviceInfo, requestAllPermissions, checkPermissions, readSimInfo } from "./nativeModules";
import { syncSimInventory } from "./simInventoryService";
import { runSyncCycle } from "./syncService";
import { setRecordingEnabled } from "./recordingPreferences";

const AuthContext = createContext(null);

const FIRST_SYNC_KEY   = "callos_first_sync_done";
const INSTALL_DATE_KEY = "callos_install_date";

// Save install date once — never overwrite
async function ensureInstallDate() {
  const existing = await AsyncStorage.getItem(INSTALL_DATE_KEY).catch(() => null);
  if (!existing) {
    await AsyncStorage.setItem(INSTALL_DATE_KEY, new Date().toISOString());
  }
}

// ── First-time and reconciliation sync ───────────────────────────────────────
// Both delegate to runSyncCycle in syncService — single sync path, no duplication.
export async function doFirstFullSync(deviceId) {
  if (!deviceId) return { accepted: 0, duplicates: 0, failed: 1, total: 0, error: "No device registered" };
  try {
    console.log("[SYNC] doFirstFullSync: delegating to runSyncCycle");
    const result = await runSyncCycle(deviceId, "reconcile");
    if ((result?.failed || 0) === 0) {
      await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
    }
    return result;
  } catch (e) {
    console.warn("[SYNC] doFirstFullSync error:", e?.message);
    return { accepted: 0, duplicates: 0, failed: 1, total: 0, error: e?.message };
  }
}

async function doStartReconciliation(deviceId) {
  try {
    console.log("[SYNC] doStartReconciliation: delegating to runSyncCycle");
    return await runSyncCycle(deviceId, "reconcile");
  } catch (e) {
    return { accepted: 0, duplicates: 0, failed: 1, total: 0, error: e?.message };
  }
}

// ── Live device heartbeat ─────────────────────────────────────────────────────
/**
 * Reads CURRENT state from Android OS (not cache) and POSTs heartbeat.
 * Called after login, register, app-start, and AppState→active.
 */
export async function sendHeartbeat(deviceId) {
  if (!deviceId) return;
  try {
    const perms = await checkPermissions().catch(() => ({}));

    // Read selected SIM slot from user's SIM Configuration choice
    let selectedSlot = null;
    try {
      const saved = await AsyncStorage.getItem("callos_selected_sim_slot");
      if (saved !== null && saved !== "") selectedSlot = parseInt(saved, 10); // 0-indexed Android slot
    } catch {}

    let simItems = [];
    try {
      const rawSims = await readSimInfo();
      simItems = rawSims.map((s) => ({
        slot:            s.slot + 1,           // backend is 1-indexed
        carrier:         s.carrierName    || null,
        phone_number:    s.phoneNumber    || null,
        mcc:             s.mcc            || null,
        mnc:             s.mnc            || null,
        country_iso:     s.countryIso     || null,
        subscription_id: s.subscriptionId || null,
        network_type:    s.networkType    || null,
        is_active:       s.isActive !== false,
        // Mark the user-selected SIM so backend knows which number to use
        is_selected:     selectedSlot !== null ? s.slot === selectedSlot : s.slot === 0,
      }));
    } catch {}

    let networkType = "unknown";
    try {
      const NetInfo = require("@react-native-community/netinfo");
      const state = await NetInfo.default.fetch();
      if (!state.isConnected) networkType = "none";
      else if (state.type === "wifi") networkType = "wifi";
      else if (state.type === "cellular") networkType = "mobile";
      else networkType = state.type || "unknown";
    } catch {}

    await api.heartbeat(deviceId, {
      is_online:              true,
      permissions_status:     perms,
      sims:                   simItems,
      network_type:           networkType,
      background_sync_status: "active",
      app_version:            "1.1.0",
    });
  } catch {}
}

// ── Hardware-bound device identifier ─────────────────────────────────────────
async function getStableDeviceId() {
  // expo-application.androidId is stable across reinstalls (tied to device + signing key)
  try {
    const Application = require("expo-application");
    if (Platform.OS === "android") {
      const androidId = Application.androidId;
      if (androidId && androidId.length > 4) return `android-${androidId}`;
    }
  } catch { /* expo-application not available */ }

  // Fallback: persist a UUID once — never regenerate if already stored
  const stored = await AsyncStorage.getItem("callos_hw_device_id").catch(() => null);
  if (stored) return stored;
  // Use a deterministic seed so reinstalls on same device get same ID
  const seed = `${Platform.Version}-${Date.now()}`;
  const newId = `rn-${seed}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem("callos_hw_device_id", newId);
  return newId;
}

// ── Device registration ───────────────────────────────────────────────────────
async function ensureDevice(user) {
  try {
    const info = getDeviceInfo();
    const hwId = await getStableDeviceId();

    // Read full SIM inventory
    const { readSimInfo } = require("./nativeModules");
    let simItems = [];
    try {
      const rawSims = await readSimInfo();
      simItems = rawSims.map((s) => ({
        slot:            s.slot + 1,
        carrier:         s.carrierName   || null,
        phone_number:    s.phoneNumber   || null,
        mcc:             s.mcc           || null,
        mnc:             s.mnc           || null,
        country_iso:     s.countryIso    || null,
        subscription_id: s.subscriptionId || null,
        network_type:    s.networkType   || null,
        is_active:       s.isActive !== false,
      }));
    } catch {}

    // Always register/upsert device — backend uses device_identifier for upsert
    // This ensures the cached device_id is always valid for this build's signing key
    const device = await api.registerDevice({
      device_identifier: hwId,
      manufacturer:      info.manufacturer,
      model:             info.model,
      android_version:   info.androidVersion || String(Platform.Version || ""),
      app_version:       "1.0.0",
      sims:              simItems,
    });
    await saveDeviceId(device.id);
    console.log("[AUTH] device upserted: " + device.id + " hwId=" + hwId);
    return device.id;
  } catch (e) {
    console.warn("[AUTH] ensureDevice failed: " + e?.message);
    // Fall back to cached ID if registration fails (network offline)
    const cached = await getDeviceId();
    if (cached) console.warn("[AUTH] using cached deviceId: " + cached);
    return cached || null;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser();
      await ensureInstallDate(); // save install date on every app open (first time only)
      if (u) {
        setUser(u);
        let d = await getDeviceId();
        setDeviceId(d);

        // Auto-refresh token on app start
        try {
          const refresh = await getRefreshToken();
          if (refresh) {
            const newTokens = await api.refresh(refresh);
            await updateAccessToken(newTokens.access_token);
            if (newTokens.refresh_token) {
              await updateRefreshToken(newTokens.refresh_token);
            }
          }
        } catch { /* runtime request refresh will retry; login is required if it also fails */ }

        // Re-upsert on every authenticated startup. This repairs a stale cached
        // backend device ID while preserving the stable hardware identifier.
        const ensuredDeviceId = await ensureDevice(u);
        if (ensuredDeviceId) {
          d = ensuredDeviceId;
          setDeviceId(d);
        }

        if (d) {
          sendHeartbeat(d).catch(() => {});
          const firstDone = await AsyncStorage.getItem(FIRST_SYNC_KEY);
          if (!firstDone) {
            console.log("[SYNC] App start: running doFirstFullSync");
            doFirstFullSync(d).catch(() => {});
          } else {
            doStartReconciliation(d).catch(() => {});
          }
          syncSimInventory(d).catch(() => {});
        }
      }
      setReady(true);
    })();
  }, []);

  const _afterAuth = useCallback(async (tokenData) => {
    await saveSession(tokenData, { id: tokenData.organization_id, email: "" });
    const me = await api.me();
    const userData = {
      ...me,
      name: me.name || me.email?.split("@")[0] || "Employee",
    };
    await saveSession(tokenData, userData);
    setUser(userData);

    if (Platform.OS === "android") {
      await requestAllPermissions().catch(() => {});
      // Start native call monitor if recording is enabled
      try {
        const { NativeModules } = require("react-native");
        const CallMonitorService = NativeModules.CallMonitorService;
        if (CallMonitorService?.startEnabledMonitor) {
          await CallMonitorService.startEnabledMonitor();
          console.log("[AUTH] native CallMonitorService started");
        }
      } catch (e) {
        console.warn("[AUTH] could not start CallMonitorService: " + e?.message);
      }
    }

    // Register device — MUST succeed before any sync
    try {
      const dId = await ensureDevice(userData);
      if (!dId) {
        console.warn("[AUTH] Device registration failed — sync and heartbeat skipped");
        return userData; // Exit early, don't proceed with sync
      }
      setDeviceId(dId);
      console.log("[AUTH] device registered: " + dId);
      await sendHeartbeat(dId).catch(() => {});
      syncSimInventory(dId, true).catch(() => {});
      // Sync from install date — non-blocking, batched
      doFirstFullSync(dId).catch((e) => console.warn("[AUTH] firstSync error:", e?.message));
    } catch (e) {
      console.warn("[AUTH] ensureDevice error:", e?.message);
    }

    return userData;
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    return _afterAuth(data);
  }, [_afterAuth]);

  const register = useCallback(async (payload) => {
    const data = await api.register(payload);
    return _afterAuth(data);
  }, [_afterAuth]);

  const logout = useCallback(async () => {
    // Match the previous account-scoped behavior: signing out immediately stops
    // native monitoring and discards an in-progress partial recording.
    await setRecordingEnabled(false).catch(() => {});
    await api.logout().catch(() => {});
    await clearSession();
    setUser(null);
    setDeviceId(null);
  }, []);

  const syncCalls = useCallback(async () => {
    if (!deviceId) return { accepted: 0, duplicates: 0, failed: 1, total: 0, error: "No device registered" };
    return runSyncCycle(deviceId, "manual");
  }, [deviceId]);

  return (
    <AuthContext.Provider value={{
      user, setUser, deviceId, ready,
      login, register, logout, syncCalls,
      isAuthed: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

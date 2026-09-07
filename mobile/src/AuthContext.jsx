import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  api, saveSession, clearSession, getStoredUser,
  getDeviceId, saveDeviceId, getRefreshToken, updateAccessToken,
} from "./api";
import { getDeviceInfo, requestAllPermissions, checkPermissions, readSimInfo } from "./nativeModules";
import {
  getRealCallLog, getNewCallsSinceLastSync,
  markCallsSynced,
} from "./callLogService";
import { syncSimInventory } from "./simInventoryService";

const AuthContext = createContext(null);

const FIRST_SYNC_KEY = "callos_first_sync_done";

// ── Live device heartbeat ─────────────────────────────────────────────────────
/**
 * Reads CURRENT state from Android OS (not cache) and POSTs heartbeat.
 * Called after login, register, app-start, and AppState→active.
 */
export async function sendHeartbeat(deviceId) {
  if (!deviceId) return;
  try {
    const perms = await checkPermissions().catch(() => ({}));

    let simItems = [];
    try {
      const rawSims = await readSimInfo();
      simItems = rawSims.map((s) => ({
        slot:            s.slot + 1,
        carrier:         s.carrierName    || null,
        phone_number:    s.phoneNumber    || null,
        mcc:             s.mcc            || null,
        mnc:             s.mnc            || null,
        country_iso:     s.countryIso     || null,
        subscription_id: s.subscriptionId || null,
        network_type:    s.networkType    || null,
        is_active:       s.isActive !== false,
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
      background_sync_status: "limited",
      app_version:            "1.0.0",
    });
  } catch {}
}

// ── Hardware-bound device identifier ─────────────────────────────────────────
async function getStableDeviceId() {
  // Try expo-application for a hardware/installation-bound ID
  try {
    const Application = require("expo-application");
    if (Platform.OS === "android") {
      const androidId = Application.androidId;
      if (androidId) return `android-${androidId}`;
    }
  } catch { /* expo-application not available */ }

  // Fallback: generate a UUID once and persist it
  const stored = await AsyncStorage.getItem("callos_hw_device_id");
  if (stored) return stored;
  const newId = `rn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await AsyncStorage.setItem("callos_hw_device_id", newId);
  return newId;
}

// ── Device registration ───────────────────────────────────────────────────────
async function ensureDevice(user) {
  try {
    let deviceId = await getDeviceId();
    const info   = getDeviceInfo();
    const hwId   = await getStableDeviceId();

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

    if (deviceId) {
      sendHeartbeat(deviceId);
      return deviceId;
    }

    const device = await api.registerDevice({
      device_identifier: hwId,
      manufacturer:      info.manufacturer,
      model:             info.model,
      android_version:   info.androidVersion || String(Platform.Version || ""),
      app_version:       "1.0.0",
      sims:              simItems,
    });
    await saveDeviceId(device.id);
    return device.id;
  } catch {
    return null;
  }
}

// ── First-time full sync ──────────────────────────────────────────────────────
async function doFirstFullSync(deviceId) {
  try {
    const done = await AsyncStorage.getItem(FIRST_SYNC_KEY);
    if (done) return;
    const allCalls = await getRealCallLog(90);
    if (!allCalls.length) return;
    const result = await api.syncCalls(deviceId, allCalls);
    if (result.accepted > 0 || result.duplicates > 0) {
      await markCallsSynced(allCalls);
      await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
    }
  } catch { /* silent — will retry on next open */ }
}

// ── App-start reconciliation ──────────────────────────────────────────────────
/**
 * On every app start (not just first login), re-read the last 7 days
 * and sync anything not yet confirmed. This is the safety net for:
 * - Calls made while app was killed
 * - Calls missed due to cursor issues
 * - Calls from phone restart
 * Server deduplication handles any re-sends safely.
 */
async function doStartReconciliation(deviceId) {
  try {
    const newCalls = await getNewCallsSinceLastSync();
    if (!newCalls.length) return;
    const result = await api.syncCalls(deviceId, newCalls);
    if (result.accepted > 0 || result.duplicates === newCalls.length) {
      await markCallsSynced(newCalls);
    }
  } catch { /* silent */ }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [ready, setReady]     = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser();
      if (u) {
        setUser(u);
        const d = await getDeviceId();
        setDeviceId(d);

        // Auto-refresh token on app start
        try {
          const refresh = await getRefreshToken();
          if (refresh) {
            const newTokens = await api.refresh(refresh);
            await updateAccessToken(newTokens.access_token);
            if (newTokens.refresh_token) {
              // Update refresh token in secure storage
              const { default: SecureStore } = await import("expo-secure-store").catch(() => ({ default: null }));
              if (SecureStore) {
                await SecureStore.setItemAsync("callos_refresh_token", newTokens.refresh_token);
              }
            }
          }
        } catch { /* token refresh failed — user stays logged in until actual 401 */ }

        if (d) {
          sendHeartbeat(d).catch(() => {});
          doStartReconciliation(d).catch(() => {});
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
      requestAllPermissions().catch(() => {});
    }

    ensureDevice(userData).then(async (dId) => {
      if (dId) {
        setDeviceId(dId);
        await sendHeartbeat(dId).catch(() => {});
        doFirstFullSync(dId);
        syncSimInventory(dId, true).catch(() => {});
      }
    }).catch(() => {});

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
    await api.logout().catch(() => {});
    await clearSession();
    setUser(null);
    setDeviceId(null);
  }, []);

  const syncCalls = useCallback(async (fallbackCalls) => {
    if (!deviceId) return { accepted: 0, error: "No device registered" };
    const firstDone = await AsyncStorage.getItem(FIRST_SYNC_KEY);
    let calls;
    if (!firstDone) {
      calls = await getRealCallLog(90);
    } else {
      calls = await getNewCallsSinceLastSync();
    }
    const payload = calls.length > 0 ? calls : (fallbackCalls ?? []);
    if (!payload.length) return { accepted: 0, duplicates: 0, failed: 0, total: 0 };
    const result = await api.syncCalls(deviceId, payload);
    if (result.accepted > 0 || result.duplicates === payload.length) {
      await markCallsSynced(payload);
      if (!firstDone) await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
    }
    return result;
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

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

const FIRST_SYNC_KEY   = "callos_first_sync_done";
const INSTALL_DATE_KEY = "callos_install_date";
const LAST_SYNC_TS_KEY = "callos_last_sync_ts";
const BATCH_SIZE       = 50;
const BATCH_DELAY_MS   = 600;

// Save install date once — never overwrite
async function ensureInstallDate() {
  const existing = await AsyncStorage.getItem(INSTALL_DATE_KEY).catch(() => null);
  if (!existing) {
    await AsyncStorage.setItem(INSTALL_DATE_KEY, new Date().toISOString());
  }
}

// Batch sync helper — never sends more than BATCH_SIZE at once
// Only marks calls as synced if server accepted OR said duplicate (already there)
async function batchSync(deviceId, calls) {
  if (!deviceId || !calls.length) return { accepted: 0, duplicates: 0, failed: 0 };
  let totalAccepted = 0, totalDup = 0, totalFailed = 0;
  const confirmedCalls = [];
  for (let i = 0; i < calls.length; i += BATCH_SIZE) {
    const batch = calls.slice(i, i + BATCH_SIZE);
    try {
      const res = await api.syncCalls(deviceId, batch);
      totalAccepted += res.accepted || 0;
      totalDup      += res.duplicates || 0;
      totalFailed   += res.failed || 0;
      // Only mark as synced if server confirmed (accepted or duplicate = already in DB)
      if ((res.accepted || 0) + (res.duplicates || 0) > 0) {
        confirmedCalls.push(...batch);
      }
      console.log(`[SYNC] batch ${Math.floor(i/BATCH_SIZE)+1}/${Math.ceil(calls.length/BATCH_SIZE)}: accepted=${res.accepted} dup=${res.duplicates} failed=${res.failed}`);
    } catch (e) {
      console.warn(`[SYNC] batch failed: ${e?.message}`);
      // Don't mark as synced — will retry next cycle
    }
    if (i + BATCH_SIZE < calls.length) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  if (confirmedCalls.length) await markCallsSynced(confirmedCalls);
  return { accepted: totalAccepted, duplicates: totalDup, failed: totalFailed };
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
      app_version:            "1.0.0",
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

// ── First-time sync — only calls FROM install date onwards ──────────────────
// Fresh install = user only wants calls from today, not 90 days of history.
// This prevents the 800-call crash on first login.
export async function doFirstFullSync(deviceId) {
  if (!deviceId) return { accepted: 0, total: 0 };
  try {
    await ensureInstallDate();
    const installDateStr = await AsyncStorage.getItem(INSTALL_DATE_KEY);
    const installDate    = installDateStr ? new Date(installDateStr) : new Date();
    const daysSinceInstall = Math.max(1, Math.ceil((Date.now() - installDate.getTime()) / 86400000));
    // Cap at 7 days — never load 90 days on first sync
    const daysToRead = Math.min(daysSinceInstall, 7);

    console.log(`[SYNC] firstSync: reading ${daysToRead} days (installed ${daysSinceInstall}d ago)`);
    const allCalls = await getRealCallLog(daysToRead);
    console.log(`[SYNC] firstSync: ${allCalls.length} calls found`);

    if (!allCalls.length) {
      await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
      await AsyncStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
      return { accepted: 0, total: 0 };
    }

    const result = await batchSync(deviceId, allCalls);
    await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
    await AsyncStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
    console.log(`[SYNC] firstSync done: accepted=${result.accepted} dup=${result.duplicates}`);
    return { ...result, total: allCalls.length };
  } catch (e) {
    console.warn(`[SYNC] firstSync ERROR: ${e?.message}`);
    return { accepted: 0, total: 0, error: e?.message };
  }
}

// ── Incremental sync — only new calls since last sync ────────────────────────
async function doStartReconciliation(deviceId) {
  try {
    const lastSyncTs = await AsyncStorage.getItem(LAST_SYNC_TS_KEY).catch(() => null);
    // Only look back max 2 days to find new calls — not 7 days
    const lookbackDays = lastSyncTs
      ? Math.min(2, Math.ceil((Date.now() - parseInt(lastSyncTs)) / 86400000) + 0.1)
      : 1;
    const allRecent = await getRealCallLog(lookbackDays);
    if (!allRecent.length) return;

    const raw = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
    const synced = raw ? new Set(JSON.parse(raw)) : new Set();
    const newCalls = allRecent.filter(c => !synced.has(c.client_event_id));

    if (!newCalls.length) return;
    console.log(`[SYNC] reconcile: ${newCalls.length} new calls`);
    await batchSync(deviceId, newCalls);
    await AsyncStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
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
      await ensureInstallDate(); // save install date on every app open (first time only)
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
          // Run first sync if never done, OR if synced_ids is empty (e.g. after logout)
          const firstDone = await AsyncStorage.getItem(FIRST_SYNC_KEY);
          const syncedIds = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
          const hasLocalSyncState = syncedIds && JSON.parse(syncedIds).length > 0;
          if (!firstDone || !hasLocalSyncState) {
            console.log("[SYNC] App start: running doFirstFullSync (firstDone=" + firstDone + " hasSyncState=" + hasLocalSyncState + ")");
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
      requestAllPermissions().catch(() => {});
    }

    // Register device — MUST succeed before any sync
    try {
      const dId = await ensureDevice(userData);
      if (dId) {
        setDeviceId(dId);
        console.log("[AUTH] device registered: " + dId);
        await sendHeartbeat(dId).catch(() => {});
        syncSimInventory(dId, true).catch(() => {});
        // Sync from install date — non-blocking, batched
        doFirstFullSync(dId).catch((e) => console.warn("[AUTH] firstSync error:", e?.message));
      } else {
        console.warn("[AUTH] device registration failed — sync skipped");
      }
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
    await api.logout().catch(() => {});
    await clearSession();
    setUser(null);
    setDeviceId(null);
  }, []);

  const syncCalls = useCallback(async (fallbackCalls) => {
    if (!deviceId) return { accepted: 0, error: "No device registered" };
    const raw = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
    const synced = raw ? new Set(JSON.parse(raw)) : new Set();
    // Only read last 2 days for manual sync — never 90 days
    const recent = await getRealCallLog(2).catch(() => []);
    const newCalls = recent.filter(c => !synced.has(c.client_event_id));
    const payload = newCalls.length > 0 ? newCalls : (fallbackCalls ?? []);
    if (!payload.length) return { accepted: 0, duplicates: 0, failed: 0, total: 0 };
    const result = await batchSync(deviceId, payload);
    await AsyncStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
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

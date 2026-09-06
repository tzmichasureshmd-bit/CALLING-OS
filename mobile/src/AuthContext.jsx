import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, saveSession, clearSession, getStoredUser, getDeviceId, saveDeviceId } from "./api";
import { getDeviceInfo, requestAllPermissions } from "./nativeModules";
import { getRealCallLog, getNewCallsSinceLastSync, markSyncComplete, getPrimarySimInfo } from "./callLogService";

const AuthContext = createContext(null);

const FIRST_SYNC_KEY = "callos_first_sync_done";

async function ensureDevice(user) {
  try {
    let deviceId = await getDeviceId();
    const info = getDeviceInfo();
    const simInfo = await getPrimarySimInfo();

    if (deviceId) {
      // Update SIM info on existing device via heartbeat
      api.heartbeat(deviceId, {
        is_online: true,
        sim_phone_number: simInfo.sim_phone_number,
        sim_carrier: simInfo.sim_carrier,
      }).catch(() => {});
      return deviceId;
    }

    const device = await api.registerDevice({
      device_identifier: `${Platform.OS}-${user.id}`,
      manufacturer: info.manufacturer,
      model: info.model,
      android_version: info.androidVersion || String(Platform.Version || ""),
      app_version: "1.0.0",
      sim_phone_number: simInfo.sim_phone_number,
      sim_carrier: simInfo.sim_carrier,
    });
    await saveDeviceId(device.id);
    return device.id;
  } catch {
    return null;
  }
}

// On first login: sync ALL existing call logs (not just new ones)
async function doFirstFullSync(deviceId) {
  try {
    const done = await AsyncStorage.getItem(FIRST_SYNC_KEY);
    if (done) return;
    const allCalls = await getRealCallLog(90); // last 90 days
    if (!allCalls.length) return;
    await api.syncCalls(deviceId, allCalls);
    await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
    await markSyncComplete();
  } catch { /* silent */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const u = await getStoredUser();
      if (u) {
        setUser(u);
        const d = await getDeviceId();
        setDeviceId(d);
      }
      setReady(true);
    })();
  }, []);

  const _afterAuth = useCallback(async (tokenData) => {
    // 1. Save token first so api.me() is authenticated
    await saveSession(tokenData, { id: tokenData.organization_id, email: "" });
    const me = await api.me();
    const userData = {
      ...me,
      name: me.name || me.email?.split("@")[0] || "Employee",
    };
    await saveSession(tokenData, userData);
    setUser(userData);

    // 2. Request ALL permissions immediately after login
    if (Platform.OS === "android") {
      requestAllPermissions().catch(() => {});
    }

    // 3. Register device + verify SIM in background
    ensureDevice(userData).then(async (dId) => {
      if (dId) {
        setDeviceId(dId);
        // 4. First-time full call log sync
        doFirstFullSync(dId);
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
    await clearSession();
    await AsyncStorage.removeItem(FIRST_SYNC_KEY); // reset so next login re-syncs
    setUser(null);
    setDeviceId(null);
  }, []);

  // Sync calls — full on first login, incremental after
  const syncCalls = useCallback(async (fallbackCalls) => {
    if (!deviceId) return { accepted: 0, error: "No device registered" };

    // Check if first sync done
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
    if (result.accepted > 0) {
      await markSyncComplete();
      if (!firstDone) await AsyncStorage.setItem(FIRST_SYNC_KEY, "1");
    }
    return result;
  }, [deviceId]);

  return (
    <AuthContext.Provider value={{ user, setUser, deviceId, ready, login, register, logout, syncCalls, isAuthed: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, saveSession, clearSession, getStoredUser, getDeviceId, saveDeviceId } from "./api";
import { getDeviceInfo } from "./nativeModules";
import { getNewCallsSinceLastSync, markSyncComplete, getPrimarySimInfo } from "./callLogService";

const AuthContext = createContext(null);

async function ensureDevice(user) {
  try {
    let deviceId = await getDeviceId();
    if (deviceId) return deviceId;

    const info = getDeviceInfo();
    const simInfo = await getPrimarySimInfo();

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
    await saveSession(tokenData, { id: tokenData.organization_id, email: "" }); // save token first
    const me = await api.me();
    await saveSession(tokenData, me);
    setUser(me);
    // Register device in background — don't block login
    ensureDevice(me).then(setDeviceId).catch(() => {});
    return me;
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
    setUser(null);
    setDeviceId(null);
  }, []);

  // Sync calls — uses real device call log when available, falls back to provided list
  const syncCalls = useCallback(async (fallbackCalls) => {
    if (!deviceId) return { accepted: 0, error: "No device registered" };
    const realCalls = await getNewCallsSinceLastSync();
    const payload = realCalls.length > 0 ? realCalls : (fallbackCalls ?? []);
    if (!payload.length) return { accepted: 0, duplicates: 0, failed: 0, total: 0 };
    const result = await api.syncCalls(deviceId, payload);
    if (result.accepted > 0) await markSyncComplete();
    return result;
  }, [deviceId]);

  return (
    <AuthContext.Provider value={{ user, deviceId, ready, login, register, logout, syncCalls, isAuthed: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

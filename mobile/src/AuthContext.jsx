import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, saveSession, clearSession, getStoredUser, getDeviceId, saveDeviceId } from "./api";

const AuthContext = createContext(null);

async function ensureDevice(user) {
  try {
    let deviceId = await getDeviceId();
    if (deviceId) return deviceId;

    // Register this device with the backend
    const device = await api.registerDevice({
      device_identifier: `${Platform.OS}-${user.id}`,
      manufacturer: "Android",
      model: Platform.OS === "android" ? "Android Device" : "iOS Device",
      android_version: String(Platform.Version || ""),
      app_version: "1.0.0",
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

  // Sync a list of call records to the backend
  const syncCalls = useCallback(async (calls) => {
    if (!deviceId) return { accepted: 0, error: "No device registered" };
    return api.syncCalls(deviceId, calls);
  }, [deviceId]);

  return (
    <AuthContext.Provider value={{ user, deviceId, ready, login, register, logout, syncCalls, isAuthed: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import AsyncStorage from "@react-native-async-storage/async-storage";

// Use SecureStore for sensitive tokens (Android Keystore encrypted)
let SecureStore = null;
try {
  SecureStore = require("expo-secure-store");
} catch {
  // expo-secure-store not available — fall back to AsyncStorage with a warning
  console.warn("[CallNexa] expo-secure-store unavailable — tokens stored in AsyncStorage");
}

export const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://api.callingos.tzmicha.com/api/v1";

// ── Secure token storage ──────────────────────────────────────────────────────

async function secureGet(key) {
  try {
    if (SecureStore) return await SecureStore.getItemAsync(key);
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function secureSet(key, value) {
  try {
    if (SecureStore) return await SecureStore.setItemAsync(key, value || "");
    return await AsyncStorage.setItem(key, value || "");
  } catch { /* non-critical */ }
}

async function secureDelete(key) {
  try {
    if (SecureStore) return await SecureStore.deleteItemAsync(key);
    return await AsyncStorage.removeItem(key);
  } catch { /* non-critical */ }
}

async function getToken() {
  return secureGet("callos_token");
}

// ── HTTP client ───────────────────────────────────────────────────────────────

async function request(method, path, body = null) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body:   body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.message || `HTTP ${res.status}`);
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out. Check your connection.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login:          (email, password) => request("POST", "/auth/login", { email, password }),
  register:       ({ name, email, password, company_code }) =>
    request("POST", "/auth/register/employee", { name, email, password, company_code }),
  me:             () => request("GET", "/auth/me"),
  updateProfile:  (payload) => request("PATCH", "/auth/me", payload),
  refresh:        (refreshToken) => request("POST", "/auth/refresh", { refresh_token: refreshToken }),
  logout:         () => request("POST", "/auth/logout").catch(() => {}),

  // Device
  registerDevice: (payload) => request("POST", "/devices/register", payload),
  heartbeat:      (deviceId, payload) => request("POST", `/devices/${deviceId}/heartbeat`, payload),
  syncSims:       (deviceId, sims) => request("POST", `/devices/${deviceId}/sims/sync`, sims),

  // Calls
  getCalls: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/calls${q ? "?" + q : ""}`);
  },
  getCall:   (callId) => request("GET", `/calls/${callId}`),
  syncCalls: (deviceId, calls) =>
    request("POST", "/calls/sync", { device_id: deviceId, calls }),

  // Analytics
  getAnalytics: (range = "today") =>
    request("GET", `/analytics/dashboard?range=${range}`),
};

// ── Session helpers ───────────────────────────────────────────────────────────

export async function saveSession(tokenData, meData) {
  await secureSet("callos_token",         tokenData.access_token);
  await secureSet("callos_refresh_token", tokenData.refresh_token || "");
  // Non-sensitive user profile stays in AsyncStorage
  await AsyncStorage.setItem("callos_user", JSON.stringify(meData));
}

export async function clearSession() {
  await secureDelete("callos_token");
  await secureDelete("callos_refresh_token");
  await AsyncStorage.multiRemove([
    "callos_user",
    "callos_device_id",
    "callos_first_sync_done",
    "callos_sync_fail_count",
  ]);
}

export async function getStoredUser() {
  try {
    const u = await AsyncStorage.getItem("callos_user");
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export async function getDeviceId() {
  try {
    return await AsyncStorage.getItem("callos_device_id");
  } catch {
    return null;
  }
}

export async function saveDeviceId(id) {
  await AsyncStorage.setItem("callos_device_id", id);
}

export async function getRefreshToken() {
  return secureGet("callos_refresh_token");
}

export async function updateAccessToken(token) {
  await secureSet("callos_token", token);
}

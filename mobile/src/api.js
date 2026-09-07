import AsyncStorage from "@react-native-async-storage/async-storage";

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://api.callingos.tzmicha.com/api/v1";

async function getToken() {
  try { return await AsyncStorage.getItem("callos_token"); } catch { return null; }
}

async function request(method, path, body = null) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out. Check your connection.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  login: (email, password) => request("POST", "/auth/login", { email, password }),
  register: ({ name, email, password, company_code }) =>
    request("POST", "/auth/register/employee", { name, email, password, company_code }),
  me: () => request("GET", "/auth/me"),
  updateProfile: (payload) => request("PATCH", "/auth/me", payload),
  refresh: (refreshToken) => request("POST", "/auth/refresh", { refresh_token: refreshToken }),

  // ── Device ────────────────────────────────────────────────────────────────
  registerDevice: (payload) => request("POST", "/devices/register", payload),
  heartbeat: (deviceId, payload) => request("POST", `/devices/${deviceId}/heartbeat`, payload),

  // ── Calls ─────────────────────────────────────────────────────────────────
  getCalls: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/calls${q ? "?" + q : ""}`);
  },
  syncCalls: (deviceId, calls) => request("POST", "/calls/sync", { device_id: deviceId, calls }),

  // ── Analytics ─────────────────────────────────────────────────────────────
  getAnalytics: (range = "today") => request("GET", `/analytics/dashboard?range=${range}`),
};

// ── Session helpers ───────────────────────────────────────────────────────────
export async function saveSession(tokenData, meData) {
  await AsyncStorage.setItem("callos_token", tokenData.access_token);
  await AsyncStorage.setItem("callos_refresh_token", tokenData.refresh_token || "");
  await AsyncStorage.setItem("callos_user", JSON.stringify(meData));
}

export async function clearSession() {
  await AsyncStorage.multiRemove(["callos_token", "callos_refresh_token", "callos_user", "callos_device_id"]);
}

export async function getStoredUser() {
  try {
    const u = await AsyncStorage.getItem("callos_user");
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}

export async function getDeviceId() {
  try { return await AsyncStorage.getItem("callos_device_id"); } catch { return null; }
}

export async function saveDeviceId(id) {
  await AsyncStorage.setItem("callos_device_id", id);
}

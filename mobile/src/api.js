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

let _refreshPromise = null;

async function refreshAccessToken() {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = await secureGet("callos_refresh_token");
    if (!refreshToken) throw new Error("No refresh token available");

    const res = await fetchWithRetry(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      throw new Error(`HTTP ${res.status}: Session refresh failed`);
    }

    await secureSet("callos_token", data.access_token);
    if (data.refresh_token) await secureSet("callos_refresh_token", data.refresh_token);
    return data.access_token;
  })().finally(() => { _refreshPromise = null; });

  return _refreshPromise;
}

// Retry fetch with exponential backoff — works on both WiFi and mobile data
async function fetchWithRetry(url, options, retries = 2) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    // 60s for sync/upload endpoints (batch DB inserts can be slow on shared hosting);
    // 12s for everything else.
    const isSyncOrUpload = options?._isSyncOrUpload === true;
    const timeout = isSyncOrUpload ? 60000 : 12000;
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (i < retries - 1) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

async function request(method, path, body = null, allowAuthRefresh = true) {
  const token = await getToken();
  const headers = {
    "Content-Type": "application/json",
    "X-Correlation-ID": `mob-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Mark sync and recording upload paths so fetchWithRetry uses the longer timeout
  const isSyncOrUpload = path.startsWith("/calls/sync") || path.includes("/recording");

  try {
    const res = await fetchWithRetry(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      _isSyncOrUpload: isSyncOrUpload,
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 && allowAuthRefresh && path !== "/auth/refresh") {
      try {
        await refreshAccessToken();
      } catch {
        throw new Error("HTTP 401: Session expired. Please sign in again.");
      }
      return request(method, path, body, false);
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${data.detail || data.message || "Request failed"}`);
    }
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request timed out. Check your connection.");
    throw e;
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
  getCall:            (callId) => request("GET", `/calls/${callId}`),
  syncCalls:          (deviceId, calls) => request("POST", "/calls/sync", { device_id: deviceId, calls }),
  getTranscript:      (callId) => request("GET", `/transcripts/${callId}`),
  updateCallNote:     (callId, status, notes) => request("PATCH", `/calls/${callId}/note`, { call_status: status, notes }),
  setCallPrivacy:     (callId, privacy) => request("PATCH", `/calls/${callId}/privacy`, { call_privacy: privacy }),
  getExcludedNumbers: () => request("GET", "/excluded-phone-numbers"),

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
    "callos_synced_ids",
    "callos_last_sync_ts",
    // callos_install_date is intentionally NOT removed here.
    // It must survive logout/login cycles — only a real uninstall should reset it.
    // callos_hw_device_id is also preserved for the same reason.
    "callos_upload_queue",
    "callos_selected_subscription_id",
    "callos_selected_sim_slot",
    "callos_selected_sim_carrier",
    "callos_selected_sim_snapshot",
    "callos_inapp_notifications",
    // Privacy-sensitive preferences/caches are account-scoped in practice.
    // Do not carry them into a different employee or organization session.
    "callos_recording_enabled",
    "callos_excluded_numbers_cache",
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

export async function updateRefreshToken(token) {
  await secureSet("callos_refresh_token", token);
}

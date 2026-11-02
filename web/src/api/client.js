import axios from "axios";

// Centralized axios instance. Base URL from env; no hardcoded server.
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const client = axios.create({
  baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// --- Auth token handling (in-memory + optional storage) ---
let accessToken = null;
export function setAccessToken(token) {
  accessToken = token;
}

function updateSavedOrganizationTokens(newAccessToken, newRefreshToken) {
  try {
    const user = JSON.parse(localStorage.getItem("callos_user") || "null");
    const organizations = JSON.parse(localStorage.getItem("callos_orgs") || "[]");
    if (!user?.organization_id || !Array.isArray(organizations)) return;
    const updated = organizations.map((organization) =>
      organization.id === user.organization_id
        ? {
            ...organization,
            access_token: newAccessToken,
            refresh_token: newRefreshToken || organization.refresh_token || "",
          }
        : organization
    );
    localStorage.setItem("callos_orgs", JSON.stringify(updated));
  } catch { /* malformed optional account cache must not break auth */ }
}

client.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// --- Normalize errors + auto token refresh on 401 ---
let _refreshPromise = null;

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    // Auto-refresh on 401 (token expired) — only once per request
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        if (!_refreshPromise) {
          const refreshToken = localStorage.getItem("callos_refresh_token");
          if (!refreshToken) throw new Error("No refresh token");
          _refreshPromise = axios.post(`${baseURL}/auth/refresh`, { refresh_token: refreshToken })
            .then((res) => {
              const newToken = res.data.access_token;
              setAccessToken(newToken);
              localStorage.setItem("callos_token", newToken);
              const newRefreshToken = res.data.refresh_token || refreshToken;
              if (res.data.refresh_token) localStorage.setItem("callos_refresh_token", res.data.refresh_token);
              updateSavedOrganizationTokens(newToken, newRefreshToken);
              return newToken;
            })
            .finally(() => { _refreshPromise = null; });
        }
        const newToken = await _refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch {
        // Refresh failed — clear session and redirect to login
        setAccessToken(null);
        localStorage.removeItem("callos_token");
        localStorage.removeItem("callos_refresh_token");
        localStorage.removeItem("callos_user");
        localStorage.removeItem("callos_orgs");
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    const data = error.response?.data;
    const normalized = {
      error_code:
        data?.error_code ||
        (status === 401 ? "AUTH_ERROR"
          : status === 403 ? "PERMISSION_ERROR"
          : status === 422 ? "VALIDATION_ERROR"
          : status === 404 ? "NOT_FOUND"
          : error.code === "ECONNABORTED" || !error.response ? "NETWORK_ERROR"
          : "SERVER_ERROR"),
      message: data?.detail || data?.message || error.message || "Request failed",
      status,
      details: data?.details,
    };
    return Promise.reject(normalized);
  }
);

export default client;

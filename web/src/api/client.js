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

client.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

// --- Normalize errors into structured shape used by ErrorState ---
client.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const normalized = {
      error_code:
        data?.error_code ||
        (status === 401
          ? "AUTH_ERROR"
          : status === 403
          ? "PERMISSION_ERROR"
          : status === 422
          ? "VALIDATION_ERROR"
          : status === 404
          ? "NOT_FOUND"
          : error.code === "ECONNABORTED" || !error.response
          ? "NETWORK_ERROR"
          : "SERVER_ERROR"),
      message: data?.message || error.message || "Request failed",
      status,
      details: data?.details,
    };
    return Promise.reject(normalized);
  }
);

export default client;

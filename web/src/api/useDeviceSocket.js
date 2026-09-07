import { useEffect, useRef, useState, useCallback } from "react";
import { devicesApi } from "./resources.js";

const WS_BASE = (import.meta.env.VITE_API_URL || "https://api.callingos.tzmicha.com/api/v1")
  .replace(/^http/, "ws");

function normalizeDevice(d) {
  const perms = d.permissions_status || {};
  const callLog    = perms.callLog    ?? perms.call_log    ?? false;
  const phoneState = perms.phoneState ?? perms.phone_state ?? false;
  const contacts   = perms.contacts   ?? false;
  const recording  = perms.recording  ?? false;
  const allOk = callLog && phoneState && contacts && recording;
  const status = !d.is_online ? "offline" : !allOk ? "warning" : "healthy";
  return {
    id:          d.id,
    employee:    d.employee_name || d.employee_id,
    device:      d.model || "Unknown",
    android:     d.android_version || "—",
    appVersion:  d.app_version || "—",
    battery:     d.battery_level ?? 0,
    lastSeenAt:  d.last_seen_at || null,
    permissions: { callLog, phoneState, contacts, recording },
    sim:         d.sims?.[0]?.carrier || d.sims?.[0]?.phone_number || "SIM 1",
    background:  perms.background ? "ok" : "warning",
    is_online:   !!d.is_online,
    latitude:    d.latitude  ?? null,
    longitude:   d.longitude ?? null,
    wifi_ssid:   d.wifi_ssid || null,
    status,
  };
}

/**
 * Real-time device list via WebSocket.
 * Falls back to 10s HTTP polling if WS is unavailable.
 *
 * Returns: { devices, connected, error, refetch }
 */
export function useDeviceSocket() {
  const [devices, setDevices]     = useState(null);   // null = first load
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(null);
  const wsRef      = useRef(null);
  const retryRef   = useRef(null);
  const pingRef    = useRef(null);
  const fallbackRef = useRef(null);
  const retryCount = useRef(0);

  // HTTP fallback fetch
  const refetch = useCallback(async () => {
    try {
      const res = await devicesApi.list();
      const items = (Array.isArray(res) ? res : res?.items || []).map(normalizeDevice);
      setDevices(items);
      setError(null);
    } catch (e) {
      setError(e);
    }
  }, []);

  const connect = useCallback(() => {
    const token   = localStorage.getItem("callos_token");
    const userRaw = localStorage.getItem("callos_user");
    if (!token || !userRaw) return;

    let orgId;
    try { orgId = JSON.parse(userRaw).organization_id; } catch { return; }
    if (!orgId) return;

    const url = `${WS_BASE}/devices/ws/${orgId}?token=${token}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      retryCount.current = 0;
      // Clear HTTP fallback if WS is up
      clearInterval(fallbackRef.current);
      // Ping every 25s to keep connection alive
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg === "pong") return;

        if (msg.event === "snapshot") {
          setDevices(msg.devices.map(normalizeDevice));
        } else if (msg.event === "device_update") {
          const updated = normalizeDevice(msg.device);
          setDevices((prev) => {
            if (!prev) return [updated];
            const idx = prev.findIndex((d) => d.id === updated.id);
            if (idx === -1) return [...prev, updated];
            const next = [...prev];
            next[idx] = updated;
            return next;
          });
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => {
      setConnected(false);
    };

    ws.onclose = (e) => {
      setConnected(false);
      clearInterval(pingRef.current);

      if (e.code === 4001 || e.code === 4003) return; // auth failure — don't retry

      // Exponential backoff: 2s, 4s, 8s … max 30s
      const delay = Math.min(2000 * 2 ** retryCount.current, 30_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);

      // While disconnected, fall back to HTTP polling every 10s
      if (!fallbackRef.current) {
        refetch();
        fallbackRef.current = setInterval(refetch, 10_000);
      }
    };
  }, [refetch]);

  useEffect(() => {
    // Initial HTTP fetch so the page isn't blank while WS handshakes
    refetch();
    connect();

    return () => {
      wsRef.current?.close();
      clearTimeout(retryRef.current);
      clearInterval(pingRef.current);
      clearInterval(fallbackRef.current);
    };
  }, [connect, refetch]);

  return { devices, connected, error, refetch };
}

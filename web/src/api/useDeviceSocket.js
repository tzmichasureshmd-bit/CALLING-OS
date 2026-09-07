import { useEffect, useRef, useState, useCallback } from "react";
import { devicesApi, callsApi } from "./resources.js";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.callingos.tzmicha.com/api/v1";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

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

function getCredentials() {
  const token   = localStorage.getItem("callos_token");
  const userRaw = localStorage.getItem("callos_user");
  if (!token || !userRaw) return null;
  try {
    const orgId = JSON.parse(userRaw).organization_id;
    if (!orgId) return null;
    return { token, orgId };
  } catch { return null; }
}

function applyMessage(msg, setDevices, setNewCallEvent) {
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
  } else if (msg.event === "calls_synced" || msg.event === "recording_uploaded" || msg.event === "transcript_updated") {
    // Signal to consumers that call data has changed
    setNewCallEvent({ event: msg.event, ts: Date.now(), ...msg });
  }
}

export function useDeviceSocket(onCallsUpdated) {
  const [devices, setDevices]     = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError]         = useState(null);
  const [newCallEvent, setNewCallEvent] = useState(null);  // fires when calls_synced received

  const wsRef       = useRef(null);
  const sseRef      = useRef(null);
  const pingRef     = useRef(null);
  const retryRef    = useRef(null);
  const pollRef     = useRef(null);
  const retryCount  = useRef(0);
  const useSse      = useRef(false);   // true once WS has failed once

  // ── HTTP fallback ──────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    try {
      const res = await devicesApi.list();
      setDevices((Array.isArray(res) ? res : res?.items || []).map(normalizeDevice));
      setError(null);
    } catch (e) { setError(e); }
  }, []);

  const startPollFallback = useCallback(() => {
    if (pollRef.current) return;
    refetch();
    pollRef.current = setInterval(refetch, 10_000);
  }, [refetch]);

  const stopPollFallback = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  // ── SSE connection ─────────────────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    const creds = getCredentials();
    if (!creds) return;
    const { token, orgId } = creds;

    sseRef.current?.close();
    const es = new EventSource(`${API_BASE}/devices/sse/${orgId}?token=${token}`);
    sseRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
      retryCount.current = 0;
      stopPollFallback();
    };

    es.onmessage = (e) => {
      try { applyMessage(JSON.parse(e.data), setDevices, setNewCallEvent); } catch { /* ignore */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      // Retry SSE with backoff
      const delay = Math.min(2000 * 2 ** retryCount.current, 30_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connectSSE, delay);
      startPollFallback();
    };
  }, [startPollFallback, stopPollFallback]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    const creds = getCredentials();
    if (!creds) return;
    const { token, orgId } = creds;

    const ws = new WebSocket(`${WS_BASE}/devices/ws/${orgId}?token=${token}`);
    wsRef.current = ws;

    // If WS doesn't open within 4s, assume proxy blocks it → switch to SSE
    const wsTimeout = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        useSse.current = true;
        connectSSE();
      }
    }, 4000);

    ws.onopen = () => {
      clearTimeout(wsTimeout);
      setConnected(true);
      setError(null);
      retryCount.current = 0;
      stopPollFallback();
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send("ping");
      }, 25_000);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg === "pong") return;
        applyMessage(msg, setDevices, setNewCallEvent);
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      clearTimeout(wsTimeout);
      setConnected(false);
    };

    ws.onclose = (e) => {
      clearTimeout(wsTimeout);
      clearInterval(pingRef.current);
      setConnected(false);

      // 403 from proxy or auth failure → switch permanently to SSE
      if (e.code === 4001 || e.code === 4003 || e.code === 1006) {
        useSse.current = true;
        connectSSE();
        return;
      }

      // Normal retry with backoff
      const delay = Math.min(2000 * 2 ** retryCount.current, 30_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(() => {
        useSse.current ? connectSSE() : connectWS();
      }, delay);
      startPollFallback();
    };
  }, [connectSSE, startPollFallback, stopPollFallback]);

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    refetch();          // immediate HTTP load while connection handshakes
    connectWS();        // try WS first, auto-falls to SSE on failure

    return () => {
      wsRef.current?.close();
      sseRef.current?.close();
      clearTimeout(retryRef.current);
      clearInterval(pingRef.current);
      clearInterval(pollRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { devices, connected, error, refetch, newCallEvent };
}

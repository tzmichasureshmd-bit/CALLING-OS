import { useEffect, useRef, useState, useCallback } from "react";
import { devicesApi, callsApi } from "./resources.js";

const API_BASE = import.meta.env.VITE_API_URL || "https://api.callingos.tzmicha.com/api/v1";
const WS_BASE  = API_BASE.replace(/^http/, "ws");

function normalizeDevice(d) {
  const perms = d.permissions_status || {};
  const callLog    = perms.callLog    ?? perms.call_log    ?? null;
  const phoneState = perms.phoneState ?? perms.phone_state ?? null;
  const contacts   = perms.contacts   ?? null;
  const storage     = perms.storage ?? perms.recording ?? null;
  const recording   = storage;
  const allOk = !!(callLog && phoneState && contacts && storage);
  // Online/stale/offline based on heartbeat freshness
  const lastSeen = d.last_seen_at ? new Date(d.last_seen_at) : null;
  const ageMs = lastSeen ? Date.now() - lastSeen.getTime() : Infinity;
  const isOnline = ageMs < 2 * 60 * 1000;          // < 2 min
  const isStale  = ageMs < 10 * 60 * 1000;         // 2-10 min
  const status = !d.is_online || !isStale ? "offline"
    : !isOnline ? "stale"
    : !allOk    ? "warning"
    : "healthy";
  // background_sync_status is NOT a runtime permission — never derive from perms bool
  const bgStatus = d.background_sync_status || perms.backgroundSync || null;
  return {
    id:                  d.id,
    employee:            d.employee_name || d.employee_id,
    device:              d.model || "Unknown",
    android:             d.android_version || "—",
    appVersion:          d.app_version || "—",
    battery:             d.battery_level ?? 0,
    lastSeenAt:          d.last_seen_at || null,
    permissions:         { callLog, phoneState, contacts, storage, recording },
    sim:                 d.sims?.[0]?.carrier || d.sims?.[0]?.phone_number || "SIM 1",
    backgroundStatus:    bgStatus,   // "limited" | "restricted" | null
    network_type:        d.network_type || null,
    is_online:           !!d.is_online,
    latitude:            d.latitude  ?? null,
    longitude:           d.longitude ?? null,
    wifi_ssid:           d.wifi_ssid || null,
    status,
  };
}

function getCredentials() {
  const token   = localStorage.getItem("callos_token");
  const userRaw = localStorage.getItem("callos_user");
  if (!token || !userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    const orgId = user.organization_id;
    if (!orgId) return null;
    return { token, orgId, role: (user.role || "").toUpperCase() };
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
  } else if (msg.event === "calls_synced" || msg.event === "call_created" || msg.event === "call_updated" || msg.event === "recording_uploaded" || msg.event === "transcript_updated" || msg.event === "summary_updated") {
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
  const mountedRef  = useRef(true);

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
      if (e.data === "pong") return;
      try {
        const msg = JSON.parse(e.data);
        applyMessage(msg, setDevices, setNewCallEvent);
      } catch { /* ignore */ }
    };

    ws.onerror = () => {
      clearTimeout(wsTimeout);
      if (mountedRef.current) setConnected(false);
    };

    ws.onclose = (e) => {
      clearTimeout(wsTimeout);
      clearInterval(pingRef.current);
      if (!mountedRef.current) return;   // unmounted — stop all retries
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
        if (mountedRef.current) useSse.current ? connectSSE() : connectWS();
      }, delay);
      startPollFallback();
    };
  }, [connectSSE, startPollFallback, stopPollFallback]);

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const credentials = getCredentials();
    refetch();
    if (credentials?.role === "EMPLOYEE") {
      // Organization-wide streams contain other employees' device details.
      // Employee pages use scoped HTTP polling instead.
      startPollFallback();
    } else {
      connectWS();
    }

    return () => {
      mountedRef.current = false;
      clearTimeout(retryRef.current);
      clearInterval(pingRef.current);
      clearInterval(pollRef.current);
      wsRef.current?.close();
      sseRef.current?.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { devices, connected, error, refetch, newCallEvent };
}

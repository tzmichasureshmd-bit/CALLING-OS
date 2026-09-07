import { useEffect, useRef, useState, useCallback } from "react";
import { Smartphone, Battery, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { PageContainer, Card, Badge, EmptyState, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { devicesApi } from "../api/resources.js";

const STATUS = {
  healthy: { label: "Healthy", tone: "success", color: "var(--success)" },
  warning: { label: "Warning", tone: "warning", color: "var(--warning)" },
  offline: { label: "Offline", tone: "danger", color: "var(--danger)" },
};

function relativeTime(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function normalizeDevice(d) {
  const perms = d.permissions_status || {};
  const callLog    = perms.callLog    ?? perms.call_log    ?? false;
  const phoneState = perms.phoneState ?? perms.phone_state ?? false;
  const contacts   = perms.contacts   ?? false;
  const recording  = perms.recording  ?? false;
  const allOk = callLog && phoneState && contacts && recording;
  const status = !d.is_online ? "offline" : !allOk ? "warning" : "healthy";
  return {
    id: d.id,
    employee: d.employee_name || d.employee_id,
    device: d.model || "Unknown",
    android: d.android_version || "—",
    appVersion: d.app_version || "—",
    battery: d.battery_level ?? 0,
    lastSeenAt: d.last_seen_at || null,
    permissions: { callLog, phoneState, contacts, recording },
    sim: "SIM 1",
    background: perms.background ? "ok" : "warning",
    status,
    is_online: !!d.is_online,
  };
}

function PermPill({ ok, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: ok ? "var(--success)" : "var(--danger)" }}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {label}
    </span>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>{value}</div>
    </div>
  );
}

// Ticks every second to keep "last seen" fresh without re-fetching
function LiveTime({ iso }) {
  const [label, setLabel] = useState(() => relativeTime(iso));
  useEffect(() => {
    setLabel(relativeTime(iso));
    const t = setInterval(() => setLabel(relativeTime(iso)), 5000);
    return () => clearInterval(t);
  }, [iso]);
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={12} />{label}</span>;
}

export default function DeviceHealth() {
  const [devices, setDevices] = useState(null);   // null = first load
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const intervalRef = useRef(null);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setFetching(true);
    try {
      const res = await devicesApi.list();
      const items = (Array.isArray(res) ? res : res?.items || []).map(normalizeDevice);
      setDevices(items);
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    fetch(false);                                  // first load — show spinner
    intervalRef.current = setInterval(() => fetch(true), 5000);  // silent poll every 5s
    return () => clearInterval(intervalRef.current);
  }, [fetch]);

  // ── first load ──
  if (devices === null && !error) {
    return <PageContainer><Card><SkeletonRows rows={4} cols={4} /></Card></PageContainer>;
  }
  if (error && devices === null) {
    return <PageContainer><Card><ErrorState title="Couldn't load device health" message={error.message} onRetry={() => fetch(false)} /></Card></PageContainer>;
  }

  const counts = { healthy: 0, warning: 0, offline: 0 };
  devices.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });

  return (
    <PageContainer>
      {/* Header row: summary cards + live indicator */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, flex: 1, minWidth: 0 }}>
          {Object.entries(STATUS).map(([key, s]) => (
            <Card key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `var(--${s.tone}-soft)`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Smartphone size={17} />
              </div>
              <div>
                <div style={{ fontFamily: "Space Grotesk", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{counts[key] || 0}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* Live pulse badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {fetching ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s infinite" }} />
              Syncing…
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--success)" }}>
              <Wifi size={13} /> Live
            </span>
          )}
          {lastUpdated && (
            <span style={{ color: "var(--text-dim)" }}>
              · updated {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button
            onClick={() => fetch(false)}
            title="Refresh now"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}
          >
            <RefreshCw size={14} style={{ animation: fetching ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <Card><EmptyState icon={Smartphone} title="No devices registered" message="Employees register a device when they install the CallNexa app and enter the company code." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }}>
          {devices.map((d) => {
            const s = STATUS[d.status];
            return (
              <Card key={d.id} hover style={{ borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: s.color }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* Online dot */}
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.is_online ? "var(--success)" : "var(--danger)", flexShrink: 0, boxShadow: d.is_online ? "0 0 0 3px var(--success-soft)" : "none" }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{d.employee}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{d.device} · {d.android}</div>
                    </div>
                  </div>
                  <Badge tone={s.tone} dot>{s.label}</Badge>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <Info label="App version" value={d.appVersion} />
                  <Info label="Battery" value={
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <Battery size={14} style={{ color: d.battery < 20 ? "var(--danger)" : "inherit" }} />
                      <span style={{ color: d.battery < 20 ? "var(--danger)" : "inherit" }}>{d.battery}%</span>
                    </span>
                  } />
                  <Info label="Last sync" value={<LiveTime iso={d.lastSeenAt} />} />
                  <Info label="SIM" value={d.sim} />
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Permissions</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <PermPill ok={d.permissions.callLog} label="Call log" />
                    <PermPill ok={d.permissions.phoneState} label="Phone state" />
                    <PermPill ok={d.permissions.contacts} label="Contacts" />
                    <PermPill ok={d.permissions.recording} label="Recording" />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <PermPill ok={d.background === "ok"} label={d.background === "ok" ? "Background sync OK" : "Background optimization warning"} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </PageContainer>
  );
}

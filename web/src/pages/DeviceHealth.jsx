import { useEffect, useState } from "react";
import { Smartphone, Battery, CheckCircle2, XCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { PageContainer, Card, Badge, EmptyState, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { useDeviceSocket } from "../api/useDeviceSocket.js";

const STATUS = {
  healthy: { label: "Healthy", tone: "success", color: "var(--success)" },
  warning: { label: "Warning", tone: "warning", color: "var(--warning)" },
  offline: { label: "Offline", tone: "danger",  color: "var(--danger)"  },
};

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

// Ticks every 5s locally — no re-fetch needed
function LiveTime({ iso }) {
  const fmt = (i) => {
    if (!i) return "never";
    const s = Math.floor((Date.now() - new Date(i)) / 1000);
    if (s < 10) return "just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)}h ago`;
  };
  const [label, setLabel] = useState(() => fmt(iso));
  useEffect(() => {
    setLabel(fmt(iso));
    const t = setInterval(() => setLabel(fmt(iso)), 5_000);
    return () => clearInterval(t);
  }, [iso]);
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={12} />{label}</span>;
}

export default function DeviceHealth() {
  const { devices, connected, error, refetch } = useDeviceSocket();

  if (devices === null && !error) {
    return <PageContainer><Card><SkeletonRows rows={4} cols={4} /></Card></PageContainer>;
  }
  if (error && devices === null) {
    return <PageContainer><Card><ErrorState title="Couldn't load device health" message={error.message} onRetry={refetch} /></Card></PageContainer>;
  }

  const counts = { healthy: 0, warning: 0, offline: 0 };
  (devices || []).forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });

  return (
    <PageContainer>
      {/* Summary + connection status */}
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

        {/* Live / Reconnecting badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
          {connected ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--success)", fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", animation: "ws-pulse 2s infinite" }} />
              Real-time
            </span>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--warning)", fontWeight: 600 }}>
              <WifiOff size={13} /> Reconnecting…
            </span>
          )}
          <button
            onClick={refetch}
            title="Refresh now"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, display: "flex", alignItems: "center" }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {!devices?.length ? (
        <Card><EmptyState icon={Smartphone} title="No devices registered" message="Employees register a device when they install the CallNexa app and enter the company code." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }}>
          {devices.map((d) => {
            const s = STATUS[d.status];
            return (
              <Card key={d.id} hover style={{ borderLeftWidth: 3, borderLeftStyle: "solid", borderLeftColor: s.color }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
                      background: d.is_online ? "var(--success)" : "var(--danger)",
                      boxShadow: d.is_online ? "0 0 0 3px var(--success-soft)" : "none",
                      animation: d.is_online ? "ws-pulse 2s infinite" : "none",
                    }} />
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
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: d.battery < 20 ? "var(--danger)" : "inherit" }}>
                      <Battery size={14} /> {d.battery}%
                    </span>
                  } />
                  <Info label="Last sync" value={<LiveTime iso={d.lastSeenAt} />} />
                  <Info label="SIM" value={d.sim} />
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Permissions</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                    <PermPill ok={d.permissions.callLog}    label="Call log" />
                    <PermPill ok={d.permissions.phoneState} label="Phone state" />
                    <PermPill ok={d.permissions.contacts}   label="Contacts" />
                    <PermPill ok={d.permissions.recording}  label="Recording" />
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
        @keyframes ws-pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </PageContainer>
  );
}

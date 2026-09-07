import { useEffect, useState } from "react";
import {
  Smartphone, Battery, CheckCircle2, XCircle,
  RefreshCw, WifiOff, Wifi, ShieldCheck, ShieldAlert,
  Cpu, AlertTriangle, MapPin,
} from "lucide-react";
import { SkeletonRows, ErrorState } from "../components/ui.jsx";
import { useDeviceSocket } from "../api/useDeviceSocket.js";

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS = {
  healthy: { label: "Healthy",  color: "var(--success)", soft: "var(--success-soft)" },
  warning: { label: "Warning",  color: "var(--warning)", soft: "var(--warning-soft)" },
  offline: { label: "Offline",  color: "var(--danger)",  soft: "var(--danger-soft)"  },
};

function useTick(iso, interval = 5000) {
  const fmt = (i) => {
    if (!i) return "Never";
    const s = Math.floor((Date.now() - new Date(i)) / 1000);
    if (s < 10) return "Just now";
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min ago`;
    return `${Math.floor(m / 60)}h ago`;
  };
  const [label, setLabel] = useState(() => fmt(iso));
  useEffect(() => {
    setLabel(fmt(iso));
    const t = setInterval(() => setLabel(fmt(iso)), interval);
    return () => clearInterval(t);
  }, [iso]);
  return label;
}

// ── sub-components ────────────────────────────────────────────────────────────

function BatteryBar({ level }) {
  const color = level < 20 ? "var(--danger)" : level < 40 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 4, background: "var(--bg-hover)", overflow: "hidden" }}>
        <div style={{ width: `${level}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color, minWidth: 36 }}>{level}%</span>
    </div>
  );
}

function PermRow({ ok, label, desc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, background: ok ? "var(--success-soft)" : "var(--danger-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {ok ? <CheckCircle2 size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>{desc}</div>}
      </div>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: ok ? "var(--success)" : "var(--danger)" }}>
        {ok ? "Granted" : "Denied"}
      </span>
    </div>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Left panel: device list item ──────────────────────────────────────────────

function DeviceRow({ d, active, onClick }) {
  const lastSeen = useTick(d.lastSeenAt);
  const s = STATUS[d.status];
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px", cursor: "pointer",
        background: active ? "var(--accent-soft)" : "transparent",
        borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-hover)"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Device icon with online dot */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: s.soft, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Smartphone size={20} color={s.color} />
        </div>
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: 10, height: 10, borderRadius: "50%",
          background: d.is_online ? "var(--success)" : "var(--danger)",
          border: "2px solid var(--bg-card)",
          animation: d.is_online ? "ws-pulse 2s infinite" : "none",
        }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.employee}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.device}</div>
        <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{lastSeen}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.soft, padding: "2px 7px", borderRadius: 6 }}>{s.label}</span>
        <span style={{ fontSize: 11.5, color: d.battery < 20 ? "var(--danger)" : "var(--text-muted)" }}>
          🔋 {d.battery}%
        </span>
      </div>
    </div>
  );
}

// ── Right panel: full device detail ──────────────────────────────────────────

function DeviceDetail({ d, connected }) {
  const lastSeen = useTick(d.lastSeenAt, 1000);
  const s = STATUS[d.status];
  const allPermsOk = d.permissions.callLog && d.permissions.phoneState && d.permissions.contacts && d.permissions.recording;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: s.soft, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <Smartphone size={30} color={s.color} />
            <span style={{
              position: "absolute", bottom: 3, right: 3,
              width: 13, height: 13, borderRadius: "50%",
              background: d.is_online ? "var(--success)" : "var(--danger)",
              border: "2.5px solid var(--bg-card)",
              animation: d.is_online ? "ws-pulse 2s infinite" : "none",
            }} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{d.employee}</div>
            <div style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 2 }}>{d.device} · Android {d.android}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: s.color, background: s.soft, padding: "3px 10px", borderRadius: 8 }}>{s.label}</span>
              {connected ? (
                <span style={{ fontSize: 11.5, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)", animation: "ws-pulse 2s infinite", display: "inline-block" }} />
                  Live
                </span>
              ) : (
                <span style={{ fontSize: 11.5, color: "var(--warning)", display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <WifiOff size={11} /> Reconnecting
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Permission warning banner */}
      {!allPermsOk && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: 12, padding: "12px 16px", marginBottom: 24 }}>
          <AlertTriangle size={18} color="var(--warning)" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Permissions missing</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>This device is missing required permissions. Ask the employee to open the app and grant them.</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
        <StatBox label="Last seen" value={lastSeen} sub={d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} />
        <StatBox label="App version" value={d.appVersion} sub="CallNexa" />
        <StatBox label="SIM" value={d.sim} sub="Active" />
      </div>

      {/* Battery */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Battery size={16} color="var(--text-muted)" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Battery</span>
          </div>
          {d.battery < 20 && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "2px 8px", borderRadius: 6 }}>⚠ Low</span>
          )}
        </div>
        <BatteryBar level={d.battery} />
      </div>

      {/* Permissions */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          {allPermsOk ? <ShieldCheck size={16} color="var(--success)" /> : <ShieldAlert size={16} color="var(--warning)" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Permissions</span>
        </div>
        <PermRow ok={d.permissions.callLog}    label="Call Log"     desc="Read device call history" />
        <PermRow ok={d.permissions.phoneState} label="Phone State"  desc="Detect active calls" />
        <PermRow ok={d.permissions.contacts}   label="Contacts"     desc="Match numbers to names" />
        <PermRow ok={d.permissions.recording}  label="Recordings"   desc="Access call recordings" />
        <div style={{ paddingTop: 10 }}>
          <PermRow ok={d.background === "ok"}  label="Background Sync" desc="Run sync when app is closed" />
        </div>
      </div>

      {/* Device info */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Cpu size={15} color="var(--text-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Device Info</span>
        </div>
        {[
          ["Model",           d.device],
          ["Android version", d.android],
          ["App version",     d.appVersion],
          ["SIM / Carrier",   d.sim],
          ...(d.wifi_ssid ? [["WiFi", d.wifi_ssid]] : []),
          ...(d.latitude  ? [["Last location", `${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}`]] : []),
          ["Device ID",       d.id],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
            <span style={{ color: "var(--text-muted)" }}>{k}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 500, maxWidth: "60%", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeviceHealth() {
  const { devices, connected, error, refetch } = useDeviceSocket();
  const [selectedId, setSelectedId] = useState(null);

  // Auto-select first device
  useEffect(() => {
    if (devices?.length && !selectedId) setSelectedId(devices[0].id);
  }, [devices]);

  // Keep selected in sync when WS updates it
  const selected = devices?.find((d) => d.id === selectedId) || devices?.[0] || null;

  const counts = { healthy: 0, warning: 0, offline: 0 };
  (devices || []).forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });

  if (devices === null && !error) {
    return (
      <div style={{ padding: 24 }}><SkeletonRows rows={5} cols={3} /></div>
    );
  }
  if (error && devices === null) {
    return (
      <div style={{ padding: 24 }}><ErrorState title="Couldn't load devices" message={error.message} onRetry={refetch} /></div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 62px)", overflow: "hidden", background: "var(--bg-base)" }}>

      {/* ── Left panel ── */}
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-card)" }}>

        {/* Panel header */}
        <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Devices</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {connected ? (
                <span style={{ fontSize: 11, color: "var(--success)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", animation: "ws-pulse 2s infinite", display: "inline-block" }} />
                  Live
                </span>
              ) : (
                <span style={{ fontSize: 11, color: "var(--warning)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <WifiOff size={10} /> Reconnecting
                </span>
              )}
              <button onClick={refetch} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 4, display: "flex" }}>
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Summary pills */}
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries({ healthy: counts.healthy, warning: counts.warning, offline: counts.offline }).map(([k, n]) => (
              <span key={k} style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 7, background: STATUS[k].soft, color: STATUS[k].color }}>
                {n} {k}
              </span>
            ))}
          </div>
        </div>

        {/* Device list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {!devices?.length ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              <Smartphone size={32} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
              No devices registered
            </div>
          ) : (
            devices.map((d) => (
              <DeviceRow
                key={d.id}
                d={d}
                active={d.id === selected?.id}
                onClick={() => setSelectedId(d.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-base)" }}>
        {selected ? (
          <DeviceDetail d={selected} connected={connected} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", gap: 12 }}>
            <Smartphone size={48} style={{ opacity: 0.2 }} />
            <span style={{ fontSize: 14 }}>Select a device</span>
          </div>
        )}
      </div>

      <style>{`
        @keyframes ws-pulse {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}

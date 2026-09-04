import { Smartphone, Battery, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { PageContainer, Card, Badge, EmptyState, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

const STATUS = {
  healthy: { label: "Healthy", tone: "success", color: "var(--success)" },
  warning: { label: "Warning", tone: "warning", color: "var(--warning)" },
  offline: { label: "Offline", tone: "danger", color: "var(--danger)" },
};

function PermPill({ ok, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: ok ? "var(--success)" : "var(--danger)" }}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {label}
    </span>
  );
}

export default function DeviceHealth() {
  const { loading, error, data, reload } = useResource(() => dataSource.getDeviceHealth());

  if (loading) return <PageContainer><Card><SkeletonRows rows={4} cols={4} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load device health" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const devices = data.items || [];
  const counts = { healthy: 0, warning: 0, offline: 0 };
  devices.forEach((d) => { counts[d.status] = (counts[d.status] || 0) + 1; });

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 16 }}>
        {Object.entries(STATUS).map(([key, s]) => (
          <Card key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `var(--${s.tone}-soft)`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}><Smartphone size={19} /></div>
            <div><div style={{ fontFamily: "Space Grotesk", fontSize: 24, fontWeight: 700, color: "var(--text-primary)" }}>{counts[key] || 0}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div></div>
          </Card>
        ))}
      </div>

      {devices.length === 0 ? (
        <Card><EmptyState icon={Smartphone} title="No devices registered" message="Employees register a device when they install the CallNexa app and enter the company code." /></Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 16 }}>
          {devices.map((d) => {
            const s = STATUS[d.status];
            return (
              <Card key={d.id} hover style={{ borderLeft: `3px solid ${s.color}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{d.employee}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{d.device} · {d.android}</div>
                  </div>
                  <Badge tone={s.tone} dot>{s.label}</Badge>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <Info label="App version" value={d.appVersion} />
                  <Info label="Battery" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Battery size={14} /> {d.battery}%</span>} />
                  <Info label="Last sync" value={<span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><RefreshCw size={12} /> {d.lastSync}</span>} />
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
    </PageContainer>
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

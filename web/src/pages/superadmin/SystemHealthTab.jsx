import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { superApi } from "./api.js";
import client from "../../api/client.js";

function StatusDot({ status }) {
  const ok = status === "healthy" || status === "configured" || status === "connected";
  const warn = status === "not_configured";
  const color = ok ? "var(--success)" : warn ? "var(--warning)" : "var(--danger)";
  const Icon = ok ? CheckCircle : warn ? AlertCircle : XCircle;
  return <Icon size={18} color={color} />;
}

function HealthCard({ title, status, children }) {
  return (
    <Card style={{ minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <StatusDot status={status} />
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{title}</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{children}</div>
    </Card>
  );
}

export default function SystemHealthTab() {
  const [health, setHealth]   = useState(null);
  const [basic, setBasic]     = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [h, db, storage] = await Promise.allSettled([
        client.get("/health").then((r) => r.data),
        client.get("/health/db").then((r) => r.data),
        client.get("/health/storage").then((r) => r.data),
      ]);
      setBasic({
        api:     h.status === "fulfilled" ? h.value : { status: "error" },
        db:      db.status === "fulfilled" ? db.value : { status: "error" },
        storage: storage.status === "fulfilled" ? storage.value : { status: "error" },
      });
      const sa = await superApi.systemHealth();
      setHealth(sa);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={load} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Checking system health…</div>
      ) : (
        <>
          {/* Basic health */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            <HealthCard title="API" status={basic.api?.status}>
              Version: {basic.api?.version || "—"}
            </HealthCard>
            <HealthCard title="Database" status={basic.db?.status}>
              {basic.db?.database || basic.db?.status || "—"}
            </HealthCard>
            <HealthCard title="Storage" status={basic.storage?.status}>
              Bucket: {basic.storage?.bucket || "not configured"}
            </HealthCard>
          </div>

          {/* Platform stats */}
          {health && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <HealthCard title="WebSockets" status="healthy">
                Active connections: <strong>{health.websockets?.active_connections ?? 0}</strong>
              </HealthCard>
              <HealthCard title="Devices" status="healthy">
                Total: <strong>{health.devices?.total ?? 0}</strong> · Online: <strong style={{ color: "var(--success)" }}>{health.devices?.online ?? 0}</strong> · Offline: <strong style={{ color: "var(--danger)" }}>{health.devices?.offline ?? 0}</strong>
              </HealthCard>
              <HealthCard title="Sync Queue" status={health.sync?.failed > 0 ? "error" : "healthy"}>
                Pending: <strong>{health.sync?.pending ?? 0}</strong> · Failed: <strong style={{ color: health.sync?.failed > 0 ? "var(--danger)" : "inherit" }}>{health.sync?.failed ?? 0}</strong>
              </HealthCard>
              <HealthCard title="Organizations" status="healthy">
                Total: <strong>{health.organizations?.total ?? 0}</strong>
              </HealthCard>
            </div>
          )}
        </>
      )}
    </div>
  );
}

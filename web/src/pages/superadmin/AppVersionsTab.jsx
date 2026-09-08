import { useState, useEffect } from "react";
import { RefreshCw, Smartphone } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { superApi } from "./api.js";

export default function AppVersionsTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    superApi.appVersions().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const versions = data?.versions || [];
  const total    = data?.total_devices || 0;
  const latest   = data?.latest;

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Smartphone size={18} color="var(--accent)" />
        <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>App Versions</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 4 }}>({total} devices total)</span>
        <div style={{ flex: 1 }} />
        <button onClick={load} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : versions.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No devices registered</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {versions.map((v) => {
            const pct = total > 0 ? (v.count / total) * 100 : 0;
            return (
              <div key={v.version} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 90, fontSize: 13, fontWeight: 700, color: v.is_latest ? "var(--success)" : "var(--text-primary)", fontFamily: "monospace" }}>
                  {v.version}
                  {v.is_latest && <span style={{ fontSize: 10, marginLeft: 6, color: "var(--success)", fontFamily: "sans-serif" }}>LATEST</span>}
                </div>
                <div style={{ flex: 1, height: 10, borderRadius: 6, background: "var(--bg-hover)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", borderRadius: 6,
                    background: v.is_latest ? "var(--success)" : v.version === "unknown" ? "var(--text-dim)" : "var(--accent)",
                    transition: "width 0.4s" }} />
                </div>
                <div style={{ width: 80, textAlign: "right", fontSize: 13, color: "var(--text-muted)" }}>
                  {v.count} <span style={{ fontSize: 11 }}>({pct.toFixed(1)}%)</span>
                </div>
                {!v.is_latest && v.version !== "unknown" && latest && (
                  <span style={{ fontSize: 11, color: "var(--warning)", fontWeight: 600 }}>outdated</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

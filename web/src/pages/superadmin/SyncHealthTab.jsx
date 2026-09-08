import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { superApi, TH, TD, fmtDate, fmtDur } from "./api.js";

const STATUS_META = {
  synced:      { label: "Synced",      color: "var(--success)" },
  sync_queued: { label: "Queued",      color: "var(--warning)" },
  syncing:     { label: "Syncing",     color: "var(--accent)"  },
  sync_failed: { label: "Failed",      color: "var(--danger)"  },
  detected:    { label: "Detected",    color: "var(--text-muted)" },
};

export default function SyncHealthTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    superApi.syncHealth().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const summary = data?.summary || {};
  const failed  = data?.failed_calls || [];
  const total   = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <Card key={key} style={{ textAlign: "center", padding: "16px 12px" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: meta.color, fontFamily: "Space Grotesk" }}>
              {loading ? "—" : (summary[key] ?? 0).toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{meta.label}</div>
            {!loading && total > 0 && (
              <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>
                {((summary[key] ?? 0) / total * 100).toFixed(1)}%
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Failed calls table */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <AlertTriangle size={16} color="var(--danger)" />
          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
            Failed Calls ({failed.length})
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={load} style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>Loading…</div>
        ) : failed.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "var(--success)", fontWeight: 600 }}>✓ No failed syncs</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH}>Phone</th><th style={TH}>Type</th><th style={TH}>Date</th>
                  <th style={TH}>Employee</th><th style={TH}>Device</th><th style={TH}>Event ID</th>
                </tr>
              </thead>
              <tbody>
                {failed.map((c) => (
                  <tr key={c.id}>
                    <td style={TD({ fontFamily: "monospace" })}>{c.phone || "—"}</td>
                    <td style={TD()}>{c.type || "—"}</td>
                    <td style={TD({ fontSize: 12 })}>{fmtDate(c.date)}</td>
                    <td style={TD({ fontSize: 12 })}>{c.employee || "—"}</td>
                    <td style={TD({ fontSize: 12 })}>{c.device || "—"}</td>
                    <td style={TD({ fontFamily: "monospace", fontSize: 11, color: "var(--text-dim)" })}>{c.client_event_id || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

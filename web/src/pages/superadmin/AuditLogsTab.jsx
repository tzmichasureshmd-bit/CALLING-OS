import { useState, useEffect } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { superApi, TH, TD, fmtDate } from "./api.js";

const ACTION_COLORS = {
  login: "var(--success)", logout: "var(--text-muted)",
  call_sync: "var(--accent)", recording_upload: "var(--violet)",
  recording_access: "var(--warning)", transcript_start: "var(--accent)",
  transcript_complete: "var(--success)", org_created: "var(--success)",
  org_deleted: "var(--danger)", org_suspended: "var(--warning)",
};

export default function AuditLogsTab() {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [page, setPage]         = useState(1);
  const [filters, setFilters]   = useState({ action: "", actor_email: "", date_from: "", date_to: "" });

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const load = () => {
    setLoading(true);
    const p = { page, page_size: 50 };
    if (filters.action)     p.action      = filters.action;
    if (filters.actor_email) p.actor_email = filters.actor_email;
    if (filters.date_from)  p.date_from   = filters.date_from;
    if (filters.date_to)    p.date_to     = filters.date_to;
    superApi.auditLogs(p).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]); // eslint-disable-line

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 50);

  return (
    <Card>
      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input placeholder="Action (e.g. login)" value={filters.action} onChange={(e) => set("action", e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, width: 180 }} />
        <input placeholder="Actor email" value={filters.actor_email} onChange={(e) => set("actor_email", e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, width: 200 }} />
        <input type="date" value={filters.date_from} onChange={(e) => set("date_from", e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }} />
        <input type="date" value={filters.date_to} onChange={(e) => set("date_to", e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }} />
        <button onClick={() => { setPage(1); load(); }}
          style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Search size={13} /> Search
        </button>
        <button onClick={load}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}>
          <RefreshCw size={13} />
        </button>
        <span style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: "32px", marginLeft: "auto" }}>
          {total.toLocaleString()} records
        </span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No audit logs found</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={TH}>Action</th><th style={TH}>Actor</th><th style={TH}>Role</th>
                <th style={TH}>Resource</th><th style={TH}>IP</th><th style={TH}>Date</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td style={TD()}>
                    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: (ACTION_COLORS[l.action] || "var(--text-dim)") + "22",
                      color: ACTION_COLORS[l.action] || "var(--text-dim)" }}>
                      {l.action}
                    </span>
                  </td>
                  <td style={TD({ fontSize: 12 })}>{l.actor_email || "—"}</td>
                  <td style={TD({ fontSize: 11, color: "var(--text-muted)" })}>{l.actor_role || "—"}</td>
                  <td style={TD({ fontSize: 12 })}>
                    {l.resource ? `${l.resource}${l.resource_id ? ` #${l.resource_id.slice(0, 8)}` : ""}` : "—"}
                  </td>
                  <td style={TD({ fontFamily: "monospace", fontSize: 11, color: "var(--text-dim)" })}>{l.ip_address || "—"}</td>
                  <td style={TD({ fontSize: 12 })}>{fmtDate(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button disabled={page === 1} onClick={() => setPage(page - 1)}
            style={{ padding: "4px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}>‹</button>
          <span style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: "28px" }}>{page} / {pages}</span>
          <button disabled={page === pages} onClick={() => setPage(page + 1)}
            style={{ padding: "4px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}>›</button>
        </div>
      )}
    </Card>
  );
}

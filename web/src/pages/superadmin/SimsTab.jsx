import { useState, useEffect } from "react";
import { Microchip, RefreshCw } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { superApi, TH, TD, fmtDate } from "./api.js";

const CHANGE_COLORS = {
  INSERTED: "var(--success)", REMOVED: "var(--danger)",
  REPLACED: "var(--warning)", CARRIER_CHANGED: "var(--violet)",
};

export default function SimsTab() {
  const [view, setView]       = useState("sims"); // sims | changes
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [carrier, setCarrier] = useState("");
  const [changeType, setChangeType] = useState("");

  const load = () => {
    setLoading(true);
    const fn = view === "sims"
      ? superApi.sims({ page, page_size: 50, carrier: carrier || undefined })
      : superApi.simChanges({ page, page_size: 50, change_type: changeType || undefined });
    fn.then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  };

  useEffect(() => { setPage(1); }, [view]);
  useEffect(() => { load(); }, [view, page, carrier, changeType]); // eslint-disable-line

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 50);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["sims", "changes"].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: view === v ? "var(--accent)" : "var(--bg-hover)",
              color: view === v ? "#fff" : "var(--text-muted)",
            }}>{v === "sims" ? "All SIMs" : "Change History"}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {view === "sims" && (
          <input placeholder="Filter carrier…" value={carrier} onChange={(e) => setCarrier(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, width: 180 }} />
        )}
        {view === "changes" && (
          <select value={changeType} onChange={(e) => setChangeType(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}>
            <option value="">All changes</option>
            {["INSERTED","REMOVED","REPLACED","CARRIER_CHANGED"].map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
        <button onClick={load} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No records found</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {view === "sims" ? (
                  <>
                    <th style={TH}>Slot</th><th style={TH}>Carrier</th><th style={TH}>Phone</th>
                    <th style={TH}>Network</th><th style={TH}>Device</th><th style={TH}>Sub ID</th>
                    <th style={TH}>Active</th><th style={TH}>Last Detected</th>
                  </>
                ) : (
                  <>
                    <th style={TH}>Change</th><th style={TH}>Slot</th>
                    <th style={TH}>Previous Carrier</th><th style={TH}>New Carrier</th>
                    <th style={TH}>Device</th><th style={TH}>Date</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {view === "sims" ? items.map((s) => (
                <tr key={s.id} style={{ background: "transparent" }}>
                  <td style={TD()}>SIM {s.slot}</td>
                  <td style={TD()}>{s.carrier || "—"}</td>
                  <td style={TD({ fontFamily: "monospace" })}>{s.phone_number || "—"}</td>
                  <td style={TD()}>
                    <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: s.network_type === "5G" ? "var(--accent-soft)" : "var(--bg-hover)",
                      color: s.network_type === "5G" ? "var(--accent)" : "var(--text-muted)" }}>
                      {s.network_type || "—"}
                    </span>
                  </td>
                  <td style={TD({ fontSize: 12 })}>{s.device_model || "—"}</td>
                  <td style={TD({ fontFamily: "monospace", fontSize: 11 })}>{s.subscription_id || "—"}</td>
                  <td style={TD()}>
                    <span style={{ color: s.is_active ? "var(--success)" : "var(--danger)", fontWeight: 700, fontSize: 12 }}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={TD({ fontSize: 12 })}>{fmtDate(s.last_detected)}</td>
                </tr>
              )) : items.map((c, i) => (
                <tr key={c.id || i}>
                  <td style={TD()}>
                    <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                      background: (CHANGE_COLORS[c.change_type] || "var(--bg-hover)") + "22",
                      color: CHANGE_COLORS[c.change_type] || "var(--text-muted)" }}>
                      {c.change_type}
                    </span>
                  </td>
                  <td style={TD()}>SIM {c.slot}</td>
                  <td style={TD({ fontSize: 12 })}>{c.previous_carrier || "—"}</td>
                  <td style={TD({ fontSize: 12 })}>{c.new_carrier || "—"}</td>
                  <td style={TD({ fontSize: 12 })}>{c.device_id || "—"}</td>
                  <td style={TD({ fontSize: 12 })}>{fmtDate(c.created_at)}</td>
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

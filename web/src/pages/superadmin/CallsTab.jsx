import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw } from "lucide-react";
import { Card, Badge, ErrorState, SkeletonRows } from "../../components/ui.jsx";
import { superApi, fmtDate, fmtDur, TH, TD } from "./api.js";

export default function CallsTab() {
  const [calls, setCalls]     = useState([]);
  const [orgs, setOrgs]       = useState({});
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [query, setQuery]     = useState("");
  const [filter, setFilter]   = useState("all");
  const [page, setPage]       = useState(1);

  const load = useCallback(async (p = 1) => {
    setLoading(true); setError(null);
    try {
      const [callsData, orgsData] = await Promise.all([
        superApi.calls({ page: p, page_size: 50 }),
        superApi.orgs({ page_size: 100 }),
      ]);
      const orgMap = {};
      (orgsData.items || []).forEach((o) => { orgMap[o.id] = o.name; });
      setOrgs(orgMap);
      setCalls(callsData.items || []);
      setTotal(callsData.total || 0);
      setPage(p);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const filtered = calls.filter((c) => {
    const matchQ = !query || (c.contact || "").toLowerCase().includes(query.toLowerCase()) || (c.phone || "").includes(query);
    const matchF = filter === "all" || c.type === filter;
    return matchQ && matchF;
  });

  const counts = {
    all:      calls.length,
    outgoing: calls.filter((c) => c.type === "outgoing").length,
    incoming: calls.filter((c) => c.type === "incoming").length,
    missed:   calls.filter((c) => c.type === "missed").length,
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <Card padding={0}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>All Calls</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{total} total calls across all organizations</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {["all", "outgoing", "incoming", "missed"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid " + (filter === f ? "transparent" : "var(--border)"), background: filter === f ? "var(--grad-brand)" : "transparent", color: filter === f ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
              {f} ({counts[f]})
            </button>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", width: 190 }}>
            <Search size={14} color="var(--text-dim)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search calls…"
              style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
          </div>
          <button onClick={() => load(1)} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 20 }}><SkeletonRows rows={6} cols={6} /></div>}
      {error   && <ErrorState title="Failed to load calls" message={error} onRetry={() => load(1)} />}

      {!loading && !error && (
        <>
          <div className="nova-scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Contact", "Organization", "Phone", "Type", "Duration", "Date"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                    <td style={TD({ fontWeight: 600, color: "var(--text-primary)" })}>{c.contact || "Unknown"}</td>
                    <td style={TD()}>
                      <span style={{ fontSize: 12, background: "var(--bg-hover)", padding: "3px 9px", borderRadius: 6, color: "var(--text-secondary)", fontWeight: 600 }}>
                        {orgs[c.org_id] || c.org_id || "—"}
                      </span>
                    </td>
                    <td style={TD({ color: "var(--accent)" })}>{c.phone || "—"}</td>
                    <td style={TD()}><Badge tone={c.type === "incoming" ? "teal" : c.type === "outgoing" ? "violet" : "danger"}>{c.type || "—"}</Badge></td>
                    <td style={TD({ color: "var(--text-secondary)", fontFamily: "Space Grotesk" })}>{fmtDur(c.duration)}</td>
                    <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(c.date)}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>No calls found.</td></tr>}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <button disabled={page <= 1} onClick={() => load(page - 1)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.5 : 1, fontSize: 13 }}>Prev</button>
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => load(page + 1)} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.5 : 1, fontSize: 13 }}>Next</button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

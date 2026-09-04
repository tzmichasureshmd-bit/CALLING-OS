import { useState } from "react";
import { Target, Phone, Calendar, ArrowRight } from "lucide-react";
import { PageContainer, Card, Badge, SearchInput, EmptyState, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { LEAD_STATUS_META } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

const FLOW = ["Call", "Connected", "Conversation", "Follow-up", "Lead", "Opportunity", "Won/Lost"];

export default function Leads() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const { loading, error, data, reload } = useResource(() => dataSource.getLeads());

  if (loading) return <PageContainer><Card><SkeletonRows rows={6} cols={5} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load leads" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const LEADS = data.items || [];
  const statuses = ["all", ...Object.keys(LEAD_STATUS_META)];
  const filtered = LEADS.filter((l) => {
    const q = [l.name, l.phone, l.employee].join(" ").toLowerCase().includes(query.toLowerCase());
    return q && (status === "all" || l.status === status);
  });

  return (
    <PageContainer>
      {/* Sales flow strip */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {FLOW.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: i < 5 ? "var(--grad-brand-soft)" : "var(--bg-hover)", color: i < 5 ? "var(--accent)" : "var(--text-muted)", fontFamily: "Space Grotesk" }}>{s}</span>
              {i < FLOW.length - 1 && <ArrowRight size={14} color="var(--text-dim)" />}
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatus(s)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid " + (status === s ? "transparent" : "var(--border)"), background: status === s ? "var(--grad-brand)" : "transparent", color: status === s ? "#fff" : "var(--text-muted)", textTransform: "capitalize" }}>
                {s === "all" ? "All" : LEAD_STATUS_META[s].label}
              </button>
            ))}
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search leads..." />
        </div>

        <div className="nova-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={Target} title="No leads found" message="Leads are created from connected calls. Adjust filters or sync new calls." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Lead", "Source", "Employee", "Status", "Priority", "Next Follow-up", "Value"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((l) => {
                  const meta = LEAD_STATUS_META[l.status];
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{l.name}</div>
                        <div style={{ color: "var(--accent)", fontSize: 12 }}>{l.phone}</div>
                      </td>
                      <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{l.source}</td>
                      <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{l.employee}</td>
                      <td style={{ padding: "13px 16px" }}><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{l.priority}</td>
                      <td style={{ padding: "13px 16px", color: l.nextFollowUp === "Overdue" ? "var(--danger)" : "var(--text-secondary)", fontWeight: l.nextFollowUp === "Overdue" ? 600 : 400 }}>{l.nextFollowUp}</td>
                      <td style={{ padding: "13px 16px", fontFamily: "Space Grotesk", fontWeight: 600, color: "var(--text-primary)" }}>{l.expectedValue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}

const th = { textAlign: "left", padding: "11px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };

import { CheckCircle2, XCircle } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, EmptyState, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

export default function OpportunitiesClosed() {
  const { loading, error, data, reload } = useResource(() => dataSource.getClosedOpportunities());

  if (loading) return <PageContainer><Card><LoadingState message="Loading..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load opportunities" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const CLOSED_OPPORTUNITIES = data.items || [];
  const won = CLOSED_OPPORTUNITIES.filter((o) => o.outcome === "Won").length;
  const lost = CLOSED_OPPORTUNITIES.filter((o) => o.outcome === "Lost").length;

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--success-soft)", color: "var(--success)", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={20} /></div>
          <div><div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{won}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Won</div></div>
        </Card>
        <Card style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--danger-soft)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center" }}><XCircle size={20} /></div>
          <div><div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{lost}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>Lost</div></div>
        </Card>
      </div>

      <Card padding={0}>
        <div style={{ padding: "18px 18px 8px" }}>
          <CardHeader icon={CheckCircle2} title="Opportunities Closed" subtitle="Deals marked won or lost by your team" />
        </div>
        <div className="callos-scroll-x">
          {CLOSED_OPPORTUNITIES.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No closed opportunities" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Client", "Phone", "Employee", "Value", "Closed Date", "Outcome"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CLOSED_OPPORTUNITIES.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{o.name}</td>
                    <td style={{ padding: "13px 16px", color: "var(--accent)" }}>{o.phone}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{o.employee}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--text-primary)" }}>{o.value}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{new Date(o.closedDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <Badge tone={o.outcome === "Won" ? "success" : "danger"}>{o.outcome}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </PageContainer>
  );
}

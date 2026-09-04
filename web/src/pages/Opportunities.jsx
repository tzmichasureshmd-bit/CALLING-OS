import { TrendingUp } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, EmptyState, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { PIPELINE_STAGES } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

const STAGE_TONE = { New: "neutral", Qualified: "teal", Proposal: "violet", Negotiation: "warning", Won: "success", Lost: "danger" };
const fmt = (n) => "₹" + n.toLocaleString("en-IN");

export default function Opportunities() {
  const { loading, error, data, reload } = useResource(() => dataSource.getPipeline());

  if (loading) return <PageContainer><Card><SkeletonRows rows={5} cols={5} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load opportunities" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const PIPELINE = data.items || [];
  const totalValue = PIPELINE.reduce((s, o) => s + o.value, 0);
  const weighted = PIPELINE.reduce((s, o) => s + o.value * o.probability, 0);

  // Group by stage for kanban-style columns
  const byStage = PIPELINE_STAGES.map((stage) => ({ stage, items: PIPELINE.filter((o) => o.stage === stage) }));

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 16 }}>
        <Card><div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Open Opportunities</div><div style={{ fontFamily: "Space Grotesk", fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{PIPELINE.length}</div></Card>
        <Card><div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Pipeline Value</div><div style={{ fontFamily: "Space Grotesk", fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(totalValue)}</div></Card>
        <Card><div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Weighted Value</div><div style={{ fontFamily: "Space Grotesk", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{fmt(Math.round(weighted))}</div></Card>
      </div>

      {/* Kanban columns */}
      <div className="nova-scroll-x" style={{ paddingBottom: 8 }}>
        <div style={{ display: "flex", gap: 14, minWidth: 900 }}>
          {byStage.map((col) => (
            <div key={col.stage} style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Badge tone={STAGE_TONE[col.stage]}>{col.stage}</Badge>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{col.items.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.items.length === 0 ? (
                  <div style={{ border: "1px dashed var(--border)", borderRadius: 12, padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>Empty</div>
                ) : col.items.map((o) => (
                  <Card key={o.id} hover padding={14}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 3 }}>{o.lead}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>{o.customer}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontFamily: "Space Grotesk", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{fmt(o.value)}</span>
                      <Badge tone="teal">{Math.round(o.probability * 100)}%</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Close: {o.closeDate}</div>
                    <div style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 6 }}>{o.nextAction}</div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

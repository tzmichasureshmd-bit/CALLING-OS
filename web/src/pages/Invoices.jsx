import { FileText, Download } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, EmptyState, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

export default function Invoices() {
  const { loading, error, data, reload } = useResource(() => dataSource.getInvoices());

  if (loading) return <PageContainer><Card><LoadingState message="Loading invoices..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load invoices" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const INVOICES = data.items || [];
  return (
    <PageContainer>
      <Card padding={0}>
        <div style={{ padding: "18px 18px 8px" }}>
          <CardHeader icon={FileText} title="Invoices" subtitle="Download past invoices and receipts" />
        </div>
        <div className="callos-scroll-x">
          {INVOICES.length === 0 ? (
            <EmptyState icon={FileText} title="No invoices yet" />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Invoice", "Period", "Users", "Amount", "Status", "Date", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--accent)" }}>{inv.id}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{inv.period}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{inv.users}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--text-primary)" }}>{inv.amount}</td>
                    <td style={{ padding: "13px 16px" }}><Badge tone="success">{inv.status}</Badge></td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{new Date(inv.date).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <button title="Download" style={{ border: "none", background: "transparent", color: "var(--accent)", cursor: "pointer" }}><Download size={16} /></button>
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

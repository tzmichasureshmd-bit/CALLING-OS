import { useState } from "react";
import { Plus, PhoneOff, Trash2 } from "lucide-react";
import { PageContainer, Card, Button, SearchInput, EmptyState, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

export default function ExcludedNumbers() {
  const [query, setQuery] = useState("");
  const { loading, error, data, reload } = useResource(() => dataSource.getExcludedNumbers());

  if (loading) return <PageContainer><Card><LoadingState message="Loading..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load excluded numbers" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const EXCLUDED_NUMBERS = data.items || [];
  const filtered = EXCLUDED_NUMBERS.filter((n) =>
    [n.number, n.reason].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PageContainer>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", flexWrap: "wrap", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Excluded Phone Numbers</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Numbers ignored during call tracking and analytics.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Search numbers..." />
            <Button icon={Plus}>Add Number</Button>
          </div>
        </div>

        <div className="callos-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={PhoneOff} title="No excluded numbers" message="Add a number to exclude it from tracking and reports." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Phone Number", "Reason", "Added By", "Date", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--accent)" }}>{n.number}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{n.reason}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{n.addedBy}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{new Date(n.date).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <button title="Remove" style={{ border: "none", background: "transparent", color: "var(--danger)", cursor: "pointer" }}><Trash2 size={16} /></button>
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

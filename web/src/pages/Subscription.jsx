import { CreditCard, Check, Users2 } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  "Call tracking", "Call recording", "Call logs",
  "AI Transcript", "Transcribe", "Dashboard Analytics",
];

export default function Subscription() {
  const { user } = useAuth();
  const { loading, error, data, reload } = useResource(() => dataSource.getSubscription());

  if (loading) return <PageContainer><Card><LoadingState message="Loading subscription..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load subscription" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const { users, perUser } = data;
  const orgName = user?.organization_name || "Your Organization";

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }} className="callos-grid-2">
        <Card>
          <CardHeader icon={CreditCard} title="Current Plan" subtitle={orgName} action={<Badge tone="success">Active</Badge>} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: "var(--text-primary)" }}>₹{perUser}</span>
            <span style={{ fontSize: 14, color: "var(--text-muted)" }}>/ user / month</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18, color: "var(--text-muted)", fontSize: 13 }}>
            <Users2 size={16} /> {users} active users · <b style={{ color: "var(--text-primary)" }}>₹{users * perUser}.00</b> / month
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            {FEATURES.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                <Check size={15} color="var(--success)" /> {f}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button>Manage Plan</Button>
            <Button variant="outline">Add Users</Button>
          </div>
        </Card>

        <Card>
          <CardHeader icon={CreditCard} title="Billing" subtitle="Next payment overview" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Billing cycle", value: "Monthly" },
              { label: "Amount due", value: `₹${users * perUser}.00` },
              { label: "Payment method", value: "UPI · **** 5823" },
            ].map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text-muted)" }}>{r.label}</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

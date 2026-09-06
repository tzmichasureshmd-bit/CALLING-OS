import { useState } from "react";
import { CreditCard, Check, Users2, X, Plus } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { useAuth } from "../context/AuthContext.jsx";
import { employeesApi } from "../api/resources.js";

function AddUsersModal({ onClose, onAdded }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim() || !email.trim()) { setErr("Name and email are required"); return; }
    setSaving(true); setErr("");
    try {
      await employeesApi.create({ name: name.trim(), email: email.trim(), phone: phone.trim() || null });
      onAdded(); onClose();
    } catch (e) {
      setErr(e?.message || "Failed to add user");
    } finally { setSaving(false); }
  }

  const inp = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: 400, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add User</div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>
        {[{label:"FULL NAME",val:name,set:setName,ph:"John Doe",type:"text"},{label:"EMAIL",val:email,set:setEmail,ph:"john@company.com",type:"email"},{label:"PHONE (optional)",val:phone,set:setPhone,ph:"+91 98765 43210",type:"tel"}].map((f) => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>{f.label}</label>
            <input style={inp} type={f.type} placeholder={f.ph} value={f.val} onChange={(e) => f.set(e.target.value)} />
          </div>
        ))}
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Button icon={Plus} onClick={submit} disabled={saving}>{saving ? "Adding…" : "Add User"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  "Call tracking", "Call recording", "Call logs",
  "AI Transcript", "Transcribe", "Dashboard Analytics",
];

export default function Subscription() {
  const { user } = useAuth();
  const { loading, error, data, reload } = useResource(() => dataSource.getSubscription());
  const [showAdd, setShowAdd] = useState(false);

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
            <Button onClick={() => window.open("mailto:billing@callingos.tzmicha.com?subject=Manage Plan", "_blank")}>Manage Plan</Button>
            <Button variant="outline" onClick={() => setShowAdd(true)}>Add Users</Button>
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
      {showAdd && <AddUsersModal onClose={() => setShowAdd(false)} onAdded={reload} />}
    </PageContainer>
  );
}


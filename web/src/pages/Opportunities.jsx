import { useState } from "react";
import { Plus, TrendingUp, X } from "lucide-react";
import { PageContainer, Card, Badge, Button, EmptyState, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { PIPELINE_STAGES } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { opportunitiesApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";
import { useAuth } from "../context/AuthContext.jsx";

const STAGE_TONE = { New: "neutral", Qualified: "teal", Proposal: "violet", Negotiation: "warning", Won: "success", Lost: "danger" };
const OPEN_STAGES = ["New", "Qualified", "Proposal", "Negotiation"];
const fmt = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

function AddOpportunityModal({ onClose, onAdded }) {
  const [fields, setFields] = useState({ name: "", phone: "", customer: "", stage: "New", value: "", probability: "", closeDate: "", nextAction: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!fields.name.trim()) { setError("Opportunity name is required"); return; }
    const probability = Number(fields.probability || 0);
    if (probability < 0 || probability > 100) { setError("Probability must be between 0 and 100"); return; }
    setSaving(true);
    try {
      await opportunitiesApi.create({
        name: fields.name.trim(),
        phone: fields.phone.trim() || null,
        customer: fields.customer.trim() || null,
        stage: fields.stage,
        value: Number(fields.value || 0),
        probability: probability / 100,
        close_date: fields.closeDate ? `${fields.closeDate}T23:59:59Z` : null,
        next_action: fields.nextAction.trim() || null,
        notes: fields.notes.trim() || null,
      });
      onAdded(); onClose();
    } catch (err) {
      setError(err?.message || "Unable to create opportunity");
    } finally { setSaving(false); }
  }

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div className="app-dialog-panel" style={{ position: "relative", width: "min(560px, 94vw)", maxHeight: "92vh", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><div><h2 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>Add opportunity</h2><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: 12 }}>Create an open opportunity in your pipeline.</p></div><button onClick={onClose} aria-label="Close" style={{ border: 0, background: "var(--bg-hover)", color: "var(--text-muted)", width: 30, height: 30, borderRadius: 9, cursor: "pointer" }}><X size={15} /></button></div>
        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <Field label="Opportunity name" required><input value={fields.name} onChange={set("name")} placeholder="Customer or deal name" required /></Field>
          <Field label="Customer / company"><input value={fields.customer} onChange={set("customer")} placeholder="Company or role" /></Field>
          <Field label="Phone"><input value={fields.phone} onChange={set("phone")} placeholder="+91 98765 43210" /></Field>
          <Field label="Stage"><select value={fields.stage} onChange={set("stage")}>{OPEN_STAGES.map((stage) => <option key={stage}>{stage}</option>)}</select></Field>
          <Field label="Value (INR)"><input type="number" min="0" value={fields.value} onChange={set("value")} placeholder="0" /></Field>
          <Field label="Probability (%)"><input type="number" min="0" max="100" value={fields.probability} onChange={set("probability")} placeholder="0" /></Field>
          <Field label="Expected close date"><input type="date" value={fields.closeDate} onChange={set("closeDate")} /></Field>
          <Field label="Next action"><input value={fields.nextAction} onChange={set("nextAction")} placeholder="Send proposal" /></Field>
          <Field label="Notes" full><textarea rows={3} value={fields.notes} onChange={set("notes")} placeholder="Context, objections, or next steps" /></Field>
          {error && <div style={{ gridColumn: "1 / -1", padding: 10, borderRadius: 9, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12 }}>{error}</div>}
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 4 }}><Button variant="outline" type="button" onClick={onClose}>Cancel</Button><Button icon={Plus} type="submit" disabled={saving}>{saving ? "Creating…" : "Create opportunity"}</Button></div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required = false, full = false, children }) {
  return <label style={{ gridColumn: full ? "1 / -1" : undefined, display: "flex", flexDirection: "column", gap: 5, color: "var(--text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>{label}{required && " *"}{children}</label>;
}

export default function Opportunities() {
  const { loading, error, data, reload } = useResource(() => dataSource.getPipeline());
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const canManage = ["ADMIN", "SUPER_ADMIN"].includes((user?.role || "").toUpperCase());

  async function updateStage(opportunity, stage) {
    if (!stage || stage === opportunity.stage) return;
    setUpdatingId(opportunity.id);
    try { await opportunitiesApi.update(opportunity.id, { stage }); await reload(); }
    catch (err) { window.alert(err?.message || "Unable to update opportunity"); }
    finally { setUpdatingId(null); }
  }

  if (loading) return <PageContainer><Card><SkeletonRows rows={5} cols={5} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load opportunities" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const pipeline = data.items || [];
  const totalValue = pipeline.reduce((sum, opportunity) => sum + Number(opportunity.value || 0), 0);
  const weighted = pipeline.reduce((sum, opportunity) => sum + Number(opportunity.value || 0) * Number(opportunity.probability || 0), 0);
  const byStage = PIPELINE_STAGES.filter((stage) => OPEN_STAGES.includes(stage)).map((stage) => ({ stage, items: pipeline.filter((opportunity) => opportunity.stage === stage) }));

  return (
    <PageContainer>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
        <div><h1 style={{ margin: 0, fontSize: 30, color: "var(--text-primary)" }}>Opportunities</h1><p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Track open deals through qualification, proposal, and negotiation.</p></div>
        <div style={{ display: "flex", gap: 9, alignItems: "center" }}><Button variant="outline" onClick={() => window.location.assign("/opportunities-closed")}>View closed deals</Button>{canManage && <Button icon={Plus} onClick={() => setShowAdd(true)}>Add opportunity</Button>}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
        <Metric label="Open opportunities" value={pipeline.length} detail="Active pipeline" tone="blue" />
        <Metric label="Pipeline value" value={fmt(totalValue)} detail="Total potential value" tone="yellow" />
        <Metric label="Weighted value" value={fmt(Math.round(weighted))} detail="Probability-adjusted" tone="green" />
      </div>
      <div className="nova-scroll-x" style={{ paddingBottom: 8 }}><div style={{ display: "flex", gap: 14, minWidth: 900 }}>{byStage.map((column) => <div key={column.stage} style={{ flex: 1, minWidth: 190 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><Badge tone={STAGE_TONE[column.stage]}>{column.stage}</Badge><span style={{ fontSize: 11, color: "var(--text-dim)" }}>{column.items.length}</span></div><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{column.items.length === 0 ? <div style={{ border: "1px dashed var(--border)", borderRadius: 14, padding: 18, textAlign: "center", fontSize: 12, color: "var(--text-dim)" }}>No opportunities</div> : column.items.map((opportunity) => <Card key={opportunity.id} hover padding={15}><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{opportunity.name}</div><div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}>{opportunity.customer}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 15, fontWeight: 750, color: "var(--text-primary)" }}>{fmt(opportunity.value)}</span><Badge tone="teal">{Math.round(opportunity.probability * 100)}%</Badge></div><div style={{ fontSize: 11, color: "var(--text-dim)" }}>Close: {opportunity.closeDate}</div><div style={{ fontSize: 11.5, color: "var(--accent)", marginTop: 6 }}>{opportunity.nextAction}</div>{canManage && <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>Move to <select value={opportunity.stage} disabled={updatingId === opportunity.id} onChange={(event) => updateStage(opportunity, event.target.value)} style={{ flex: 1, minWidth: 0, padding: "5px 7px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)" }}>{[...OPEN_STAGES, "Won", "Lost"].map((stage) => <option key={stage}>{stage}</option>)}</select></label>}</Card>)}</div></div>)}</div></div>
      {showAdd && <AddOpportunityModal onClose={() => setShowAdd(false)} onAdded={reload} />}
    </PageContainer>
  );
}

function Metric({ label, value, detail, tone }) {
  const backgrounds = { blue: "var(--pastel-blue)", yellow: "var(--pastel-yellow)", green: "var(--pastel-green)" };
  return <div style={{ padding: 17, borderRadius: "var(--radius-xl-app)", background: backgrounds[tone], border: "1px solid var(--border-soft-app)" }}><div style={{ color: "var(--text-secondary-app)", fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div><div style={{ marginTop: 10, color: "var(--text-primary-app)", fontSize: 27, fontWeight: 750 }}>{value}</div><div style={{ marginTop: 4, color: "var(--text-secondary-app)", fontSize: 11 }}>{detail}</div></div>;
}

import { useEffect, useState } from "react";
import { CreditCard, Plus, RefreshCw, Save, ShieldAlert } from "lucide-react";
import { Badge, Button, Card, ErrorState, LoadingState } from "../../components/ui.jsx";
import { subscriptionAdminApi } from "../../api/resources.js";

const money = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));

export default function BillingTab() {
  const [data, setData] = useState({ plans: [], subscriptions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);
  const [newPlan, setNewPlan] = useState({ name: "", member_limit: "" });

  async function load() {
    setLoading(true); setError("");
    try { const [plans, subscriptions] = await Promise.all([subscriptionAdminApi.plans(), subscriptionAdminApi.subscriptions()]); setData({ plans: plans.items || [], subscriptions: subscriptions.items || [] }); }
    catch (err) { setError(err?.message || "Unable to load billing administration"); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function savePrice(price, event) {
    const form = new FormData(event.currentTarget);
    setSaving(price.id);
    try { await subscriptionAdminApi.updatePrice(price.id, { regular_price: Number(form.get("regular")), selling_price: Number(form.get("selling")) }); await load(); }
    catch (err) { window.alert(err?.message || "Unable to update price"); }
    finally { setSaving(null); }
  }

  async function createPlan(event) {
    event.preventDefault();
    try { await subscriptionAdminApi.createPlan({ name: newPlan.name.trim(), member_limit: Number(newPlan.member_limit), application_access: { desktop: true, mobile: true }, is_active: true }); setNewPlan({ name: "", member_limit: "" }); await load(); }
    catch (err) { window.alert(err?.message || "Unable to create plan"); }
  }

  async function extend(subscription) {
    const months = Number(window.prompt("Months to extend", "1"));
    const reason = window.prompt("Audit reason");
    if (!months || !reason) return;
    await subscriptionAdminApi.extend(subscription.id, { months, reason });
    await load();
  }

  async function suspend(subscription) {
    const reason = window.prompt("Audit reason for suspension");
    if (!reason) return;
    await subscriptionAdminApi.suspend(subscription.id, { reason });
    await load();
  }

  if (loading) return <Card><LoadingState message="Loading subscription administration..." /></Card>;
  if (error) return <Card><ErrorState title="Could not load billing administration" message={error} onRetry={load} /></Card>;

  return <div style={{ display: "grid", gap: 16 }}>
    <Card><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}><div><h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18 }}>Plans and prices</h2><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: 12 }}>Official selling prices are stored in the database and audited when changed.</p></div><Button variant="ghost" icon={RefreshCw} onClick={load}>Refresh</Button></div>{data.plans.map((plan) => <div key={plan.id} style={{ marginBottom: 14, padding: 14, borderRadius: 13, background: "var(--surface-muted)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div><strong style={{ color: "var(--text-primary)" }}>{plan.name}</strong><span style={{ marginLeft: 8, color: "var(--text-muted)", fontSize: 12 }}>{plan.member_limit} members · Desktop + Mobile</span></div><Badge tone={plan.is_active ? "success" : "neutral"}>{plan.is_active ? "Active" : "Inactive"}</Badge></div><div style={{ display: "grid", gap: 7 }}>{(plan.prices || []).map((price) => <form key={price.id} onSubmit={(event) => { event.preventDefault(); savePrice(price, event); }} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1fr auto", gap: 8, alignItems: "center", fontSize: 12 }}><span style={{ color: "var(--text-muted)" }}>{price.duration}</span><input name="regular" defaultValue={price.regular_price} type="number" min="0" step="0.01" aria-label="Regular price" style={{ padding: "7px 8px" }} /><input name="selling" defaultValue={price.selling_price} type="number" min="0" step="0.01" aria-label="Selling price" style={{ padding: "7px 8px" }} /><Button type="submit" variant="outline" disabled={saving === price.id} icon={Save}>{saving === price.id ? "Saving" : "Save"}</Button></form>)}</div></div>)}</Card>
    <Card><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><Plus size={17} color="var(--accent)" /><strong style={{ color: "var(--text-primary)" }}>Create configurable plan</strong></div><form onSubmit={createPlan} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input required value={newPlan.name} onChange={(event) => setNewPlan((current) => ({ ...current, name: event.target.value }))} placeholder="Plan name" style={{ padding: "9px 10px" }} /><input required type="number" min="1" value={newPlan.member_limit} onChange={(event) => setNewPlan((current) => ({ ...current, member_limit: event.target.value }))} placeholder="Member limit" style={{ padding: "9px 10px" }} /><Button type="submit" icon={Plus}>Create plan</Button></form></Card>
    <Card><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}><ShieldAlert size={17} color="var(--warning)" /><strong style={{ color: "var(--text-primary)" }}>Organization subscriptions</strong></div>{data.subscriptions.length === 0 ? <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No subscription orders yet.</div> : <div style={{ display: "grid", gap: 8 }}>{data.subscriptions.map((subscription) => <div key={subscription.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", padding: 11, borderRadius: 10, background: "var(--surface-muted)", fontSize: 12 }}><span><strong>{subscription.organization_id}</strong> · {subscription.plan?.name} · {subscription.member_limit} seats</span><span><Badge tone={subscription.status === "active" ? "success" : "warning"}>{subscription.status}</Badge> <Button variant="ghost" onClick={() => extend(subscription)}>Extend</Button> <Button variant="ghost" onClick={() => suspend(subscription)}>Suspend</Button></span></div>)}</div>}</Card>
  </div>;
}

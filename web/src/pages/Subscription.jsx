import { useMemo, useState } from "react";
import { Check, CreditCard, CalendarDays, Users, ShieldCheck, X, ReceiptText } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button, LoadingState, ErrorState, EmptyState } from "../components/ui.jsx";
import { subscriptionApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";

const DURATIONS = [
  { key: "1_month", label: "1 Month" },
  { key: "6_months", label: "6 Months" },
  { key: "1_year", label: "1 Year" },
];

const SALES_PHONE = "+918341551387";
const SALES_PHONE_DISPLAY = "+91 83415 51387";
const SALES_EMAIL = "suresh.md@tzmicha.com";

const durationLabel = (value) => DURATIONS.find((item) => item.key === value)?.label || value;
const money = (value, currency = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value || 0));

function PriceCard({ plan, duration, onSelect, disabled }) {
  const price = plan.prices?.find((item) => item.duration === duration);
  if (!price) return null;
  const savings = Math.max(Number(price.regular_price) - Number(price.selling_price), 0);
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 16, border: "1px solid var(--border-soft-app)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div><div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{plan.name}</div><div style={{ marginTop: 5, color: "var(--text-muted)", fontSize: 12.5 }}>Up to {plan.member_limit} members</div></div>
        <Badge tone="success">Desktop + Mobile</Badge>
      </div>
      <div style={{ padding: 14, borderRadius: 14, background: "var(--pastel-green)" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 750 }}>{durationLabel(duration)}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}><span style={{ color: "var(--text-dim)", textDecoration: "line-through", fontSize: 15 }}>{money(price.regular_price, price.currency)}</span><strong style={{ color: "var(--text-primary)", fontSize: 28 }}>{money(price.selling_price, price.currency)}</strong></div>
        <div style={{ marginTop: 5, color: "var(--success)", fontSize: 12, fontWeight: 700 }}>Save {money(savings, price.currency)}</div>
      </div>
      <div style={{ display: "grid", gap: 8, color: "var(--text-secondary)", fontSize: 12.5 }}><span><Check size={14} color="var(--success)" /> Desktop application included</span><span><Check size={14} color="var(--success)" /> Mobile application included</span><span><Check size={14} color="var(--success)" /> {plan.member_limit} active member seats</span></div>
      <Button onClick={() => onSelect(plan, price)} disabled={disabled} style={{ width: "100%", justifyContent: "center" }}>Select Plan</Button>
    </Card>
  );
}

function ContactSalesModal({ request, onClose }) {
  const [copied, setCopied] = useState(false);
  const message = `CallNexa ${request.plan.name} plan, ${durationLabel(request.price.duration)}, ${request.plan.member_limit} members. Price: ${money(request.price.selling_price, request.price.currency)}.`;
  function copyRequest() { navigator.clipboard?.writeText(message); setCopied(true); }
  return <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} /><div className="app-dialog-panel" style={{ position: "relative", width: "min(460px, 92vw)", padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><div><h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 18 }}>Contact CallNexa</h2><p style={{ margin: "5px 0 0", color: "var(--text-muted)", fontSize: 12 }}>We will confirm the plan, taxes, payment details, and activation with you.</p></div><button onClick={onClose} aria-label="Close" style={{ border: 0, background: "var(--bg-hover)", color: "var(--text-muted)", width: 30, height: 30, borderRadius: 9, cursor: "pointer" }}><X size={15} /></button></div><div style={{ padding: 14, borderRadius: 13, background: "var(--pastel-blue)", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}>{message}</div><div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--warning-soft)", color: "var(--warning)", fontSize: 12.5 }}>No payment has been started. A CallNexa representative will provide the next steps.</div><div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 16, padding: 12, borderRadius: 10, background: "var(--surface-muted)", fontSize: 13 }}><strong style={{ color: "var(--text-primary)" }}>Contact Sales</strong><a href={`tel:${SALES_PHONE}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{SALES_PHONE_DISPLAY}</a><a href={`mailto:${SALES_EMAIL}?subject=CallNexa plan enquiry&body=${encodeURIComponent(message)}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{SALES_EMAIL}</a></div><div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}><Button variant="outline" onClick={copyRequest}>{copied ? "Copied" : "Copy request"}</Button><Button variant="ghost" onClick={onClose}>Close</Button></div></div></div>;
}

export default function Subscription() {
  const { loading, error, data, reload } = useResource(async () => {
    const [plans, current, payments] = await Promise.all([subscriptionApi.plans(), subscriptionApi.current(), subscriptionApi.payments()]);
    return { plans: plans.items || [], current, payments: payments.items || [] };
  });
  const [duration, setDuration] = useState("1_month");
  const [contactRequest, setContactRequest] = useState(null);
  const [actionError, setActionError] = useState("");

  const plans = data?.plans || [];
  const current = data?.current;
  const usage = current?.status && current.status !== "not_configured" ? `${current.active_members} / ${current.member_limit} seats used` : "No active subscription";

  function selectPlan(plan, price) {
    setActionError("");
    setContactRequest({ plan, price });
  }

  if (loading) return <PageContainer><Card><LoadingState message="Loading subscription plans..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Could not load subscription" message={error.message} onRetry={reload} /></Card></PageContainer>;

  return <PageContainer><div style={{ display: "grid", gap: 18 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div><h1 style={{ margin: 0, color: "var(--text-primary)", fontSize: 30 }}>Subscription & Billing</h1><p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13 }}>One organization package includes both the Desktop and Mobile applications.</p></div><div style={{ display: "flex", gap: 8, alignItems: "center", color: "var(--text-muted)", fontSize: 12 }}><ShieldCheck size={16} color="var(--success)" /> Backend-verified pricing</div></div>
    <Card><CardHeader icon={CreditCard} title="Current subscription" subtitle="Your organization seat usage and billing status" /><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>{[["Plan", current?.plan?.name || "Not configured"], ["Status", current?.status || "not_configured"], ["Seats", usage], ["Expires", current?.expiry_date ? new Date(current.expiry_date).toLocaleDateString("en-IN") : "—"], ["Days remaining", current?.days_remaining ?? "—"]].map(([label, value]) => <div key={label} style={{ padding: 13, borderRadius: 12, background: "var(--surface-muted)" }}><div style={{ color: "var(--text-muted)", fontSize: 10.5, textTransform: "uppercase", fontWeight: 750 }}>{label}</div><div style={{ marginTop: 6, color: "var(--text-primary)", fontWeight: 750, fontSize: 14 }}>{value}</div></div>)}</div></Card>
    <Card><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}><CardHeader icon={CalendarDays} title="Choose duration" subtitle="The selling price is read from the backend catalog." /><div style={{ display: "flex", gap: 5, padding: 4, borderRadius: 11, background: "var(--surface-muted)" }}>{DURATIONS.map((item) => <button key={item.key} onClick={() => setDuration(item.key)} style={{ border: 0, borderRadius: 8, padding: "8px 12px", background: duration === item.key ? "var(--primary-dark-app)" : "transparent", color: duration === item.key ? "#fff" : "var(--text-muted)", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>{item.label}</button>)}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))", gap: 12 }}>{plans.map((plan) => <PriceCard key={plan.id} plan={plan} duration={duration} onSelect={selectPlan} disabled={false} />)}</div>{plans.length === 0 && <EmptyState icon={Users} title="No active plans configured" message="A Super Admin must configure subscription plans before checkout is available." />}{actionError && <div style={{ marginTop: 14, padding: 10, borderRadius: 9, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12.5 }}>{actionError}</div>}</Card>
    <Card><CardHeader icon={ReceiptText} title="Payment history" subtitle="Payments and invoices are created only after verified payment." />{(data?.payments || []).length === 0 ? <EmptyState icon={ReceiptText} title="No payments yet" message="Completed payments will appear here." /> : <div style={{ display: "grid", gap: 8 }}>{data.payments.map((payment) => <div key={payment.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 11, borderRadius: 10, background: "var(--surface-muted)", fontSize: 12.5 }}><span>{payment.provider_order_id}</span><strong>{money(payment.amount, payment.currency)} · {payment.status}</strong></div>)}</div>}</Card>
    {contactRequest && <ContactSalesModal request={contactRequest} onClose={() => setContactRequest(null)} />}
  </div></PageContainer>;
}

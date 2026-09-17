import { useState } from "react";
import { Check, CreditCard, Tag, Users, Zap, ChevronRight } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { subscriptionApi } from "../api/resources.js";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    desc: "For small teams getting started with call tracking.",
    monthlyPrice: 100,
    yearlyPrice: 80,
    yearlyTotal: 960,
    maxEmployees: 10,
    features: ["Up to 10 employees", "Call tracking & logs", "Dashboard analytics"],
  },
  {
    key: "growth",
    name: "Growth",
    desc: "For growing sales teams that need recordings and AI insights.",
    monthlyPrice: 250,
    yearlyPrice: 200,
    yearlyTotal: 2400,
    maxEmployees: 200,
    features: ["Up to 200 employees", "Everything in Starter", "Call recording", "AI Transcribe", "Priority support"],
    popular: true,
  },
];

const FEATURE_ROWS = [
  { label: "Employees",        starter: "Up to 10",   growth: "Up to 200" },
  { label: "Call tracking",    starter: true,          growth: true },
  { label: "Call logs",        starter: true,          growth: true },
  { label: "Dashboard",        starter: true,          growth: true },
  { label: "Call recording",   starter: false,         growth: true },
  { label: "AI Transcribe",    starter: false,         growth: true },
  { label: "Priority support", starter: false,         growth: true },
];

function FeatureCell({ val }) {
  if (val === true)  return <Check size={15} color="var(--success)" strokeWidth={2.5} />;
  if (val === false) return <span style={{ color: "var(--border-strong)", fontSize: 16, lineHeight: 1 }}>—</span>;
  return <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{val}</span>;
}

export default function Subscription() {
  const { loading, error, data, reload } = useResource(() => dataSource.getSubscription());
  const [billing, setBilling] = useState("monthly");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  if (loading) return <PageContainer><Card><LoadingState message="Loading subscription..." /></Card></PageContainer>;
  if (error)   return <PageContainer><Card><ErrorState title="Couldn't load subscription" message={error.message} onRetry={reload} /></Card></PageContainer>;

  const { users, plan } = data;
  const currentPlan = PLANS.find((p) => p.key === plan) || PLANS[0];

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponApplying(true); setCouponMsg(null);
    try {
      const res = await subscriptionApi.applyCoupon(coupon.trim());
      setCouponMsg({ ok: true, text: res.message || "Coupon applied!" });
      reload();
    } catch (e) {
      setCouponMsg({ ok: false, text: e?.message || "Invalid coupon code." });
    } finally { setCouponApplying(false); }
  }

  async function selectPlan(planKey) {
    setPlanLoading(true);
    try {
      await subscriptionApi.selectPlan(planKey, billing);
      reload();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to select plan.");
    } finally { setPlanLoading(false); }
  }

  return (
    <PageContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Top row: current plan + billing toggle ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: 16 }}>

          {/* Current plan card */}
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", alignItems: "stretch" }}>

              {/* Plan info */}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-dim)", marginBottom: 8 }}>Current Plan</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: "Space Grotesk", fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{currentPlan.name}</span>
                  <Badge tone="success" dot>Active</Badge>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                  <Users size={13} />
                  {users} employee{users !== 1 ? "s" : ""} · up to {currentPlan.maxEmployees}
                </div>
              </div>

              <div style={{ background: "var(--border)" }} />

              {/* Monthly price */}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-dim)", marginBottom: 8 }}>Monthly billing</div>
                <div style={{ fontFamily: "Space Grotesk", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1, marginBottom: 4 }}>
                  ₹{currentPlan.monthlyPrice}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginLeft: 4 }}>/mo</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Billed every month</div>
              </div>

              <div style={{ background: "var(--border)" }} />

              {/* Yearly price */}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-dim)" }}>Yearly billing</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", borderRadius: 5, padding: "1px 6px" }}>Save 20%</span>
                </div>
                <div style={{ fontFamily: "Space Grotesk", fontSize: 28, fontWeight: 800, color: "var(--success)", lineHeight: 1, marginBottom: 4 }}>
                  ₹{currentPlan.yearlyPrice}
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-muted)", marginLeft: 4 }}>/mo</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>₹{currentPlan.yearlyTotal} billed yearly</div>
              </div>

            </div>
          </Card>

          {/* Billing toggle */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>Billing cycle</div>
            <div style={{ display: "inline-flex", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
              {["monthly", "yearly"].map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  style={{
                    padding: "7px 20px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 600,
                    background: billing === b ? "var(--bg-card)" : "transparent",
                    color: billing === b ? "var(--text-primary)" : "var(--text-muted)",
                    boxShadow: billing === b ? "var(--shadow-sm)" : "none",
                    transition: "all 0.15s",
                  }}
                >
                  {b.charAt(0).toUpperCase() + b.slice(1)}
                </button>
              ))}
            </div>
            {billing === "yearly" && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--success)", background: "var(--success-soft)", borderRadius: 6, padding: "3px 10px" }}>
                15-day free trial included
              </span>
            )}
          </div>
        </div>

        {/* ── Plan cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {PLANS.map((p) => {
            const isCurrent = plan === p.key;
            const price = billing === "yearly" ? p.yearlyPrice : p.monthlyPrice;
            const total = billing === "yearly" ? `₹${p.yearlyTotal}/yr` : "billed monthly";

            return (
              <div
                key={p.key}
                className="nova-card"
                style={{
                  padding: 0, overflow: "hidden",
                  border: `1.5px solid ${isCurrent ? "var(--accent)" : p.popular ? "var(--border-strong)" : "var(--border)"}`,
                  boxShadow: isCurrent ? "0 0 0 3px var(--accent-soft)" : "var(--shadow-sm)",
                  display: "flex", flexDirection: "column",
                }}
              >
                {/* Plan header */}
                <div style={{ padding: "22px 26px 20px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "Space Grotesk", fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{p.name}</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{p.desc}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                      {p.popular && <Badge tone="violet">Popular</Badge>}
                      {isCurrent && <Badge tone="success">Current</Badge>}
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14 }}>
                    <span style={{ fontFamily: "Space Grotesk", fontSize: 38, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
                      ₹{price}
                    </span>
                    <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>/month</span>
                    <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 4 }}>· {total}</span>
                  </div>
                </div>

                {/* Features */}
                <div style={{ padding: "18px 26px", flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "var(--text-dim)", marginBottom: 12 }}>
                    What's included
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {p.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-secondary)" }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Check size={12} color="var(--success)" strokeWidth={2.5} />
                        </div>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <div style={{ padding: "0 26px 24px" }}>
                  <button
                    onClick={() => selectPlan(p.key)}
                    disabled={isCurrent || planLoading}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: 10,
                      border: isCurrent ? "1.5px solid var(--border)" : "none",
                      background: isCurrent ? "transparent" : "var(--grad-brand)",
                      color: isCurrent ? "var(--text-muted)" : "#fff",
                      fontWeight: 700, fontSize: 14, cursor: isCurrent ? "default" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "filter 0.15s",
                    }}
                    onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.filter = "brightness(1.08)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                  >
                    {isCurrent ? "Current Plan" : billing === "yearly" ? "Start Free Trial" : `Choose ${p.name}`}
                    {!isCurrent && <ChevronRight size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Feature comparison table ── */}
        <Card padding={0}>
          <div style={{ padding: "18px 24px 0" }}>
            <CardHeader icon={Zap} title="Plan Comparison" subtitle="See exactly what's included in each plan" />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "12px 24px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: 12, width: "50%" }}>Feature</th>
                  {PLANS.map((p) => (
                    <th key={p.key} style={{ padding: "12px 24px", textAlign: "center", fontWeight: 700, color: plan === p.key ? "var(--accent)" : "var(--text-primary)", fontSize: 13, fontFamily: "Space Grotesk" }}>
                      {p.name}
                      {plan === p.key && <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "var(--success)", marginTop: 2 }}>Current</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row, i) => (
                  <tr key={row.label} style={{ borderBottom: i < FEATURE_ROWS.length - 1 ? "1px solid var(--border)" : "none", background: i % 2 === 0 ? "transparent" : "var(--bg-hover)" }}>
                    <td style={{ padding: "13px 24px", color: "var(--text-secondary)", fontWeight: 500 }}>{row.label}</td>
                    <td style={{ padding: "13px 24px", textAlign: "center" }}><FeatureCell val={row.starter} /></td>
                    <td style={{ padding: "13px 24px", textAlign: "center" }}><FeatureCell val={row.growth} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Bottom row: coupon + payment history ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          <Card>
            <CardHeader icon={Tag} title="Coupon Code" subtitle="Have a discount code? Apply it here." />
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="e.g. LAUNCH50"
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 10,
                  border: "1px solid var(--border)", background: "var(--bg-input)",
                  color: "var(--text-primary)", fontSize: 13.5, outline: "none",
                  letterSpacing: 1.5, fontWeight: 600,
                }}
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
              />
              <Button onClick={applyCoupon} disabled={couponApplying || !coupon.trim()}>
                {couponApplying ? "Applying…" : "Apply"}
              </Button>
            </div>
            {couponMsg && (
              <div style={{ marginTop: 8, fontSize: 12.5, color: couponMsg.ok ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                {couponMsg.text}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader icon={CreditCard} title="Payment History" subtitle="Your past invoices and transactions." />
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, color: "var(--text-dim)" }}>
              No payments yet. History will appear after your first billing cycle.
            </div>
          </Card>

        </div>

      </div>
    </PageContainer>
  );
}

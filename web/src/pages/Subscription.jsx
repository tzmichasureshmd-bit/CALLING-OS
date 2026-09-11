import { useState } from "react";
import { CreditCard, Users2, Check, Tag, Gift } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { subscriptionApi } from "../api/resources.js";

// Monthly prices
const PLANS = [
  {
    key: "starter",
    name: "Starter",
    monthlyPrice: 100,
    yearlyPrice: 80,   // ₹80/user/month billed yearly = 20% off
    unit: "user/month",
    maxEmployees: 100,
    features: ["Call tracking", "Call logs", "Dashboard Analytics", "Up to 100 employees"],
    popular: false,
  },
  {
    key: "growth",
    name: "Growth",
    monthlyPrice: 500,
    yearlyPrice: 400,  // ₹400/month billed yearly = 20% off
    unit: "month",
    maxEmployees: null,
    features: ["Everything in Starter", "Call recording", "AI Transcribe", "Unlimited employees", "Priority support"],
    popular: true,
  },
];

function BillingToggle({ billing, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: billing === "monthly" ? "var(--text-primary)" : "var(--text-muted)" }}>Monthly</span>
      <div
        onClick={() => onChange(billing === "monthly" ? "yearly" : "monthly")}
        style={{
          width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative",
          background: billing === "yearly" ? "var(--accent)" : "var(--border)",
          transition: "background 0.2s",
        }}
      >
        <div style={{
          position: "absolute", top: 3, left: billing === "yearly" ? 23 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: billing === "yearly" ? "var(--text-primary)" : "var(--text-muted)" }}>
        Yearly
      </span>
      {billing === "yearly" && (
        <span style={{ fontSize: 11, fontWeight: 700, background: "var(--success)", color: "#fff", borderRadius: 6, padding: "2px 7px" }}>
          Save 20% + 15-day free trial
        </span>
      )}
    </div>
  );
}

function PlanCard({ plan, billing, current, onSelect, loading }) {
  const isCurrent = current === plan.key;
  const price = billing === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;
  const yearlyTotal = plan.yearlyPrice * (plan.key === "growth" ? 12 : 12); // shown as annual total hint

  return (
    <div style={{
      border: `1.5px solid ${isCurrent ? "var(--accent)" : plan.popular ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 14, padding: 20, position: "relative",
      background: isCurrent ? "rgba(99,102,241,0.07)" : "var(--bg-card)",
      flex: 1,
    }}>
      {plan.popular && !isCurrent && (
        <span style={{ position: "absolute", top: 14, right: 14, background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px" }}>Popular</span>
      )}
      {isCurrent && (
        <span style={{ position: "absolute", top: 14, right: 14, background: "var(--success)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px" }}>Current</span>
      )}

      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{plan.name}</div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>₹{price}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/{plan.unit}</span>
      </div>

      {billing === "yearly" && (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4 }}>
          Billed ₹{plan.key === "growth" ? plan.yearlyPrice * 12 : plan.yearlyPrice * 12 + "/user"} yearly
        </div>
      )}
      {billing === "monthly" && (
        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 4 }}>
          {plan.key === "growth" ? "Flat rate — unlimited employees" : "Up to 100 employees per org"}
        </div>
      )}

      {/* Yearly trial badge */}
      {billing === "yearly" && (
        <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, padding: "5px 9px", marginBottom: 10 }}>
          <Gift size={12} color="var(--success)" />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--success)" }}>15-day free trial included</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)" }}>
            <Check size={13} color="var(--success)" /> {f}
          </div>
        ))}
      </div>

      <button
        onClick={() => onSelect(plan.key, billing)}
        disabled={isCurrent || loading}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
          background: isCurrent ? "var(--bg-hover)" : "var(--accent)",
          color: isCurrent ? "var(--text-muted)" : "#fff",
          fontWeight: 700, fontSize: 13.5, cursor: isCurrent ? "default" : "pointer",
        }}
      >
        {isCurrent ? "Current Plan" : billing === "yearly" ? `Start Free Trial` : `Select ${plan.name}`}
      </button>
    </div>
  );
}

export default function Subscription() {
  const { loading, error, data, reload } = useResource(() => dataSource.getSubscription());
  const [billing, setBilling] = useState("monthly");
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  if (loading) return <PageContainer><Card><LoadingState message="Loading subscription..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load subscription" message={error.message} onRetry={reload} /></Card></PageContainer>;

  const { users, plan, perUser } = data;
  const planLabel = plan === "growth" ? "Growth Plan" : "Starter Plan";
  const monthlyTotal = plan === "growth" ? 500 : users * 100;

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

  async function selectPlan(planKey, billingCycle) {
    setPlanLoading(true);
    try {
      await subscriptionApi.selectPlan(planKey, billingCycle);
      reload();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to select plan.");
    } finally { setPlanLoading(false); }
  }

  return (
    <PageContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Current Plan */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={17} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Current Plan</span>
            </div>
            <Badge tone="success">Active</Badge>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>{planLabel}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 30, fontWeight: 800, color: "var(--accent)" }}>₹{monthlyTotal}</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/ month</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
            <Users2 size={15} /> {users} active employee{users !== 1 ? "s" : ""}
            {plan === "starter" && <span>· ₹100/user</span>}
          </div>
        </Card>

        {/* Available Plans */}
        <Card>
          <CardHeader icon={CreditCard} title="Available Plans" subtitle="Choose a plan that fits your needs" />
          <BillingToggle billing={billing} onChange={setBilling} />
          <div style={{ display: "flex", gap: 14 }}>
            {PLANS.map((p) => (
              <PlanCard key={p.key} plan={p} billing={billing} current={plan} onSelect={selectPlan} loading={planLoading} />
            ))}
          </div>
        </Card>

        {/* Coupon Code */}
        <Card>
          <CardHeader icon={Tag} title="Coupon Code" subtitle="Have a discount code? Apply it here" />
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <input
              value={coupon}
              onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              style={{ flex: 1, padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13.5, outline: "none", letterSpacing: 1 }}
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

        {/* Payment History */}
        <Card>
          <CardHeader icon={CreditCard} title="Payment History" subtitle="View your recent transactions" />
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
            Payment history will appear here after your first billing cycle.
          </div>
        </Card>

      </div>
    </PageContainer>
  );
}

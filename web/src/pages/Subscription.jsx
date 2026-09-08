import { useState } from "react";
import { CreditCard, Users2, Check, Tag, Calendar, Info, ChevronRight } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { subscriptionApi } from "../api/resources.js";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 100,
    unit: "user/month",
    maxEmployees: 100,
    features: ["Call tracking", "Call logs", "Dashboard Analytics", "Up to 100 employees"],
    popular: false,
  },
  {
    key: "growth",
    name: "Growth",
    price: 500,
    unit: "month",
    maxEmployees: null,
    features: ["Everything in Starter", "Call recording", "AI Transcribe", "Unlimited employees", "Priority support"],
    popular: true,
  },
];

function PlanCard({ plan, current, onSelect, loading }) {
  const isCurrent = current === plan.key;
  return (
    <div style={{
      border: `1.5px solid ${isCurrent ? "var(--accent)" : plan.popular ? "var(--accent)" : "var(--border)"}`,
      borderRadius: 14, padding: 20, position: "relative",
      background: isCurrent ? "var(--accent-soft, rgba(99,102,241,0.07))" : "var(--bg-card)",
      flex: 1,
    }}>
      {plan.popular && !isCurrent && (
        <span style={{ position: "absolute", top: 14, right: 14, background: "var(--accent)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px" }}>Popular</span>
      )}
      {isCurrent && (
        <span style={{ position: "absolute", top: 14, right: 14, background: "var(--success)", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "2px 8px" }}>Current</span>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>{plan.name}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: "var(--accent)" }}>₹{plan.price}</span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>/{plan.unit}</span>
      </div>
      {plan.key === "growth" && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Flat rate — unlimited employees</div>
      )}
      {plan.key === "starter" && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Up to 100 employees per org</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "14px 0 16px" }}>
        {plan.features.map((f) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)" }}>
            <Check size={13} color="var(--success)" /> {f}
          </div>
        ))}
      </div>
      <button
        onClick={() => onSelect(plan.key)}
        disabled={isCurrent || loading}
        style={{
          width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
          background: isCurrent ? "var(--bg-hover)" : "var(--accent)",
          color: isCurrent ? "var(--text-muted)" : "#fff",
          fontWeight: 700, fontSize: 13.5, cursor: isCurrent ? "default" : "pointer",
        }}
      >
        {isCurrent ? "Current Plan" : `Select ${plan.name}`}
      </button>
    </div>
  );
}

export default function Subscription() {
  const { loading, error, data, reload } = useResource(() => dataSource.getSubscription());
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  if (loading) return <PageContainer><Card><LoadingState message="Loading subscription..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load subscription" message={error.message} onRetry={reload} /></Card></PageContainer>;

  const { users, plan, isTrial, trialDaysLeft, trialEndsOn, perUser } = data;

  async function applyCoupon() {
    if (!coupon.trim()) return;
    setCouponApplying(true); setCouponMsg(null);
    try {
      const res = await subscriptionApi.applyCoupon(coupon.trim());
      setCouponMsg({ ok: true, text: res.message || "Coupon applied!" });
      reload();
    } catch (e) {
      setCouponMsg({ ok: false, text: e?.response?.data?.detail || "Invalid coupon code." });
    } finally { setCouponApplying(false); }
  }

  async function selectPlan(planKey) {
    setPlanLoading(true);
    try {
      await subscriptionApi.selectPlan(planKey);
      reload();
    } catch (e) {
      alert(e?.response?.data?.detail || "Failed to select plan.");
    } finally { setPlanLoading(false); }
  }

  return (
    <PageContainer>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>

        {/* Current Plan */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={17} color="var(--accent)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>Current Plan</span>
            </div>
            <Badge tone="success">Active</Badge>
          </div>

          {isTrial ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>Trial Period</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
                Free Trial — {trialDaysLeft} Day(s) Remaining
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
                  <Users2 size={14} /> {users} Employee(s) In Trial <span style={{ color: "var(--text-muted)" }}>(Max 10 During Trial)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--text-secondary)" }}>
                  <Calendar size={14} /> Trial ends on {trialEndsOn}
                </div>
              </div>
              <div style={{ background: "var(--info-soft, rgba(59,130,246,0.08))", border: "1px solid var(--info-border, rgba(59,130,246,0.2))", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", gap: 8 }}>
                <Info size={15} color="var(--info, #3b82f6)" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>
                  During Trial: User count automatically matches your employee count. Add or remove employees to change the count. Current count: <b>{users} user(s)</b>.
                </span>
              </div>
              <button
                onClick={() => selectPlan("starter")}
                disabled={planLoading}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                ↑ Select Starter Plan <ChevronRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4, textTransform: "capitalize" }}>
                {plan === "growth" ? "Growth Plan" : "Starter Plan"}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 30, fontWeight: 800, color: "var(--accent)" }}>
                  ₹{plan === "growth" ? 500 : users * 100}
                </span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>/ month</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-muted)" }}>
                <Users2 size={15} /> {users} active employees
              </div>
            </>
          )}
        </Card>

        {/* Available Plans */}
        <Card>
          <CardHeader icon={CreditCard} title="Available Plans" subtitle="Choose a plan that fits your needs" />
          <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
            {PLANS.map((p) => (
              <PlanCard key={p.key} plan={p} current={isTrial ? null : plan} onSelect={selectPlan} loading={planLoading} />
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
            {isTrial ? "No payments yet — you're on a free trial." : "Payment history will appear here after your first billing cycle."}
          </div>
        </Card>

      </div>
    </PageContainer>
  );
}

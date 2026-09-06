import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Phone, Users2, Clock, Flame, TrendingUp, Trophy, Activity,
  AlertTriangle, Zap, Smartphone, ArrowRight, ChevronRight, Star,
  PhoneMissed, PhoneOutgoing, PhoneIncoming, Battery,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Card, CardHeader, Badge, PageContainer, KpiCard, ChartTooltip,
  SkeletonCard, SkeletonRows, ErrorState, EmptyState, SectionTitle,
} from "../components/ui.jsx";
import { formatTalkTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useRange } from "../context/RangeContext.jsx";
import * as api from "../api/resources.js";

const POLL_INTERVAL = 30000; // 30s live pulse refresh

const SEV = { high: { tone: "danger", color: "var(--danger)" }, medium: { tone: "warning", color: "var(--warning)" }, low: { tone: "info", color: "var(--info)" } };

function DashboardSkeleton() {
  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={1} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
        <Card><SkeletonRows rows={5} cols={4} /></Card>
        <Card><SkeletonRows rows={5} cols={2} /></Card>
      </div>
    </PageContainer>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { range } = useRange();
  const { loading, error, data, reload } = useResource(() => dataSource.getDashboard(range), [range]);
  const [livePulse, setLivePulse] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    function fetchPulse() {
      api.analyticsApi.livePulse()
        .then((res) => setLivePulse(res.items || []))
        .catch(() => {});
    }
    fetchPulse();
    pollRef.current = setInterval(fetchPulse, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (error) return <PageContainer><Card><ErrorState title="Sync interrupted" message={error.message} hint="Last successful sync: 12:41 PM" code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const { kpis, topPerformer: top, leaderboard, opportunities, dailyMetrics, outcomeBreakdown, durationDistribution, deviceHealth, needsAttention, salesFunnel } = data;
  const pulse = livePulse ?? data.livePulse ?? [];
  const hotLeads = opportunities.filter((o) => o.hot).slice(0, 4);
  const axis = "var(--text-dim)";

  return (
    <PageContainer>
      {/* KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 18 }}>
        <div onClick={() => navigate("/call-logs")} style={{ cursor: "pointer" }}>
          <KpiCard icon={Phone} label="Total Calls" value={kpis.totalCalls} sub="all employees" tone="teal" numeric />
        </div>
        <div onClick={() => navigate("/call-logs")} style={{ cursor: "pointer" }}>
          <KpiCard icon={Users2} label="Connected" value={`${kpis.connectedPct}%`} sub={`${kpis.connected} connected`} tone="violet" />
        </div>
        <div onClick={() => navigate("/analytics")} style={{ cursor: "pointer" }}>
          <KpiCard icon={Clock} label="Talk Time" value={formatTalkTime(kpis.talkTimeSeconds)} sub="this week" tone="cyan" />
        </div>
        <div onClick={() => navigate("/leads")} style={{ cursor: "pointer" }}>
          <KpiCard icon={Flame} label="Hot Leads" value={kpis.hotLeads} sub="need action" tone="warning" numeric />
        </div>
      </div>

      {/* NEEDS ATTENTION — prominent */}
      <Card style={{ marginBottom: 18, borderColor: "var(--border-strong)" }}>
        <CardHeader icon={AlertTriangle} title="Needs Attention" subtitle="What requires action right now" action={<Badge tone="danger" dot>{needsAttention.length} items</Badge>} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          {needsAttention.map((n) => {
            const s = SEV[n.severity] || SEV.medium;
            return (
              <button key={n.id} onClick={() => navigate(n.to)} style={{
                textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
                background: "var(--bg-hover)", borderRadius: 12, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12, borderLeft: `3px solid ${s.color}`,
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `var(--${s.tone}-soft)`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertTriangle size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.detail}</div>
                </div>
                <ChevronRight size={16} color="var(--text-dim)" />
              </button>
            );
          })}
        </div>
      </Card>

      {/* CALL ACTIVITY + LIVE PULSE */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 18 }} className="nova-grid-2">
        <Card>
          <CardHeader icon={Activity} title="Call Activity" subtitle="Total vs connected vs missed — last 7 days" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyMetrics} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#14b8a6" stopOpacity={0.35} /><stop offset="100%" stopColor="#14b8a6" stopOpacity={0} /></linearGradient>
                <linearGradient id="gConn" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="total" name="Total" stroke="#14b8a6" strokeWidth={2} fill="url(#gTotal)" />
              <Area type="monotone" dataKey="connected" name="Connected" stroke="#8b5cf6" strokeWidth={2} fill="url(#gConn)" />
              <Area type="monotone" dataKey="missed" name="Missed" stroke="#ef4444" strokeWidth={2} fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card padding={0}>
          <div style={{ padding: "20px 20px 6px" }}>
            <CardHeader icon={Zap} title="Live Pulse" subtitle="Real-time call events" action={<span className="nova-live-dot" />} />
          </div>
          <div style={{ padding: "0 8px 8px", maxHeight: 240, overflowY: "auto" }}>
            {pulse.length === 0 ? (
              <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-dim)", fontSize: 12.5 }}>No recent call events</div>
            ) : pulse.map((p) => {
              const c = { success: "var(--success)", danger: "var(--danger)", info: "var(--info)" }[p.tone] || "var(--info)";
              return (
                <div key={p.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 12px", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "Space Grotesk", minWidth: 34, paddingTop: 2 }}>{p.time}</div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: c, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{p.text}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.employee}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* OPPORTUNITY PIPELINE + HOT LEADS */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 18 }} className="nova-grid-2">
        <Card padding={0}>
          <div style={{ padding: "20px 20px 10px" }}>
            <CardHeader icon={TrendingUp} title="Opportunity Pipeline" subtitle="Multi-connect opportunities this month" action={<button onClick={() => navigate("/opportunities")} style={linkBtn}>View all <ArrowRight size={13} /></button>} />
          </div>
          <div className="nova-scroll-x" style={{ maxHeight: 320, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, background: "var(--bg-card)" }}>
                  {["Client", "Connects", "Talk Time", "Last", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {opportunities.map((o) => (
                  <tr key={o.id} onClick={() => navigate("/opportunities")} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "11px 16px", maxWidth: 210 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {o.hot && <Star size={12} fill="var(--warning)" color="var(--warning)" />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                          <div style={{ color: "var(--accent)", fontSize: 11.5 }}>{o.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "11px 16px", fontFamily: "Space Grotesk", fontWeight: 700, color: "var(--text-primary)" }}>{o.connects}×</td>
                    <td style={{ padding: "11px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatTalkTime(o.talkTimeSeconds)}</td>
                    <td style={{ padding: "11px 16px", color: "var(--info)", whiteSpace: "nowrap" }}>{o.lastContact}</td>
                    <td style={{ padding: "11px 16px" }}>{o.status !== "-" ? <Badge tone="teal">{o.status}</Badge> : <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Flame} title="Hot Leads" subtitle="High-value, multiple connects" action={<button onClick={() => navigate("/leads")} style={linkBtn}>View all <ArrowRight size={13} /></button>} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {hotLeads.map((o, i) => (
              <div key={o.id} onClick={() => navigate("/leads")} style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-hover)", borderRadius: 12, padding: "10px 12px", cursor: "pointer" }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, fontFamily: "Space Grotesk", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{o.phone}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--success)", fontFamily: "Space Grotesk" }}>{o.connects}×</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-dim)" }}>{formatTalkTime(o.talkTimeSeconds)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* TOP PERFORMER + TEAM + DEVICE HEALTH */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 1fr", gap: 16, marginBottom: 18 }} className="nova-grid-3">
        <Card>
          <CardHeader icon={Trophy} title="Top Performer" />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "Space Grotesk" }}>{top.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</div>
            <div><div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{top.name}</div><div style={{ fontSize: 12, color: "var(--text-muted)" }}>{top.connectedPct}% connected</div></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[{ l: "Calls", v: top.calls }, { l: "Talk Time", v: formatTalkTime(top.talkTimeSeconds) }, { l: "Missed", v: top.missed }, { l: "Repeat", v: top.repeatClients }].map((s) => (
              <div key={s.l} style={{ background: "var(--bg-hover)", borderRadius: 10, padding: "10px", textAlign: "center" }}>
                <div style={{ fontFamily: "Space Grotesk", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{s.v}</div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card padding={0}>
          <div style={{ padding: "20px 20px 8px" }}><CardHeader icon={Trophy} title="Team Leaderboard" /></div>
          <div className="nova-scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr>{["#", "Agent", "Calls", "Connected", "Missed"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {leaderboard.map((e) => (
                  <tr key={e.id} onClick={() => navigate("/manage/employees")} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}>
                    <td style={{ padding: "12px 16px" }}><div style={{ width: 22, height: 22, borderRadius: 7, background: e.rank === 1 ? "var(--grad-brand)" : "var(--bg-hover)", color: e.rank === 1 ? "#fff" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{e.rank}</div></td>
                    <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{e.calls}</td>
                    <td style={{ padding: "12px 16px", color: "var(--success)", fontWeight: 600 }}>{e.connected} ({e.connectedPct}%)</td>
                    <td style={{ padding: "12px 16px", color: "var(--danger)" }}>{e.missed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader icon={Smartphone} title="Device Health" action={<button onClick={() => navigate("/device-health")} style={linkBtn}>Details <ArrowRight size={13} /></button>} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {deviceHealth.map((d) => {
              const st = d.status === "healthy" ? { tone: "success", label: "Healthy" } : d.status === "warning" ? { tone: "warning", label: "Warning" } : { tone: "danger", label: "Offline" };
              return (
                <div key={d.id} style={{ border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)" }}>{d.employee}</span>
                    <Badge tone={st.tone} dot>{st.label}</Badge>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5, color: "var(--text-muted)" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Battery size={13} /> {d.battery}%</span>
                    <span>· {d.lastSync}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* SALES FUNNEL + DURATION */}
      <div style={{ display: "grid", gridTemplateColumns: salesFunnel.length ? "1.6fr 1fr" : "1fr", gap: 16 }} className="nova-grid-2">
        {salesFunnel.length > 0 && (
          <Card>
            <CardHeader icon={TrendingUp} title="Sales Flow" subtitle="Call → Connected → Conversation → Follow-up → Lead → Opportunity → Won" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesFunnel} layout="vertical" margin={{ top: 4, right: 16, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} width={90} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]}>
                  {salesFunnel.map((_, i) => <Cell key={i} fill={i % 2 ? "#8b5cf6" : "#14b8a6"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Card>
          <CardHeader icon={Clock} title="Duration Distribution" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={durationDistribution} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {["#14b8a6", "#8b5cf6", "#22d3ee", "#f59e0b"].map((c, i) => <Cell key={i} fill={c} stroke="var(--bg-card)" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </PageContainer>
  );
}

const th = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };
const linkBtn = { border: "none", background: "transparent", color: "var(--accent)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 };

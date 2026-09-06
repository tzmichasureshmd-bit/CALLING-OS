import { BarChart3, TrendingUp, Activity, Clock } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { PageContainer, Card, CardHeader, ChartTooltip, SkeletonCard, ErrorState } from "../components/ui.jsx";
import { formatTalkTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { useRange } from "../context/RangeContext.jsx";

export default function Analytics() {
  const { range } = useRange();
  const { loading, error, data, reload } = useResource(() => dataSource.getAnalytics(range), [range]);
  const axis = "var(--text-dim)";

  if (loading) return <PageContainer><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load analytics" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const { dailyMetrics, outcomeBreakdown, durationDistribution, funnel, leaderboard } = data;

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="nova-grid-2">
        <Card>
          <CardHeader icon={Activity} title="Daily Call Metrics" subtitle="Total / Connected / Missed" />
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dailyMetrics} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="total" name="Total" stroke="#14b8a6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="connected" name="Connected" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="missed" name="Missed" stroke="#ef4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader icon={BarChart3} title="Call Outcome Breakdown" subtitle="Incoming / Outgoing / Missed" />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={outcomeBreakdown} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="incoming" name="Incoming" stackId="a" fill="#14b8a6" />
              <Bar dataKey="outgoing" name="Outgoing" stackId="a" fill="#8b5cf6" />
              <Bar dataKey="missed" name="Missed" stackId="a" fill="#ef4444" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader icon={Clock} title="Duration Distribution" />
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={durationDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {["#14b8a6", "#8b5cf6", "#22d3ee", "#f59e0b"].map((c, i) => <Cell key={i} fill={c} stroke="var(--bg-card)" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} /><Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader icon={TrendingUp} title="Sales Flow" />
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnel} layout="vertical" margin={{ top: 4, right: 16, left: 20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11, fill: axis }} axisLine={false} tickLine={false} width={92} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Count" radius={[0, 6, 6, 0]}>{funnel.map((_, i) => <Cell key={i} fill={i % 2 ? "#8b5cf6" : "#14b8a6"} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <CardHeader icon={BarChart3} title="Team Summary" />
        <div className="nova-scroll-x">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Employee", "Calls", "Connected", "Connected %", "Talk Time", "Missed"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {leaderboard.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{e.calls}</td>
                  <td style={{ padding: "12px 16px", color: "var(--success)", fontWeight: 600 }}>{e.connected}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{e.connectedPct}%</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{formatTalkTime(e.talkTimeSeconds)}</td>
                  <td style={{ padding: "12px 16px", color: "var(--danger)" }}>{e.missed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

const th = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };

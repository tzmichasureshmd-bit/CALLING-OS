import { BarChart3, Download, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";
import { PageContainer, Card, CardHeader, Button, ErrorState, SkeletonCard } from "../components/ui.jsx";
import { formatTalkTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

export default function Reports() {
  const { loading, error, data, reload } = useResource(() => dataSource.getAnalytics());
  const axisColor = "var(--text-dim)";

  if (loading) return <PageContainer><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load reports" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const { dailyMetrics, leaderboard } = data;
  const perEmployee = leaderboard.map((e) => ({ name: e.name.split(" ")[0], calls: e.calls, connected: e.connected }));

  return (
    <PageContainer>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Button variant="outline" icon={Download}>Export Report (PDF)</Button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="callos-grid-2">
        <Card>
          <CardHeader icon={TrendingUp} title="Call Volume Trend" subtitle="Total calls over the last 7 days" />
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyMetrics} margin={{ top: 5, right: 6, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="cv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#14b8a6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="total" stroke="#14b8a6" strokeWidth={2} fill="url(#cv)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <CardHeader icon={BarChart3} title="Calls by Employee" subtitle="Comparison across the team" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={perEmployee} margin={{ top: 5, right: 6, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: axisColor }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Bar dataKey="calls" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              <Bar dataKey="connected" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <CardHeader icon={BarChart3} title="Team Summary" subtitle="Key metrics per employee" />
        <div className="callos-scroll-x">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Employee", "Calls", "Connected", "Connected %", "Talk Time", "Missed"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "11px 14px", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{e.calls}</td>
                  <td style={{ padding: "12px 14px", color: "var(--success)", fontWeight: 600 }}>{e.connected}</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{e.connectedPct}%</td>
                  <td style={{ padding: "12px 14px", color: "var(--text-secondary)" }}>{formatTalkTime(e.talkTimeSeconds)}</td>
                  <td style={{ padding: "12px 14px", color: "var(--danger)" }}>{e.missed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </PageContainer>
  );
}

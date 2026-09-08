import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader, Card, SectionRow, Delta } from "../../src/components";
import { RadialRing, Sparkline, MiniBars, BarChart, Donut } from "../../src/charts";
import { api } from "../../src/api";
import { getRealCallLog } from "../../src/callLogService";

const RANGES = ["Today", "Yesterday", "Last Week", "Last 30"];
const RANGE_MAP = { "Today": "today", "Yesterday": "yesterday", "Last Week": "7d", "Last 30": "30d" };

const EMPTY = {
  totalCalls: 0, connectedPct: 0, connected: 0,
  talkTime: "0m", missed: 0, avgDuration: "00:00",
  spark: { total: [0], connected: [0], missed: [0], talk: [0] },
  week: { labels: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"], data: [0,0,0,0,0,0,0] },
  callMix: [
    { label: "Incoming", value: 0, color: palette.teal },
    { label: "Outgoing", value: 0, color: palette.violet },
    { label: "Missed",   value: 0, color: palette.red },
  ],
  momentum: { streak: "—", bestDay: "—", bestDaySub: "", avgDuration: "—" },
};

export default function Home() {
  const [range, setRange] = useState("Today");
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const contentW = width - 32;
  const [m, setM] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [localCounts, setLocalCounts] = useState({ total: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0 });

  const loadLocalCounts = useCallback(() => {
    getRealCallLog(1).then((calls) => {
      setLocalCounts({
        total:    calls.length,
        incoming: calls.filter((c) => c.call_type === "incoming").length,
        outgoing: calls.filter((c) => c.call_type === "outgoing").length,
        missed:   calls.filter((c) => c.call_type === "missed").length,
        rejected: calls.filter((c) => c.call_type === "rejected").length,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { loadLocalCounts(); }, []);

  const load = useCallback((r = range, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    if (isRefresh) loadLocalCounts(); // refresh local counts too
    api.getAnalytics(RANGE_MAP[r] || "today")
      .then((res) => {
        const kpis = res.kpis || {};
        const daily = res.daily_metrics || [];
        const lb = res.leaderboard || [];

        // Build spark from daily data
        const totals = daily.map((d) => d.total || 0);
        const conns  = daily.map((d) => d.connected || 0);
        const misses = daily.map((d) => d.missed || 0);

        // Momentum: streak = consecutive days with calls, bestDay = max calls day
        let streak = 0;
        for (let i = daily.length - 1; i >= 0; i--) {
          if (daily[i].total > 0) streak++; else break;
        }
        const bestIdx = totals.indexOf(Math.max(...totals));
        const bestDay = daily[bestIdx];

        const total = kpis.total_calls || 0;
        const incoming = kpis.incoming || 0;
        const outgoing = kpis.outgoing || 0;
        const missed   = kpis.missed || 0;
        const inPct  = total ? Math.round(incoming / total * 100) : 0;
        const outPct = total ? Math.round(outgoing / total * 100) : 0;
        const misPct = total ? Math.round(missed   / total * 100) : 0;

        setM({
          totalCalls: total,
          connected: kpis.connected || 0,
          connectedPct: kpis.connected_pct || 0,
          talkTime: fmtSeconds(kpis.talk_time_seconds),
          missed,
          avgDuration: fmtDuration(kpis.avg_duration_seconds),
          spark: {
            total:     totals.length ? totals : [0],
            connected: conns.length  ? conns  : [0],
            missed:    misses.length ? misses : [0],
            talk:      daily.map((d) => Math.round((d.connected || 0) * (kpis.avg_duration_seconds || 0) / 60)),
          },
          week: {
            labels: daily.map((d) => d.day),
            data:   totals,
          },
          callMix: [
            { label: "Incoming", value: inPct,  color: palette.teal },
            { label: "Outgoing", value: outPct, color: palette.violet },
            { label: "Missed",   value: misPct, color: palette.red },
          ],
          momentum: {
            streak:      streak > 0 ? `${streak} day${streak > 1 ? "s" : ""}` : "—",
            bestDay:     bestDay ? `${bestDay.total} calls` : "—",
            bestDaySub:  bestDay ? bestDay.day : "",
            avgDuration: fmtDuration(kpis.avg_duration_seconds),
          },
        });
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [range]);

  useEffect(() => { load(range); }, [range]);

  function fmtSeconds(s) {
    if (!s) return "0m";
    const h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  }
  function fmtDuration(s) {
    if (!s) return "00:00";
    return `${Math.floor(s / 60).toString().padStart(2, "0")}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(range, true)} tintColor={palette.teal} />}
      >
        {/* Range pills — always visible */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {RANGES.map((r) => (
                <Pressable key={r} onPress={() => setRange(r)}
                  style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5,
                    borderColor: r === range ? palette.teal : theme.border,
                    backgroundColor: r === range ? palette.teal : theme.surface }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: r === range ? "#04211d" : theme.muted }}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Live call strip — reads directly from Android call log */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Today",    value: localCounts.total,    color: palette.teal,   icon: "call" },
            { label: "Incoming", value: localCounts.incoming, color: palette.violet, icon: "call-received" },
            { label: "Missed",   value: localCounts.missed,   color: palette.red,    icon: "call-missed" },
            { label: "Outgoing", value: localCounts.outgoing, color: palette.cyan,   icon: "call-made" },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: theme.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: theme.border, alignItems: "center" }}>
              <Ionicons name={s.icon} size={15} color={s.color} />
              <Text style={{ fontSize: 20, fontWeight: "800", color: theme.primary, marginTop: 3 }}>{s.value}</Text>
              <Text style={{ fontSize: 9, color: theme.muted, marginTop: 1 }}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Hero card */}
        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <HeroStat theme={theme} icon="call" iconColor={palette.teal} label="Total Calls" value={m.totalCalls} />
            <HeroStat theme={theme} icon="time-outline" iconColor={palette.violet} label="Talk Time" value={m.talkTime} align="right" />
          </View>
          <View style={{ alignItems: "center", marginVertical: 6 }}>
            <RadialRing percent={m.connectedPct} size={160} stroke={15} />
            <Text style={{ fontSize: 12, color: theme.muted, marginTop: 6 }}>{m.connected} connected · {m.connectedPct}%</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <HeroStat theme={theme} icon="close-circle-outline" iconColor={palette.red} label="Missed" value={m.missed} />
            <HeroStat theme={theme} icon="speedometer-outline" iconColor={palette.amber} label="Avg Duration" value={m.avgDuration} align="right" />
          </View>
        </Card>

        {/* KPI tiles */}
        <SectionRow title="Performance Overview" />
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <KpiTile theme={theme} label="Total Calls" value={m.totalCalls} chart={<Sparkline data={m.spark.total} color={palette.teal} width={(contentW - 12) / 2 - 32} height={38} />} />
          <KpiTile theme={theme} label="Connected"   value={m.connected}  chart={<Sparkline data={m.spark.connected} color={palette.violet} width={(contentW - 12) / 2 - 32} height={38} />} />
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <KpiTile theme={theme} label="Missed"    value={m.missed}    chart={<MiniBars data={m.spark.missed} color={palette.red} width={(contentW - 12) / 2 - 32} height={38} />} />
          <KpiTile theme={theme} label="Talk Time" value={m.talkTime}  chart={<Sparkline data={m.spark.talk} color={palette.cyan} width={(contentW - 12) / 2 - 32} height={38} />} />
        </View>

        {/* Weekly bar chart */}
        {m.week.data.length > 0 && m.week.data.some((v) => v > 0) && (
          <>
            <SectionRow title="Calls this week" />
            <Card style={{ marginBottom: 16 }}>
              <BarChart data={m.week.data} labels={m.week.labels} width={contentW - 32} height={150} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                {m.week.labels.map((l, i) => (
                  <View key={l} style={{ alignItems: "center", width: (contentW - 32) / m.week.labels.length }}>
                    <Text style={{ fontSize: 10.5, fontWeight: "700", color: theme.secondary }}>{m.week.data[i]}</Text>
                    <Text style={{ fontSize: 10.5, color: theme.dim }}>{l}</Text>
                  </View>
                ))}
              </View>
            </Card>
          </>
        )}

        {/* Call mix donut */}
        {m.callMix.some((s) => s.value > 0) && (
          <>
            <SectionRow title="Call mix" />
            <Card style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                <Donut segments={m.callMix} size={124} stroke={22} />
                <View style={{ flex: 1, gap: 12 }}>
                  {m.callMix.map((s) => (
                    <View key={s.label} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: s.color }} />
                        <Text style={{ fontSize: 13, color: theme.secondary }}>{s.label}</Text>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary }}>{s.value}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Momentum — real data */}
        <SectionRow title="Momentum" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <MomentumCard theme={theme} icon="flame"         color={palette.amber}  label="Streak"       value={m.momentum.streak} />
          <MomentumCard theme={theme} icon="trophy-outline" color={palette.violet} label="Best Day"     value={m.momentum.bestDay} sub={m.momentum.bestDaySub} />
          <MomentumCard theme={theme} icon="time-outline"   color={palette.teal}   label="Avg Duration" value={m.momentum.avgDuration} />
        </View>

        {loading && (
          <Text style={{ textAlign: "center", color: theme.muted, marginTop: 24, fontSize: 13 }}>Loading data...</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ theme, icon, iconColor, label, value, align = "left" }) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={15} color={iconColor} />
        <Text style={{ fontSize: 12, color: theme.muted }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function KpiTile({ theme, label, value, chart }) {
  const { shadowSoft } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border }, shadowSoft]}>
      <Text style={{ fontSize: 12.5, color: theme.muted }}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary, marginTop: 4, marginBottom: 6 }}>{value}</Text>
      {chart}
    </View>
  );
}

function MomentumCard({ theme, icon, color, label, value, sub }) {
  const { shadowSoft } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.card, borderRadius: 16, padding: 13, borderWidth: 1, borderColor: theme.border }, shadowSoft]}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: color + "1f", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ fontSize: 11, color: theme.muted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "800", color: theme.primary, marginTop: 1 }}>{value}</Text>
      {sub ? <Text style={{ fontSize: 9.5, color: theme.dim, marginTop: 1 }}>{sub}</Text> : null}
    </View>
  );
}

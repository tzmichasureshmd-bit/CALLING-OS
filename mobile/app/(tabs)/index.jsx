import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader, Card, SectionRow, Delta } from "../../src/components";
import { RadialRing, Sparkline, MiniBars, BarChart, Donut } from "../../src/charts";
import { api } from "../../src/api";
import { HOME } from "../../src/mockData"; // fallback shape only

export default function Home() {
  const [range, setRange] = useState("Today");
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const contentW = width - 32;

  const [m, setM] = useState(HOME);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rangeMap = { "Today": "today", "Yesterday": "yesterday", "Last Week": "7d", "Last 30": "30d" };
    api.getAnalytics(rangeMap[range] || "today")
      .then((res) => {
        const kpis = res.kpis || {};
        const lb = res.leaderboard || [];
        const top = lb[0] || {};
        setM({
          ...HOME,
          totalCalls: kpis.total_calls ?? HOME.totalCalls,
          connected: kpis.connected ?? HOME.connected,
          connectedPct: kpis.connected_pct ?? HOME.connectedPct,
          talkTime: fmtSeconds(kpis.talk_time_seconds),
          missed: kpis.missed ?? HOME.missed,
          avgDuration: fmtDuration(kpis.avg_duration_seconds),
          week: buildWeek(res.daily_metrics || []),
          callMix: [
            { label: "Incoming", value: kpis.incoming ?? 0, color: palette.teal },
            { label: "Outgoing", value: kpis.outgoing ?? 0, color: palette.violet },
            { label: "Missed", value: kpis.missed ?? 0, color: palette.red },
          ],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [range]);

  function fmtSeconds(s) {
    if (!s) return "0m";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function fmtDuration(s) {
    if (!s) return "00:00";
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }
  function buildWeek(daily) {
    if (!daily.length) return HOME.week;
    return { labels: daily.map((d) => d.day), data: daily.map((d) => d.total) };
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 14 }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 20, fontWeight: "800", color: theme.primary }}>{range}</Text>
              <Ionicons name="chevron-down" size={18} color={theme.muted} />
            </View>
            <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>2 Sep, Tuesday</Text>
          </View>
          <Pressable style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}><Ionicons name="calendar-outline" size={18} color={theme.secondary} /></Pressable>
        </View>

        <Card style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <HeroStat theme={theme} icon="call" iconColor={palette.teal} label="Total Calls" value={m.totalCalls} delta={m.deltas.total} />
            <HeroStat theme={theme} icon="time-outline" iconColor={palette.violet} label="Talk Time" value={m.talkTime} delta={m.deltas.talk} align="right" />
          </View>
          <View style={{ alignItems: "center", marginVertical: 6 }}>
            <RadialRing percent={m.connectedPct} size={160} stroke={15} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
              <Delta value={m.deltas.connected} />
              <Text style={{ fontSize: 12, color: theme.muted }}>{m.connected} connected</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
            <HeroStat theme={theme} icon="close-circle-outline" iconColor={palette.red} label="Missed" value={m.missed} delta={m.deltas.missed} />
            <HeroStat theme={theme} icon="speedometer-outline" iconColor={palette.amber} label="Avg Duration" value={m.avgDuration} delta={m.deltas.avg} align="right" />
          </View>
        </Card>

        <SectionRow title="Performance Overview" />
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <KpiTile theme={theme} label="Total Calls" value={m.totalCalls} delta={m.deltas.total} chart={<Sparkline data={m.spark.total} color={palette.teal} width={(contentW - 12) / 2 - 32} height={38} />} />
          <KpiTile theme={theme} label="Connected" value={m.connected} delta={m.deltas.connected} chart={<Sparkline data={m.spark.connected} color={palette.violet} width={(contentW - 12) / 2 - 32} height={38} />} />
        </View>
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <KpiTile theme={theme} label="Missed" value={m.missed} delta={m.deltas.missed} chart={<MiniBars data={m.spark.missed} color={palette.red} width={(contentW - 12) / 2 - 32} height={38} />} />
          <KpiTile theme={theme} label="Talk Time" value={m.talkTime} delta={m.deltas.talk} chart={<Sparkline data={m.spark.talk} color={palette.cyan} width={(contentW - 12) / 2 - 32} height={38} />} />
        </View>

        <SectionRow title="Calls this week" />
        <Card style={{ marginBottom: 16 }}>
          <BarChart data={m.week.data} labels={m.week.labels} width={contentW - 32} height={150} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            {m.week.labels.map((l, i) => (
              <View key={l} style={{ alignItems: "center", width: (contentW - 32) / 7 }}>
                <Text style={{ fontSize: 10.5, fontWeight: "700", color: theme.secondary }}>{m.week.data[i]}</Text>
                <Text style={{ fontSize: 10.5, color: theme.dim }}>{l}</Text>
              </View>
            ))}
          </View>
        </Card>

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

        <SectionRow title="Momentum" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <MomentumCard theme={theme} icon="flame" color={palette.amber} label="Streak" value={m.momentum.streak} />
          <MomentumCard theme={theme} icon="trophy-outline" color={palette.violet} label="Best Day" value={m.momentum.bestDay} sub={m.momentum.bestDaySub} />
          <MomentumCard theme={theme} icon="time-outline" color={palette.teal} label="Avg Duration" value={m.momentum.avgDuration} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ theme, icon, iconColor, label, value, delta, align = "left" }) {
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={icon} size={15} color={iconColor} />
        <Text style={{ fontSize: 12, color: theme.muted }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary, marginTop: 2 }}>{value}</Text>
      <Delta value={delta} />
    </View>
  );
}

function KpiTile({ theme, label, value, delta, chart }) {
  const { shadowSoft } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border }, shadowSoft]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12.5, color: theme.muted }}>{label}</Text>
        <Delta value={delta} />
      </View>
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

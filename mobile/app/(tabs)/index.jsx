import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, useWindowDimensions, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader, Card, SectionRow } from "../../src/components";
import { RadialRing, Sparkline, MiniBars, BarChart, Donut } from "../../src/charts";
import { getRealCallLog } from "../../src/callLogService";

const RANGES = ["Today", "Yesterday", "Last Week", "Last 30"];

function fmtSeconds(s) {
  if (!s) return "0m";
  const h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}
function fmtDuration(s) {
  if (!s) return "00:00";
  return `${Math.floor(s/60).toString().padStart(2,"0")}:${Math.floor(s%60).toString().padStart(2,"0")}`;
}
function dayLabel(iso) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short" });
}

// Filter calls to the selected range
function filterByRange(calls, range) {
  const now = new Date();
  if (range === "Today") {
    const start = new Date(now); start.setHours(0,0,0,0);
    return calls.filter(c => new Date(c.start_time) >= start);
  }
  if (range === "Yesterday") {
    const start = new Date(now); start.setDate(now.getDate()-1); start.setHours(0,0,0,0);
    const end   = new Date(now); end.setDate(now.getDate()-1);   end.setHours(23,59,59,999);
    return calls.filter(c => { const t = new Date(c.start_time); return t >= start && t <= end; });
  }
  if (range === "Last Week") {
    const start = new Date(now); start.setDate(now.getDate()-7); start.setHours(0,0,0,0);
    return calls.filter(c => new Date(c.start_time) >= start);
  }
  // Last 30
  const start = new Date(now); start.setDate(now.getDate()-30); start.setHours(0,0,0,0);
  return calls.filter(c => new Date(c.start_time) >= start);
}

// Build daily breakdown for charts (last 7 days)
function buildDailyData(calls) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate()+1);
    const dc = calls.filter(c => { const t = new Date(c.start_time); return t >= d && t < next; });
    days.push({
      label: d.toLocaleDateString("en-IN", { weekday: "short" }),
      total:     dc.length,
      connected: dc.filter(c => c.call_type === "incoming" || (c.call_type === "outgoing" && c.duration_seconds > 0)).length,
      missed:    dc.filter(c => c.call_type === "missed").length,
      talkSecs:  dc.reduce((s, c) => s + (c.duration_seconds || 0), 0),
    });
  }
  return days;
}

// Compute all stats from local calls
function computeStats(calls) {
  const total     = calls.length;
  const incoming  = calls.filter(c => c.call_type === "incoming").length;
  const outgoing  = calls.filter(c => c.call_type === "outgoing").length;
  const missed    = calls.filter(c => c.call_type === "missed").length;
  const rejected  = calls.filter(c => c.call_type === "rejected").length;
  const connected = calls.filter(c => c.duration_seconds > 0).length;
  const connectedPct = total ? Math.round(connected / total * 100) : 0;
  const totalSecs = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
  const avgSecs   = connected ? Math.round(totalSecs / connected) : 0;

  const daily = buildDailyData(calls);

  // Streak — consecutive days with calls (from today backwards)
  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].total > 0) streak++; else break;
  }
  const bestDayIdx = daily.reduce((bi, d, i, arr) => d.total > arr[bi].total ? i : bi, 0);

  return {
    total, incoming, outgoing, missed, rejected, connected, connectedPct,
    talkTime: fmtSeconds(totalSecs),
    avgDuration: fmtDuration(avgSecs),
    daily,
    callMix: [
      { label: "Incoming", value: total ? Math.round(incoming/total*100) : 0, color: palette.teal },
      { label: "Outgoing", value: total ? Math.round(outgoing/total*100) : 0, color: palette.violet },
      { label: "Missed",   value: total ? Math.round(missed/total*100)   : 0, color: palette.red },
    ],
    momentum: {
      streak:     streak > 0 ? `${streak}d` : "—",
      bestDay:    daily[bestDayIdx]?.total > 0 ? `${daily[bestDayIdx].total} calls` : "—",
      bestDaySub: daily[bestDayIdx]?.label || "",
      avgDuration: fmtDuration(avgSecs),
    },
  };
}

const EMPTY_STATS = computeStats([]);

export default function Home() {
  const [range, setRange]       = useState("Today");
  const [allCalls, setAllCalls] = useState([]);   // last 30 days raw
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const contentW = width - 32;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Read last 30 days once — filter in memory per range
      const calls = await getRealCallLog(30);
      setAllCalls(calls);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Compute stats for selected range — pure local, instant
  const stats = useMemo(() => {
    if (!allCalls.length) return EMPTY_STATS;
    const filtered = filterByRange(allCalls, range);
    return computeStats(filtered);
  }, [allCalls, range]);

  const topStrip = [
    { label: range === "Today" ? "Today" : "Total", value: stats.total,    color: palette.teal,   icon: "call-outline" },
    { label: "Incoming",                             value: stats.incoming, color: palette.violet, icon: "call-received" },
    { label: "Missed",                               value: stats.missed,   color: palette.red,    icon: "call-missed" },
    { label: "Outgoing",                             value: stats.outgoing, color: palette.cyan,   icon: "call-made" },
  ];

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:theme.bg }} edges={["top"]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal:16, paddingBottom:110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
      >
        {/* Range pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop:8, marginBottom:14 }}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {RANGES.map(r => (
              <Pressable key={r} onPress={() => setRange(r)}
                style={{ paddingHorizontal:16, paddingVertical:9, borderRadius:999, borderWidth:1.5,
                  borderColor: r===range ? palette.teal : theme.border,
                  backgroundColor: r===range ? palette.teal : theme.surface }}>
                <Text style={{ fontSize:13, fontWeight:"700", color: r===range ? "#04211d" : theme.muted }}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {loading ? (
          <View style={{ alignItems:"center", paddingVertical:40 }}>
            <ActivityIndicator color={palette.teal} size="large"/>
            <Text style={{ color:theme.muted, marginTop:12, fontSize:13 }}>Reading call log…</Text>
          </View>
        ) : (
          <>
            {/* Top 4 stat cards */}
            <View style={{ flexDirection:"row", gap:8, marginBottom:14 }}>
              {topStrip.map(s => (
                <View key={s.label} style={{ flex:1, backgroundColor:theme.card, borderRadius:14, padding:10, borderWidth:1, borderColor:theme.border, alignItems:"center" }}>
                  <Ionicons name={s.icon} size={16} color={s.color}/>
                  <Text style={{ fontSize:22, fontWeight:"800", color:theme.primary, marginTop:4 }}>{s.value}</Text>
                  <Text style={{ fontSize:9.5, color:theme.muted, marginTop:2, textAlign:"center" }}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Hero card */}
            <Card style={{ marginBottom:16 }}>
              <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:8 }}>
                <StatBox theme={theme} icon="call" color={palette.teal}   label="Total Calls" value={stats.total}/>
                <StatBox theme={theme} icon="time-outline" color={palette.violet} label="Talk Time" value={stats.talkTime} right/>
              </View>
              <View style={{ alignItems:"center", marginVertical:8 }}>
                <RadialRing percent={stats.connectedPct} size={160} stroke={15}/>
                <Text style={{ fontSize:12, color:theme.muted, marginTop:6 }}>
                  {stats.connected} connected · {stats.connectedPct}%
                </Text>
              </View>
              <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:6 }}>
                <StatBox theme={theme} icon="close-circle-outline" color={palette.red}   label="Missed"       value={stats.missed}/>
                <StatBox theme={theme} icon="speedometer-outline"  color={palette.amber} label="Avg Duration" value={stats.avgDuration} right/>
              </View>
            </Card>

            {/* Performance Overview */}
            <SectionRow title="Performance Overview"/>
            <View style={{ flexDirection:"row", gap:12, marginBottom:12 }}>
              <KpiTile theme={theme} label="Total Calls" value={stats.total}
                chart={<Sparkline data={stats.daily.map(d=>d.total)} color={palette.teal} width={(contentW-12)/2-32} height={38}/>}/>
              <KpiTile theme={theme} label="Connected" value={stats.connected}
                chart={<Sparkline data={stats.daily.map(d=>d.connected)} color={palette.violet} width={(contentW-12)/2-32} height={38}/>}/>
            </View>
            <View style={{ flexDirection:"row", gap:12, marginBottom:16 }}>
              <KpiTile theme={theme} label="Missed" value={stats.missed}
                chart={<MiniBars data={stats.daily.map(d=>d.missed)} color={palette.red} width={(contentW-12)/2-32} height={38}/>}/>
              <KpiTile theme={theme} label="Talk Time" value={stats.talkTime}
                chart={<Sparkline data={stats.daily.map(d=>Math.round(d.talkSecs/60))} color={palette.cyan} width={(contentW-12)/2-32} height={38}/>}/>
            </View>

            {/* Daily bar chart */}
            {stats.daily.some(d=>d.total>0) && (
              <>
                <SectionRow title="Last 7 Days"/>
                <Card style={{ marginBottom:16 }}>
                  <BarChart data={stats.daily.map(d=>d.total)} labels={stats.daily.map(d=>d.label)} width={contentW-32} height={140}/>
                  <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:8 }}>
                    {stats.daily.map((d,i) => (
                      <View key={i} style={{ alignItems:"center", flex:1 }}>
                        <Text style={{ fontSize:10, fontWeight:"700", color:theme.secondary }}>{d.total||""}</Text>
                        <Text style={{ fontSize:10, color:theme.dim }}>{d.label}</Text>
                      </View>
                    ))}
                  </View>
                </Card>
              </>
            )}

            {/* Call mix donut */}
            {stats.callMix.some(s=>s.value>0) && (
              <>
                <SectionRow title="Call Mix"/>
                <Card style={{ marginBottom:16 }}>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:18 }}>
                    <Donut segments={stats.callMix} size={120} stroke={22}/>
                    <View style={{ flex:1, gap:12 }}>
                      {stats.callMix.map(s => (
                        <View key={s.label} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
                          <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                            <View style={{ width:10, height:10, borderRadius:3, backgroundColor:s.color }}/>
                            <Text style={{ fontSize:13, color:theme.secondary }}>{s.label}</Text>
                          </View>
                          <Text style={{ fontSize:13, fontWeight:"700", color:theme.primary }}>{s.value}%</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Card>
              </>
            )}

            {/* Momentum */}
            <SectionRow title="Momentum"/>
            <View style={{ flexDirection:"row", gap:12, marginBottom:8 }}>
              <MomentumCard theme={theme} icon="flame"          color={palette.amber}  label="Streak"       value={stats.momentum.streak}/>
              <MomentumCard theme={theme} icon="trophy-outline" color={palette.violet} label="Best Day"     value={stats.momentum.bestDay} sub={stats.momentum.bestDaySub}/>
              <MomentumCard theme={theme} icon="time-outline"   color={palette.teal}   label="Avg Duration" value={stats.momentum.avgDuration}/>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ theme, icon, color, label, value, right }) {
  return (
    <View style={{ alignItems: right ? "flex-end" : "flex-start" }}>
      <View style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
        <Ionicons name={icon} size={14} color={color}/>
        <Text style={{ fontSize:11.5, color:theme.muted }}>{label}</Text>
      </View>
      <Text style={{ fontSize:22, fontWeight:"800", color:theme.primary, marginTop:2 }}>{value}</Text>
    </View>
  );
}

function KpiTile({ theme, label, value, chart }) {
  const { shadowSoft } = useTheme();
  return (
    <View style={[{ flex:1, backgroundColor:theme.card, borderRadius:16, padding:14, borderWidth:1, borderColor:theme.border }, shadowSoft]}>
      <Text style={{ fontSize:12.5, color:theme.muted }}>{label}</Text>
      <Text style={{ fontSize:22, fontWeight:"800", color:theme.primary, marginTop:4, marginBottom:6 }}>{value}</Text>
      {chart}
    </View>
  );
}

function MomentumCard({ theme, icon, color, label, value, sub }) {
  const { shadowSoft } = useTheme();
  return (
    <View style={[{ flex:1, backgroundColor:theme.card, borderRadius:16, padding:13, borderWidth:1, borderColor:theme.border }, shadowSoft]}>
      <View style={{ width:32, height:32, borderRadius:9, backgroundColor:color+"1f", alignItems:"center", justifyContent:"center", marginBottom:8 }}>
        <Ionicons name={icon} size={17} color={color}/>
      </View>
      <Text style={{ fontSize:11, color:theme.muted }}>{label}</Text>
      <Text style={{ fontSize:15, fontWeight:"800", color:theme.primary, marginTop:1 }}>{value}</Text>
      {sub ? <Text style={{ fontSize:9.5, color:theme.dim, marginTop:1 }}>{sub}</Text> : null}
    </View>
  );
}

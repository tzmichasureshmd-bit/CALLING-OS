import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, useWindowDimensions, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader, Card } from "../../src/components";
import { LineChart, StackedBars, Donut, ProgressBar } from "../../src/charts";
import { getRealCallLog } from "../../src/callLogService";

const RANGES = ["Today", "7 Days", "30 Days"];
const DURATION_COLORS = [palette.teal, palette.violet, palette.cyan, palette.amber];

// ── Filter calls by range ─────────────────────────────────────────────────────
function filterByRange(calls, range) {
  const now = new Date();
  if (range === "Today") {
    const s = new Date(now); s.setHours(0,0,0,0);
    return calls.filter(c => new Date(c.start_time) >= s);
  }
  if (range === "7 Days") {
    const s = new Date(now); s.setDate(now.getDate()-7); s.setHours(0,0,0,0);
    return calls.filter(c => new Date(c.start_time) >= s);
  }
  const s = new Date(now); s.setDate(now.getDate()-30); s.setHours(0,0,0,0);
  return calls.filter(c => new Date(c.start_time) >= s);
}

// ── Build daily breakdown ─────────────────────────────────────────────────────
function buildDaily(calls, range) {
  const days = range === "Today" ? 1 : range === "7 Days" ? 7 : 30;
  const result = [];
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate()+1);
    const dc = calls.filter(c => { const t = new Date(c.start_time); return t >= d && t < next; });
    result.push({
      label:     days <= 7 ? d.toLocaleDateString("en-IN",{weekday:"short"}) : d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"}),
      total:     dc.length,
      connected: dc.filter(c => c.duration_seconds > 0).length,
      missed:    dc.filter(c => c.call_type === "missed").length,
      rejected:  dc.filter(c => c.call_type === "rejected").length,
    });
  }
  return result;
}

// ── Duration distribution ─────────────────────────────────────────────────────
function buildDuration(calls) {
  const buckets = [
    { label: "< 1 min",   min: 0,   max: 60   },
    { label: "1–3 min",   min: 60,  max: 180  },
    { label: "3–10 min",  min: 180, max: 600  },
    { label: "> 10 min",  min: 600, max: Infinity },
  ];
  const connected = calls.filter(c => c.duration_seconds > 0);
  if (!connected.length) return [];
  return buckets.map((b, i) => {
    const count = connected.filter(c => c.duration_seconds >= b.min && c.duration_seconds < b.max).length;
    return { label: b.label, value: Math.round(count / connected.length * 100), color: DURATION_COLORS[i] };
  }).filter(b => b.value > 0);
}

// ── Top contacts by call count ────────────────────────────────────────────────
function buildTopContacts(calls) {
  const map = {};
  calls.forEach(c => {
    const key = c.contact_name && c.contact_name !== "Unknown" ? c.contact_name : c.phone_number;
    if (!key) return;
    if (!map[key]) map[key] = { name: key, calls: 0, totalSecs: 0 };
    map[key].calls++;
    map[key].totalSecs += c.duration_seconds || 0;
  });
  return Object.values(map)
    .sort((a,b) => b.calls - a.calls)
    .slice(0, 5);
}

export default function Insights() {
  const [range, setRange]       = useState("7 Days");
  const [allCalls, setAllCalls] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const w = width - 64;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const calls = await getRealCallLog(30);
      setAllCalls(calls);
    } catch { /* silent */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // All computed from local data — instant, no network
  const data = useMemo(() => {
    const filtered = filterByRange(allCalls, range);
    if (!filtered.length) return null;
    const daily    = buildDaily(filtered, range);
    const duration = buildDuration(filtered);
    const contacts = buildTopContacts(filtered);
    const maxCalls = contacts.length ? contacts[0].calls : 1;
    return {
      daily,
      duration,
      topContacts: contacts.map(c => ({ ...c, pct: Math.round(c.calls / maxCalls * 100) })),
      hasData: filtered.length > 0,
    };
  }, [allCalls, range]);

  const title = { fontSize: 15, fontWeight: "700", color: theme.muted, marginBottom: 8 };

  const Legend = ({ items }) => (
    <View style={{ flexDirection:"row", gap:14, marginBottom:8 }}>
      {items.map(it => (
        <View key={it.label} style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
          <View style={{ width:9, height:9, borderRadius:3, backgroundColor:it.color }}/>
          <Text style={{ fontSize:11.5, color:theme.muted }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );

  const XLabels = ({ labels }) => {
    // Show max 7 labels to avoid overlap
    const step = Math.ceil(labels.length / 7);
    return (
      <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:6 }}>
        {labels.filter((_,i) => i % step === 0).map(l => (
          <Text key={l} style={{ fontSize:10, color:theme.dim }}>{l}</Text>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:theme.bg }} edges={["top"]}>
      <AppHeader title="Insights" right={
        <View style={{ flexDirection:"row", gap:6 }}>
          {RANGES.map(r => (
            <Pressable key={r} onPress={() => setRange(r)}
              style={{ paddingHorizontal:11, paddingVertical:6, borderRadius:10, borderWidth:1,
                borderColor: r===range ? palette.teal : theme.border,
                backgroundColor: r===range ? palette.teal+"22" : "transparent" }}>
              <Text style={{ fontSize:12, fontWeight:"700", color: r===range ? palette.teal : theme.muted }}>{r}</Text>
            </Pressable>
          ))}
        </View>
      }/>

      {loading ? (
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator color={palette.teal} size="large"/>
          <Text style={{ color:theme.muted, marginTop:12, fontSize:13 }}>Reading call log…</Text>
        </View>
      ) : !data ? (
        <ScrollView
          contentContainerStyle={{ flex:1, alignItems:"center", justifyContent:"center", padding:32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal}/>}
        >
          <Text style={{ fontSize:40, marginBottom:16 }}>📊</Text>
          <Text style={{ fontSize:16, fontWeight:"700", color:theme.primary, textAlign:"center" }}>No calls for {range}</Text>
          <Text style={{ fontSize:13, color:theme.muted, textAlign:"center", marginTop:8 }}>
            Make some calls and pull down to refresh.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal:16, paddingBottom:110, paddingTop:8 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal}/>}
        >
          {/* Total vs Connected */}
          {data.daily.some(d => d.total > 0) && (
            <Card style={{ marginBottom:14 }}>
              <Text style={title}>Total vs Connected Calls</Text>
              <Legend items={[{label:"Total",color:palette.violet},{label:"Connected",color:palette.teal}]}/>
              <LineChart width={w} height={160} series={[
                { data: data.daily.map(d=>d.total),     color: palette.violet },
                { data: data.daily.map(d=>d.connected), color: palette.teal   },
              ]}/>
              <XLabels labels={data.daily.map(d=>d.label)}/>
            </Card>
          )}

          {/* Call Outcomes */}
          {data.daily.some(d => d.connected+d.missed > 0) && (
            <Card style={{ marginBottom:14 }}>
              <Text style={title}>Call Outcomes</Text>
              <Legend items={[{label:"Connected",color:palette.teal},{label:"Missed",color:palette.red},{label:"Rejected",color:palette.amber}]}/>
              <StackedBars width={w} height={160}
                data={data.daily.map(d=>({ connected:d.connected, missed:d.missed, rejected:d.rejected }))}
                keys={["connected","missed","rejected"]}
                colors={[palette.teal, palette.red, palette.amber]}/>
              <XLabels labels={data.daily.map(d=>d.label)}/>
            </Card>
          )}

          {/* Duration Distribution */}
          {data.duration.length > 0 && (
            <Card style={{ marginBottom:14 }}>
              <Text style={title}>Call Duration Distribution</Text>
              <View style={{ flexDirection:"row", alignItems:"center", gap:18, marginTop:4 }}>
                <Donut segments={data.duration} size={120} stroke={22}/>
                <View style={{ flex:1, gap:10 }}>
                  {data.duration.map(s => (
                    <View key={s.label} style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between" }}>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:7 }}>
                        <View style={{ width:10, height:10, borderRadius:3, backgroundColor:s.color }}/>
                        <Text style={{ fontSize:12.5, color:theme.secondary }}>{s.label}</Text>
                      </View>
                      <Text style={{ fontSize:13, fontWeight:"700", color:theme.primary }}>{s.value}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          )}

          {/* Top Contacts */}
          {data.topContacts.length > 0 && (
            <Card style={{ marginBottom:14 }}>
              <Text style={{ ...title, marginBottom:12 }}>Most Called Contacts</Text>
              {data.topContacts.map((c, i) => (
                <View key={c.name} style={{ flexDirection:"row", alignItems:"center", gap:12, marginBottom: i===data.topContacts.length-1 ? 0 : 14 }}>
                  <Text style={{ fontSize:13, fontWeight:"700", color:theme.dim, width:18 }}>{i+1}</Text>
                  <View style={{ width:36, height:36, borderRadius:18, backgroundColor:palette.teal+"22", alignItems:"center", justifyContent:"center" }}>
                    <Text style={{ fontSize:13, fontWeight:"700", color:palette.teal }}>
                      {c.name.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex:1 }}>
                    <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:5 }}>
                      <Text style={{ fontSize:13.5, fontWeight:"600", color:theme.primary }} numberOfLines={1}>{c.name}</Text>
                      <Text style={{ fontSize:12.5, fontWeight:"700", color:theme.secondary }}>{c.calls} calls</Text>
                    </View>
                    <ProgressBar percent={c.pct} color={i===0 ? palette.teal : palette.violet} width={w-64} height={6}/>
                  </View>
                </View>
              ))}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

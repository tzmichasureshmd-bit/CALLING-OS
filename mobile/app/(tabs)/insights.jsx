import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, useWindowDimensions, RefreshControl, Modal, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader, Card } from "../../src/components";
import { LineChart, StackedBars, Donut, ProgressBar } from "../../src/charts";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";

const RANGE_MAP = { "Today": "today", "7 Days": "7d", "30 Days": "30d" };
const RANGES = ["Today", "7 Days", "30 Days"];

const DURATION_COLORS = ["#14b8a6", "#8b5cf6", "#22d3ee", "#f59e0b"];

export default function Insights() {
  const [range, setRange] = useState("7 Days");
  const [dropOpen, setDropOpen] = useState(false);
  const { width } = useWindowDimensions();
  const { theme } = useTheme();
  const { syncCalls } = useAuth();
  const w = width - 64;
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback((r = range, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    api.getAnalytics(RANGE_MAP[r] || "7d")
      .then((res) => {
        const daily = res.daily_metrics || [];
        const labels = daily.map((d) => d.day);
        const dist = (res.duration_distribution || []).map((d, i) => ({
          label: d.name, value: d.value, color: d.color || DURATION_COLORS[i % 4],
        }));
        const lb = (res.leaderboard || []).slice(0, 5).map((e) => ({
          name: e.name,
          calls: e.calls,
          pct: e.connected_pct ?? 0,
        }));
        const maxPct = lb.length ? Math.max(...lb.map((e) => e.pct)) : 100;

        setD({
          totalVsConnected: {
            labels,
            total:     daily.map((d) => d.total || 0),
            connected: daily.map((d) => d.connected || 0),
          },
          outcomes: {
            labels,
            data: daily.map((d) => ({
              connected: d.connected || 0,
              missed:    d.missed || 0,
              rejected:  0,
            })),
          },
          duration: dist,
          topCallers: lb.map((e) => ({ ...e, pct: maxPct > 0 ? Math.round(e.pct / maxPct * 100) : 0 })),
        });
      })
      .catch(() => setD(null))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [range]);

  useEffect(() => { load(range); }, [range]);

  async function handleSyncAndReload() {
    setSyncing(true);
    try {
      await syncCalls();
    } catch { /* silent */ } finally {
      setSyncing(false);
      load(range, true);
    }
  }

  const RangeDrop = () => (
    <>
      <Pressable onPress={() => setDropOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
        <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary }}>{range}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.muted} />
      </Pressable>
      <Modal visible={dropOpen} transparent animationType="fade" onRequestClose={() => setDropOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={() => setDropOpen(false)}>
          <View style={{ position: "absolute", top: 100, right: 16, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.border, overflow: "hidden", minWidth: 140 }}>
            {RANGES.map((r) => (
              <Pressable key={r} onPress={() => { setRange(r); setDropOpen(false); }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: r !== RANGES[RANGES.length - 1] ? 1 : 0, borderBottomColor: theme.border, backgroundColor: r === range ? palette.teal + "18" : "transparent" }}>
                <Text style={{ fontSize: 14, fontWeight: r === range ? "700" : "500", color: r === range ? palette.teal : theme.primary }}>{r}</Text>
                {r === range && <Ionicons name="checkmark" size={16} color={palette.teal} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );

  const Legend = ({ items }) => (
    <View style={{ flexDirection: "row", gap: 16, marginBottom: 8, marginTop: 2 }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: it.color }} />
          <Text style={{ fontSize: 11.5, color: theme.muted }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );

  const Labels = ({ labels }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", width: w, marginTop: 6 }}>
      {labels.map((l) => <Text key={l} style={{ fontSize: 10.5, color: theme.dim }}>{l}</Text>)}
    </View>
  );

  const title = { fontSize: 15, fontWeight: "700", color: theme.primary, marginBottom: 4 };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
        <AppHeader title="Insights" right={<RangeDrop />} />
        <Text style={{ textAlign: "center", color: theme.muted, marginTop: 60 }}>Loading insights...</Text>
      </SafeAreaView>
    );
  }

  if (!d || (!d.totalVsConnected.total.some((v) => v > 0) && !d.topCallers.length)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
        <AppHeader title="Insights" right={<RangeDrop />} />
        <ScrollView
          contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(range, true)} tintColor={palette.teal} />}
        >
          <Text style={{ fontSize: 40, marginBottom: 16 }}>📊</Text>
          <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary, textAlign: "center" }}>No data for {range}</Text>
          <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginTop: 8 }}>
            Sync your call logs to see insights here.
          </Text>
          <Pressable onPress={handleSyncAndReload} disabled={syncing}
            style={{ marginTop: 20, backgroundColor: palette.teal, borderRadius: 13, paddingHorizontal: 28, paddingVertical: 13, flexDirection: "row", alignItems: "center", gap: 8 }}>
            {syncing
              ? <ActivityIndicator color="#fff" size="small" />
              : <Ionicons name="sync-outline" size={18} color="#fff" />}
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>
              {syncing ? "Syncing..." : "Sync & Reload"}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Insights" right={<RangeDrop />} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(range, true)} tintColor={palette.teal} />}
      >
        {d.totalVsConnected.total.some((v) => v > 0) && (
          <Card style={{ marginBottom: 14 }}>
            <Text style={title}>Total vs Connected Calls</Text>
            <Legend items={[{ label: "Total", color: palette.violet }, { label: "Connected", color: palette.teal }]} />
            <LineChart width={w} height={170} series={[
              { data: d.totalVsConnected.total,     color: palette.violet },
              { data: d.totalVsConnected.connected, color: palette.teal },
            ]} />
            <Labels labels={d.totalVsConnected.labels} />
          </Card>
        )}

        {d.outcomes.data.some((r) => r.connected + r.missed > 0) && (
          <Card style={{ marginBottom: 14 }}>
            <Text style={title}>Call Outcomes</Text>
            <Legend items={[{ label: "Connected", color: palette.teal }, { label: "Missed", color: palette.red }, { label: "Rejected", color: palette.amber }]} />
            <StackedBars width={w} height={170} data={d.outcomes.data} keys={["connected", "missed", "rejected"]} colors={[palette.teal, palette.red, palette.amber]} />
            <Labels labels={d.outcomes.labels} />
          </Card>
        )}

        {d.duration.some((s) => s.value > 0) && (
          <Card style={{ marginBottom: 14 }}>
            <Text style={title}>Duration Distribution</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 6 }}>
              <Donut segments={d.duration} size={130} stroke={24} />
              <View style={{ flex: 1, gap: 10 }}>
                {d.duration.map((s) => (
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
        )}

        {d.topCallers.length > 0 && (
          <Card>
            <Text style={{ ...title, marginBottom: 12 }}>Top Callers</Text>
            {d.topCallers.map((t, i) => (
              <View key={t.name} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: i === d.topCallers.length - 1 ? 0 : 14 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.dim, width: 16 }}>{i + 1}</Text>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: palette.teal + "22", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: palette.teal }}>{t.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text style={{ fontSize: 13.5, fontWeight: "600", color: theme.primary }}>{t.name}</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: theme.secondary }}>{t.calls} calls</Text>
                  </View>
                  <ProgressBar percent={t.pct} color={i === 0 ? palette.teal : palette.violet} width={w - 64} height={6} />
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

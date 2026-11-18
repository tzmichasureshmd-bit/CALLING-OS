import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { palette, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { getRealCallLog } from "../../src/callLogService";
import { api } from "../../src/api";

const TEAL = "#0ABFA3";
const NAVY = "#0D1B4B";

const RANGES = [
  { key: "7d",  label: "7 Days",   days: 7  },
  { key: "30d", label: "30 Days",  days: 30 },
  { key: "90d", label: "3 Months", days: 90 },
];

function fmtSecs(s) {
  if (!s) return "0m";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildWeekly(calls, days) {
  const weeks = Math.ceil(days / 7);
  const result = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end   = new Date(); end.setDate(end.getDate() - i * 7); end.setHours(23,59,59,999);
    const start = new Date(end); start.setDate(end.getDate() - 6); start.setHours(0,0,0,0);
    const wc = calls.filter(c => { const t = new Date(c.start_time); return t >= start && t <= end; });
    result.push({
      label:     `W${weeks - i}`,
      total:     wc.length,
      connected: wc.filter(c => c.duration_seconds > 0).length,
      missed:    wc.filter(c => c.call_type === "missed").length,
    });
  }
  return result;
}

function StatCard({ label, value, sub, color, icon }) {
  return (
    <View style={{ flex: 1, backgroundColor: color + "12", borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1.5, borderColor: color + "33", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ fontSize: 22, fontWeight: "800", color: NAVY }}>{value}</Text>
      <Text style={{ fontSize: 10, fontWeight: "700", color: color, textAlign: "center" }}>{label}</Text>
      {sub ? <Text style={{ fontSize: 10, color: "#64748b", textAlign: "center" }}>{sub}</Text> : null}
    </View>
  );
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? value / max : 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <Text style={{ fontSize: 11, color: "#64748b", width: 28 }}>{label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden" }}>
        <View style={{ width: `${pct * 100}%`, height: 8, backgroundColor: color, borderRadius: 4 }} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: "700", color: NAVY, width: 24, textAlign: "right" }}>{value}</Text>
    </View>
  );
}

export default function Reports() {
  const { theme } = useTheme();
  const router    = useRouter();
  const [range,      setRange]      = useState("30d");
  const [calls,      setCalls]      = useState([]);
  const [backendStats, setBackendStats] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const rangeDays = RANGES.find(r => r.key === range)?.days || 30;

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [raw, analytics] = await Promise.allSettled([
        getRealCallLog(rangeDays),
        api.getAnalytics(range).catch(() => null),
      ]);
      if (raw.status === "fulfilled") setCalls(raw.value);
      if (analytics.status === "fulfilled") setBackendStats(analytics.value);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [range, rangeDays]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - rangeDays); cutoff.setHours(0,0,0,0);
    const filtered = calls.filter(c => new Date(c.start_time) >= cutoff);
    const total     = filtered.length;
    const incoming  = filtered.filter(c => c.call_type === "incoming").length;
    const outgoing  = filtered.filter(c => c.call_type === "outgoing").length;
    const missed    = filtered.filter(c => c.call_type === "missed").length;
    const connected = filtered.filter(c => c.duration_seconds > 0).length;
    const totalSecs = filtered.reduce((s, c) => s + (c.duration_seconds || 0), 0);
    const connPct   = total ? Math.round(connected / total * 100) : 0;
    const avgSecs   = connected ? Math.round(totalSecs / connected) : 0;
    const weekly    = buildWeekly(filtered, rangeDays);
    const maxWeek   = Math.max(...weekly.map(w => w.total), 1);
    return { total, incoming, outgoing, missed, connected, totalSecs, connPct, avgSecs, weekly, maxWeek, filtered };
  }, [calls, rangeDays]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F0FFF8" }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: "#C3F0E0", backgroundColor: "#fff" }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: SPACE.md }}>
          <Ionicons name="arrow-back" size={22} color={NAVY} />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", color: NAVY, flex: 1 }}>My Reports</Text>
      </View>

      {/* Range tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.sm, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#C3F0E0" }}>
        {RANGES.map(r => {
          const on = r.key === range;
          return (
            <Pressable key={r.key} onPress={() => setRange(r.key)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: RADIUS.md, alignItems: "center",
                backgroundColor: on ? NAVY : "#F0FFF8", borderWidth: 1, borderColor: on ? NAVY : "#C3F0E0" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: on ? "#fff" : NAVY + "99" }}>{r.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={TEAL} size="large" />
          <Text style={{ color: "#64748b", marginTop: 12, fontSize: 13 }}>Loading reports…</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 110, gap: SPACE.md }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
        >
          {/* KPI grid */}
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <StatCard label="Total Calls"   value={stats.total}          color={TEAL}          icon="call-outline"              />
            <StatCard label="Connected"     value={`${stats.connPct}%`}  color={palette.emerald} icon="checkmark-circle-outline" />
            <StatCard label="Talk Time"     value={fmtSecs(stats.totalSecs)} color={palette.violet} icon="time-outline"          />
          </View>
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <StatCard label="Incoming"  value={stats.incoming} color={TEAL}         icon="call-received"  />
            <StatCard label="Outgoing"  value={stats.outgoing} color={palette.violet} icon="call-made"    />
            <StatCard label="Missed"    value={stats.missed}   color={palette.red}  icon="call-missed"    />
          </View>

          {/* Weekly breakdown */}
          {stats.weekly.some(w => w.total > 0) && (
            <View style={{ backgroundColor: "#fff", borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: "#C3F0E0" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: SPACE.md }}>Weekly Breakdown</Text>
              {stats.weekly.map(w => (
                <BarRow key={w.label} label={w.label} value={w.total} max={stats.maxWeek} color={TEAL} />
              ))}
              <View style={{ flexDirection: "row", gap: 16, marginTop: SPACE.sm }}>
                {[["Connected", palette.emerald], ["Missed", palette.red]].map(([l, c]) => (
                  <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: c }} />
                    <Text style={{ fontSize: 10, color: "#64748b" }}>{l}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Avg duration */}
          <View style={{ backgroundColor: "#fff", borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: "#C3F0E0" }}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY, marginBottom: SPACE.md }}>Call Quality</Text>
            {[
              { label: "Avg Call Duration",  value: fmtSecs(stats.avgSecs),                    color: TEAL          },
              { label: "Connection Rate",    value: `${stats.connPct}%`,                        color: palette.emerald },
              { label: "Total Talk Time",    value: fmtSecs(stats.totalSecs),                   color: palette.violet },
              { label: "Calls Per Day",      value: (stats.total / rangeDays).toFixed(1),       color: palette.amber  },
            ].map((r, i) => (
              <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
                paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: "#e2e8f0" }}>
                <Text style={{ fontSize: 13, color: "#64748b" }}>{r.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: "800", color: r.color }}>{r.value}</Text>
              </View>
            ))}
          </View>

          {stats.total === 0 && (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
              <Ionicons name="bar-chart-outline" size={48} color="#94a3b8" />
              <Text style={{ fontSize: 15, fontWeight: "700", color: NAVY }}>No calls in this period</Text>
              <Text style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>Make calls and sync to see your report.</Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const RANGES = ["today", "week", "month"];
const RANGE_LABELS = { today: "Today", week: "This Week", month: "This Month" };

function fmt(n) {
  const v = Number(n || 0);
  if (!v) return "₹0";
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

export default function AdminReports() {
  const router = useRouter();
  const colors = adminTheme;
  const [range, setRange] = useState("today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (r = range, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getAnalytics(r);
      setData(res);
    } catch (e) { setData(null); }
    finally { setLoading(false); setRefreshing(false); }
  }, [range]);

  useEffect(() => { load(range); }, [range]);

  const kpis = data?.kpis || {};
  const leaderboard = data?.top_employees || data?.leaderboard || [];
  const totalCalls = kpis.total_calls || 0;
  const connected  = kpis.connected  || 0;
  const missed     = kpis.missed     || 0;
  const connRate   = totalCalls ? Math.round(connected / totalCalls * 100) : 0;
  const avgDurMin  = Math.round((kpis.avg_duration_seconds || 0) / 60);
  const totalHours = Math.round((kpis.total_duration_seconds || 0) / 3600 * 10) / 10;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: SPACE.md }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={[TYPE.h2, { color: colors.primary, flex: 1 }]}>Reports</Text>
      </View>

      {/* Range tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.sm }}>
        {RANGES.map(r => (
          <Pressable key={r} onPress={() => setRange(r)}
            style={{ flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.md, alignItems: "center",
              backgroundColor: r === range ? colors.accent : colors.surface,
              borderWidth: 1, borderColor: r === range ? colors.accent : colors.border }}>
            <Text style={[TYPE.label, { color: r === range ? colors.white : colors.muted }]}>{RANGE_LABELS[r]}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(range, true)} tintColor={colors.accent} />}
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* Summary card */}
            <View style={{ backgroundColor: colors.white, borderRadius: RADIUS.card, padding: SPACE.lg, borderWidth: 1, borderColor: colors.border }}>
              <Text style={[TYPE.title, { color: colors.primary, marginBottom: SPACE.md }]}>Team Summary — {RANGE_LABELS[range]}</Text>
              {[
                { label: "Total Calls",     value: totalCalls,        icon: "call-outline",             color: colors.accent  },
                { label: "Connected",       value: connected,         icon: "checkmark-circle-outline", color: colors.success },
                { label: "Missed",          value: missed,            icon: "close-circle-outline",     color: colors.danger  },
                { label: "Connect Rate",    value: `${connRate}%`,    icon: "trending-up-outline",      color: colors.info    },
                { label: "Avg Duration",    value: `${avgDurMin}m`,   icon: "time-outline",             color: colors.warning },
                { label: "Total Talk Time", value: `${totalHours}h`,  icon: "mic-outline",              color: colors.accent  },
              ].map((row, i) => (
                <View key={row.label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: SPACE.md,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border }}>
                  <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: row.color + "22",
                    alignItems: "center", justifyContent: "center", marginRight: SPACE.md }}>
                    <Ionicons name={row.icon} size={18} color={row.color} />
                  </View>
                  <Text style={[TYPE.body, { color: colors.secondary, flex: 1 }]}>{row.label}</Text>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: colors.primary }}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Call breakdown bar chart */}
            {totalCalls > 0 && (
              <View style={{ backgroundColor: colors.white, borderRadius: RADIUS.card, padding: SPACE.lg, borderWidth: 1, borderColor: colors.border }}>
                <Text style={[TYPE.title, { color: colors.primary, marginBottom: SPACE.md }]}>Call Breakdown</Text>
                {[
                  { label: "Connected", value: connected, color: colors.success },
                  { label: "Missed",    value: missed,    color: colors.danger  },
                  { label: "Rejected",  value: kpis.rejected || 0, color: colors.warning },
                ].map(row => {
                  const pct = totalCalls ? Math.round(row.value / totalCalls * 100) : 0;
                  return (
                    <View key={row.label} style={{ marginBottom: SPACE.md }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                        <Text style={[TYPE.body, { color: colors.secondary }]}>{row.label}</Text>
                        <Text style={[TYPE.body, { color: row.color, fontWeight: "700" }]}>{row.value} · {pct}%</Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" }}>
                        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: row.color, borderRadius: 4 }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Leaderboard */}
            {leaderboard.length > 0 && (
              <View style={{ backgroundColor: colors.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                <View style={{ padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                  <Ionicons name="trophy-outline" size={20} color={colors.accent} />
                  <Text style={[TYPE.title, { color: colors.primary }]}>Team Leaderboard</Text>
                </View>
                {leaderboard.map((emp, i) => {
                  const empCalls = emp.total_calls ?? 0;
                  const pct = leaderboard[0]?.total_calls ? Math.round(empCalls / leaderboard[0].total_calls * 100) : 0;
                  return (
                    <View key={emp.employee_id || i} style={{ padding: SPACE.md,
                      borderBottomWidth: i < leaderboard.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: i === 0 ? colors.accent : colors.muted, width: 28 }}>{i + 1}</Text>
                        <Text style={[TYPE.body, { color: colors.primary, flex: 1, fontWeight: "700" }]} numberOfLines={1}>
                          {emp.employee_name || emp.name || "—"}
                        </Text>
                        <Text style={[TYPE.body, { color: colors.accent, fontWeight: "800" }]}>{empCalls}</Text>
                      </View>
                      <View style={{ height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden", marginLeft: 28 }}>
                        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: i === 0 ? colors.accent : colors.info, borderRadius: 3 }} />
                      </View>
                      <Text style={[TYPE.micro, { color: colors.muted, marginLeft: 28, marginTop: 3 }]}>
                        {Math.round((emp.avg_duration_seconds ?? 0) / 60)}m avg · {emp.connected ?? 0} connected
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

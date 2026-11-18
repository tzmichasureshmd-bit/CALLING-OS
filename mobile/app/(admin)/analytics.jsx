import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const RANGES = ["today", "week", "month"];
const RANGE_LABELS = { today: "Today", week: "This Week", month: "This Month" };

export default function AdminAnalytics() {
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
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => { load(range); }, [range]);

  const kpis = data?.kpis || {};

  const stats = [
    { label: "Total Calls",    value: kpis.total_calls    ?? 0,  icon: "call-outline",             color: colors.accent },
    { label: "Connected",      value: kpis.connected      ?? 0,  icon: "checkmark-circle-outline", color: colors.success },
    { label: "Missed",         value: kpis.missed         ?? 0,  icon: "call-missed",              color: colors.danger },
    { label: "Avg Duration",   value: `${Math.round((kpis.avg_duration_seconds ?? 0) / 60)}m`, icon: "time-outline", color: colors.info },
    { label: "Connect Rate",   value: kpis.total_calls ? `${Math.round((kpis.connected ?? 0) / kpis.total_calls * 100)}%` : "0%", icon: "trending-up-outline", color: colors.warning },
    { label: "Total Talk Time",value: `${Math.round((kpis.total_duration_seconds ?? 0) / 3600)}h`, icon: "mic-outline", color: colors.accent },
  ];

  const topEmployees = data?.top_employees || data?.leaderboard || [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: SPACE.md }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={[TYPE.h2, { color: colors.primary, flex: 1 }]}>Analytics</Text>
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
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.md, paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(range, true)} tintColor={colors.accent} />}
      >
        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            {/* KPI Grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
              {stats.map(s => (
                <View key={s.label} style={{ width: "48%", backgroundColor: colors.white, borderRadius: RADIUS.card,
                  padding: SPACE.md, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm }}>
                    <View style={{ width: 32, height: 32, borderRadius: RADIUS.md, backgroundColor: s.color + "22",
                      alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={s.icon} size={16} color={s.color} />
                    </View>
                    <Text style={[TYPE.caption, { color: colors.muted, flex: 1 }]} numberOfLines={1}>{s.label}</Text>
                  </View>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: colors.primary }}>{s.value}</Text>
                </View>
              ))}
            </View>

            {/* Top Employees */}
            {topEmployees.length > 0 && (
              <View style={{ backgroundColor: colors.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
                <View style={{ padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={[TYPE.title, { color: colors.primary }]}>Top Performers</Text>
                </View>
                {topEmployees.slice(0, 8).map((emp, i) => (
                  <View key={emp.employee_id || i} style={{ flexDirection: "row", alignItems: "center",
                    padding: SPACE.md, borderBottomWidth: i < topEmployees.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent + "22",
                      alignItems: "center", justifyContent: "center", marginRight: SPACE.md }}>
                      <Text style={[TYPE.label, { color: colors.accent, fontWeight: "800" }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[TYPE.body, { color: colors.primary }]}>{emp.employee_name || emp.name || "—"}</Text>
                      <Text style={[TYPE.caption, { color: colors.muted }]}>{emp.total_calls ?? 0} calls · {Math.round((emp.avg_duration_seconds ?? 0) / 60)}m avg</Text>
                    </View>
                    <Text style={[TYPE.title, { color: colors.accent }]}>{emp.total_calls ?? 0}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Call breakdown */}
            {kpis.total_calls > 0 && (
              <View style={{ backgroundColor: colors.white, borderRadius: RADIUS.card, borderWidth: 1, borderColor: colors.border, padding: SPACE.lg }}>
                <Text style={[TYPE.title, { color: colors.primary, marginBottom: SPACE.md }]}>Call Breakdown</Text>
                {[
                  { label: "Connected", value: kpis.connected ?? 0, color: colors.success },
                  { label: "Missed",    value: kpis.missed    ?? 0, color: colors.danger },
                  { label: "Rejected",  value: kpis.rejected  ?? 0, color: colors.warning },
                ].map(row => {
                  const pct = kpis.total_calls ? Math.round(row.value / kpis.total_calls * 100) : 0;
                  return (
                    <View key={row.label} style={{ marginBottom: SPACE.md }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <Text style={[TYPE.caption, { color: colors.muted }]}>{row.label}</Text>
                        <Text style={[TYPE.caption, { color: row.color, fontWeight: "700" }]}>{row.value} ({pct}%)</Text>
                      </View>
                      <View style={{ height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" }}>
                        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: row.color, borderRadius: 3 }} />
                      </View>
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

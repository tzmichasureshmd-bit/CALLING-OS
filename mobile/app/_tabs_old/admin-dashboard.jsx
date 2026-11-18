import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { useAuth } from "../../src/AuthContext";
import { api } from "../../src/api";
import { useRouter } from "expo-router";

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = adminTheme;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const [analytics, employees] = await Promise.all([
        api.getAnalytics("today"),
        api.getEmployees({ page_size: 100 }),
      ]);
      const kpis = analytics?.kpis || {};
      setStats({
        total_calls:       kpis.total_calls    || 0,
        total_employees:   employees?.total    ?? employees?.items?.length ?? 0,
        connected:         kpis.connected      || 0,
        avg_duration_mins: Math.round((kpis.avg_duration_seconds || 0) / 60),
      });
    } catch {
      setStats({ total_calls: 0, total_employees: 0, connected: 0, avg_duration_mins: 0 });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, []);

  const STAT_BOXES = [
    { icon: "call-outline",             label: "Total Calls",  value: stats?.total_calls       ?? 0,    color: colors.accent  },
    { icon: "people-outline",           label: "Employees",    value: stats?.total_employees   ?? 0,    color: colors.info    },
    { icon: "checkmark-circle-outline", label: "Connected",    value: stats?.connected         ?? 0,    color: colors.success },
    { icon: "time-outline",             label: "Avg Duration", value: `${stats?.avg_duration_mins ?? 0}m`, color: colors.warning },
  ];

  const QUICK_ACTIONS = [
    { icon: "people-outline",        label: "Employees",     route: "/(tabs)/admin-employees"   },
    { icon: "call-outline",          label: "All Calls",     route: "/(tabs)/admin-calls"        },
    { icon: "bar-chart-outline",     label: "Analytics",     route: "/(tabs)/admin-analytics"   },
    { icon: "document-text-outline", label: "Reports",       route: "/(tabs)/admin-reports"     },
    { icon: "person-add-outline",    label: "Leads",         route: "/(tabs)/admin-leads"       },
    { icon: "trending-up-outline",   label: "Opportunities", route: "/(tabs)/admin-opportunities"},
    { icon: "people-circle-outline", label: "Customers",     route: "/(tabs)/admin-customers"   },
    { icon: "settings-outline",      label: "Settings",      route: "/(tabs)/admin-settings"    },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStats(); }} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg }}>
          <View>
            <Text style={[TYPE.caption, { color: colors.muted }]}>Welcome back</Text>
            <Text style={[TYPE.h2, { color: colors.primary, marginTop: SPACE.xs }]}>
              {user?.first_name || user?.name || "Admin"}
            </Text>
          </View>
          <Ionicons name="notifications-outline" size={24} color={colors.accent} />
        </View>

        {/* Live Overview card */}
        <LinearGradient
          colors={["#e8f5e9", "#f1f8e9"]}
          style={{ margin: SPACE.lg, borderRadius: RADIUS.card, padding: SPACE.lg, borderWidth: 1, borderColor: colors.border }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.lg }}>
            <Text style={[TYPE.title, { color: colors.primary }]}>Live Overview — Today</Text>
            <Ionicons name="trending-up" size={20} color={colors.accent} />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: SPACE.xl }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
              {STAT_BOXES.map(s => (
                <View key={s.label} style={{ width: "48%", backgroundColor: colors.white, borderRadius: RADIUS.md, padding: SPACE.md, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm }}>
                    <View style={{ width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: s.color + "22", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={s.icon} size={16} color={s.color} />
                    </View>
                  </View>
                  <Text style={{ fontSize: 28, fontWeight: "800", color: colors.primary }}>{s.value}</Text>
                  <Text style={[TYPE.caption, { color: colors.muted, marginTop: 2 }]}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>

        {/* Quick Actions */}
        <View style={{ paddingHorizontal: SPACE.lg }}>
          <Text style={[TYPE.h3, { color: colors.primary, marginBottom: SPACE.md }]}>Quick Actions</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
            {QUICK_ACTIONS.map(a => (
              <Pressable
                key={a.label}
                onPress={() => router.push(a.route)}
                style={({ pressed }) => ({
                  width: "48%", backgroundColor: colors.white, borderRadius: RADIUS.md,
                  paddingVertical: SPACE.lg, paddingHorizontal: SPACE.md,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: colors.border,
                  opacity: pressed ? 0.7 : 1, marginBottom: SPACE.sm,
                })}
              >
                <Ionicons name={a.icon} size={26} color={colors.accent} />
                <Text style={[TYPE.caption, { color: colors.primary, marginTop: SPACE.sm, fontWeight: "600" }]}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

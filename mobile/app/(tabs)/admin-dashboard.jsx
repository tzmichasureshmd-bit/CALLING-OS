import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  StyleSheet, useWindowDimensions, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, adminTheme, TYPE, SPACE, RADIUS, gradientAdminBg, gradientAdminCard } from "../../src/theme";
import { useRole } from "../../src/RoleContext";
import { useAuth } from "../../src/AuthContext";
import { api } from "../../src/api";

export default function AdminDashboard() {
  const { appMode } = useRole();
  const { user } = useAuth();
  const dims = useWindowDimensions();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState(null);

  const colors = adminTheme;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      // Use employee analytics endpoint — admin views company-wide stats
      const response = await api.getAnalytics("today");
      setStats({
        active_calls: response?.active_calls || response?.total_calls || 0,
        total_employees: response?.employee_count || 0,
        completed_calls: response?.calls_today || 0,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      setStats({ active_calls: 0, total_employees: 0, completed_calls: 0 });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: SPACE.lg }]}>
          <View>
            <Text style={[TYPE.caption, { color: colors.muted }]}>Welcome back</Text>
            <Text style={[TYPE.h2, { color: colors.primary, marginTop: SPACE.xs }]}>
              {user?.first_name || "Admin"}
            </Text>
          </View>
          <Ionicons name="notifications-outline" size={24} color={colors.accent} />
        </View>

        {/* Live Statistics */}
        <LinearGradient
          colors={gradientAdminBg}
          style={[styles.statsCard, { marginHorizontal: SPACE.lg, marginTop: SPACE.xl }]}
        >
          <View style={styles.statsHeader}>
            <Text style={[TYPE.title, { color: colors.primary }]}>Live Overview</Text>
            <Ionicons name="trending-up" size={20} color={colors.accent} />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: SPACE.xxl }} />
          ) : (
            <View style={styles.statsGrid}>
              <StatBox
                icon="call"
                label="Active Calls"
                value={stats?.active_calls || 0}
                trend="+12%"
                colors={colors}
              />
              <StatBox
                icon="people"
                label="Employees"
                value={stats?.total_employees || 0}
                trend="0%"
                colors={colors}
              />
              <StatBox
                icon="checkmark-circle"
                label="Completed"
                value={stats?.completed_calls || 0}
                trend="+8%"
                colors={colors}
              />
              <StatBox
                icon="time"
                label="Avg Duration"
                value={`${stats?.avg_duration_mins || 0}m`}
                trend="-2%"
                colors={colors}
              />
            </View>
          )}
        </LinearGradient>

        {/* Quick Actions */}
        <View style={[styles.section, { marginTop: SPACE.xxl }]}>
          <Text style={[TYPE.h3, { color: colors.primary, marginHorizontal: SPACE.lg, marginBottom: SPACE.lg }]}>
            Quick Actions
          </Text>
          <View style={[styles.actionGrid, { marginHorizontal: SPACE.lg }]}>
            <ActionButton
              icon="people-outline"
              label="Employees"
              onPress={() => {}}
              colors={colors}
            />
            <ActionButton
              icon="call-outline"
              label="All Calls"
              onPress={() => {}}
              colors={colors}
            />
            <ActionButton
              icon="document-text-outline"
              label="Reports"
              onPress={() => {}}
              colors={colors}
            />
            <ActionButton
              icon="settings-outline"
              label="Settings"
              onPress={() => {}}
              colors={colors}
            />
          </View>
        </View>

        {/* Recent Activity */}
        <View style={[styles.section, { marginVertical: SPACE.xxl }]}>
          <Text style={[TYPE.h3, { color: colors.primary, marginHorizontal: SPACE.lg, marginBottom: SPACE.lg }]}>
            Recent Activity
          </Text>
          <ActivityFeed colors={colors} />
        </View>

        <View style={{ height: SPACE.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Stat Box Component
// ════════════════════════════════════════════════════════════════════════════
function StatBox({ icon, label, value, trend, colors }) {
  const trendColor = trend.includes("+") ? colors.success : colors.danger;
  return (
    <View style={[styles.statBox, { backgroundColor: colors.white, borderColor: colors.border, borderWidth: 1 }]}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.accent} />
        <Text style={[TYPE.caption, { color: trendColor }]}>{trend}</Text>
      </View>
      <Text style={[TYPE.title, { color: colors.primary, marginTop: SPACE.md }]}>{value}</Text>
      <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>{label}</Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Action Button Component
// ════════════════════════════════════════════════════════════════════════════
function ActionButton({ icon, label, onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionBtn,
        {
          backgroundColor: colors.surface2,
          borderColor: colors.border,
          borderWidth: 1,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.accent} />
      <Text style={[TYPE.caption, { color: colors.primary, marginTop: SPACE.sm }]}>{label}</Text>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Activity Feed Component
// ════════════════════════════════════════════════════════════════════════════
function ActivityFeed({ colors }) {
  const activities = [
    { icon: "call-outline", label: "John made a call", time: "5m ago", color: colors.info },
    { icon: "people-outline", label: "New employee added", time: "1h ago", color: colors.success },
    { icon: "document-outline", label: "Report generated", time: "2h ago", color: colors.warning },
  ];

  return (
    <View style={{ paddingHorizontal: SPACE.lg }}>
      {activities.map((activity, idx) => (
        <View
          key={idx}
          style={[
            styles.activityItem,
            { borderBottomColor: colors.border, borderBottomWidth: idx < activities.length - 1 ? 1 : 0 },
          ]}
        >
          <View
            style={[
              styles.activityIcon,
              { backgroundColor: activity.color, opacity: 0.1 },
            ]}
          >
            <Ionicons name={activity.icon} size={16} color={activity.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[TYPE.body, { color: colors.primary }]}>{activity.label}</Text>
            <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>{activity.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: SPACE.md,
  },
  statsCard: {
    borderRadius: RADIUS.card,
    padding: SPACE.lg,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACE.lg,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statBox: {
    width: "48%",
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACE.md,
  },
  section: {
    paddingHorizontal: SPACE.lg,
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  actionBtn: {
    width: "48%",
    paddingVertical: SPACE.lg,
    paddingHorizontal: SPACE.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE.md,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SPACE.md,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: SPACE.md,
  },
});

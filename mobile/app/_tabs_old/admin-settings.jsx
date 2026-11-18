import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";

const MORE_ITEMS = [
  { route: "/(tabs)/admin-analytics",     icon: "bar-chart-outline",        label: "Analytics",     color: "#14b8a6" },
  { route: "/(tabs)/admin-leads",         icon: "person-add-outline",       label: "Leads",         color: "#8b5cf6" },
  { route: "/(tabs)/admin-opportunities", icon: "trending-up-outline",      label: "Opportunities", color: "#f59e0b" },
  { route: "/(tabs)/admin-customers",     icon: "people-outline",           label: "Customers",     color: "#06b6d4" },
  { route: "/(tabs)/admin-reports",       icon: "document-text-outline",    label: "Reports",       color: "#10b981" },
];

export default function AdminSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const colors = adminTheme;
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try { setOrganization(await api.getOrganization()); }
    catch (error) { Alert.alert("Unable to load company", error.message || "Please try again."); }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, []);

  async function regenerateCode() {
    try {
      const result = await api.regenerateCompanyCode();
      setOrganization(current => ({ ...current, company_code: result.code, code: result.code }));
      Alert.alert("Company code updated", result.code || "The new code is ready to share.");
    } catch (error) { Alert.alert("Unable to update code", error.message || "Please try again."); }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.accent} />}
        contentContainerStyle={{ padding: SPACE.lg, gap: SPACE.lg }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[TYPE.caption, { color: colors.muted }]}>Company workspace</Text>
            <Text style={[TYPE.h2, { color: colors.primary, marginTop: SPACE.xs }]}>
              {organization?.name || user?.organization_name || "Organization"}
            </Text>
          </View>
          <Ionicons name="business-outline" size={28} color={colors.accent} />
        </View>

        {/* More screens */}
        <View>
          <Text style={[TYPE.micro, { color: colors.muted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: SPACE.sm }]}>More</Text>
          <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border, padding: 0, overflow: "hidden" }]}>
            {MORE_ITEMS.map((item, i) => (
              <Pressable key={item.route} onPress={() => router.push(item.route)}
                style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg,
                  borderBottomWidth: i < MORE_ITEMS.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: item.color + "1a",
                  alignItems: "center", justifyContent: "center", marginRight: SPACE.md }}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <Text style={[TYPE.title, { color: colors.primary, flex: 1 }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? <ActivityIndicator color={colors.accent} size="large" /> : (
          <>
            {/* Organization details */}
            <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]}>
              <Text style={[TYPE.title, { color: colors.primary }]}>Organization details</Text>
              <Info label="Company name"  value={organization?.name   || "—"} colors={colors} />
              <Info label="Company email" value={organization?.email  || "—"} colors={colors} />
              <Info label="Status"        value={organization?.status || "active"} colors={colors} />
            </View>

            {/* Employee connect code */}
            <View style={[styles.card, { backgroundColor: colors.surface2, borderColor: colors.border }]}>
              <Text style={[TYPE.title, { color: colors.primary }]}>Employee connect code</Text>
              <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.sm }]}>
                Share this code with employees so they can join the organization from the Employee app.
              </Text>
              <Text style={[styles.code, { color: colors.primary }]}>
                {organization?.company_code || organization?.code || user?.organization_code || "—"}
              </Text>
              <Pressable onPress={regenerateCode} style={[styles.button, { backgroundColor: colors.accent }]}>
                <Text style={[TYPE.bodyBold, { color: colors.white }]}>Regenerate company code</Text>
              </Pressable>
            </View>

            {/* Signed in as */}
            <View style={[styles.card, { backgroundColor: colors.white, borderColor: colors.border }]}>
              <Text style={[TYPE.title, { color: colors.primary }]}>Signed in as</Text>
              <Info label="Email" value={user?.email || "—"} colors={colors} />
              <Info label="Role"  value={user?.role  || "ADMIN"} colors={colors} />
            </View>

            {/* Sign out */}
            <Pressable onPress={async () => { await logout(); router.replace("/intro"); }}
              style={[styles.button, { backgroundColor: colors.danger }]}>
              <Text style={[TYPE.bodyBold, { color: colors.white }]}>Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value, colors }) {
  return (
    <View style={{ paddingTop: SPACE.md, marginTop: SPACE.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={[TYPE.caption, { color: colors.muted }]}>{label}</Text>
      <Text style={[TYPE.body, { color: colors.primary, marginTop: 3 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card:      { borderWidth: 1, borderRadius: RADIUS.card, padding: SPACE.lg },
  code:      { fontSize: 24, fontWeight: "800", letterSpacing: 1.2, marginTop: SPACE.lg, marginBottom: SPACE.lg },
  button:    { borderRadius: RADIUS.md, paddingVertical: SPACE.md, alignItems: "center", justifyContent: "center" },
});

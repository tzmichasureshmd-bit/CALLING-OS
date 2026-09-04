import { useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "../../src/theme";
import { EMPLOYEE, PERMISSIONS, HOME, CALLS } from "../../src/mockData";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";

export default function Profile() {
  const { theme, mode, toggle, shadowSoft } = useTheme();
  const router = useRouter();
  const { user, logout, syncCalls, deviceId } = useAuth();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const e = {
    name: user?.name || EMPLOYEE.name,
    email: user?.email || EMPLOYEE.email,
    companyCode: user?.organization_code || EMPLOYEE.companyCode,
    companyName: user?.organization_name || EMPLOYEE.companyName,
  };

  async function handleSync() {
    if (!deviceId) {
      Alert.alert("Not Ready", "Device not registered yet. Try signing out and back in.");
      return;
    }
    setSyncing(true); setSyncResult(null);
    try {
      // Build sync payload from mock calls (replace with real call log later)
      const now = new Date();
      const calls = CALLS.map((c, i) => ({
        client_event_id: `mock-${user?.id}-${c.id}`,
        phone_number: c.phone.replace(/\s/g, ""),
        contact_name: c.name,
        call_type: c.type,
        start_time: new Date(now.getTime() - (i + 1) * 3600000).toISOString(),
        end_time: c.duration !== "00:00"
          ? new Date(now.getTime() - (i + 1) * 3600000 + parseDur(c.duration) * 1000).toISOString()
          : null,
        duration_seconds: parseDur(c.duration),
        sim_slot: c.sim === "SIM 2" ? 2 : 1,
        source: c.sim,
        recording_available: c.recording,
      }));
      const result = await syncCalls(calls);
      setSyncResult(result);
    } catch (e) {
      Alert.alert("Sync Failed", e.message);
    } finally { setSyncing(false); }
  }

  function parseDur(str) {
    const [m, s] = str.split(":").map(Number);
    return (m || 0) * 60 + (s || 0);
  }

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  const dark = mode === "dark";

  const card = { backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border };
  const iconBox = (bg) => ({ width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: bg });

  const Row = ({ icon, title, sub }) => (
    <Pressable style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16 }]}>
      <View style={iconBox(palette.teal + "1a")}><Ionicons name={icon} size={18} color={theme.accent} /></View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>{title}</Text>
        <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.dim} />
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }} showsVerticalScrollIndicator={false}>
        {/* Gradient profile header */}
        <View style={{ padding: 16 }}>
          <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 20, position: "relative" }}>
            <Pressable style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}><Ionicons name="create-outline" size={17} color="#fff" /></Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff" }}>{e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>{e.name}</Text>
                <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", marginTop: 1 }}>{e.email}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, backgroundColor: "rgba(255,255,255,0.18)", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9 }}>
                  <MaterialCommunityIcons name="shield-key-outline" size={13} color="#fff" />
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 0.4 }}>{e.companyCode}</Text>
                </View>
              </View>
            </View>
            {/* Quick stats row */}
            <View style={{ flexDirection: "row", marginTop: 18, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 14, paddingVertical: 12 }}>
              {[
                { label: "Calls", value: HOME.totalCalls },
                { label: "Connected", value: `${HOME.connectedPct}%` },
                { label: "Talk Time", value: HOME.talkTime },
              ].map((s, i) => (
                <View key={s.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: "rgba(255,255,255,0.2)" }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff" }}>{s.value}</Text>
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Row icon="phone-portrait-outline" title="SIM Configuration" sub="2 SIMs Active" />
          <Row icon="mic-outline" title="Call Recordings" sub="128 recordings · 2.4 GB" />

          {/* Permission Health */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={iconBox(palette.emerald + "1f")}><Ionicons name="shield-checkmark-outline" size={18} color={palette.emerald} /></View>
              <View><Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Permission Health</Text><Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>All permissions are active</Text></View>
            </View>
            {PERMISSIONS.map((p) => (
              <View key={p.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <Ionicons name={p.key === "callLog" ? "call-outline" : p.key === "contacts" ? "people-outline" : "mic-outline"} size={16} color={theme.muted} />
                  <Text style={{ fontSize: 14, color: theme.secondary }}>{p.label}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 12.5, color: theme.success, fontWeight: "600" }}>Allowed</Text>
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                </View>
              </View>
            ))}
          </View>

          {/* Sync Now */}
          <Pressable onPress={handleSync} disabled={syncing}
            style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16, borderColor: syncing ? theme.border : palette.teal + "55" }]}>
            <View style={iconBox(palette.teal + "1a")}>
              {syncing
                ? <ActivityIndicator size="small" color={palette.teal} />
                : <Ionicons name="cloud-upload-outline" size={18} color={palette.teal} />}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Sync Calls Now</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>
                {syncResult
                  ? `✓ ${syncResult.accepted} synced · ${syncResult.duplicates} duplicates`
                  : "Push call logs to dashboard"}
              </Text>
            </View>
            {!syncing && <Ionicons name="chevron-forward" size={20} color={palette.teal} />}
          </Pressable>

          {/* Theme toggle — live */}
          <View style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={iconBox(palette.violet + "1f")}><Ionicons name={dark ? "moon" : "sunny"} size={18} color={palette.violet} /></View>
              <View><Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Theme</Text><Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>{dark ? "Dark Mode" : "Light Mode"}</Text></View>
            </View>
            <Pressable onPress={toggle} style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: dark ? palette.teal : theme.borderStrong, justifyContent: "center", paddingHorizontal: 2 }}>
              <View style={{ position: "absolute", left: dark ? 22 : 2, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" }} />
            </Pressable>
          </View>

          <Row icon="information-circle-outline" title="About CallNexa" sub="v1.0.0 (100)" />

          <Pressable onPress={handleSignOut} style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderColor: theme.dangerSoft }]}>
            <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: theme.danger }}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

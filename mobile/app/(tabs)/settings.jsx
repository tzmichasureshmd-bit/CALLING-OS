import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, Modal, TextInput, Image, RefreshControl, Linking, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "../../src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";
import { checkPermissions, requestAllPermissions, readSimInfo, getDeviceInfo } from "../../src/nativeModules";
import { api } from "../../src/api";
import { getSyncHealthSummary } from "../../src/callStatusStore";
import {
  getNotificationPreferences,
  setNotificationPreference,
  getNotificationPermissionStatus,
} from "../../src/notificationManager";

const LAST_SYNC_KEY      = "callos_last_sync_ts";
const RECORDING_PREF_KEY = "callos_recording_enabled";

export default function Profile() {
  const { theme, mode, toggle, shadowSoft } = useTheme();
  const router = useRouter();
  const { user, setUser, logout, syncCalls, deviceId } = useAuth();
  const [syncing, setSyncing]             = useState(false);
  const [syncResult, setSyncResult]       = useState(null);
  const [lastSync, setLastSync]           = useState(null);
  const [permissions, setPermissions]     = useState({});
  const [sims, setSims]                   = useState([]);
  const [selectedSim, setSelectedSim]     = useState(null); // null = all SIMs
  const [deviceInfo, setDeviceInfo]       = useState({});
  const [stats, setStats]                 = useState({ totalCalls: "â€”", connectedPct: "â€”", talkTime: "â€”" });
  const [editOpen, setEditOpen]           = useState(false);
  const [simOpen, setSimOpen]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);
  const [syncHealth, setSyncHealth]       = useState(null);
  const [notifPerms, setNotifPerms]       = useState("undetermined");
  const [notifPrefs, setNotifPrefs]       = useState({ calls: true, sync: true, recording: true, transcription: true });

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [perms, simList, ts, recPref, health, np, nprefs] = await Promise.all([
      checkPermissions(),
      readSimInfo(),
      AsyncStorage.getItem(LAST_SYNC_KEY),
      AsyncStorage.getItem(RECORDING_PREF_KEY),
      getSyncHealthSummary(),
      getNotificationPermissionStatus(),
      getNotificationPreferences(),
    ]);
    setPermissions(perms);
    if (simList.length) {
      setSims(simList);
      const saved = await AsyncStorage.getItem("callos_selected_sim_slot");
      setSelectedSim(saved !== null && saved !== "" ? parseInt(saved, 10) : null);
    }
    setDeviceInfo(getDeviceInfo());
    setRecordingEnabled(recPref === "true");
    setSyncHealth(health);
    setNotifPerms(np);
    setNotifPrefs(nprefs);
    if (ts) {
      const d = new Date(parseInt(ts, 10));
      setLastSync(d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }));
    }
    if (deviceId) {
      api.heartbeat(deviceId, { is_online: true, permissions_status: perms }).catch(() => {});
    }
    api.getAnalytics("today")
      .then((res) => {
        const k = res.kpis || {};
        setStats({
          totalCalls:   k.total_calls ?? 0,
          connectedPct: `${k.connected_pct ?? 0}%`,
          talkTime:     fmtSeconds(k.talk_time_seconds),
        });
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [deviceId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function fmtSeconds(s) {
    if (!s) return "0m";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function handleSync() {
    if (!deviceId) { Alert.alert("Not Ready", "Device not registered. Sign out and back in."); return; }
    setSyncing(true); setSyncResult(null);
    try {
      const { getRealCallLog, markCallsSynced } = require("../../src/callLogService");
      const { api: _api } = require("../../src/api");
      let allCalls = await getRealCallLog(90);
      if (selectedSim !== null) {
        allCalls = allCalls.filter((c) => (c.sim_slot !== undefined ? c.sim_slot - 1 : null) === selectedSim);
      }
      if (!allCalls.length) {
        setSyncResult({ accepted: 0, duplicates: 0, failed: 0 });
        Alert.alert("No Calls Found", selectedSim !== null
          ? `No calls for SIM ${selectedSim + 1} in last 90 days.`
          : "No calls found in last 90 days.");
        return;
      }
      const result = await _api.syncCalls(deviceId, allCalls);
      if (result.accepted > 0 || result.duplicates > 0) await markCallsSynced(allCalls);
      setSyncResult(result);
      const now = Date.now();
      await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
      setLastSync(new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }));
      Alert.alert("Sync Complete", `${result.accepted} new  ${result.duplicates} duplicates  ${allCalls.length} total read`);
    } catch (e) {
      Alert.alert("Sync Failed", e.message);
    } finally { setSyncing(false); }
  }

  async function handleRequestPermission(key) {
    const result = await requestAllPermissions();
    setPermissions(result);
    if (!result[key]) {
      Alert.alert(
        "Permission Required",
        "Please enable this permission in your device Settings â†’ Apps â†’ CallNexa â†’ Permissions.",
        [
          { text: "Open Settings", onPress: () => Linking.openSettings() },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  }

  async function toggleRecording(val) {
    if (val && !permissions.recording) {
      // Request microphone permission first
      const result = await requestAllPermissions();
      setPermissions(result);
      if (!result.recording) {
        Alert.alert(
          "Microphone Permission Required",
          "Go to Settings â†’ Apps â†’ CallNexa â†’ Permissions â†’ Microphone and enable it.",
          [{ text: "Open Settings", onPress: () => Linking.openSettings() }, { text: "Cancel", style: "cancel" }]
        );
        return;
      }
    }
    setRecordingEnabled(val);
    await AsyncStorage.setItem(RECORDING_PREF_KEY, String(val));
  }

  async function handleSignOut() {
    await logout();
    router.replace("/login");
  }

  function handleProfileSaved(updated) {
    const merged = { ...user, ...updated };
    setUser(merged);
    AsyncStorage.setItem("callos_user", JSON.stringify(merged));
  }

  const dark = mode === "dark";
  const e = {
    name:        user?.name        || "Employee",
    email:       user?.email       || "",
    companyCode: user?.organization_code || user?.company_code || "",
    companyName: user?.organization_name || user?.company_name || "",
  };

  const card    = { backgroundColor: theme.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.border };
  const iconBox = (bg) => ({ width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: bg });

  const PERM_LIST = [
    { key: "callLog",    icon: "call-outline",           label: "Call Log",    desc: "Read call history",          required: true },
    { key: "phoneState", icon: "phone-portrait-outline", label: "Phone State", desc: "Detect active calls & SIM",   required: true },
    { key: "contacts",   icon: "people-outline",         label: "Contacts",    desc: "Match caller names",         required: true },
    { key: "storage",    icon: "folder-outline",         label: "Storage",     desc: "Access call recordings",     required: true },
    { key: "recording",  icon: "mic-outline",            label: "Microphone",  desc: "Record calls (optional)",   required: false },
  ];

  const requiredGranted = PERM_LIST.filter((p) => p.required).every((p) => permissions[p.key]);
  const allGranted      = PERM_LIST.every((p) => permissions[p.key]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadAll(true)} tintColor={palette.teal} />}
      >
        {/* â”€â”€ Profile header â”€â”€ */}
        <View style={{ padding: 16 }}>
          <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 20 }}>
            <Pressable onPress={() => setEditOpen(true)} style={{ position: "absolute", top: 16, right: 16, width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="create-outline" size={17} color="#fff" />
            </Pressable>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 62, height: 62, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)" }}>
                <Text style={{ fontSize: 22, fontWeight: "800", color: "#fff" }}>
                  {e.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                </Text>
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
            <View style={{ flexDirection: "row", marginTop: 18, backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 14, paddingVertical: 12 }}>
              {[
                { label: "Calls",     value: stats.totalCalls },
                { label: "Connected", value: stats.connectedPct },
                { label: "Talk Time", value: stats.talkTime },
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

          {/* â”€â”€ SIM Configuration â”€â”€ */}
          <Pressable onPress={() => setSimOpen(true)} style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16 }]}>
            <View style={iconBox(palette.teal + "1a")}><Ionicons name="phone-portrait-outline" size={18} color={theme.accent} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>SIM Configuration</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>
                {sims.length
                  ? selectedSim !== null
                    ? `Tracking SIM ${selectedSim + 1} only  ${sims.length} SIM${sims.length > 1 ? "s" : ""} detected`
                    : `All SIMs  ${sims.length} SIM${sims.length > 1 ? "s" : ""} detected`
                  : "Tap to view SIM details"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.dim} />
          </Pressable>

          {/* â”€â”€ Device Info â”€â”€ */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={iconBox(palette.violet + "1f")}><Ionicons name="hardware-chip-outline" size={18} color={palette.violet} /></View>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Device</Text>
            </View>
            {[
              { label: "Model",        value: deviceInfo.model || "â€”" },
              { label: "Manufacturer", value: deviceInfo.manufacturer || "â€”" },
              { label: "Android",      value: deviceInfo.androidVersion || "â€”" },
            ].map((r) => (
              <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                <Text style={{ fontSize: 13, color: theme.muted }}>{r.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* â”€â”€ Permission Health â”€â”€ */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={iconBox(requiredGranted ? palette.emerald + "1f" : palette.red + "1f")}>
                <Ionicons name="shield-checkmark-outline" size={18} color={requiredGranted ? palette.emerald : palette.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Permission Health</Text>
                <Text style={{ fontSize: 12.5, color: requiredGranted ? theme.success : theme.danger, marginTop: 1 }}>
                  {requiredGranted ? "Required permissions granted âœ“" : "Required permissions missing â€” tap to fix"}
                </Text>
              </View>
            </View>
            {PERM_LIST.map((p) => (
              <Pressable key={p.key} onPress={() => !permissions[p.key] && handleRequestPermission(p.key)}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <Ionicons name={p.icon} size={16} color={theme.muted} />
                  <View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Text style={{ fontSize: 13.5, color: theme.secondary }}>{p.label}</Text>
                      {p.required && (
                        <View style={{ backgroundColor: palette.red + "22", borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 }}>
                          <Text style={{ fontSize: 9, fontWeight: "700", color: palette.red }}>REQUIRED</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ fontSize: 11, color: theme.dim }}>{p.desc}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {permissions[p.key] !== undefined ? (
                    <>
                      <Text style={{ fontSize: 12, color: permissions[p.key] ? theme.success : theme.danger, fontWeight: "600" }}>
                        {permissions[p.key] ? "Allowed" : "Denied"}
                      </Text>
                      <Ionicons name={permissions[p.key] ? "checkmark-circle" : "alert-circle"} size={16} color={permissions[p.key] ? theme.success : theme.danger} />
                    </>
                  ) : <ActivityIndicator size="small" color={theme.muted} />}
                </View>
              </Pressable>
            ))}
            {!requiredGranted && (
              <Pressable onPress={() => requestAllPermissions().then(setPermissions)}
                style={{ marginTop: 10, backgroundColor: palette.teal + "1a", borderRadius: 10, padding: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: palette.teal }}>Grant Required Permissions</Text>
              </Pressable>
            )}
          </View>

          {/* â”€â”€ Battery Optimization Warning â”€â”€ */}
          <Pressable
            onPress={() => Linking.openSettings()}
            style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16, borderColor: palette.amber + "55" }]}>
            <View style={iconBox(palette.amber + "1f")}>
              <Ionicons name="battery-charging-outline" size={18} color={palette.amber} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Battery Optimization</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>
                Disable battery optimization for reliable background sync. Tap â†’ Apps â†’ CallNexa â†’ Battery â†’ Unrestricted
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={palette.amber} />
          </Pressable>

          {/* â”€â”€ Call Recording Toggle â”€â”€ */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={iconBox(palette.violet + "1f")}><Ionicons name="mic-outline" size={18} color={palette.violet} /></View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Call Recording</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>
                    {recordingEnabled ? "Recording enabled Â· saves to dashboard" : "Off Â· calls not recorded"}
                  </Text>
                </View>
              </View>
              <Switch
                value={recordingEnabled}
                onValueChange={toggleRecording}
                trackColor={{ false: theme.border, true: palette.violet + "88" }}
                thumbColor={recordingEnabled ? palette.violet : theme.muted}
              />
            </View>
            {recordingEnabled && (
              <View style={{ marginTop: 10, backgroundColor: palette.violet + "12", borderRadius: 10, padding: 10 }}>
                <Text style={{ fontSize: 12, color: palette.violet, lineHeight: 18 }}>
                  âœ“ Recorded calls will be saved and available for AI transcription on the web dashboard.{"\n"}Only calls with recordings will be transcribed â€” saves storage & DB space.
                </Text>
              </View>
            )}
          </View>

          {/* â”€â”€ Sync Health â”€â”€ */}
          {syncHealth && (
            <View style={[card, shadowSoft]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <View style={iconBox(palette.teal + "1a")}><Ionicons name="pulse-outline" size={18} color={palette.teal} /></View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Sync Health</Text>
              </View>
              {[
                { label: "Total tracked",       value: syncHealth.total,             color: theme.primary },
                { label: "Synced",              value: syncHealth.synced,            color: palette.emerald },
                { label: "Pending",             value: syncHealth.pending,           color: palette.amber },
                { label: "Failed",              value: syncHealth.failed,            color: syncHealth.failed > 0 ? palette.red : theme.muted },
                { label: "Recordings uploaded", value: syncHealth.recordingUploaded, color: palette.violet },
                { label: "Recordings pending",  value: syncHealth.recordingPending,  color: palette.amber },
                { label: "Transcribed",         value: syncHealth.transcribed,       color: palette.cyan },
              ].map((r) => (
                <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <Text style={{ fontSize: 13, color: theme.muted }}>{r.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: r.color }}>{r.value}</Text>
                </View>
              ))}
              <Text style={{ fontSize: 11, color: theme.dim, marginTop: 8 }}>Last sync: {lastSync || "Never"}</Text>
            </View>
          )}

          {/* â”€â”€ Notification Preferences â”€â”€ */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={iconBox(palette.amber + "1f")}><Ionicons name="notifications-outline" size={18} color={palette.amber} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Notifications</Text>
                <Text style={{ fontSize: 12, color: notifPerms === "granted" ? theme.success : theme.danger, marginTop: 1 }}>
                  {notifPerms === "granted" ? "Allowed âœ“" : notifPerms === "denied" ? "Blocked â€” open Settings" : "Not yet requested"}
                </Text>
              </View>
              {notifPerms !== "granted" && (
                <Pressable onPress={() => Linking.openSettings()} style={{ backgroundColor: palette.amber + "22", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: palette.amber }}>Fix</Text>
                </Pressable>
              )}
            </View>
            {[
              { key: "calls",         label: "Call detected / synced",   icon: "call-outline" },
              { key: "sync",          label: "Sync progress",            icon: "sync-outline" },
              { key: "recording",     label: "Recording upload",         icon: "mic-outline" },
              { key: "transcription", label: "Transcription complete",   icon: "sparkles-outline" },
            ].map((p) => (
              <View key={p.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                  <Ionicons name={p.icon} size={15} color={theme.muted} />
                  <Text style={{ fontSize: 13.5, color: theme.secondary }}>{p.label}</Text>
                </View>
                <Switch
                  value={notifPrefs[p.key]}
                  onValueChange={async (val) => {
                    await setNotificationPreference(p.key, val);
                    setNotifPrefs((prev) => ({ ...prev, [p.key]: val }));
                  }}
                  trackColor={{ false: theme.border, true: palette.teal + "88" }}
                  thumbColor={notifPrefs[p.key] ? palette.teal : theme.muted}
                />
              </View>
            ))}
          </View>

          {/* â”€â”€ Sync Now â”€â”€ */}
          <Pressable onPress={handleSync} disabled={syncing}
            style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16, borderColor: syncing ? theme.border : palette.teal + "55" }]}>
            <View style={iconBox(palette.teal + "1a")}>
              {syncing ? <ActivityIndicator size="small" color={palette.teal} /> : <Ionicons name="cloud-upload-outline" size={18} color={palette.teal} />}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Sync Calls Now</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>
                {syncing
                  ? "Syncing all call logs..."
                  : syncResult
                    ? `âœ“ ${syncResult.accepted} new Â· ${syncResult.duplicates} duplicates`
                    : lastSync
                      ? `Last synced: ${lastSync}`
                      : "Auto-syncs every 5s Â· tap to sync now"}
              </Text>
            </View>
            {!syncing && <Ionicons name="chevron-forward" size={20} color={palette.teal} />}
          </Pressable>

          {/* â”€â”€ Theme toggle â”€â”€ */}
          <View style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={iconBox(palette.violet + "1f")}><Ionicons name={dark ? "moon" : "sunny"} size={18} color={palette.violet} /></View>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Theme</Text>
                <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>{dark ? "Dark Mode" : "Light Mode"}</Text>
              </View>
            </View>
            <Pressable onPress={toggle} style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: dark ? palette.teal : theme.borderStrong, justifyContent: "center", paddingHorizontal: 2 }}>
              <View style={{ position: "absolute", left: dark ? 22 : 2, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" }} />
            </Pressable>
          </View>

          {/* â”€â”€ App info â”€â”€ */}
          <View style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16 }]}>
            <Image source={require("../../assets/logo.png")} style={{ width: 38, height: 38, borderRadius: 10 }} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>CallNexa</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>v1.0.0 Â· {e.companyName}</Text>
            </View>
          </View>

          {/* â”€â”€ Sign out â”€â”€ */}
          <Pressable onPress={handleSignOut} style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderColor: theme.dangerSoft }]}>
            <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: theme.danger }}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} onSaved={handleProfileSaved} user={user} theme={theme} />
      <SimConfigModal visible={simOpen} onClose={() => setSimOpen(false)} sims={sims} selectedSim={selectedSim} onSelectSim={async (slot) => { setSelectedSim(slot); await AsyncStorage.setItem("callos_selected_sim_slot", slot === null ? "" : String(slot)); }} theme={theme} />
    </SafeAreaView>
  );
}

// â”€â”€ Edit Profile Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditProfileModal({ visible, onClose, onSaved, user, theme }) {
  const [name, setName]     = useState(user?.name || "");
  const [email, setEmail]   = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(user?.name || "");
      setEmail(user?.email || "");
    }
  }, [visible, user]);

  async function save() {
    if (!name.trim()) { Alert.alert("Error", "Name cannot be empty"); return; }
    setSaving(true);
    try {
      const updated = await api.updateProfile({ name: name.trim(), email: email.trim() });
      const newData = { name: updated.name || name.trim(), email: updated.email || email.trim() };
      const stored = await AsyncStorage.getItem("callos_user");
      if (stored) await AsyncStorage.setItem("callos_user", JSON.stringify({ ...JSON.parse(stored), ...newData }));
      onSaved(newData);
      Alert.alert("Saved âœ“", "Profile updated successfully.");
      onClose();
    } catch (err) {
      Alert.alert("Error", err.message || "Could not update profile.");
    } finally { setSaving(false); }
  }

  const inp = { backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: theme.primary, marginTop: 6 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>Edit Profile</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
          </View>
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>FULL NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={theme.dim}
            style={inp}
          />
          <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted, marginTop: 14 }}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={theme.dim}
            style={inp}
          />
          <Pressable onPress={save} disabled={saving} style={{ marginTop: 24 }}>
            <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Save Changes</Text>}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// â”€â”€ SIM Config Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SimConfigModal({ visible, onClose, sims, selectedSim, onSelectSim, theme }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>SIM Configuration</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
          </View>
          <Text style={{ fontSize: 12.5, color: theme.muted, marginBottom: 16 }}>Choose which SIM to track. Only calls from that SIM will sync.</Text>
          {sims.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
              <Ionicons name="phone-portrait-outline" size={48} color={theme.dim} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>No SIM detected</Text>
              <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", lineHeight: 20 }}>Make sure Phone State permission is granted.</Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <Pressable onPress={() => onSelectSim(null)}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, borderWidth: 2,
                  borderColor: selectedSim === null ? palette.teal : theme.border,
                  backgroundColor: selectedSim === null ? palette.teal + "12" : theme.surface }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: selectedSim === null ? palette.teal + "22" : theme.bg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="layers-outline" size={20} color={selectedSim === null ? palette.teal : theme.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: selectedSim === null ? palette.teal : theme.primary }}>All SIMs</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>Sync calls from all SIM slots</Text>
                </View>
                <Ionicons name={selectedSim === null ? "checkmark-circle" : "ellipse-outline"} size={22} color={selectedSim === null ? palette.teal : theme.dim} />
              </Pressable>
              {sims.map((s) => {
                const on = selectedSim === s.slot;
                return (
                  <Pressable key={s.slot} onPress={() => onSelectSim(s.slot)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, borderWidth: 2,
                      borderColor: on ? palette.teal : theme.border,
                      backgroundColor: on ? palette.teal + "12" : theme.surface }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? palette.teal + "22" : theme.bg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="phone-portrait-outline" size={20} color={on ? palette.teal : theme.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: on ? palette.teal : theme.primary }}>SIM {s.slot + 1}</Text>
                      {s.carrierName ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{s.carrierName}</Text> : null}
                      {s.phoneNumber ? <Text style={{ fontSize: 12, color: theme.muted }}>{s.phoneNumber}</Text> : null}
                      {s.countryIso  ? <Text style={{ fontSize: 11, color: theme.dim }}>{s.countryIso.toUpperCase()}</Text> : null}
                    </View>
                    <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? palette.teal : theme.dim} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

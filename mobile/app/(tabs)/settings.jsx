import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, Modal, TextInput, Image, RefreshControl, Linking, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";
import { checkPermissions, requestAllPermissions, readSimInfo, getDeviceInfo } from "../../src/nativeModules";
import { api } from "../../src/api";
import { getSyncHealthSummary } from "../../src/callStatusStore";
import { saveSimSelection, getSimSelection, checkSimChange } from "../../src/simSelectionService";
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
  const [selectedSim, setSelectedSim]     = useState(null); // full SIM object or null
  const [simChangeAlert, setSimChangeAlert] = useState(null); // { previous, current } or null
  const [deviceInfo, setDeviceInfo]       = useState({});
  const [stats, setStats]                 = useState({ totalCalls: "—", connectedPct: "—", talkTime: "—" });
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
      const sel = await getSimSelection();
      let found = null;
      if (sel.subscriptionId) {
        found = simList.find((s) => s.subscriptionId && String(s.subscriptionId) === sel.subscriptionId) || null;
      }
      if (!found && sel.slot !== null) {
        found = simList.find((s) => s.slot === sel.slot) || null;
      }
      setSelectedSim(found);
      const changeResult = await checkSimChange(simList);
      if (changeResult.changed) {
        setSimChangeAlert({ previous: changeResult.previous, current: changeResult.current });
      }
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
    // Load stats from local call log � no backend needed
    try {
      const { getRealCallLog } = require("../../src/callLogService");
      const todayCalls = await getRealCallLog(1);
      const now = new Date(); now.setHours(0,0,0,0);
      const today = todayCalls.filter(c => new Date(c.start_time) >= now);
      const connected = today.filter(c => c.duration_seconds > 0).length;
      const totalSecs = today.reduce((s, c) => s + (c.duration_seconds || 0), 0);
      const h = Math.floor(totalSecs / 3600), m = Math.floor((totalSecs % 3600) / 60);
      setStats({
        totalCalls:   today.length,
        connectedPct: today.length ? `${Math.round(connected/today.length*100)}%` : "0%",
        talkTime:     totalSecs > 0 ? (h > 0 ? `${h}h ${m}m` : `${m}m`) : "0m",
      });
    } catch { /* silent */ }
    setRefreshing(false);
  }, [deviceId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  function fmtSeconds(s) {
    if (!s) return "0m";
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function handleSync() {
    if (!deviceId) {
      Alert.alert("Not Ready", "This device is not registered. Sign out and sign back in.");
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncCalls();
      setSyncResult(result);

      if ((result.failed || 0) > 0) {
        Alert.alert(
          "Sync Incomplete",
          `${result.accepted || 0} new, ${result.duplicates || 0} already synced, ${result.failed} failed. Pending calls remain recoverable and will retry.`,
        );
        return;
      }

      const completedAt = result.completed_at || Date.now();
      setLastSync(new Date(completedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short",
      }));
      if ((result.total || 0) === 0) {
        Alert.alert("Sync Complete", "No pending calls were found.");
      } else {
        Alert.alert(
          "Sync Complete",
          `${result.accepted || 0} new, ${result.duplicates || 0} already synced, ${result.total || 0} checked.`,
        );
      }
    } catch (e) {
      Alert.alert("Sync Error", e?.message || "Unable to synchronize calls. Pending calls will retry.");
    } finally {
      setSyncing(false);
    }
  }

    async function handleRequestPermission(key) {
    const result = await requestAllPermissions();
    setPermissions(result);
    if (!result[key]) {
      Alert.alert(
        "Permission Required",
        "Please enable this permission in your device Settings → Apps → CallNexa → Permissions.",
        [
          { text: "Open Settings", onPress: () => Linking.openSettings() },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  }

  async function toggleRecording(val) {
    if (val && !permissions.storage) {
      const result = await requestAllPermissions();
      setPermissions(result);
      if (!result.storage) {
        Alert.alert(
          "Audio Permission Required",
          "Go to Settings → Apps → CallNexa → Permissions and allow music/audio file access.",
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

  const card    = { backgroundColor: theme.card, borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: theme.border };
  const iconBox = (bg) => ({ width: 38, height: 38, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", backgroundColor: bg });
  // Section header label
  const sectionLabel = { ...TYPE.micro, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 4, paddingBottom: SPACE.sm, paddingTop: SPACE.xl };

  const PERM_LIST = [
    { key: "callLog",    icon: "call-outline",           label: "Call Log",    desc: "Read call history",          required: true },
    { key: "phoneState", icon: "phone-portrait-outline", label: "Phone State", desc: "Detect active calls & SIM",   required: true },
    { key: "contacts",   icon: "people-outline",         label: "Contacts",    desc: "Match caller names",         required: true },
    { key: "storage",    icon: "folder-outline",         label: "Audio Files", desc: "Access permitted call recordings", required: true },
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
        {/* ── Profile header ── */}
        <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.xl, paddingBottom: SPACE.sm }}>
          <View style={{ backgroundColor: theme.card, borderRadius: RADIUS.xxl, padding: SPACE.lg, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <View style={{ width: 56, height: 56, borderRadius: RADIUS.xl, backgroundColor: palette.teal + "18", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 20, fontWeight: "700", color: palette.teal }}>
                  {e.name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.h3, color: theme.primary }}>{e.name}</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2 }}>{e.email}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.emerald }} />
                  <Text style={{ ...TYPE.label, color: theme.muted }}>{e.companyCode}</Text>
                </View>
              </View>
              <Pressable onPress={() => setEditOpen(true)} style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: theme.surface2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border }}>
                <Ionicons name="pencil" size={15} color={theme.muted} />
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", marginTop: SPACE.lg, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: theme.border }}>
              {[
                { label: "Today's Calls", value: stats.totalCalls },
                { label: "Connected",     value: stats.connectedPct },
                { label: "Talk Time",     value: stats.talkTime },
              ].map((s, i) => (
                <View key={s.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: theme.border }}>
                  <Text style={{ fontSize: 18, fontWeight: "700", color: theme.primary }}>{s.value}</Text>
                  <Text style={{ ...TYPE.micro, color: theme.muted, marginTop: 2 }}>{s.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.sm }}>

          {/* ── SECTION: APP SETTINGS ── */}
          <Text style={sectionLabel}>App Settings</Text>

          {/* Grouped card: SIM + Recording + Theme */}
          <View style={[card, shadowSoft, { padding: 0, overflow: "hidden" }]}>

            {/* SIM Configuration */}
            <Pressable onPress={() => setSimOpen(true)} style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={iconBox(palette.teal + "1a")}><Ionicons name="phone-portrait-outline" size={18} color={theme.accent} /></View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>SIM Configuration</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }}>
                  {sims.length
                    ? selectedSim !== null
                      ? `SIM ${selectedSim?.display_slot ?? (selectedSim?.slot != null ? selectedSim.slot + 1 : 1)}${selectedSim?.carrierName ? ' — ' + selectedSim.carrierName : ''}`
                      : `All SIMs · ${sims.length} detected`
                    : "Tap to configure"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dim} />
            </Pressable>

            {/* Call Recording */}
            <View style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={iconBox(palette.violet + "1f")}><Ionicons name="mic-outline" size={18} color={palette.violet} /></View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>Call Recording</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }}>
                  {recordingEnabled ? "Enabled · saves to dashboard" : "Off · calls not recorded"}
                </Text>
              </View>
              <Switch value={recordingEnabled} onValueChange={toggleRecording} trackColor={{ false: theme.border, true: palette.violet + "88" }} thumbColor={recordingEnabled ? palette.violet : theme.muted} />
            </View>

            {/* Theme */}
            <View style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg }}>
              <View style={iconBox(palette.violet + "1f")}><Ionicons name={dark ? "moon" : "sunny"} size={18} color={palette.violet} /></View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>Theme</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }}>{dark ? "Dark Mode" : "Light Mode"}</Text>
              </View>
              <Pressable onPress={toggle} style={{ width: 46, height: 26, borderRadius: 13, backgroundColor: dark ? palette.teal : theme.borderStrong, justifyContent: "center", paddingHorizontal: 2 }}>
                <View style={{ position: "absolute", left: dark ? 22 : 2, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" }} />
              </Pressable>
            </View>
          </View>

          {/* ── SECTION: PERMISSIONS & SYNC ── */}
          <Text style={sectionLabel}>Permissions &amp; Sync</Text>

          {/* Grouped card: Permissions + Battery + Notifications + Sync */}
          <View style={[card, shadowSoft, { padding: 0, overflow: "hidden" }]}>

            {/* Permission Health */}
            <Pressable onPress={() => !requiredGranted && requestAllPermissions().then(setPermissions)}
              style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={iconBox(requiredGranted ? palette.emerald + "1f" : palette.red + "1f")}>
                <Ionicons name="shield-checkmark-outline" size={18} color={requiredGranted ? palette.emerald : palette.red} />
              </View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>Permissions</Text>
                <Text style={{ ...TYPE.caption, color: requiredGranted ? theme.success : theme.danger, marginTop: 1 }}>
                  {requiredGranted ? "All required permissions granted ✓" : "Missing required permissions — tap to fix"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.dim} />
            </Pressable>

            {/* Battery */}
            <Pressable onPress={() => Linking.openSettings()}
              style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={iconBox(palette.amber + "1f")}><Ionicons name="battery-charging-outline" size={18} color={palette.amber} /></View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>Battery Optimization</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }}>Set to Unrestricted for reliable sync</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={palette.amber} />
            </Pressable>

            {/* Notifications */}
            <View style={{ padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.md }}>
                <View style={iconBox(palette.amber + "1f")}><Ionicons name="notifications-outline" size={18} color={palette.amber} /></View>
                <View style={{ flex: 1, marginLeft: SPACE.md }}>
                  <Text style={{ ...TYPE.title, color: theme.primary }}>Notifications</Text>
                  <Text style={{ ...TYPE.caption, color: notifPerms === "granted" ? theme.success : theme.danger, marginTop: 1 }}>
                    {notifPerms === "granted" ? "Allowed ✓" : notifPerms === "denied" ? "Blocked — open Settings" : "Not yet requested"}
                  </Text>
                </View>
                {notifPerms !== "granted" && (
                  <Pressable onPress={() => Linking.openSettings()} style={{ backgroundColor: palette.amber + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 5 }}>
                    <Text style={{ ...TYPE.label, color: palette.amber }}>Fix</Text>
                  </Pressable>
                )}
              </View>
              {[
                { key: "calls",         label: "Call detected / synced",  icon: "call-outline" },
                { key: "sync",          label: "Sync progress",           icon: "sync-outline" },
                { key: "recording",     label: "Recording upload",        icon: "mic-outline" },
                { key: "transcription", label: "Transcription complete",  icon: "sparkles-outline" },
              ].map((p) => (
                <View key={p.key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: SPACE.sm, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                    <Ionicons name={p.icon} size={15} color={theme.muted} />
                    <Text style={{ ...TYPE.body, color: theme.secondary }}>{p.label}</Text>
                  </View>
                  <Switch value={notifPrefs[p.key]} onValueChange={async (val) => { await setNotificationPreference(p.key, val); setNotifPrefs((prev) => ({ ...prev, [p.key]: val })); }} trackColor={{ false: theme.border, true: palette.teal + "88" }} thumbColor={notifPrefs[p.key] ? palette.teal : theme.muted} />
                </View>
              ))}
            </View>

            {/* Sync Now */}
            <Pressable onPress={handleSync} disabled={syncing}
              style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg }}>
              <View style={iconBox(palette.teal + "1a")}>
                {syncing ? <ActivityIndicator size="small" color={palette.teal} /> : <Ionicons name="cloud-upload-outline" size={18} color={palette.teal} />}
              </View>
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>Sync Calls Now</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }}>
                  {syncing ? "Syncing…" : syncResult ? `✓ ${syncResult.accepted} new · ${syncResult.duplicates} duplicates` : lastSync ? `Last synced: ${lastSync}` : "Auto-syncs while the app is active"}
                </Text>
              </View>
              {!syncing && <Ionicons name="chevron-forward" size={18} color={palette.teal} />}
            </Pressable>
          </View>

          {/* ── SECTION: ABOUT ── */}
          <Text style={sectionLabel}>About</Text>

          <View style={[card, shadowSoft, { padding: 0, overflow: "hidden" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", padding: SPACE.lg }}>
              <Image source={require("../../assets/logo.png")} style={{ width: 38, height: 38, borderRadius: RADIUS.md }} resizeMode="contain" />
              <View style={{ flex: 1, marginLeft: SPACE.md }}>
                <Text style={{ ...TYPE.title, color: theme.primary }}>CallNexa</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }}>v1.1.0 · {e.companyName}</Text>
              </View>
            </View>
          </View>

          {/* ── Sign out ── */}
          <Pressable onPress={handleSignOut}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm,
              paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: theme.danger + "44",
              backgroundColor: theme.dangerSoft, marginBottom: SPACE.sm }}>
            <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            <Text style={{ ...TYPE.bodyBold, color: theme.danger }}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>


      {/* SIM Change Alert */}
      {simChangeAlert && (
        <Modal visible={true} transparent animationType="fade">
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: 24 }}>
            <View style={{ backgroundColor: theme.bg, borderRadius: 20, padding: 24, width: "100%", maxWidth: 360, borderWidth: 1, borderColor: palette.amber + "55" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Ionicons name="warning-outline" size={24} color={palette.amber} />
                <Text style={{ fontSize: 17, fontWeight: "800", color: theme.primary }}>SIM Changed</Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 12, lineHeight: 20 }}>
                Your previously selected SIM is no longer detected.
              </Text>
              <View style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.dim, marginBottom: 4 }}>PREVIOUS</Text>
                <Text style={{ fontSize: 13, color: palette.red }}>SIM {simChangeAlert.previous?.slot != null ? simChangeAlert.previous.slot + 1 : "?"} — {simChangeAlert.previous?.carrierName || "Unknown"}</Text>
              </View>
              {simChangeAlert.current && (
                <View style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: theme.border }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: theme.dim, marginBottom: 4 }}>NOW IN SAME SLOT</Text>
                  <Text style={{ fontSize: 13, color: palette.teal }}>SIM {simChangeAlert.current?.slot != null ? simChangeAlert.current.slot + 1 : "?"} — {simChangeAlert.current?.carrierName || "Unknown"}</Text>
                </View>
              )}
              <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 16, lineHeight: 18 }}>
                Please reselect your CallNexa SIM to avoid syncing calls to the wrong SIM.
              </Text>
              <Pressable onPress={() => { setSimChangeAlert(null); setSimOpen(true); }}
                style={{ backgroundColor: palette.amber, borderRadius: 12, padding: 14, alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Reselect SIM</Text>
              </Pressable>
              <Pressable onPress={() => setSimChangeAlert(null)} style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 13, color: theme.dim }}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} onSaved={handleProfileSaved} user={user} theme={theme} />
      <SimConfigModal visible={simOpen} onClose={() => setSimOpen(false)} sims={sims} selectedSim={selectedSim} onSelectSim={async (sim) => {
          setSelectedSim(sim);
          const { saveSimSelection, clearSimSelection } = require('../../src/simSelectionService');
          const { runSyncCycle } = require('../../src/syncService');
          
          // 1. Save selection locally
          if (sim) { 
            await saveSimSelection(sim); 
          } else { 
            await clearSimSelection(); 
          }
          
          // 2. Sync to backend (update is_selected flag in database)
          try {
            const deviceId = await AsyncStorage.getItem("callos_device_id");
            if (deviceId && sims.length > 0) {
              // Map all SIMs with updated is_selected flag
              const updatedSims = sims.map(s => ({
                slot: s.slot,
                carrier: s.carrierName || null,
                display_name: s.display_name || `SIM ${s.slot + 1}`,
                phone_number: s.phoneNumber || null,
                mcc: s.mcc || null,
                mnc: s.mnc || null,
                country_iso: s.countryIso || null,
                subscription_id: s.subscriptionId || null,
                network_type: s.networkType || null,
                is_active: true,
                is_selected: sim 
                  ? (sim.subscriptionId ? s.subscriptionId === sim.subscriptionId : s.slot === sim.slot)
                  : false  // "All SIMs" mode = no SIM selected
              }));
              
              await api.syncSims(deviceId, updatedSims);
              console.log("[SIM_SELECTION_SYNCED] device=" + deviceId + " selected=" + (sim ? `slot ${sim.slot}` : "all"));
              
              // 3. Trigger immediate re-sync with new SIM filter
              runSyncCycle(deviceId, "reconcile").catch(e => 
                console.warn("[SIM_CHANGE_RESYNC_FAILED]", e)
              );
            }
          } catch (err) {
            console.error("[SIM_SYNC_TO_BACKEND_FAILED]", err);
            Alert.alert("Warning", "SIM selection saved locally, but could not sync to dashboard. Changes will sync on next heartbeat.");
          }
          
          setSimOpen(false);
        }} theme={theme} />
    </SafeAreaView>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────
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
      Alert.alert("Saved ✓", "Profile updated successfully.");
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

// ── SIM Config Modal ──────────────────────────────────────────────────────────
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
                const on = selectedSim && (selectedSim.subscriptionId ? selectedSim.subscriptionId === s.subscriptionId : selectedSim.slot === s.slot);
                return (
                  <Pressable key={s.slot} onPress={() => onSelectSim(s)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, borderWidth: 2,
                      borderColor: on ? palette.teal : theme.border,
                      backgroundColor: on ? palette.teal + "12" : theme.surface }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: on ? palette.teal + "22" : theme.bg, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="phone-portrait-outline" size={20} color={on ? palette.teal : theme.muted} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: on ? palette.teal : theme.primary }}>SIM {s.display_slot ?? (s.slot + 1)}</Text>
                      {s.carrierName ? <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>{s.carrierName}</Text> : null}
                      {s.phoneNumber ? <Text style={{ fontSize: 12, color: theme.muted }}>{s.phoneNumber}</Text> : <Text style={{ fontSize: 11, color: theme.dim }}>Phone number not available</Text>}
                      {s.networkType && s.networkType !== "UNKNOWN" ? <Text style={{ fontSize: 11, color: theme.dim }}>{s.networkType}{s.countryIso ? " · " + s.countryIso.toUpperCase() : ""}</Text> : null}
                      {s.subscriptionId ? <Text style={{ fontSize: 10, color: theme.dim }}>Sub ID: {s.subscriptionId}</Text> : null}
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

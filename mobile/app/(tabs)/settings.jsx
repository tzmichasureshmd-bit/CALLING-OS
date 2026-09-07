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
  const [deviceInfo, setDeviceInfo]       = useState({});
  const [stats, setStats]                 = useState({ totalCalls: "—", connectedPct: "—", talkTime: "—" });
  const [editOpen, setEditOpen]           = useState(false);
  const [simOpen, setSimOpen]             = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const [perms, simList, ts, recPref] = await Promise.all([
      checkPermissions(),
      readSimInfo(),
      AsyncStorage.getItem(LAST_SYNC_KEY),
      AsyncStorage.getItem(RECORDING_PREF_KEY),
    ]);
    setPermissions(perms);
    if (simList.length) setSims(simList);
    setDeviceInfo(getDeviceInfo());
    setRecordingEnabled(recPref === "true");
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
      const result = await syncCalls();
      setSyncResult(result);
      const now = Date.now();
      await AsyncStorage.setItem(LAST_SYNC_KEY, String(now));
      setLastSync(new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }));
      Alert.alert("Sync Complete", `✓ ${result.accepted} new · ${result.duplicates} duplicates`);
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
        "Please enable this permission in your device Settings → Apps → CallNexa → Permissions.",
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
          "Go to Settings → Apps → CallNexa → Permissions → Microphone and enable it.",
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

  // Storage: Android 13+ uses READ_MEDIA_AUDIO, older uses READ_EXTERNAL_STORAGE
  // Both are requested automatically based on Android version
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
        {/* ── Profile header ── */}
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

          {/* ── SIM Configuration ── */}
          <Pressable onPress={() => setSimOpen(true)} style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16 }]}>
            <View style={iconBox(palette.teal + "1a")}><Ionicons name="phone-portrait-outline" size={18} color={theme.accent} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>SIM Configuration</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>
                {sims.length
                  ? sims.map((s) => `SIM ${s.slot + 1}${s.carrierName ? ` · ${s.carrierName}` : ""}${s.phoneNumber ? ` (${s.phoneNumber})` : ""}`).join("   ")
                  : "Tap to view SIM details"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.dim} />
          </Pressable>

          {/* ── Device Info ── */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={iconBox(palette.violet + "1f")}><Ionicons name="hardware-chip-outline" size={18} color={palette.violet} /></View>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Device</Text>
            </View>
            {[
              { label: "Model",        value: deviceInfo.model || "—" },
              { label: "Manufacturer", value: deviceInfo.manufacturer || "—" },
              { label: "Android",      value: deviceInfo.androidVersion || "—" },
            ].map((r) => (
              <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 }}>
                <Text style={{ fontSize: 13, color: theme.muted }}>{r.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>{r.value}</Text>
              </View>
            ))}
          </View>

          {/* ── Permission Health ── */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <View style={iconBox(requiredGranted ? palette.emerald + "1f" : palette.red + "1f")}>
                <Ionicons name="shield-checkmark-outline" size={18} color={requiredGranted ? palette.emerald : palette.red} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Permission Health</Text>
                <Text style={{ fontSize: 12.5, color: requiredGranted ? theme.success : theme.danger, marginTop: 1 }}>
                  {requiredGranted ? "Required permissions granted ✓" : "Required permissions missing — tap to fix"}
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

          {/* ── Call Recording Toggle ── */}
          <View style={[card, shadowSoft]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={iconBox(palette.violet + "1f")}><Ionicons name="mic-outline" size={18} color={palette.violet} /></View>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>Call Recording</Text>
                  <Text style={{ fontSize: 12, color: theme.muted, marginTop: 1 }}>
                    {recordingEnabled ? "Recording enabled · saves to dashboard" : "Off · calls not recorded"}
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
                  ✓ Recorded calls will be saved and available for AI transcription on the web dashboard.{"\n"}Only calls with recordings will be transcribed — saves storage & DB space.
                </Text>
              </View>
            )}
          </View>

          {/* ── Sync Now ── */}
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
                    ? `✓ ${syncResult.accepted} new · ${syncResult.duplicates} duplicates`
                    : lastSync
                      ? `Last synced: ${lastSync}`
                      : "Auto-syncs every 5s · tap to sync now"}
              </Text>
            </View>
            {!syncing && <Ionicons name="chevron-forward" size={20} color={palette.teal} />}
          </Pressable>

          {/* ── Theme toggle ── */}
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

          {/* ── App info ── */}
          <View style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", padding: 16 }]}>
            <Image source={require("../../assets/logo.png")} style={{ width: 38, height: 38, borderRadius: 10 }} resizeMode="contain" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>CallNexa</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>v1.0.0 · {e.companyName}</Text>
            </View>
          </View>

          {/* ── Sign out ── */}
          <Pressable onPress={handleSignOut} style={[card, shadowSoft, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderColor: theme.dangerSoft }]}>
            <Ionicons name="log-out-outline" size={18} color={theme.danger} />
            <Text style={{ fontSize: 14.5, fontWeight: "700", color: theme.danger }}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>

      <EditProfileModal visible={editOpen} onClose={() => setEditOpen(false)} onSaved={handleProfileSaved} user={user} theme={theme} />
      <SimConfigModal visible={simOpen} onClose={() => setSimOpen(false)} sims={sims} theme={theme} />
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
function SimConfigModal({ visible, onClose, sims, theme }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>SIM Configuration</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
          </View>
          {sims.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 32, gap: 12 }}>
              <Ionicons name="phone-portrait-outline" size={48} color={theme.dim} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.primary }}>No SIM detected</Text>
              <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", lineHeight: 20 }}>
                SIM details will appear here once the app reads your device SIM cards.{"\n"}Make sure Phone State permission is granted.
              </Text>
            </View>
          ) : sims.map((s, i) => (
            <View key={i} style={{ backgroundColor: theme.surface, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: palette.teal + "1a", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="phone-portrait-outline" size={18} color={palette.teal} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary }}>SIM {s.slot + 1}</Text>
                <View style={{ backgroundColor: palette.emerald + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: palette.emerald }}>Active</Text>
                </View>
              </View>
              {[
                { label: "Phone Number", value: s.phoneNumber || "Reading from device..." },
                { label: "Carrier",      value: s.carrierName || "Reading from device..." },
                { label: "Country",      value: s.countryIso?.toUpperCase() || "—" },
              ].map((r) => (
                <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                  <Text style={{ fontSize: 13, color: theme.muted }}>{r.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>{r.value}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

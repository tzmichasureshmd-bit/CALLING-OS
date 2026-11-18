import { useEffect, useState } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  RefreshControl, ActivityIndicator, Alert, Switch, StyleSheet, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminTheme, adminPalette, TYPE, SPACE, RADIUS, useTheme } from "../../src/theme";
import { api } from "../../src/api";
import { useAuth } from "../../src/AuthContext";

// C is set dynamically per component via useTheme — see main screen
let C = adminTheme;

const NAV_ITEMS = [
  { route: "/(admin)/analytics",     icon: "bar-chart-outline",        label: "Analytics",      color: "#14B8A6", desc: "Team performance & KPIs"     },
  { route: "/(admin)/calls",         icon: "call-outline",             label: "All Calls",      color: "#22C55E", desc: "Call logs & intelligence"    },
  { route: "/(admin)/follow-ups",    icon: "calendar-outline",         label: "Follow-ups",     color: "#0ABFA3", desc: "All employees' follow-ups"   },
  { route: "/(admin)/leads",         icon: "person-add-outline",       label: "Leads",          color: "#8B5CF6", desc: "Hot & warm leads"            },
  { route: "/(admin)/opportunities", icon: "trending-up-outline",      label: "Opportunities",  color: "#F59E0B", desc: "Active pipeline"             },
  { route: "/(admin)/customers",     icon: "people-outline",           label: "Customers",      color: "#06B6D4", desc: "Customer profiles"           },
  { route: "/(admin)/employees",     icon: "person-circle-outline",    label: "Employees",      color: "#EF4444", desc: "Manage team members"         },
  { route: "/(admin)/device-health",  icon: "phone-portrait-outline",   label: "Device Health",  color: "#06B6D4", desc: "Monitor employee devices"    },
  { route: "/(admin)/reports",       icon: "document-text-outline",    label: "Reports",        color: "#10B981", desc: "Charts & team summary"       },
];

// ── Shared Card ───────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <View style={[{
      backgroundColor: C.card, borderRadius: RADIUS.card,
      borderWidth: 1, borderColor: C.border, padding: SPACE.lg,
      marginBottom: SPACE.lg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
    }, style]}>
      {children}
    </View>
  );
}

function SectionHead({ icon, title, subtitle }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.lg }}>
      <View style={{ width: 32, height: 32, borderRadius: RADIUS.sm,
        backgroundColor: adminPalette.primary + "22", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={16} color={adminPalette.primary} />
      </View>
      <View>
        <Text style={{ ...TYPE.h3, color: C.primary }}>{title}</Text>
        {subtitle && <Text style={{ ...TYPE.micro, color: C.muted, marginTop: 1 }}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={{ paddingVertical: SPACE.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <Text style={{ ...TYPE.micro, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ ...TYPE.body, color: C.primary, marginTop: 2 }}>{value || "—"}</Text>
    </View>
  );
}

function RowToggle({ icon, label, value, onValueChange }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingVertical: SPACE.sm, borderBottomWidth: 1, borderBottomColor: C.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <Ionicons name={icon} size={18} color={C.muted} />
        <Text style={{ ...TYPE.body, color: C.primary }}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange}
        trackColor={{ false: C.border, true: adminPalette.primary }}
        thumbColor="#fff" />
    </View>
  );
}

// ── Edit Profile Modal ────────────────────────────────────────────────────────
function EditProfileModal({ user, onClose, onSaved }) {
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Name cannot be empty"); return; }
    setSaving(true); setErr("");
    try {
      await api.updateProfile({ name: name.trim() });
      onSaved(name.trim()); onClose();
    } catch (e) { setErr(e?.message || "Could not update profile"); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible animationType="slide" transparent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: SPACE.xl, paddingBottom: 40, position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: SPACE.lg }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.lg }}>
          <Text style={{ ...TYPE.h3, color: C.primary }}>Edit profile</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
        </View>
        <Text style={{ ...TYPE.label, color: C.muted, marginBottom: SPACE.xs }}>FULL NAME</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Your name"
          placeholderTextColor={C.dim}
          style={{ backgroundColor: C.bg, borderRadius: RADIUS.md, borderWidth: 1,
            borderColor: C.border, padding: SPACE.md, ...TYPE.body, color: C.primary, marginBottom: SPACE.md }} />
        {err ? <Text style={{ ...TYPE.caption, color: "#EF4444", marginBottom: SPACE.sm }}>{err}</Text> : null}
        <Pressable onPress={save} disabled={saving}
          style={{ backgroundColor: adminPalette.primary, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: "center" }}>
          <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>{saving ? "Saving..." : "Save changes"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  async function submit() {
    setErr("");
    if (next.length < 8) { setErr("New password must be at least 8 characters"); return; }
    if (next !== confirm) { setErr("Passwords do not match"); return; }
    setSaving(true);
    try {
      await api.changePassword({ current_password: current, new_password: next });
      setOk(true);
    } catch (e) { setErr(e?.message || "Could not change password"); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible animationType="slide" transparent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: SPACE.xl, paddingBottom: 40, position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: SPACE.lg }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.lg }}>
          <Text style={{ ...TYPE.h3, color: C.primary }}>Change password</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
        </View>
        {ok ? (
          <View style={{ alignItems: "center", paddingVertical: SPACE.xl }}>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text style={{ ...TYPE.bodyBold, color: C.primary, marginTop: SPACE.md }}>Password changed!</Text>
            <Pressable onPress={onClose} style={{ marginTop: SPACE.lg, backgroundColor: adminPalette.primary,
              borderRadius: RADIUS.md, padding: SPACE.md, paddingHorizontal: SPACE.xl }}>
              <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {[
              { label: "CURRENT PASSWORD", value: current, set: setCurrent },
              { label: "NEW PASSWORD", value: next, set: setNext },
              { label: "CONFIRM NEW PASSWORD", value: confirm, set: setConfirm },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: SPACE.md }}>
                <Text style={{ ...TYPE.label, color: C.muted, marginBottom: SPACE.xs }}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.set} secureTextEntry
                  placeholderTextColor={C.dim} placeholder="••••••••"
                  style={{ backgroundColor: C.bg, borderRadius: RADIUS.md, borderWidth: 1,
                    borderColor: C.border, padding: SPACE.md, ...TYPE.body, color: C.primary }} />
              </View>
            ))}
            {err ? <Text style={{ ...TYPE.caption, color: "#EF4444", marginBottom: SPACE.sm }}>{err}</Text> : null}
            <Pressable onPress={submit} disabled={saving}
              style={{ backgroundColor: adminPalette.primary, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: "center" }}>
              <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>{saving ? "Saving..." : "Change password"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </Modal>
  );
}

function AppMenuCard({ router }) {
  const [open, setOpen] = useState(false);
  return (
    <Card style={{ padding: 0 }}>
      <Pressable onPress={() => setOpen(o => !o)}
        style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", padding: SPACE.lg }}>
        <View style={{ flexDirection:"row", alignItems:"center", gap: SPACE.sm }}>
          <View style={{ width:32, height:32, borderRadius:RADIUS.sm, backgroundColor:adminPalette.primary+"22", alignItems:"center", justifyContent:"center" }}>
            <Ionicons name="grid-outline" size={16} color={adminPalette.primary} />
          </View>
          <View>
            <Text style={{ ...TYPE.h3, color:C.primary }}>App Menus</Text>
            <Text style={{ ...TYPE.micro, color:C.muted, marginTop:1 }}>{open ? "Tap to collapse" : `${NAV_ITEMS.length} sections available`}</Text>
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={20} color={C.muted} />
      </Pressable>
      {open && NAV_ITEMS.map((item) => (
        <Pressable key={item.route} onPress={() => router.push(item.route)}
          style={({ pressed }) => ({
            flexDirection:"row", alignItems:"center", gap:SPACE.md,
            paddingHorizontal:SPACE.lg, paddingVertical:SPACE.md,
            borderTopWidth:1, borderTopColor:C.border,
            opacity: pressed ? 0.7 : 1,
          })}>
          <View style={{ width:38, height:38, borderRadius:RADIUS.md,
            backgroundColor:item.color+"18", alignItems:"center", justifyContent:"center" }}>
            <Ionicons name={item.icon} size={18} color={item.color} />
          </View>
          <View style={{ flex:1 }}>
            <Text style={{ ...TYPE.body, color:C.primary, fontWeight:"600" }}>{item.label}</Text>
            {item.desc && <Text style={{ ...TYPE.micro, color:C.muted, marginTop:1 }}>{item.desc}</Text>}
          </View>
          <Ionicons name="chevron-forward" size={16} color={C.dim} />
        </Pressable>
      ))}
    </Card>
  );
}
export default function AdminSettings() {
  const { user, logout, setUser } = useAuth();
  const router = useRouter();
  const { theme, isDark, toggleDark } = useTheme();
  C = theme; // make all sub-components use the live theme
  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [notifications, setNotifications] = useState(true);

  async function load() {
    try { setOrg(await api.getOrganization()); }
    catch { }
    finally { setLoading(false); setRefreshing(false); }
  }
  useEffect(() => { load(); }, []);

  async function regenerateCode() {
    Alert.alert("Regenerate code?", "The current code will stop working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Regenerate", style: "destructive", onPress: async () => {
        try {
          const res = await api.regenerateCompanyCode();
          setOrg(o => ({ ...o, company_code: res.code, code: res.code }));
          Alert.alert("New code ready", res.code || "Code updated.");
        } catch (e) { Alert.alert("Error", e?.message || "Try again."); }
      }},
    ]);
  }

  function signOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/intro"); } },
    ]);
  }

  const initials = (user?.name || user?.email || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const companyCode = org?.company_code || org?.code || user?.organization_code || "—";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={adminPalette.primary} />}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 120 }}>

        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.xl }}>
          <View>
            <Text style={{ ...TYPE.caption, color: C.muted }}>Company workspace</Text>
            <Text style={{ ...TYPE.h2, color: C.primary }}>{org?.name || user?.organization_name || "Settings"}</Text>
          </View>
          <View style={{ width: 44, height: 44, borderRadius: RADIUS.full,
            backgroundColor: adminPalette.primary + "22", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="settings-outline" size={22} color={adminPalette.primary} />
          </View>
        </View>

        {/* Profile card */}
        <Card>
          <SectionHead icon="person-outline" title="Profile" subtitle="Your account" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}>
            <LinearGradient colors={[adminPalette.primary, adminPalette.navyLight || "#3B5A8F"]}
              style={{ width: 52, height: 52, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>{initials}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={{ ...TYPE.h3, color: C.primary }}>{user?.name || "—"}</Text>
              <Text style={{ ...TYPE.caption, color: C.muted }}>{user?.email || "—"}</Text>
              <View style={{ backgroundColor: adminPalette.primary + "22", borderRadius: RADIUS.full,
                paddingHorizontal: SPACE.sm, paddingVertical: 2, alignSelf: "flex-start", marginTop: 4 }}>
                <Text style={{ ...TYPE.micro, color: adminPalette.primary, fontWeight: "700" }}>{user?.role || "ADMIN"}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            <Pressable onPress={() => setShowEditProfile(true)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: SPACE.sm, padding: SPACE.sm, borderRadius: RADIUS.md,
                borderWidth: 1, borderColor: C.border, backgroundColor: C.bg }}>
              <Ionicons name="pencil-outline" size={15} color={C.primary} />
              <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "700" }}>Edit profile</Text>
            </Pressable>
            <Pressable onPress={() => setShowChangePassword(true)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: SPACE.sm, padding: SPACE.sm, borderRadius: RADIUS.md,
                borderWidth: 1, borderColor: C.border, backgroundColor: C.bg }}>
              <Ionicons name="lock-closed-outline" size={15} color={C.primary} />
              <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "700" }}>Password</Text>
            </Pressable>
          </View>
        </Card>

        {/* Organization */}
        {loading ? <ActivityIndicator color={adminPalette.primary} style={{ marginBottom: SPACE.lg }} /> : (
          <Card>
            <SectionHead icon="business-outline" title="Organization" subtitle="Company account details" />
            <InfoRow label="Company name" value={org?.name} />
            <InfoRow label="Email" value={org?.email} />
            <InfoRow label="Status" value={org?.status || "active"} />
          </Card>
        )}

        {/* Connect code */}
        <Card style={{ backgroundColor: adminPalette.primaryLight || "#F0FECB" }}>
          <SectionHead icon="qr-code-outline" title="Employee connect code" subtitle="Share with employees to join your workspace" />
          <View style={{ backgroundColor: C.card, borderRadius: RADIUS.lg, padding: SPACE.lg,
            alignItems: "center", marginBottom: SPACE.md, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ fontSize: 28, fontWeight: "900", letterSpacing: 3, color: C.primary }}>{companyCode}</Text>
          </View>
          <Pressable onPress={regenerateCode}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center",
              gap: SPACE.sm, padding: SPACE.md, borderRadius: RADIUS.md,
              borderWidth: 1, borderColor: adminPalette.primary, backgroundColor: C.card }}>
            <Ionicons name="refresh-outline" size={16} color={adminPalette.primary} />
            <Text style={{ ...TYPE.bodyBold, color: adminPalette.primary }}>Regenerate code</Text>
          </Pressable>
        </Card>

        <AppMenuCard router={router} />

        {/* Preferences */}
        <Card>
          <SectionHead icon="options-outline" title="Preferences" />
          <RowToggle icon={isDark ? "moon" : "sunny-outline"} label="Dark mode" value={isDark} onValueChange={toggleDark} />
          <RowToggle icon="notifications-outline" label="Notifications" value={notifications} onValueChange={setNotifications} />
        </Card>

        {/* Sign out */}
        <Pressable onPress={signOut}
          style={({ pressed }) => ({
            flexDirection: "row", alignItems: "center", justifyContent: "center",
            gap: SPACE.sm, padding: SPACE.lg, borderRadius: RADIUS.card,
            backgroundColor: "#FEF2F2", borderWidth: 1.5, borderColor: "#EF4444",
            marginBottom: SPACE.lg, opacity: pressed ? 0.75 : 1,
          })}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#EF4444" }}>Sign out</Text>
        </Pressable>

        <Text style={{ ...TYPE.micro, color: C.muted, textAlign: "center", marginBottom: SPACE.lg }}>
          CallNexa · Admin
        </Text>
      </ScrollView>

      {showEditProfile && (
        <EditProfileModal user={user} onClose={() => setShowEditProfile(false)}
          onSaved={(name) => { if (setUser) setUser(u => ({ ...u, name })); }} />
      )}
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </SafeAreaView>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

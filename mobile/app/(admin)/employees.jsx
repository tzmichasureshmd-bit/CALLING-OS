import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { adminTheme, adminPalette, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const C = adminTheme;

const RANGES = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "Week" },
  { key: "30d",       label: "Month" },
];

function fmtDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDuration(s) {
  if (!s) return "0m";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Shared Card ───────────────────────────────────────────────────────────────
function Card({ children, style, padding }) {
  return (
    <View style={[
      { backgroundColor: C.card, borderRadius: RADIUS.card, borderWidth: 1, borderColor: C.border,
        padding: padding !== undefined ? padding : SPACE.lg, marginBottom: SPACE.lg,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
      style,
    ]}>
      {children}
    </View>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHead({ icon, title, action, onAction }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: adminPalette.primary + "22", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={adminPalette.primary} />
        </View>
        <Text style={{ ...TYPE.h3, color: C.primary }}>{title}</Text>
      </View>
      {action && <Pressable onPress={onAction}><Text style={{ ...TYPE.caption, color: adminPalette.primary }}>{action}</Text></Pressable>}
    </View>
  );
}

// ── Range Pills ───────────────────────────────────────────────────────────────
function RangePills({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: SPACE.sm }}>
      {RANGES.map((r) => {
        const active = value === r.key;
        return (
          <Pressable key={r.key} onPress={() => onChange(r.key)}
            style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full,
              backgroundColor: active ? adminPalette.primary : C.card,
              borderWidth: 1, borderColor: active ? adminPalette.primary : C.border }}>
            <Text style={{ ...TYPE.caption, color: active ? "#fff" : C.muted }}>{r.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <View style={{ width: "48%", backgroundColor: C.card, borderRadius: RADIUS.card,
      borderWidth: 1, borderColor: C.border, padding: SPACE.md,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm }}>
        <Text style={{ ...TYPE.label, color: C.muted, textTransform: "uppercase" }}>{label}</Text>
        <View style={{ width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
      </View>
      <Text style={{ fontSize: 26, fontWeight: "800", color: C.primary, lineHeight: 32 }}>{value}</Text>
      {sub ? <Text style={{ ...TYPE.micro, color: C.muted, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

// ── Add Employee Modal ────────────────────────────────────────────────────────
function AddEmployeeModal({ onClose, onAdded }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim() || !email.trim()) { setErr("Name and email are required"); return; }
    setSaving(true); setErr("");
    try {
      await api.createEmployee({ name: name.trim(), email: email.trim(), phone: phone.trim() || null });
      onAdded(); onClose();
    } catch (e) { setErr(e?.message || "Failed to add employee"); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible animationType="slide" transparent>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: SPACE.xl, paddingBottom: 40, position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: SPACE.lg }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.lg }}>
          <Text style={{ ...TYPE.h3, color: C.primary }}>Register employee</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
        </View>
        {[
          { label: "FULL NAME", value: name, set: setName, placeholder: "Rahul Sharma", keyboard: "default" },
          { label: "EMAIL", value: email, set: setEmail, placeholder: "rahul@company.com", keyboard: "email-address" },
          { label: "PHONE (OPTIONAL)", value: phone, set: setPhone, placeholder: "+91 98765 43210", keyboard: "phone-pad" },
        ].map((f) => (
          <View key={f.label} style={{ marginBottom: SPACE.md }}>
            <Text style={{ ...TYPE.label, color: C.muted, marginBottom: SPACE.xs }}>{f.label}</Text>
            <TextInput value={f.value} onChangeText={f.set} placeholder={f.placeholder}
              placeholderTextColor={C.dim} keyboardType={f.keyboard} autoCapitalize="none"
              style={{ backgroundColor: C.surface2 || C.bg, borderRadius: RADIUS.md, borderWidth: 1,
                borderColor: C.border, padding: SPACE.md, ...TYPE.body, color: C.primary }} />
          </View>
        ))}
        {err ? <Text style={{ ...TYPE.caption, color: "#EF4444", marginBottom: SPACE.sm }}>{err}</Text> : null}
        <Pressable onPress={submit} disabled={saving}
          style={{ backgroundColor: adminPalette.primary, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: "center" }}>
          <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>{saving ? "Adding..." : "Register employee"}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// ── Employee Detail Modal ─────────────────────────────────────────────────────
function EmployeeDetailModal({ employee, range, onClose, onStatusChanged }) {
  const [detailRange, setDetailRange] = useState(range);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [calls, setCalls] = useState([]);
  const [updating, setUpdating] = useState(false);

  useEffect(() => { setDetailRange(range); }, [range]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setOverview(null);
    setCalls([]);
    console.log("[EmpDetail] fetching id:", employee.id, "range:", detailRange);
    Promise.all([
      api.getCalls({ employee_id: employee.id, page_size: 20 }).catch((e) => { console.log("[EmpDetail] calls error:", e?.message); return { items: [] }; }),
      api.getEmployeeAnalytics(employee.id, detailRange).catch((e) => { console.log("[EmpDetail] analytics error:", e?.message); return null; }),
    ]).then(([callData, analyticsData]) => {
      if (!active) return;
      console.log("[EmpDetail] calls:", callData?.items?.length, "analytics kpis:", analyticsData?.kpis);
      setCalls(callData?.items || []);
      setOverview(analyticsData);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [employee.id, detailRange]);

  async function toggleStatus() {
    const next = employee.status === "active" ? "trashed" : "active";
    setUpdating(true);
    try {
      await api.updateEmployee(employee.id, { status: next });
      onStatusChanged(); onClose();
    } catch (e) { Alert.alert("Error", e?.message || "Could not update status"); }
    finally { setUpdating(false); }
  }

  const kpis = overview?.kpis || {};
  const devices = overview?.devices || overview?.employee?.devices || [];
  const empProfile = overview?.employee || employee;
  const initials = (empProfile.name || employee.name)?.split(" ").map((p) => p[0]).slice(0, 2).join("") || "?";
  const isActive = (empProfile.status || employee.status) === "active";

  return (
    <Modal visible animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: C.border }}>
          <Pressable onPress={onClose}><Ionicons name="chevron-back" size={24} color={adminPalette.primary} /></Pressable>
          <Text style={{ ...TYPE.h3, color: C.primary, flex: 1, marginLeft: SPACE.sm }}>{employee.name}</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 60 }}>
          {/* Profile card */}
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <LinearGradient colors={[adminPalette.primary, adminPalette.navyLight || "#3B5A8F"]}
                style={{ width: 56, height: 56, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>{initials}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.h3, color: C.primary }}>{empProfile.name || employee.name}</Text>
                <Text style={{ ...TYPE.caption, color: C.muted }}>{empProfile.email || employee.email}</Text>
                <Text style={{ ...TYPE.caption, color: C.muted }}>{empProfile.phone || employee.phone || employee.mobile || "No phone"}</Text>
              </View>
              <View style={{ backgroundColor: isActive ? "#22C55E22" : "#EF444422",
                borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
                <Text style={{ ...TYPE.micro, color: isActive ? "#22C55E" : "#EF4444", fontWeight: "700" }}>
                  {isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: SPACE.sm, marginTop: SPACE.md }}>
              <Text style={{ ...TYPE.micro, color: C.muted }}>Joined {fmtDate(empProfile.created_at || employee.created_at || employee.registeredDate)}</Text>
              {(empProfile.employee_code || employee.employee_code) ? <Text style={{ ...TYPE.micro, color: C.muted }}>· Code: {empProfile.employee_code || employee.employee_code}</Text> : null}
            </View>
          </Card>

          {/* Range + Performance */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
            <Text style={{ ...TYPE.h3, color: C.primary }}>Performance</Text>
            <RangePills value={detailRange} onChange={setDetailRange} />
          </View>

          {loading ? (
            <ActivityIndicator color={adminPalette.primary} size="large" style={{ marginVertical: SPACE.xl }} />
          ) : (
            <>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>
                <KpiCard icon="call-outline" label="Total Calls" value={kpis.total_calls ?? 0} sub={`${kpis.incoming ?? 0} in / ${kpis.outgoing ?? 0} out`} color={adminPalette.primary} />
                <KpiCard icon="checkmark-circle-outline" label="Connected" value={`${kpis.connected_pct ?? 0}%`} sub={`${kpis.connected ?? 0} conversations`} color="#14B8A6" />
                <KpiCard icon="time-outline" label="Talk Time" value={fmtDuration(kpis.talk_time_seconds ?? 0)} sub={`Avg ${fmtDuration(kpis.avg_duration_seconds ?? 0)}`} color="#F59E0B" />
                <KpiCard icon="call-sharp" label="Missed" value={kpis.missed ?? 0} sub={`${kpis.rejected ?? 0} rejected`} color="#EF4444" />
              </View>

              {devices.length > 0 && (
                <Card>
                  <SectionHead icon="phone-portrait-outline" title="Devices" />
                  {devices.map((d) => (
                    <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md,
                      borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm }}>
                      <Ionicons name="phone-portrait-outline" size={18} color={adminPalette.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "600" }}>{d.manufacturer || "Device"} {d.model || ""}</Text>
                        <Text style={{ ...TYPE.micro, color: C.muted }}>Android {d.android_version || "—"} · App {d.app_version || "—"}</Text>
                      </View>
                      <View style={{ backgroundColor: d.is_online ? "#22C55E22" : "#EF444422",
                        borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 2 }}>
                        <Text style={{ ...TYPE.micro, color: d.is_online ? "#22C55E" : "#EF4444" }}>{d.is_online ? "Online" : "Offline"}</Text>
                      </View>
                    </View>
                  ))}
                </Card>
              )}

              <Card padding={0}>
                <View style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
                  <SectionHead icon="call-outline" title="Recent calls" />
                </View>
                {calls.length === 0 ? (
                  <Text style={{ ...TYPE.caption, color: C.muted, textAlign: "center", padding: SPACE.xl }}>No calls in this period</Text>
                ) : calls.slice(0, 15).map((c) => {
                  const callType = c.call_type || c.type || "unknown";
                  const contact  = c.contact_name || c.contact || c.phone_number || "Unknown";
                  const callDate = c.start_time || c.date || c.started_at;
                  const duration = c.duration_seconds || c.durationSeconds || 0;
                  const typeColor = callType === "incoming" ? "#14B8A6"
                    : callType === "outgoing" ? adminPalette.primary
                    : callType === "missed"   ? "#EF4444" : "#9CA3AF";
                  const typeIcon  = callType === "outgoing" ? "arrow-up-outline"
                    : callType === "missed"   ? "call-outline" : "call-outline";
                  return (
                    <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md,
                      paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
                      borderTopWidth: 1, borderTopColor: C.border }}>
                      <View style={{ width: 34, height: 34, borderRadius: RADIUS.full,
                        backgroundColor: typeColor + "18", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name={typeIcon} size={14} color={typeColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...TYPE.bodyBold, color: C.primary }} numberOfLines={1}>{contact}</Text>
                        <Text style={{ ...TYPE.micro, color: C.muted, marginTop: 2 }}>
                          {fmtDate(callDate)}
                        </Text>
                        <View style={{ backgroundColor: typeColor + "18", borderRadius: RADIUS.full,
                          paddingHorizontal: 6, paddingVertical: 1, alignSelf: "flex-start", marginTop: 2 }}>
                          <Text style={{ ...TYPE.micro, color: typeColor, fontWeight: "700", textTransform: "capitalize" }}>{callType}</Text>
                        </View>
                      </View>
                      <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "700" }}>
                        {fmtDuration(duration)}
                      </Text>
                    </View>
                  );
                })}
              </Card>
            </>
          )}

          <Pressable onPress={toggleStatus} disabled={updating}
            style={{ backgroundColor: isActive ? "#EF444422" : "#22C55E22",
              borderRadius: RADIUS.md, padding: SPACE.md,
              flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm }}>
            <Ionicons name={isActive ? "person-remove-outline" : "person-add-outline"} size={16}
              color={isActive ? "#EF4444" : "#22C55E"} />
            <Text style={{ ...TYPE.bodyBold, color: isActive ? "#EF4444" : "#22C55E" }}>
              {updating ? "Saving..." : isActive ? "Deactivate employee" : "Restore employee"}
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function EmployeeCard({ employee, stat, onPress }) {
  const initials = employee.name?.split(" ").map((p) => p[0]).slice(0, 2).join("") || "?";
  const isActive = employee.status === "active";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      flexDirection: "row", alignItems: "center", gap: SPACE.md,
      backgroundColor: C.card, borderRadius: RADIUS.card, borderWidth: 1,
      borderColor: isActive ? C.border : "#EF444433",
      padding: SPACE.md, marginBottom: SPACE.sm,
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
      opacity: pressed ? 0.75 : 1,
    })}>
      <LinearGradient
        colors={isActive ? [adminPalette.primary, adminPalette.navyLight || "#3B5A8F"] : ["#9CA3AF", "#6B7280"]}
        style={{ width: 42, height: 42, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>{initials}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: 2 }}>
          <Text style={{ ...TYPE.bodyBold, color: C.primary }}>{employee.name}</Text>
          {!isActive && (
            <View style={{ backgroundColor: "#EF444422", borderRadius: RADIUS.full, paddingHorizontal: 6, paddingVertical: 1 }}>
              <Text style={{ ...TYPE.micro, color: "#EF4444", fontWeight: "700" }}>Inactive</Text>
            </View>
          )}
        </View>
        <Text style={{ ...TYPE.micro, color: C.muted }}>{employee.email}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: 3 }}>
          {stat
            ? <Text style={{ ...TYPE.micro, color: C.muted }}>{stat.calls} calls · {stat.connected_pct}% connected</Text>
            : <Text style={{ ...TYPE.micro, color: C.muted }}>Joined {fmtDate(employee.created_at || employee.registeredDate)}</Text>
          }
        </View>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.dim} />
    </Pressable>
  );
}

function TeamLeaderboard({ leaderboard, employees, onSelect, loading }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? leaderboard : leaderboard.slice(0, 5);

  function handlePress(stat) {
    const found = employees.find((e) => e.id === stat.id);
    onSelect(found || { id: stat.id, name: stat.name, email: "", phone: "", mobile: "", status: "active" });
  }

  return (
    <Card padding={0} style={{ marginBottom: SPACE.lg }}>
      <View style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
        <SectionHead icon="podium-outline" title="Team performance" />
      </View>
      {loading ? (
        <ActivityIndicator color={adminPalette.primary} style={{ marginVertical: SPACE.lg }} />
      ) : leaderboard.length === 0 ? (
        <View style={{ alignItems: "center", paddingVertical: SPACE.xl }}>
          <Ionicons name="bar-chart-outline" size={32} color={C.dim} />
          <Text style={{ ...TYPE.caption, color: C.muted, marginTop: SPACE.sm, textAlign: "center" }}>No activity yet{"\n"}Performance appears after calls are synced.</Text>
        </View>
      ) : (
        <>
          {visible.map((stat, i) => {
            const initials = stat.name?.split(" ").map((p) => p[0]).slice(0, 2).join("") || "?";
            const connPct = stat.connected_pct ?? 0;
            const connColor = connPct >= 70 ? "#22C55E" : connPct >= 40 ? "#F59E0B" : "#EF4444";
            const rank = i + 1;
            return (
              <Pressable key={stat.id} onPress={() => handlePress(stat)}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: SPACE.md,
                  paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
                  borderTopWidth: 1, borderTopColor: C.border,
                  opacity: pressed ? 0.75 : 1,
                })}>
                {/* Rank */}
                <View style={{ width: 24, alignItems: "center" }}>
                  {rank <= 3
                    ? <Text style={{ fontSize: 16 }}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉"}</Text>
                    : <Text style={{ ...TYPE.caption, color: C.muted, fontWeight: "800" }}>#{rank}</Text>}
                </View>
                {/* Avatar */}
                <LinearGradient
                  colors={rank === 1 ? ["#F59E0B", "#D97706"] : [adminPalette.primary, adminPalette.navyLight || "#3B5A8F"]}
                  style={{ width: 38, height: 38, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{initials}</Text>
                </LinearGradient>
                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={{ ...TYPE.bodyBold, color: C.primary }} numberOfLines={1}>{stat.name}</Text>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: C.border, marginTop: SPACE.xs }}>
                    <View style={{ height: 4, borderRadius: 2, width: `${Math.min(connPct, 100)}%`, backgroundColor: connColor }} />
                  </View>
                  <Text style={{ ...TYPE.micro, color: connColor, marginTop: 2, fontWeight: "700" }}>{connPct}% connected</Text>
                </View>
                {/* Stats */}
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "700" }}>{stat.calls ?? 0} calls</Text>
                  <Text style={{ ...TYPE.micro, color: C.muted }}>{fmtDuration(stat.talk_time_seconds)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={C.dim} />
              </Pressable>
            );
          })}
          {leaderboard.length > 5 && (
            <Pressable onPress={() => setShowAll(v => !v)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "center",
                gap: SPACE.sm, paddingVertical: SPACE.md,
                borderTopWidth: 1, borderTopColor: C.border }}>
              <Text style={{ ...TYPE.caption, color: adminPalette.primary, fontWeight: "700" }}>
                {showAll ? "Show less" : `Show all ${leaderboard.length} agents`}
              </Text>
              <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color={adminPalette.primary} />
            </Pressable>
          )}
        </>
      )}
    </Card>
  );
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("7d");
  const [teamData, setTeamData] = useState(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState(null);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.getEmployees({ page_size: 200 });
      console.log("[Employees] loaded:", res?.items?.length, "first:", res?.items?.[0]);
      setEmployees(res?.items || []);
    } catch (e) { console.log("[Employees] error:", e?.message); setEmployees([]); }
    finally { setLoading(false); }
  }, []);

  const fetchTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const d = await api.getTeamAnalytics(range);
      console.log("[Team] kpis:", d?.kpis, "leaderboard:", d?.leaderboard?.length);
      setTeamData(d);
    } catch (e) { console.log("[Team] error:", e?.message); setTeamData(null); }
    finally { setTeamLoading(false); }
  }, [range]);

  useEffect(() => { setLoading(true); fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchEmployees(), fetchTeam()]);
    setRefreshing(false);
  };

  const leaderboard = teamData?.leaderboard || [];
  const leaderById = new Map(leaderboard.map((s) => [s.id, s]));
  const kpis = teamData?.kpis || {};
  const activeEmployees = employees.filter((e) => e.status === "active");
  const inactiveEmployees = employees.filter((e) => e.status !== "active");
  const activeCount = activeEmployees.length;
  const filtered = activeEmployees.filter((e) =>
    [e.name, e.email, e.mobile, e.phone].join(" ").toLowerCase().includes(search.toLowerCase())
  );
  const filteredInactive = inactiveEmployees.filter((e) =>
    [e.name, e.email, e.mobile, e.phone].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminPalette.primary} />}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 120 }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.xl }}>
          <View>
            <Text style={{ ...TYPE.h2, color: C.primary }}>Team overview</Text>
            <Text style={{ ...TYPE.caption, color: C.muted }}>Calls, activity & performance</Text>
          </View>
          <Pressable onPress={() => setShowAdd(true)}
            style={{ width: 40, height: 40, borderRadius: RADIUS.full, backgroundColor: adminPalette.primary, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person-add-outline" size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Range */}
        <View style={{ marginBottom: SPACE.xl }}>
          <RangePills value={range} onChange={setRange} />
        </View>

        {/* Team KPIs */}
        {teamLoading ? (
          <ActivityIndicator color={adminPalette.primary} size="large" style={{ marginBottom: SPACE.xl }} />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>
            <KpiCard icon="call-outline" label="Team Calls" value={kpis.total_calls ?? 0} sub="All employees" color={adminPalette.primary} />
            <KpiCard icon="checkmark-circle-outline" label="Connected" value={`${kpis.connected_pct ?? 0}%`} sub={`${kpis.connected ?? 0} connected`} color="#14B8A6" />
            <KpiCard icon="time-outline" label="Talk Time" value={fmtDuration(kpis.talk_time_seconds ?? 0)} sub="Selected period" color="#F59E0B" />
            <KpiCard icon="people-outline" label="Active" value={activeCount} sub={`${employees.length} total`} color="#3B82F6" />
          </View>
        )}

        {/* Team Performance */}
        <TeamLeaderboard leaderboard={leaderboard} employees={employees} onSelect={setSelected} loading={teamLoading} />

        {/* Roster */}
        <Card padding={0}>
          <View style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
            <SectionHead icon="people-outline" title="Employee roster" />
          </View>
          {/* Search */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm,
            marginHorizontal: SPACE.lg, marginBottom: SPACE.md,
            backgroundColor: C.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border,
            paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm }}>
            <Ionicons name="search" size={16} color={C.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search employees..."
              placeholderTextColor={C.dim}
              style={{ flex: 1, ...TYPE.body, color: C.primary }} />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={C.muted} />
              </Pressable>
            )}
          </View>

          <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg }}>
            {loading ? (
              <ActivityIndicator color={adminPalette.primary} style={{ marginVertical: SPACE.xl }} />
            ) : (
              <>
                {/* Active employees */}
                {filtered.length > 0 && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.sm, marginTop: SPACE.xs }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
                      <Text style={{ ...TYPE.label, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Active · {filtered.length}
                      </Text>
                    </View>
                    {filtered.map((emp) => (
                      <EmployeeCard key={emp.id} employee={emp} stat={leaderById.get(emp.id)}
                        onPress={() => setSelected(emp)} />
                    ))}
                  </>
                )}

                {/* Inactive employees */}
                {filteredInactive.length > 0 && (
                  <>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm,
                      marginBottom: SPACE.sm, marginTop: filtered.length > 0 ? SPACE.lg : SPACE.xs }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
                      <Text style={{ ...TYPE.label, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Inactive · {filteredInactive.length}
                      </Text>
                    </View>
                    {filteredInactive.map((emp) => (
                      <EmployeeCard key={emp.id} employee={emp} stat={leaderById.get(emp.id)}
                        onPress={() => setSelected(emp)} />
                    ))}
                  </>
                )}

                {filtered.length === 0 && filteredInactive.length === 0 && (
                  <Text style={{ ...TYPE.caption, color: C.muted, textAlign: "center", paddingVertical: SPACE.xl }}>
                    No employees found
                  </Text>
                )}
              </>
            )}
            <Text style={{ ...TYPE.micro, color: C.muted, textAlign: "center", marginTop: SPACE.sm }}>
              {activeCount} active · {inactiveEmployees.length} inactive
            </Text>
          </View>
        </Card>
      </ScrollView>

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} onAdded={() => { fetchEmployees(); fetchTeam(); }} />}
      {selected && <EmployeeDetailModal employee={selected} range={range}
        onClose={() => setSelected(null)} onStatusChanged={() => { fetchEmployees(); fetchTeam(); }} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({});

import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, useWindowDimensions, Modal, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { adminTheme, adminPalette, TYPE, SPACE, RADIUS } from "../../src/theme";
import { useAuth } from "../../src/AuthContext";
import { api } from "../../src/api";
import { useRouter } from "expo-router";
import { LineChart, Donut } from "../../src/charts";

const C = adminTheme;
const POLL_MS = 30000;

const PRESETS = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "Week" },
  { key: "custom",    label: "Custom" },
];

// ── Date helpers ──────────────────────────────────────────────────────────────
function toISO(date) {
  return date.toISOString().split("T")[0];
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function diffDays(a, b) {
  return Math.round((b - a) / 86400000);
}
function fmtDisplay(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtTime(secs) {
  if (!secs) return "0m";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Custom date picker modal ────────────────────────────────────────────────────
function CustomRangeModal({ visible, onClose, onApply }) {
  const today = toISO(new Date());
  const [start, setStart] = useState(toISO(addDays(new Date(), -7)));
  const [end,   setEnd]   = useState(today);
  const [err,   setErr]   = useState("");

  function validate() {
    if (!start || !end) return "Enter both dates";
    const s = new Date(start), e = new Date(end);
    if (isNaN(s) || isNaN(e)) return "Invalid date format (YYYY-MM-DD)";
    if (s > e) return "Start must be before end";
    if (diffDays(s, e) > 90) return "Max range is 90 days";
    return "";
  }

  function apply() {
    const e = validate();
    if (e) { setErr(e); return; }
    setErr("");
    onApply(start, end);
  }

  // Quick shortcuts
  const shortcuts = [
    { label: "Last 14d", days: 14 },
    { label: "Last 30d", days: 30 },
    { label: "Last 60d", days: 60 },
    { label: "Last 90d", days: 90 },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
      <View style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: SPACE.xl, paddingBottom: 40, position: "absolute", bottom: 0, left: 0, right: 0 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: "center", marginBottom: SPACE.lg }} />
        <Text style={{ ...TYPE.h3, color: C.primary, marginBottom: SPACE.lg }}>Custom Date Range</Text>

        {/* Shortcuts */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>
          {shortcuts.map(s => (
            <Pressable key={s.label} onPress={() => { setStart(toISO(addDays(new Date(), -s.days))); setEnd(today); setErr(""); }}
              style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.border }}>
              <Text style={{ ...TYPE.caption, color: C.primary }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Date inputs */}
        <Text style={{ ...TYPE.label, color: C.muted, marginBottom: SPACE.xs }}>START DATE</Text>
        <TextInput
          value={start} onChangeText={v => { setStart(v); setErr(""); }}
          placeholder="YYYY-MM-DD" placeholderTextColor={C.dim}
          style={{ backgroundColor: C.surface2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACE.md, ...TYPE.body, color: C.primary, marginBottom: SPACE.md }}
        />
        <Text style={{ ...TYPE.label, color: C.muted, marginBottom: SPACE.xs }}>END DATE</Text>
        <TextInput
          value={end} onChangeText={v => { setEnd(v); setErr(""); }}
          placeholder="YYYY-MM-DD" placeholderTextColor={C.dim}
          style={{ backgroundColor: C.surface2, borderRadius: RADIUS.md, borderWidth: 1, borderColor: C.border, padding: SPACE.md, ...TYPE.body, color: C.primary, marginBottom: SPACE.sm }}
        />

        {!!err && <Text style={{ ...TYPE.caption, color: "#EF4444", marginBottom: SPACE.sm }}>{err}</Text>}
        {start && end && !err && (
          <Text style={{ ...TYPE.caption, color: C.muted, marginBottom: SPACE.md }}>
            {diffDays(new Date(start), new Date(end))} days selected
          </Text>
        )}

        <Pressable onPress={apply}
          style={{ backgroundColor: adminPalette.primary, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: "center" }}>
          <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>Apply Range</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function relDate(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHead({ icon, title, action, onAction }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
        <View style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: adminPalette.primary + "22", alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={16} color={adminPalette.primary} />
        </View>
        <Text style={{ ...TYPE.h3, color: C.primary }}>{title}</Text>
      </View>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={{ ...TYPE.caption, color: adminPalette.primary }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, style }) {
  return (
    <View style={{
      backgroundColor: C.card, borderRadius: RADIUS.card,
      borderWidth: 1, borderColor: C.border,
      padding: SPACE.lg, marginBottom: SPACE.lg,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06, shadowRadius: 12, elevation: 3,
      ...style,
    }}>
      {children}
    </View>
  );
}

// ── KPI row ───────────────────────────────────────────────────────────────────
function KpiRow({ kpis }) {
  const items = [
    { icon: "call-outline",             label: "Total Calls",  value: kpis.total_calls ?? 0,                          color: adminPalette.primary },
    { icon: "checkmark-circle-outline", label: "Connected",    value: `${kpis.connected_pct ?? 0}%`,                  color: "#14B8A6" },
    { icon: "time-outline",             label: "Talk Time",    value: fmtTime(kpis.talk_time_seconds),                color: "#F59E0B" },
    { icon: "flame-outline",            label: "Hot Leads",    value: kpis.hot_leads ?? 0,                            color: "#EF4444" },
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>
      {items.map(s => (
        <View key={s.label} style={{
          width: "48%", backgroundColor: C.card, borderRadius: RADIUS.card,
          borderWidth: 1, borderColor: C.border, padding: SPACE.md,
          shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
        }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm }}>
            <Text style={{ ...TYPE.label, color: C.muted, textTransform: "uppercase" }}>{s.label}</Text>
            <View style={{ width: 28, height: 28, borderRadius: RADIUS.sm, backgroundColor: s.color + "22", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={s.icon} size={14} color={s.color} />
            </View>
          </View>
          <Text style={{ fontSize: 28, fontWeight: "800", color: C.primary, lineHeight: 34 }}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Needs Attention (collapsed by default, tap header to expand) ──────────────
function NeedsAttention({ items, router }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  const sevColor = { high: "#EF4444", medium: "#F59E0B", low: "#3B82F6" };
  const highCount = items.filter(n => n.severity === "high").length;
  return (
    <Card style={{ padding: 0 }}>
      {/* Header row — always visible, tap to toggle */}
      <Pressable onPress={() => setOpen(o => !o)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACE.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <View style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: "#EF444422", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="warning-outline" size={16} color="#EF4444" />
          </View>
          <Text style={{ ...TYPE.h3, color: C.primary }}>Needs Attention</Text>
          <View style={{ backgroundColor: highCount > 0 ? "#EF444422" : "#F59E0B22", borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 2 }}>
            <Text style={{ ...TYPE.micro, color: highCount > 0 ? "#EF4444" : "#F59E0B", fontWeight: "700" }}>{items.length}</Text>
          </View>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
      </Pressable>

      {/* Expandable items */}
      {open && (
        <View style={{ paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg }}>
          {items.map(n => (
            <Pressable key={n.id} onPress={() => router.push(n.to || "/(admin)/dashboard")}
              style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, backgroundColor: "#FFF5F5", borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm, borderLeftWidth: 3, borderLeftColor: sevColor[n.severity] || "#F59E0B" }}>
              <Ionicons name="alert-circle-outline" size={18} color={sevColor[n.severity] || "#F59E0B"} />
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.bodyBold, color: C.primary }}>{n.title}</Text>
                <Text style={{ ...TYPE.caption, color: C.muted }} numberOfLines={1}>{n.detail}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.dim} />
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

// ── Call Activity chart ───────────────────────────────────────────────────────
function CallActivityChart({ daily, width }) {
  if (!daily.length) return null;
  const labels = daily.map(d => d.day);
  const series = [
    { data: daily.map(d => d.total),     color: adminPalette.primary },
    { data: daily.map(d => d.connected), color: "#14B8A6" },
    { data: daily.map(d => d.missed),    color: "#EF4444" },
  ];
  const chartW = width - SPACE.lg * 2 - 32;
  return (
    <Card>
      <SectionHead icon="activity-outline" title="Call Activity" />
      <View style={{ flexDirection: "row", gap: SPACE.lg, marginBottom: SPACE.md }}>
        {[["Total", adminPalette.primary], ["Connected", "#14B8A6"], ["Missed", "#EF4444"]].map(([l, c]) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
            <Text style={{ ...TYPE.micro, color: C.muted }}>{l}</Text>
          </View>
        ))}
      </View>
      <LineChart series={series} width={chartW} height={160} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm }}>
        {labels.map(l => <Text key={l} style={{ ...TYPE.micro, color: C.muted }}>{l}</Text>)}
      </View>
    </Card>
  );
}

// ── Live Pulse ────────────────────────────────────────────────────────────────
function LivePulse({ pulse }) {
  const toneColor = { success: "#22C55E", danger: "#EF4444", info: "#3B82F6" };
  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
          <View style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: adminPalette.primary + "22", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="flash-outline" size={16} color={adminPalette.primary} />
          </View>
          <Text style={{ ...TYPE.h3, color: C.primary }}>Live Pulse</Text>
        </View>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
      </View>
      {!pulse.length && <Text style={{ ...TYPE.caption, color: C.muted, textAlign: "center", paddingVertical: SPACE.lg }}>No recent call events</Text>}
      {pulse.slice(0, 8).map((p, i) => (
        <View key={p.id ?? i} style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.md, paddingVertical: SPACE.sm, borderBottomWidth: i < pulse.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
          <Text style={{ ...TYPE.micro, color: C.muted, minWidth: 40, paddingTop: 2 }}>{p.time}</Text>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: toneColor[p.tone] || "#3B82F6", marginTop: 4 }} />
          <View style={{ flex: 1 }}>
            <Text style={{ ...TYPE.caption, color: C.primary }}>{p.text}</Text>
            <Text style={{ ...TYPE.micro, color: C.muted }}>{p.employee}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

// ── Opportunity Pipeline ──────────────────────────────────────────────────────
function OpportunityPipeline({ opps, router }) {
  if (!opps.length) return null;
  return (
    <Card style={{ padding: 0 }}>
      <View style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
        <SectionHead icon="trending-up-outline" title="Opportunity Pipeline" action="View all" onAction={() => router.push("/(admin)/opportunities")} />
      </View>
      {opps.slice(0, 6).map((o, i) => (
        <Pressable key={o.id} onPress={() => router.push("/(admin)/opportunities")}
          style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: C.border }}>
          {o.hot && <Ionicons name="star" size={12} color="#F59E0B" />}
          <View style={{ flex: 1 }}>
            <Text style={{ ...TYPE.bodyBold, color: C.primary }} numberOfLines={1}>{o.name}</Text>
            <Text style={{ ...TYPE.micro, color: adminPalette.primary }}>{o.phone}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "700" }}>{o.connects}×</Text>
            <Text style={{ ...TYPE.micro, color: C.muted }}>{fmtTime(o.talkTimeSeconds)}</Text>
          </View>
          <View style={{ minWidth: 60, alignItems: "flex-end" }}>
            {o.status && o.status !== "-"
              ? <View style={{ backgroundColor: adminPalette.primary + "22", borderRadius: RADIUS.full, paddingHorizontal: SPACE.sm, paddingVertical: 2 }}>
                  <Text style={{ ...TYPE.micro, color: adminPalette.primary }}>{o.status}</Text>
                </View>
              : <Text style={{ ...TYPE.micro, color: C.dim }}>—</Text>
            }
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

// ── Hot Leads ─────────────────────────────────────────────────────────────────
function HotLeads({ opps, router }) {
  const hot = opps.filter(o => o.hot).slice(0, 4);
  if (!hot.length) return null;
  return (
    <Card>
      <SectionHead icon="flame-outline" title="Hot Leads" action="View all" onAction={() => router.push("/(admin)/leads")} />
      {hot.map((o, i) => (
        <Pressable key={o.id} onPress={() => router.push("/(admin)/leads")}
          style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, backgroundColor: "#FFFBEB", borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm }}>
          <View style={{ width: 26, height: 26, borderRadius: RADIUS.sm, backgroundColor: adminPalette.primary, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...TYPE.micro, color: "#fff", fontWeight: "800" }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...TYPE.bodyBold, color: C.primary }} numberOfLines={1}>{o.name}</Text>
            <Text style={{ ...TYPE.micro, color: C.muted }}>{o.phone}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ ...TYPE.caption, color: "#22C55E", fontWeight: "700" }}>{o.connects}×</Text>
            <Text style={{ ...TYPE.micro, color: C.muted }}>{fmtTime(o.talkTimeSeconds)}</Text>
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

// ── Top Performer ─────────────────────────────────────────────────────────────
function TopPerformer({ top }) {
  if (!top) return null;
  const initials = top.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const stats = [
    { l: "Calls",     v: top.calls },
    { l: "Talk Time", v: fmtTime(top.talkTimeSeconds) },
    { l: "Missed",    v: top.missed },
    { l: "Connected", v: `${top.connectedPct}%` },
  ];
  return (
    <Card>
      <SectionHead icon="trophy-outline" title="Top Performer" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}>
        <LinearGradient colors={[adminPalette.primary, adminPalette.navyLight || "#3B5A8F"]}
          style={{ width: 48, height: 48, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{initials}</Text>
        </LinearGradient>
        <View>
          <Text style={{ ...TYPE.h3, color: C.primary }}>{top.name}</Text>
          <Text style={{ ...TYPE.caption, color: C.muted }}>{top.connectedPct}% connected</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
        {stats.map(s => (
          <View key={s.l} style={{ width: "48%", backgroundColor: C.surface2, borderRadius: RADIUS.md, padding: SPACE.md, alignItems: "center" }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: C.primary }}>{s.v}</Text>
            <Text style={{ ...TYPE.micro, color: C.muted, marginTop: 2 }}>{s.l}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── Team Leaderboard ──────────────────────────────────────────────────────────
function TeamLeaderboard({ leaderboard, router }) {
  if (!leaderboard.length) return null;
  return (
    <Card style={{ padding: 0 }}>
      <View style={{ padding: SPACE.lg, paddingBottom: SPACE.sm }}>
        <SectionHead icon="podium-outline" title="Team Leaderboard" action="Manage" onAction={() => router.push("/(admin)/employees")} />
      </View>
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm }}>
        {["#", "Agent", "Calls", "Connected", "Missed"].map(h => (
          <Text key={h} style={{ ...TYPE.micro, color: C.muted, textTransform: "uppercase", flex: h === "Agent" ? 2 : 1 }}>{h}</Text>
        ))}
      </View>
      {leaderboard.map((e, i) => (
        <View key={e.id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderTopWidth: 1, borderTopColor: C.border }}>
          <View style={{ flex: 1 }}>
            <View style={{ width: 22, height: 22, borderRadius: RADIUS.xs, backgroundColor: e.rank === 1 ? adminPalette.primary : C.surface2, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ ...TYPE.micro, color: e.rank === 1 ? "#fff" : C.muted, fontWeight: "700" }}>{e.rank}</Text>
            </View>
          </View>
          <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "600", flex: 2 }} numberOfLines={1}>{e.name}</Text>
          <Text style={{ ...TYPE.caption, color: C.secondary, flex: 1 }}>{e.calls}</Text>
          <Text style={{ ...TYPE.caption, color: "#22C55E", fontWeight: "600", flex: 1 }}>{e.connected}</Text>
          <Text style={{ ...TYPE.caption, color: "#EF4444", flex: 1 }}>{e.missed}</Text>
        </View>
      ))}
    </Card>
  );
}

// ── Device Health ─────────────────────────────────────────────────────────────
function DeviceHealth({ devices, router }) {
  if (!devices.length) return null;
  const stMap = {
    healthy: { color: "#22C55E", label: "Healthy" },
    warning: { color: "#F59E0B", label: "Warning" },
    offline: { color: "#EF4444", label: "Offline" },
  };
  return (
    <Card>
      <SectionHead icon="phone-portrait-outline" title="Device Health" action="Details" onAction={() => router.push("/(admin)/employees")} />
      {devices.slice(0, 5).map(d => {
        const st = stMap[d.status] || stMap.offline;
        return (
          <View key={d.id} style={{ borderWidth: 1, borderColor: C.border, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <Text style={{ ...TYPE.caption, color: C.primary, fontWeight: "600" }}>{d.employee}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: st.color }} />
                <Text style={{ ...TYPE.micro, color: st.color }}>{st.label}</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
              <Ionicons name="battery-half-outline" size={13} color={C.muted} />
              <Text style={{ ...TYPE.micro, color: C.muted }}>{d.battery}%</Text>
              <Text style={{ ...TYPE.micro, color: C.muted }}>· {d.lastSync}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// ── Duration Donut ────────────────────────────────────────────────────────────
function DurationDonut({ distribution }) {
  if (!distribution.length) return null;
  const COLORS = ["#84CC16", "#14B8A6", "#3B82F6", "#F59E0B"];
  const segments = distribution.map((d, i) => ({ ...d, color: d.color || COLORS[i % COLORS.length] }));
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <Card>
      <SectionHead icon="time-outline" title="Duration Distribution" />
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.xl }}>
        <Donut segments={segments} size={120} stroke={20} />
        <View style={{ flex: 1, gap: SPACE.sm }}>
          {segments.map(s => (
            <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
              <Text style={{ ...TYPE.caption, color: C.primary, flex: 1 }}>{s.name}</Text>
              <Text style={{ ...TYPE.caption, color: C.muted, fontWeight: "700" }}>{Math.round(s.value / total * 100)}%</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [data, setData] = useState(null);
  const [pulse, setPulse] = useState([]);
  const pollRef = useRef(null);
  // keep latest range/custom in refs so async callbacks always read fresh values
  const rangeRef = useRef("7d");
  const csRef = useRef("");
  const ceRef = useRef("");
  const isMounted = useRef(true);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);

  async function doFetch(r, cs, ce) {
    try {
      const [analytics, oppsRes, attentionRes, devicesRes] = await Promise.all([
        api.getAnalytics(r, cs, ce),
        api.getOpportunitiesList({ closed: false, page_size: 20 }).catch(() => ({ items: [] })),
        api.getNeedsAttention().catch(() => ({ items: [] })),
        api.getDevices().catch(() => []),
      ]);
      const kpis = analytics?.kpis || {};
      const lb = (analytics?.leaderboard || []).map((e, i) => ({
        id: e.id, name: e.name, rank: e.rank || i + 1,
        calls: e.calls, connected: e.connected,
        connectedPct: e.connected_pct ?? 0,
        missed: e.missed, talkTimeSeconds: e.talk_time_seconds ?? 0,
      }));
      const rawDevices = Array.isArray(devicesRes) ? devicesRes : devicesRes?.items || [];
      const empMap = new Map();
      rawDevices.forEach(d => {
        const k = d.employee_id || d.id;
        const ex = empMap.get(k);
        if (!ex) { empMap.set(k, d); return; }
        const t1 = ex.last_seen_at ? new Date(ex.last_seen_at).getTime() : 0;
        const t2 = d.last_seen_at  ? new Date(d.last_seen_at).getTime()  : 0;
        if (t2 > t1) empMap.set(k, d);
      });
      const devices = Array.from(empMap.values()).map(d => {
        const perms = d.permissions_status || {};
        const allOk = perms.callLog && perms.phoneState;
        const status = !d.is_online ? "offline" : !allOk ? "warning" : "healthy";
        const diff = d.last_seen_at ? Date.now() - new Date(d.last_seen_at).getTime() : null;
        const mins = diff != null ? Math.floor(diff / 60000) : null;
        const lastSync = mins == null ? "never" : mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
        return { id: d.id, employee: d.employee_name || d.employee_id || "—", battery: d.battery_level ?? 0, lastSync, status };
      });
      setData({
        kpis: {
          total_calls: kpis.total_calls ?? 0,
          connected: kpis.connected ?? 0,
          connected_pct: kpis.connected_pct ?? 0,
          talk_time_seconds: kpis.talk_time_seconds ?? 0,
          hot_leads: kpis.hot_leads ?? 0,
        },
        daily: (analytics?.daily_metrics || []).map(d => ({ day: d.day, total: d.total, connected: d.connected, missed: d.missed })),
        duration: (analytics?.duration_distribution || []).map(d => ({ name: d.name, value: d.value, color: d.color })),
        leaderboard: lb,
        top: lb[0] || null,
        opps: (oppsRes?.items || []).map(o => ({
          id: o.id, name: o.name || o.lead || "—", phone: o.phone || "—",
          connects: o.connects || 1, talkTimeSeconds: o.talk_time_seconds || 0,
          status: o.stage !== "New" ? o.stage : "-", hot: (o.connects || 1) >= 2,
          lastContact: relDate(o.last_contact_at),
        })),
        attention: attentionRes?.items || [],
        devices,
      });
    } catch (e) {
      console.warn("Dashboard fetch error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function doFetchPulse() {
    try {
      const res = await api.getLivePulse();
      setPulse((res?.items || []).map((p, i) => ({ ...p, id: p.id ?? i })));
    } catch {}
  }

  function startPolling() {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(doFetchPulse, POLL_MS);
  }

  // initial load + range changes — eslint-disable-next-line is intentional:
  // doFetch/doFetchPulse are defined in component scope but are stable in behaviour
  useEffect(() => {
    rangeRef.current = range;
    csRef.current = customStart;
    ceRef.current = customEnd;
    setLoading(true);
    doFetch(range, customStart, customEnd);
    doFetchPulse();
    startPolling();
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customStart, customEnd]);

  function applyCustom(s, e) {
    setShowPicker(false);
    setCustomStart(s);
    setCustomEnd(e);
    setRange("custom");
    // also update refs and fetch immediately with fresh values
    rangeRef.current = "custom";
    csRef.current = s;
    ceRef.current = e;
    setLoading(true);
    doFetch("custom", s, e);
    startPolling();
  }

  const onRefresh = () => {
    setRefreshing(true);
    doFetch(rangeRef.current, csRef.current, ceRef.current);
    doFetchPulse();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={adminPalette.primary} />}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.xl }}>
          <View>
            <Text style={{ ...TYPE.caption, color: C.muted }}>Welcome back</Text>
            <Text style={{ ...TYPE.h2, color: C.primary }}>{user?.first_name || user?.name || "Admin"}</Text>
          </View>
          <Ionicons name="notifications-outline" size={24} color={adminPalette.primary} />
        </View>

        {/* Range pills */}
        <View style={{ flexDirection: "row", gap: SPACE.sm, marginBottom: customStart ? SPACE.sm : SPACE.xl, flexWrap: "wrap" }}>
          {PRESETS.map(p => {
            const active = range === p.key;
            return (
              <Pressable key={p.key}
                onPress={() => {
                  if (p.key === "custom") { setShowPicker(true); return; }
                  setRange(p.key); setCustomStart(""); setCustomEnd("");
                }}
                style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.full, backgroundColor: active ? adminPalette.primary : C.card, borderWidth: 1, borderColor: active ? adminPalette.primary : C.border, flexDirection: "row", alignItems: "center", gap: 4 }}>
                {p.key === "custom" && <Ionicons name="calendar-outline" size={12} color={active ? "#fff" : C.muted} />}
                <Text style={{ ...TYPE.caption, color: active ? "#fff" : C.muted }}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom range label */}
        {range === "custom" && customStart && customEnd && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginBottom: SPACE.xl }}>
            <Ionicons name="calendar" size={13} color={adminPalette.primary} />
            <Text style={{ ...TYPE.caption, color: adminPalette.primary }}>
              {fmtDisplay(customStart)} → {fmtDisplay(customEnd)}
            </Text>
            <Pressable onPress={() => setShowPicker(true)}>
              <Text style={{ ...TYPE.caption, color: C.muted }}>Edit</Text>
            </Pressable>
          </View>
        )}

        <CustomRangeModal
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          onApply={applyCustom}
        />

        {loading ? (
          <ActivityIndicator color={adminPalette.primary} size="large" style={{ marginTop: 60 }} />
        ) : data ? (
          <>
            <KpiRow kpis={data.kpis} />
            <NeedsAttention items={data.attention} router={router} />
            <CallActivityChart daily={data.daily} width={width} />
            <LivePulse pulse={pulse} />
            <OpportunityPipeline opps={data.opps} router={router} />
            <HotLeads opps={data.opps} router={router} />
            <TopPerformer top={data.top} />
            <TeamLeaderboard leaderboard={data.leaderboard} router={router} />
            <DeviceHealth devices={data.devices} router={router} />
            <DurationDonut distribution={data.duration} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

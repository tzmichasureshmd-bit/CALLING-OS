import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, useWindowDimensions,
  RefreshControl, ActivityIndicator, Modal, FlatList, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { CountUp, LiveDot, EmptyState } from "../../src/components";
import { AnimatedBars } from "../../src/charts";
import { getRealCallLog } from "../../src/callLogService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/AuthContext";

const NAVY = "#0D1B4B";
const TEAL = "#0ABFA3";
const MINT = "#E8FFE8";

const CALL_TYPE_META = {
  incoming: { icon: "call-received", color: TEAL,      label: "Incoming" },
  outgoing: { icon: "call-made",     color: "#8b5cf6", label: "Outgoing" },
  missed:   { icon: "call-missed",   color: "#ef4444", label: "Missed"   },
  rejected: { icon: "call-missed",   color: "#f59e0b", label: "Rejected" },
};

function fmtSecs(s) {
  if (!s) return "0m";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtDur(s) {
  if (!s) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}
function filterByRange(calls, key) {
  const now = new Date();
  if (key === "today") {
    const s = new Date(now); s.setHours(0,0,0,0);
    return calls.filter(c => new Date(c.start_time) >= s);
  }
  if (key === "yesterday") {
    const s = new Date(now); s.setDate(now.getDate()-1); s.setHours(0,0,0,0);
    const e = new Date(now); e.setDate(now.getDate()-1); e.setHours(23,59,59,999);
    return calls.filter(c => { const t = new Date(c.start_time); return t >= s && t <= e; });
  }
  if (key === "thismonth") {
    const s = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
    return calls.filter(c => new Date(c.start_time) >= s);
  }
  if (key === "lastmonth") {
    const s = new Date(now.getFullYear(), now.getMonth()-1, 1, 0,0,0,0);
    const e = new Date(now.getFullYear(), now.getMonth(), 0, 23,59,59,999);
    return calls.filter(c => { const t = new Date(c.start_time); return t >= s && t <= e; });
  }
  const daysMap = { "7d": 7, "14d": 14, "90d": 90 };
  const days = daysMap[key] || 7;
  const s = new Date(now); s.setDate(now.getDate() - days); s.setHours(0,0,0,0);
  return calls.filter(c => new Date(c.start_time) >= s);
}
function buildDaily7(calls) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const dc = calls.filter(c => { const t = new Date(c.start_time); return t >= d && t < next; });
    days.push({
      label:    d.toLocaleDateString("en-IN", { weekday: "short" }),
      total:    dc.length,
      missed:   dc.filter(c => c.call_type === "missed").length,
      talkSecs: dc.reduce((s, c) => s + (c.duration_seconds || 0), 0),
    });
  }
  return days;
}
function computeStats(calls) {
  const total     = calls.length;
  const incoming  = calls.filter(c => c.call_type === "incoming").length;
  const outgoing  = calls.filter(c => c.call_type === "outgoing").length;
  const missed    = calls.filter(c => c.call_type === "missed").length;
  const connected = calls.filter(c => c.duration_seconds > 0).length;
  const totalSecs = calls.reduce((s, c) => s + (c.duration_seconds || 0), 0);
  const connPct   = total ? Math.round(connected / total * 100) : 0;
  const avgSecs   = connected ? Math.round(totalSecs / connected) : 0;
  return { total, incoming, outgoing, missed, connected, totalSecs, connPct, avgSecs };
}

// ── Avatar initials ───────────────────────────────────────────────────────────
function Avatar({ name, size = 40, bg = NAVY }) {
  const initials = String(name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: size * 0.32, fontWeight: "800", color: "#fff" }}>{initials}</Text>
    </View>
  );
}

// ── Dark navy call card (matches reference "Break" / "Ongoing Calls" rows) ────
function NavyCallCard({ call, onPress }) {
  const meta = CALL_TYPE_META[call.call_type] || CALL_TYPE_META.incoming;
  const name = call.contact_name && call.contact_name !== "Unknown" ? call.contact_name : call.phone_number;
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center",
        backgroundColor: NAVY,
        borderRadius: 16, padding: 14, marginBottom: 10,
        opacity: pressed ? 0.88 : 1,
      })}>
      <Avatar name={name} size={42} bg={meta.color + "33"} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }} numberOfLines={1}>{name}</Text>
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{meta.label}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <View style={{ backgroundColor: meta.color + "33", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: meta.color }}>{fmtDur(call.duration_seconds)}</Text>
        </View>
        <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{relTime(call.start_time)}</Text>
      </View>
    </Pressable>
  );
}

// ── KPI stat pill ─────────────────────────────────────────────────────────────
function StatPill({ label, value, color, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1,
      backgroundColor: "#fff", borderRadius: 16, padding: 14,
      alignItems: "center", gap: 6,
      borderWidth: 1.5, borderColor: "#C3F0E0",
      shadowColor: NAVY, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    }}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 24, fontWeight: "800", color: NAVY }}><CountUp value={value} /></Text>
      <Text style={{ fontSize: 10, fontWeight: "700", color: NAVY + "66", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

const QUICK = [
  { key: "today",     label: "Today"     },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "7 Days"    },
];

function buildFilterOptions() {
  const now = new Date();
  const tDays  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const tName  = now.toLocaleDateString("en-IN", { month: "long" });
  const lmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lDays  = new Date(lmDate.getFullYear(), lmDate.getMonth() + 1, 0).getDate();
  const lName  = lmDate.toLocaleDateString("en-IN", { month: "long" });
  return [
    { key: "today",     label: "Today",                              icon: "today-outline",           sub: "Calls made today"                        },
    { key: "yesterday", label: "Yesterday",                          icon: "calendar-outline",        sub: "Calls from yesterday"                    },
    { key: "7d",        label: "Last 7 Days",                        icon: "calendar-clear-outline",  sub: "Past week"                               },
    { key: "14d",       label: "Last 14 Days",                       icon: "calendar-number-outline", sub: "Past 2 weeks"                            },
    { key: "thismonth", label: `${tName}`,                           icon: "calendar-sharp",          sub: `This month · ${tDays} days`              },
    { key: "lastmonth", label: `${lName}`,                           icon: "arrow-back-circle-outline",sub: `Last month · ${lDays} days`             },
    { key: "90d",       label: "Last 3 Months",                      icon: "stats-chart-outline",     sub: "Past 90 days"                            },
  ];
}

export default function Home() {
  const [range, setRange]           = useState("today");
  const [allCalls, setAllCalls]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync]     = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const mountedRef  = useRef(true);
  const router      = useRouter();
  const { user }    = useAuth();
  const { width }   = useWindowDimensions();
  const contentW    = width - 32;
  const FILTER_OPTS = useMemo(() => buildFilterOptions(), []);
  const activeLabel = useMemo(() => FILTER_OPTS.find(o => o.key === range)?.label || "Today", [range, FILTER_OPTS]);

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem("callos_last_sync_ts").then(ts => {
      if (ts && mountedRef.current) setLastSync(parseInt(ts, 10));
    }).catch(() => {});
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Fetch enough days to cover the full current month (max 31)
      const monthDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      const calls = await getRealCallLog(Math.max(31, monthDays));
      if (mountedRef.current) setAllCalls(calls);
    } catch { /* silent */ } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rangeFiltered = useMemo(() => filterByRange(allCalls, range), [allCalls, range]);
  const stats         = useMemo(() => computeStats(rangeFiltered), [rangeFiltered]);
  const daily7        = useMemo(() => buildDaily7(allCalls), [allCalls]);
  const recentCalls   = useMemo(() =>
    [...rangeFiltered].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 6),
  [rangeFiltered]);
  const missedCalls   = useMemo(() =>
    rangeFiltered.filter(c => c.call_type === "missed").slice(0, 4),
  [rangeFiltered]);

  const syncLabel = lastSync ? `Synced ${relTime(new Date(lastSync).toISOString())}` : "Not synced yet";
  const userName  = user?.name || "Employee";

  if (!loading && allCalls.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: MINT }} edges={["top"]}>
        <EmployeeHeader userName={userName} router={router} />
        <EmptyState
          icon="call-outline"
          title="No calls recorded"
          message={"CallNexa reads your Android call log.\nMake a call and pull down to refresh."}
          action={
            <Pressable onPress={() => load(true)} style={{ marginTop: SPACE.md }}>
              <LinearGradient colors={[NAVY, "#1E2D6B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>Refresh</Text>
              </LinearGradient>
            </Pressable>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: MINT }} edges={["top"]}>
      <EmployeeHeader userName={userName} router={router} syncLabel={syncLabel} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
      >
        {/* ── Quick range pills + Filter button ── */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.sm }}>
          {QUICK.map(r => {
            const active = r.key === range;
            return (
              <Pressable key={r.key} onPress={() => setRange(r.key)}
                style={{
                  paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
                  backgroundColor: active ? NAVY : "#fff",
                  borderWidth: 1.5, borderColor: active ? NAVY : "#C3F0E0",
                }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : NAVY + "99" }}>{r.label}</Text>
              </Pressable>
            );
          })}
          {/* Filter button */}
          <Pressable onPress={() => setFilterOpen(true)}
            style={{
              marginLeft: "auto",
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
              backgroundColor: !["today","yesterday","7d"].includes(range) ? NAVY : "#fff",
              borderWidth: 1.5, borderColor: !["today","yesterday","7d"].includes(range) ? NAVY : "#C3F0E0",
            }}>
            <Ionicons name="options-outline" size={15}
              color={!["today","yesterday","7d"].includes(range) ? "#fff" : NAVY} />
            <Text style={{ fontSize: 12, fontWeight: "700",
              color: !["today","yesterday","7d"].includes(range) ? "#fff" : NAVY }}>
              {!["today","yesterday","7d"].includes(range) ? activeLabel : "Filter"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator color={TEAL} size="large" />
            <Text style={{ ...TYPE.caption, color: NAVY + "88", marginTop: SPACE.md }}>Reading call log…</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>

            {/* ── Statistics heading ── */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE.xs }}>
              <Text style={{ fontSize: 26, fontWeight: "900", color: NAVY, letterSpacing: -0.5 }}>Statistics</Text>
              <View style={{ backgroundColor: TEAL + "22", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: TEAL }}>{activeLabel}</Text>
              </View>
            </View>

            {/* ── 3 KPI pills ── */}
            <View style={{ flexDirection: "row", gap: SPACE.sm }}>
              <StatPill label="Incoming" value={stats.incoming} color={TEAL}      icon="call-received" onPress={() => router.push("/(employee)/logs")} />
              <StatPill label="Outgoing" value={stats.outgoing} color="#8b5cf6"   icon="call-made"     onPress={() => router.push("/(employee)/logs")} />
              <StatPill label="Missed"   value={stats.missed}   color="#ef4444"   icon="call-missed"   onPress={() => router.push("/(employee)/logs")} />
            </View>

            {/* ── Hero stats card (navy) ── */}
            <View style={{ backgroundColor: NAVY, borderRadius: 20, padding: SPACE.lg, overflow: "hidden" }}>
              <LinearGradient colors={["rgba(10,191,163,0.18)", "transparent"]}
                style={{ position: "absolute", top: 0, left: 0, right: 0, height: 70 }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: SPACE.md }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {activeLabel} Total
                  </Text>
                  <Text style={{ fontSize: 52, fontWeight: "900", color: "#fff", lineHeight: 60 }}>
                    <CountUp value={stats.total} />
                  </Text>
                  <Text style={{ fontSize: 12, color: TEAL, fontWeight: "600" }}>calls recorded</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 8 }}>
                  <View style={{ backgroundColor: TEAL + "22", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: TEAL }}>{stats.connPct}%</Text>
                    <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Connected</Text>
                  </View>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{fmtSecs(stats.totalSecs)}</Text>
                    <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>Talk Time</Text>
                  </View>
                </View>
              </View>
              {/* 7-day bar chart */}
              {daily7.some(d => d.total > 0) && (
                <>
                  <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginBottom: SPACE.md }} />
                  <AnimatedBars data={daily7} width={contentW - SPACE.xxxl - SPACE.lg} height={56} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    {daily7.map((d, i) => (
                      <Text key={i} style={{ flex: 1, textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
                        {d.label}
                      </Text>
                    ))}
                  </View>
                </>
              )}
              {/* Sync row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
                <LiveDot color={TEAL} />
                <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{syncLabel}</Text>
              </View>
            </View>

            {/* ── Recent Calls heading ── */}
            {recentCalls.length > 0 && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE.xs }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: NAVY, letterSpacing: -0.5 }}>Recent Calls</Text>
                  <Pressable onPress={() => router.push("/(employee)/logs")} hitSlop={8}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: TEAL }}>See all →</Text>
                  </Pressable>
                </View>
                {recentCalls.map((c, i) => (
                  <NavyCallCard
                    key={c.client_event_id || i}
                    call={c}
                    onPress={() => router.push({ pathname: "/call-detail", params: { clientEventId: c.client_event_id || "", callId: "" } })}
                  />
                ))}
              </>
            )}

            {/* ── Missed Calls section ── */}
            {missedCalls.length > 0 && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACE.xs }}>
                  <Text style={{ fontSize: 22, fontWeight: "900", color: NAVY, letterSpacing: -0.5 }}>Missed</Text>
                  <View style={{ backgroundColor: "#ef444422", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#ef4444" }}>{stats.missed}</Text>
                  </View>
                </View>
                {missedCalls.map((c, i) => (
                  <NavyCallCard
                    key={c.client_event_id || i}
                    call={c}
                    onPress={() => router.push({ pathname: "/call-detail", params: { clientEventId: c.client_event_id || "", callId: "" } })}
                  />
                ))}
              </>
            )}

          </View>
        )}
      </ScrollView>

      {/* ── Filter Bottom Sheet ── */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(13,27,75,0.45)" }} onPress={() => setFilterOpen(false)} />
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          backgroundColor: "#fff",
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          paddingBottom: 40, paddingTop: 8,
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: "#C3F0E0", alignSelf: "center", marginBottom: 16 }} />
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: NAVY }}>Filter by Period</Text>
            <Pressable onPress={() => setFilterOpen(false)} hitSlop={12}
              style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "#E8FFE8", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={NAVY} />
            </Pressable>
          </View>
          {/* Options */}
          {FILTER_OPTS.map((opt, i) => {
            const active = opt.key === range;
            return (
              <Pressable key={opt.key} onPress={() => { setRange(opt.key); setFilterOpen(false); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  paddingHorizontal: 20, paddingVertical: 14,
                  backgroundColor: active ? NAVY + "08" : "transparent",
                  borderLeftWidth: active ? 3 : 0,
                  borderLeftColor: TEAL,
                  marginHorizontal: active ? 0 : 0,
                }}>
                <View style={{
                  width: 44, height: 44, borderRadius: 13,
                  backgroundColor: active ? NAVY : "#E8FFE8",
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name={opt.icon} size={22} color={active ? TEAL : NAVY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: active ? NAVY : NAVY }}>{opt.label}</Text>
                  <Text style={{ fontSize: 12, color: NAVY + "66", marginTop: 2 }}>{opt.sub}</Text>
                </View>
                {active && <Ionicons name="checkmark-circle" size={22} color={TEAL} />}
              </Pressable>
            );
          })}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Employee Header — avatar + name + search icon ─────────────────────────────
function EmployeeHeader({ userName, router, syncLabel }) {
  const initials = String(userName || "E").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
      backgroundColor: MINT,
      borderBottomWidth: 1, borderBottomColor: "#C3F0E0",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: NAVY, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: "#fff" }}>{initials}</Text>
        </View>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "800", color: NAVY }}>{userName}</Text>
          <Text style={{ fontSize: 11, color: TEAL, fontWeight: "600" }}>Employee</Text>
        </View>
      </View>
      <Pressable onPress={() => router.push("/(employee)/logs")}
        style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#C3F0E0" }}>
        <Ionicons name="search-outline" size={20} color={NAVY} />
      </Pressable>
    </View>
  );
}

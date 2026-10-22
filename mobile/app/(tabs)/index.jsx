import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, useWindowDimensions,
  RefreshControl, ActivityIndicator, Modal, FlatList, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, gradientBrandSoft, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { AppHeader, Badge, Card, CardHeader, EmptyState, CountUp, LiveDot } from "../../src/components";
import { RadialRing, AnimatedBars, ProgressBar } from "../../src/charts";
import { getRealCallLog } from "../../src/callLogService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// ── Constants ─────────────────────────────────────────────────────────────────
const RANGES = [
  { key: "today",     label: "Today"     },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "7 Days"    },
  { key: "30d",       label: "30 Days"   },
];

const TYPE_META = {
  incoming: { icon: "call-received", color: palette.teal,   label: "Incoming" },
  outgoing: { icon: "call-made",     color: palette.violet, label: "Outgoing" },
  missed:   { icon: "call-missed",   color: palette.red,    label: "Missed"   },
  rejected: { icon: "call-missed",   color: palette.amber,  label: "Rejected" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    const s = new Date(now); s.setHours(0, 0, 0, 0);
    return calls.filter(c => new Date(c.start_time) >= s);
  }
  if (key === "yesterday") {
    const s = new Date(now); s.setDate(now.getDate() - 1); s.setHours(0, 0, 0, 0);
    const e = new Date(now); e.setDate(now.getDate() - 1); e.setHours(23, 59, 59, 999);
    return calls.filter(c => { const t = new Date(c.start_time); return t >= s && t <= e; });
  }
  if (key === "7d") {
    const s = new Date(now); s.setDate(now.getDate() - 7); s.setHours(0, 0, 0, 0);
    return calls.filter(c => new Date(c.start_time) >= s);
  }
  const s = new Date(now); s.setDate(now.getDate() - 30); s.setHours(0, 0, 0, 0);
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

// ── Animated card entrance ────────────────────────────────────────────────────
function FadeCard({ children, delay = 0, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 380, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
      Animated.timing(translateY,  { toValue: 0, duration: 380, delay, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

// ── Call Sheet ────────────────────────────────────────────────────────────────
function CallSheet({ visible, onClose, title, calls, color }) {
  const { theme } = useTheme();
  const router = useRouter();
  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
    }
  }, [visible]);

  const renderItem = useCallback(({ item: c }) => {
    const meta = TYPE_META[c.call_type] || TYPE_META.incoming;
    return (
      <Pressable
        onPress={() => { onClose(); router.push({ pathname: "/call-detail", params: { clientEventId: c.client_event_id || "", callId: "" } }); }}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: SPACE.md,
          paddingVertical: 13, paddingHorizontal: SPACE.lg,
          borderBottomWidth: 1, borderBottomColor: theme.border,
          backgroundColor: pressed ? theme.surface2 : "transparent",
        })}
      >
        <View style={{ width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.bodyBold, color: theme.primary }} numberOfLines={1}>
            {c.contact_name && c.contact_name !== "Unknown" ? c.contact_name : c.phone_number}
          </Text>
          <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2 }} numberOfLines={1}>
            {c.phone_number} · {relTime(c.start_time)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Text style={{ ...TYPE.label, color: meta.color }}>{meta.label}</Text>
          <Text style={{ ...TYPE.micro, color: theme.dim, marginTop: 2 }}>{fmtDur(c.duration_seconds)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.dim} />
      </Pressable>
    );
  }, [theme, router, onClose]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,6,12,0.55)" }} onPress={onClose} />
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: theme.surface,
        borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
        borderWidth: 1, borderColor: theme.border,
        maxHeight: "78%",
        transform: [{ translateY: slideY }],
        shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 20,
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong, alignSelf: "center", marginTop: SPACE.md, marginBottom: 2 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ ...TYPE.h3, color: theme.primary }}>{title}</Text>
            <Badge tone="teal">{calls.length}</Badge>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: theme.surface2, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={16} color={theme.muted} />
          </Pressable>
        </View>
        {calls.length === 0 ? (
          <EmptyState icon="call-outline" title="No calls in this period" />
        ) : (
          <FlatList
            data={calls}
            keyExtractor={(_, i) => String(i)}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// ── KPI Pill (Incoming / Outgoing / Missed) ───────────────────────────────────
function KpiPill({ label, value, color, icon, onPress }) {
  const { theme, shadowSoft } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  function onPressIn() { Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, speed: 60 }).start(); }
  function onPressOut() { Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 60, bounciness: 10 }).start(); }
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={{ flex: 1 }}>
      <Animated.View style={[{
        backgroundColor: theme.card,
        borderRadius: RADIUS.xl,
        padding: SPACE.lg,
        borderWidth: 2,
        borderColor: color,
        alignItems: "center",
        minHeight: 88,
        justifyContent: "center",
        gap: SPACE.xs,
        transform: [{ scale }],
      }, shadowSoft]}>
        <View style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={icon} size={17} color={color} />
        </View>
        <Text style={{ fontSize: 26, fontWeight: "800", color: theme.primary, lineHeight: 32 }}>
          <CountUp value={value} />
        </Text>
        <Text style={{ ...TYPE.micro, color: theme.muted, textAlign: "center" }}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Recent Call Row ───────────────────────────────────────────────────────────
function RecentCallRow({ c, theme, onPress }) {
  const meta = TYPE_META[c.call_type] || TYPE_META.incoming;
  const scale = useRef(new Animated.Value(1)).current;
  function onPressIn() { Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 80 }).start(); }
  function onPressOut() { Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 60 }).start(); }
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={{
        flexDirection: "row", alignItems: "center", gap: SPACE.md,
        paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border,
        transform: [{ scale }],
      }}>
        <View style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={meta.icon} size={17} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...TYPE.bodyBold, color: theme.primary }} numberOfLines={1}>
            {c.contact_name && c.contact_name !== "Unknown" ? c.contact_name : c.phone_number}
          </Text>
          <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 1 }} numberOfLines={1}>
            {c.phone_number}{c.source && c.source !== "UNKNOWN" ? ` · ${c.source}` : ""}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Text style={{ ...TYPE.label, color: meta.color }}>{meta.label}</Text>
          <Text style={{ ...TYPE.micro, color: theme.dim, marginTop: 2 }}>{relTime(c.start_time)}</Text>
          {c.duration_seconds > 0 && (
            <Text style={{ ...TYPE.micro, color: theme.dim }}>{fmtDur(c.duration_seconds)}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.dim} />
      </Animated.View>
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [range, setRange]           = useState("today");
  const [allCalls, setAllCalls]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet]           = useState(null);
  const [lastSync, setLastSync]     = useState(null);
  const mountedRef                  = useRef(true);
  const router                      = useRouter();
  const { theme, shadowCard }       = useTheme();
  const { width }                   = useWindowDimensions();
  const contentW                    = width - 32;

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
      const calls = await getRealCallLog(30);
      if (mountedRef.current) setAllCalls(calls);
    } catch { /* silent */ } finally {
      if (mountedRef.current) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rangeFiltered = useMemo(() => filterByRange(allCalls, range), [allCalls, range]);
  const stats         = useMemo(() => computeStats(rangeFiltered), [rangeFiltered]);
  const daily7        = useMemo(() => buildDaily7(allCalls), [allCalls]);
  const recentCalls   = useMemo(() => [...rangeFiltered].sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 8), [rangeFiltered]);

  function openSheet(title, filter, color) {
    const calls = filter === "all" ? rangeFiltered : rangeFiltered.filter(c => c.call_type === filter);
    setSheet({ title, calls, color });
  }

  const syncLabel = lastSync ? `Synced ${relTime(new Date(lastSync).toISOString())}` : "Not synced yet";

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!loading && allCalls.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
        <AppHeader />
        <EmptyState
          icon="call-outline"
          title="No calls recorded"
          message={"CallNexa reads your Android call log.\nMake a call and pull down to refresh."}
          action={
            <Pressable onPress={() => load(true)} style={{ marginTop: SPACE.md }}>
              <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
      >
        {/* ── Range selector ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, paddingBottom: SPACE.sm, gap: SPACE.sm }}>
          {RANGES.map(r => {
            const active = r.key === range;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={{
                  flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.md, alignItems: "center",
                  backgroundColor: active ? palette.teal : theme.surface,
                  borderWidth: 1, borderColor: active ? palette.teal : theme.border,
                }}
              >
                <Text style={{ ...TYPE.label, color: active ? "#04211d" : theme.muted }}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator color={palette.teal} size="large" />
            <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: SPACE.md }}>Reading call log…</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: SPACE.lg, gap: SPACE.md }}>

            {/* ── HERO CARD — KPIs + RadialRing ── */}
            <FadeCard delay={0}>
              <View style={[{
                backgroundColor: theme.card,
                borderRadius: RADIUS.xxl,
                borderWidth: 1, borderColor: theme.border,
                overflow: "hidden",
              }, shadowCard]}>
                {/* Gradient accent top strip */}
                <LinearGradient colors={["rgba(20,184,166,0.08)", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 80 }} />

                <View style={{ padding: SPACE.lg }}>
                  {/* Header row */}
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACE.lg }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...TYPE.micro, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACE.xs }}>
                        {RANGES.find(r => r.key === range)?.label} Calls
                      </Text>
                      <Pressable onPress={() => openSheet("All Calls", "all", palette.teal)}>
                        <Text style={{ fontSize: 52, fontWeight: "800", color: theme.primary, lineHeight: 60 }}>
                          <CountUp value={stats.total} />
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginTop: 2 }}>
                          <Text style={{ ...TYPE.label, color: palette.teal }}>View all calls</Text>
                          <Ionicons name="arrow-forward" size={12} color={palette.teal} />
                        </View>
                      </Pressable>
                    </View>
                    <RadialRing percent={stats.connPct} size={110} stroke={11} label="Connected" />
                  </View>

                  {/* Divider */}
                  <View style={{ height: 1, backgroundColor: theme.border, marginBottom: SPACE.md }} />

                  {/* Stats row */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    {[
                      { label: "Talk Time", value: fmtSecs(stats.totalSecs), color: palette.teal,    onPress: () => openSheet("All Calls", "all", palette.teal) },
                      { label: "Avg Call",  value: fmtDur(stats.avgSecs),    color: palette.violet,  onPress: null },
                      { label: "Connected", value: stats.connected,          color: palette.emerald, onPress: () => openSheet("Connected", "all", palette.emerald) },
                    ].map(s => (
                      <Pressable key={s.label} onPress={s.onPress || undefined} style={{ alignItems: "center", flex: 1 }}>
                        <Text style={{ fontSize: 18, fontWeight: "800", color: s.color }}>{s.value}</Text>
                        <Text style={{ ...TYPE.micro, color: theme.muted, marginTop: 3 }}>{s.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Sync status */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: theme.border }}>
                    <LiveDot color={palette.emerald} />
                    <Text style={{ ...TYPE.micro, color: theme.dim }}>{syncLabel}</Text>
                  </View>
                </View>
              </View>
            </FadeCard>

            {/* ── KPI PILLS: Incoming / Outgoing / Missed ── */}
            <FadeCard delay={80}>
              <View style={{ flexDirection: "row", gap: SPACE.sm }}>
                <KpiPill label="Incoming" value={stats.incoming} color={palette.teal}   icon="call-received" onPress={() => openSheet("Incoming Calls", "incoming", palette.teal)} />
                <KpiPill label="Outgoing" value={stats.outgoing} color={palette.violet} icon="call-made"     onPress={() => openSheet("Outgoing Calls", "outgoing", palette.violet)} />
                <KpiPill label="Missed"   value={stats.missed}   color={palette.red}    icon="call-missed"   onPress={() => openSheet("Missed Calls",   "missed",   palette.red)} />
              </View>
            </FadeCard>

            {/* ── 7-DAY ACTIVITY ── */}
            {daily7.some(d => d.total > 0) && (
              <FadeCard delay={160}>
                <View style={[{ backgroundColor: theme.card, borderRadius: RADIUS.xl, padding: SPACE.lg, borderWidth: 1, borderColor: theme.border }, shadowCard]}>
                  <CardHeader icon="stats-chart-outline" title="7-Day Activity" subtitle="Daily call volume" />
                  <AnimatedBars data={daily7} width={contentW - SPACE.xxxl} height={64} />
                  {/* Count row */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm }}>
                    {daily7.map((d, i) => (
                      <View key={i} style={{ flex: 1, alignItems: "center" }}>
                        <Text style={{ ...TYPE.micro, fontWeight: "700", color: d.total > 0 ? theme.secondary : theme.dim }}>{d.total || ""}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </FadeCard>
            )}

            {/* ── RECENT CALLS ── */}
            {recentCalls.length > 0 && (
              <FadeCard delay={240}>
                <View style={[{ backgroundColor: theme.card, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }, shadowCard]}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, paddingBottom: SPACE.md }}>
                    <CardHeader icon="time-outline" title="Recent Calls" />
                    <Pressable onPress={() => router.push("/(tabs)/logs")} hitSlop={8}>
                      <Text style={{ ...TYPE.label, color: palette.teal }}>See all →</Text>
                    </Pressable>
                  </View>
                  <View style={{ paddingHorizontal: SPACE.lg }}>
                    {recentCalls.map((c, i) => (
                      <RecentCallRow
                        key={c.client_event_id || i}
                        c={c}
                        theme={theme}
                        onPress={() => router.push({ pathname: "/call-detail", params: { clientEventId: c.client_event_id || "", callId: "" } })}
                      />
                    ))}
                  </View>
                  <View style={{ height: SPACE.sm }} />
                </View>
              </FadeCard>
            )}

          </View>
        )}
      </ScrollView>

      {sheet && (
        <CallSheet
          visible={!!sheet}
          onClose={() => setSheet(null)}
          title={sheet.title}
          calls={sheet.calls}
          color={sheet.color}
        />
      )}
    </SafeAreaView>
  );
}

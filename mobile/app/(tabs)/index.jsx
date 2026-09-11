import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, Pressable, useWindowDimensions,
  RefreshControl, ActivityIndicator, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { RadialRing, Sparkline, MiniBars } from "../../src/charts";
import { getRealCallLog } from "../../src/callLogService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

// ── Constants ─────────────────────────────────────────────────────────────────
const RANGES = [
  { key: "today",     label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d",        label: "7 Days" },
  { key: "30d",       label: "30 Days" },
];

const TYPE_META = {
  incoming: { icon: "call-received",  color: palette.teal,    label: "Incoming" },
  outgoing: { icon: "call-made",      color: palette.violet,  label: "Outgoing" },
  missed:   { icon: "call-missed",    color: palette.red,     label: "Missed"   },
  rejected: { icon: "call-missed",    color: palette.amber,   label: "Rejected" },
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

// ── Call List Bottom Sheet ────────────────────────────────────────────────────
function CallSheet({ visible, onClose, title, calls, color }) {
  const { theme } = useTheme();
  const router = useRouter();
  const renderItem = useCallback(({ item: c }) => {
    const meta = TYPE_META[c.call_type] || TYPE_META.incoming;
    return (
      <Pressable
        onPress={() => {
          onClose();
          router.push({ pathname: "/call-detail", params: { clientEventId: c.client_event_id || "", callId: "" } });
        }}
        style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          paddingVertical: 13, paddingHorizontal: 16,
          borderBottomWidth: 1, borderBottomColor: theme.border,
        }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center" }}>
          <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }} numberOfLines={1}>
            {c.contact_name && c.contact_name !== "Unknown" ? c.contact_name : c.phone_number}
          </Text>
          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }} numberOfLines={1}>
            {c.phone_number} · {relTime(c.start_time)}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: meta.color }}>{meta.label}</Text>
          <Text style={{ fontSize: 11, color: theme.dim, marginTop: 2 }}>{fmtDur(c.duration_seconds)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={theme.dim} />
      </Pressable>
    );
  }, [theme, router, onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: "78%",
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginTop: 10, marginBottom: 2 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary }}>{title}</Text>
            <View style={{ backgroundColor: color + "22", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color }}>{calls.length}</Text>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color={theme.muted} />
          </Pressable>
        </View>
        {calls.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 48 }}>
            <Ionicons name="call-outline" size={36} color={theme.dim} />
            <Text style={{ fontSize: 14, color: theme.muted, marginTop: 12 }}>No calls in this period</Text>
          </View>
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
      </View>
    </Modal>
  );
}

// ── Stat Pill — tappable ──────────────────────────────────────────────────────
function StatPill({ label, value, color, icon, onPress }) {
  const { theme, shadowSoft } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1, backgroundColor: pressed ? color + "18" : theme.card,
          borderRadius: 14, padding: 14, borderWidth: 1,
          borderColor: pressed ? color : theme.border,
          alignItems: "center", minHeight: 80, justifyContent: "center",
        },
        shadowSoft,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={color} />
      <Text style={{ fontSize: 24, fontWeight: "800", color: theme.primary, marginTop: 6 }}>{value}</Text>
      <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 3, textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

// ── Recent Call Row ───────────────────────────────────────────────────────────
function RecentCallRow({ c, theme, onPress }) {
  const meta = TYPE_META[c.call_type] || TYPE_META.incoming;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12,
        paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border,
        opacity: pressed ? 0.7 : 1,
      })}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name={meta.icon} size={17} color={meta.color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: "600", color: theme.primary }} numberOfLines={1}>
          {c.contact_name && c.contact_name !== "Unknown" ? c.contact_name : c.phone_number}
        </Text>
        <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 1 }} numberOfLines={1}>
          {c.phone_number}
          {c.source && c.source !== "UNKNOWN" ? ` · ${c.source}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", flexShrink: 0 }}>
        <Text style={{ fontSize: 11.5, fontWeight: "600", color: meta.color }}>{meta.label}</Text>
        <Text style={{ fontSize: 11, color: theme.dim, marginTop: 2 }}>{relTime(c.start_time)}</Text>
        {c.duration_seconds > 0 && (
          <Text style={{ fontSize: 10.5, color: theme.dim }}>{fmtDur(c.duration_seconds)}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={14} color={theme.dim} />
    </Pressable>
  );
}

// ── Sync Status Row ───────────────────────────────────────────────────────────
function SyncStatusRow({ theme }) {
  const [lastSync, setLastSync] = useState(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    AsyncStorage.getItem("callos_last_sync_ts").then(ts => {
      if (ts) setLastSync(parseInt(ts, 10));
    }).catch(() => {});
  }, []);

  const syncLabel = lastSync
    ? `Last sync ${relTime(new Date(lastSync).toISOString())}`
    : "Not synced yet";

  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 8,
      paddingHorizontal: 16, paddingVertical: 8,
      backgroundColor: theme.surface, borderBottomWidth: 1, borderBottomColor: theme.border,
    }}>
      <Ionicons name="sync-outline" size={13} color={theme.dim} />
      <Text style={{ fontSize: 11.5, color: theme.dim }}>{syncLabel}</Text>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Home() {
  const [range, setRange]           = useState("today");
  const [allCalls, setAllCalls]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet]           = useState(null);
  const mountedRef                  = useRef(true);
  const router                      = useRouter();
  const { theme, shadowSoft }       = useTheme();
  const { width }                   = useWindowDimensions();
  const contentW                    = width - 32;

  useEffect(() => {
    mountedRef.current = true;
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
    const calls = filter === "all"
      ? rangeFiltered
      : rangeFiltered.filter(c => c.call_type === filter);
    setSheet({ title, calls, color });
  }

  const statPills = [
    { label: "Incoming", value: stats.incoming, color: palette.teal,   icon: "call-received", filter: "incoming" },
    { label: "Outgoing", value: stats.outgoing, color: palette.violet, icon: "call-made",     filter: "outgoing" },
    { label: "Missed",   value: stats.missed,   color: palette.red,    icon: "call-missed",   filter: "missed"   },
  ];

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!loading && allCalls.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
        <AppHeader />
        <SyncStatusRow theme={theme} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Ionicons name="call-outline" size={52} color={theme.dim} />
          <Text style={{ fontSize: 18, fontWeight: "700", color: theme.primary, marginTop: 16, textAlign: "center" }}>No calls recorded</Text>
          <Text style={{ fontSize: 13.5, color: theme.muted, marginTop: 8, textAlign: "center", lineHeight: 20 }}>
            CallNexa reads your Android call log.{"\n"}Make a call and pull down to refresh.
          </Text>
          <Pressable
            onPress={() => load(true)}
            style={{ marginTop: 24, backgroundColor: palette.teal + "22", borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: palette.teal + "44" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: palette.teal }}>Refresh</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader />
      <SyncStatusRow theme={theme} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
      >
        {/* ── Range selector ── */}
        <View style={{ flexDirection: "row", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 8 }}>
          {RANGES.map(r => {
            const active = r.key === range;
            return (
              <Pressable
                key={r.key}
                onPress={() => setRange(r.key)}
                style={{
                  flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                  backgroundColor: active ? palette.teal : theme.surface,
                  borderWidth: 1, borderColor: active ? palette.teal : theme.border,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#04211d" : theme.muted }}>{r.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator color={palette.teal} size="large" />
            <Text style={{ color: theme.muted, marginTop: 12, fontSize: 13 }}>Reading call log…</Text>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 16 }}>

            {/* ── PRIMARY SUMMARY CARD ── */}
            <View style={[{ backgroundColor: theme.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }, shadowSoft]}>
              {/* Top row: total + ring */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 12, color: theme.muted, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {RANGES.find(r => r.key === range)?.label} Calls
                  </Text>
                  <Pressable onPress={() => openSheet("All Calls", "all", palette.teal)}>
                    <Text style={{ fontSize: 48, fontWeight: "800", color: theme.primary, lineHeight: 56 }}>{stats.total}</Text>
                    <Text style={{ fontSize: 12, color: palette.teal, fontWeight: "600" }}>Tap to view all →</Text>
                  </Pressable>
                </View>
                <RadialRing percent={stats.connPct} size={110} stroke={11} label="Connected" />
              </View>

              {/* Divider */}
              <View style={{ height: 1, backgroundColor: theme.border, marginBottom: 14 }} />

              {/* Stats row */}
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {[
                  { label: "Talk Time", value: fmtSecs(stats.totalSecs), color: palette.teal,    onPress: () => openSheet("All Calls", "all", palette.teal) },
                  { label: "Avg Call",  value: fmtDur(stats.avgSecs),    color: palette.violet,  onPress: null },
                  { label: "Connected", value: stats.connected,          color: palette.emerald, onPress: () => openSheet("Connected Calls", "all", palette.emerald) },
                ].map(s => (
                  <Pressable key={s.label} onPress={s.onPress || undefined} style={{ alignItems: "center", flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: s.color }}>{s.value}</Text>
                    <Text style={{ fontSize: 10.5, color: theme.muted, marginTop: 3 }}>{s.label}</Text>
                    {s.onPress && <Text style={{ fontSize: 9, color: s.color, marginTop: 1 }}>tap →</Text>}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── STAT PILLS: Incoming / Outgoing / Missed ── */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {statPills.map(s => (
                <StatPill
                  key={s.label}
                  label={s.label}
                  value={s.value}
                  color={s.color}
                  icon={s.icon}
                  onPress={() => openSheet(s.label + " Calls", s.filter, s.color)}
                />
              ))}
            </View>

            {/* ── 7-DAY ACTIVITY ── */}
            {daily7.some(d => d.total > 0) && (
              <View style={[{ backgroundColor: theme.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }, shadowSoft]}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>7-Day Activity</Text>
                <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6, height: 56 }}>
                  {daily7.map((d, i) => {
                    const maxTotal = Math.max(...daily7.map(x => x.total), 1);
                    const h = Math.max((d.total / maxTotal) * 48, d.total > 0 ? 4 : 2);
                    const isToday = i === 6;
                    return (
                      <View key={i} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                        <View style={{ width: "100%", height: h, borderRadius: 4, backgroundColor: isToday ? palette.teal : palette.teal + "44" }} />
                        <Text style={{ fontSize: 9.5, color: isToday ? palette.teal : theme.dim, fontWeight: isToday ? "700" : "400" }}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10 }}>
                  {daily7.map((d, i) => (
                    <View key={i} style={{ flex: 1, alignItems: "center" }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: d.total > 0 ? theme.secondary : theme.dim }}>{d.total || ""}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── RECENT CALLS ── */}
            {recentCalls.length > 0 && (
              <View style={[{ backgroundColor: theme.card, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12, overflow: "hidden" }, shadowSoft]}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Recent Calls</Text>
                  <Pressable onPress={() => router.push("/(tabs)/logs")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "700", color: palette.teal }}>See all →</Text>
                  </Pressable>
                </View>
                <View style={{ paddingHorizontal: 16 }}>
                  {recentCalls.map((c, i) => (
                    <RecentCallRow
                      key={c.client_event_id || i}
                      c={c}
                      theme={theme}
                      onPress={() => router.push({ pathname: "/call-detail", params: { clientEventId: c.client_event_id || "", callId: "" } })}
                    />
                  ))}
                </View>
                <View style={{ height: 8 }} />
              </View>
            )}

            {/* ── PERFORMANCE METRICS ── */}
            <View style={[{ backgroundColor: theme.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }, shadowSoft]}>
              <Text style={{ fontSize: 13, fontWeight: "700", color: theme.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.4 }}>Performance</Text>
              {[
                { label: "Connected Rate", value: `${stats.connPct}%`,          bar: stats.connPct,                          color: palette.teal   },
                { label: "Avg Duration",   value: fmtDur(stats.avgSecs),         bar: Math.min(stats.avgSecs / 300 * 100, 100), color: palette.violet },
                { label: "Talk Time",      value: fmtSecs(stats.totalSecs),      bar: Math.min(stats.totalSecs / 3600 * 100, 100), color: palette.cyan },
              ].map(m => (
                <View key={m.label} style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5 }}>
                    <Text style={{ fontSize: 13, color: theme.secondary }}>{m.label}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: m.color }}>{m.value}</Text>
                  </View>
                  <View style={{ height: 5, backgroundColor: theme.border, borderRadius: 3, overflow: "hidden" }}>
                    <View style={{ width: `${m.bar}%`, height: "100%", backgroundColor: m.color, borderRadius: 3 }} />
                  </View>
                </View>
              ))}
            </View>

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

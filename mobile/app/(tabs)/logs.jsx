import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TextInput, Pressable, Linking,
  RefreshControl, ToastAndroid, Platform, Clipboard, Modal, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { palette, gradientBrand, useTheme } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";
import { getAllCallStatuses, STATUS } from "../../src/callStatusStore";
import { getRealCallLog } from "../../src/callLogService";

const CHIPS = ["All", "In", "Out", "Missed", "Recorded"];

const TYPE = {
  incoming: { icon: "call-received", color: palette.teal,   label: "Incoming" },
  outgoing: { icon: "call-made",     color: palette.violet, label: "Outgoing" },
  missed:   { icon: "call-missed",   color: palette.red,    label: "Missed"   },
  rejected: { icon: "call-missed",   color: palette.amber,  label: "Rejected" },
  blocked:  { icon: "call-missed",   color: palette.amber,  label: "Blocked"  },
};

// ── Sync status badge ─────────────────────────────────────────────────────────
const SYNC_BADGE = {
  [STATUS.SYNCED]:                  { label: "✓ Synced",          color: palette.emerald },
  [STATUS.SYNCING]:                 { label: "↻ Syncing…",        color: palette.teal    },
  [STATUS.SYNC_QUEUED]:             { label: "◷ Queued",          color: palette.amber   },
  [STATUS.SYNC_FAILED]:             { label: "! Failed",          color: palette.red     },
  [STATUS.DETECTED]:                { label: "◷ Detected",        color: palette.amber   },
  [STATUS.LOCAL_SAVED]:             { label: "◷ Saved",           color: palette.amber   },
  [STATUS.RECORDING_UPLOADED]:      { label: "🎙 Rec uploaded",   color: palette.violet  },
  [STATUS.RECORDING_UPLOADING]:     { label: "↑ Uploading rec…",  color: palette.violet  },
  [STATUS.TRANSCRIPTION_COMPLETED]: { label: "✦ Transcribed",     color: palette.cyan    },
};

function SyncBadge({ clientEventId, localStatuses }) {
  const entry = localStatuses[clientEventId];
  if (!entry) return null;

  // Show most advanced meaningful status
  let badge = null;
  if (entry.transcript_status === STATUS.TRANSCRIPTION_COMPLETED) {
    badge = SYNC_BADGE[STATUS.TRANSCRIPTION_COMPLETED];
  } else if (entry.recording_status === STATUS.RECORDING_UPLOADED) {
    badge = SYNC_BADGE[STATUS.RECORDING_UPLOADED];
  } else if (entry.recording_status === STATUS.RECORDING_UPLOADING) {
    badge = SYNC_BADGE[STATUS.RECORDING_UPLOADING];
  } else if (entry.sync_status) {
    badge = SYNC_BADGE[entry.sync_status];
  }

  if (!badge) return null;

  return (
    <View style={{ backgroundColor: badge.color + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 10, fontWeight: "700", color: badge.color }}>{badge.label}</Text>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDur(s) {
  if (!s) return "00:00";
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}
function isToday(iso) {
  const d = new Date(iso), now = new Date();
  return d.toDateString() === now.toDateString();
}
function isYesterday(iso) {
  const d = new Date(iso), now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString();
}
function groupLabel(iso) {
  if (isToday(iso)) return "Today";
  if (isYesterday(iso)) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function directCall(phone) {
  Linking.openURL(`tel:${phone.replace(/\s/g, "")}`);
}

// ── Dial Pad ──────────────────────────────────────────────────────────────────
function DialPad({ visible, onClose, theme }) {
  const [num, setNum] = useState("");
  const KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, minHeight: 52 }}>
            <Text style={{ fontSize: 32, fontWeight: "700", color: theme.primary, letterSpacing: 3, flex: 1, textAlign: "center" }}>{num || " "}</Text>
            {num.length > 0 && (
              <Pressable onPress={() => setNum((n) => n.slice(0, -1))} style={{ padding: 8 }}>
                <Ionicons name="backspace-outline" size={24} color={theme.muted} />
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, marginBottom: 24 }}>
            {KEYS.map((k) => (
              <Pressable key={k} onPress={() => setNum((n) => n + k)}
                style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "600", color: theme.primary }}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}>
            <Pressable onPress={onClose} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={26} color={theme.muted} />
            </Pressable>
            <Pressable onPress={() => { if (!num) return; onClose(); directCall(num); }} disabled={!num}>
              <LinearGradient colors={gradientBrand} style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="call" size={28} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Sync Progress Bar ─────────────────────────────────────────────────────────────────────────────────
/**
 * Shows a floating bar at the top when calls are pending/syncing.
 * Disappears automatically after all calls are synced.
 */
function SyncProgressBar({ localStatuses, theme }) {
  const slideY = useRef(new Animated.Value(-60)).current;
  const entries = Object.values(localStatuses);
  const pending  = entries.filter((e) => [STATUS.DETECTED, STATUS.LOCAL_SAVED, STATUS.SYNC_QUEUED, STATUS.SYNCING].includes(e.sync_status)).length;
  const synced   = entries.filter((e) => e.sync_status === STATUS.SYNCED).length;
  const failed   = entries.filter((e) => e.sync_status === STATUS.SYNC_FAILED).length;
  const total    = entries.length;
  const visible  = pending > 0 || failed > 0;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : -60,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [visible]);

  const isSyncing = entries.some((e) => e.sync_status === STATUS.SYNCING);
  const color  = failed > 0 ? palette.red : isSyncing ? palette.teal : palette.amber;
  const label  = isSyncing
    ? `Syncing ${pending} call${pending !== 1 ? "s" : ""}...`
    : failed > 0
    ? `${failed} call${failed !== 1 ? "s" : ""} failed to sync`
    : `${pending} call${pending !== 1 ? "s" : ""} queued to sync`;

  return (
    <Animated.View style={{
      transform: [{ translateY: slideY }],
      backgroundColor: color + "ee",
      paddingHorizontal: 16,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    }}>
      <Ionicons
        name={isSyncing ? "sync" : failed > 0 ? "alert-circle" : "time"}
        size={16}
        color="#fff"
      />
      <Text style={{ flex: 1, fontSize: 13, fontWeight: "700", color: "#fff" }}>{label}</Text>
      {total > 0 && (
        <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
          {synced}/{total} done
        </Text>
      )}
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────────────────────────────────
export default function Calls() {
  const [query, setQuery]       = useState("");
  const [chip, setChip]         = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [allCalls, setAllCalls] = useState([]);
  const [localStatuses, setLocalStatuses] = useState({});
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);
  const { theme, shadowSoft } = useTheme();
  const router = useRouter();
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      // Load local Android call log + server calls + local statuses in parallel
      const [localRaw, serverRes, statuses] = await Promise.all([
        getRealCallLog(30).catch(() => []),
        api.getCalls({ page_size: 200 }).catch(() => ({ items: [] })),
        getAllCallStatuses(),
      ]);

      // Build status map
      const statusMap = {};
      statuses.forEach((s) => { statusMap[s.client_event_id] = s; });
      setLocalStatuses(statusMap);

      // Build server call map keyed by client_event_id for dedup
      const serverMap = {};
      (serverRes.items || []).forEach((c) => {
        if (c.client_event_id) serverMap[c.client_event_id] = c;
      });

      // Map local calls — prefer server data if already synced
      const localItems = localRaw.map((c) => {
        const server = serverMap[c.client_event_id];
        return {
          id:            server?.id || c.client_event_id,
          clientEventId: c.client_event_id,
          type:          c.call_type || "incoming",
          name:          server?.contact_name || c.contact_name || "Unknown",
          phone:         c.phone_number,
          duration:      fmtDur(c.duration_seconds),
          durationSec:   c.duration_seconds,
          time:          new Date(c._start_ms || c.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          ago:           relTime(c.start_time),
          group:         groupLabel(c.start_time),
          sim:           c.source || "SIM 1",
          recording:     !!c.recording_path || server?.recording_available || false,
          _ts:           c._start_ms || new Date(c.start_time).getTime(),
          _fromLocal:    true,
        };
      });

      // Add any server calls not in local log (older than 30 days or from other devices)
      const localIds = new Set(localRaw.map((c) => c.client_event_id));
      const serverOnly = (serverRes.items || [])
        .filter((c) => !localIds.has(c.client_event_id))
        .map((c) => ({
          id:            c.id,
          clientEventId: c.client_event_id,
          type:          c.call_type || "incoming",
          name:          c.contact_name || "Unknown",
          phone:         c.phone_number,
          duration:      fmtDur(c.duration_seconds),
          durationSec:   c.duration_seconds,
          time:          new Date(c.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          ago:           relTime(c.start_time),
          group:         groupLabel(c.start_time),
          sim:           c.source || "SIM 1",
          recording:     c.recording_available,
          _ts:           new Date(c.start_time).getTime(),
          _fromLocal:    false,
        }));

      // Merge + sort newest first
      const merged = [...localItems, ...serverOnly]
        .sort((a, b) => b._ts - a._ts);

      setAllCalls(merged);
    } catch { /* silent — show stale data */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  // Refresh local sync statuses every 3s so progress bar stays live
  useEffect(() => {
    const t = setInterval(async () => {
      const statuses = await getAllCallStatuses();
      const statusMap = {};
      statuses.forEach((s) => { statusMap[s.client_event_id] = s; });
      setLocalStatuses(statusMap);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const filtered = allCalls.filter((c) => {
    const q = [c.name, c.phone].join(" ").toLowerCase().includes(query.toLowerCase());
    let f = true;
    if (chip === "In")          f = c.type === "incoming";
    else if (chip === "Out")    f = c.type === "outgoing";
    else if (chip === "Missed") f = c.type === "missed";
    else if (chip === "Recorded") f = !!c.recording;
    return q && f;
  });

  // Group by date
  const groups = [];
  const seen = new Set();
  filtered.forEach((c) => {
    if (!seen.has(c.group)) { seen.add(c.group); groups.push(c.group); }
  });

  const Action = ({ icon, label, color = palette.teal, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} style={{ alignItems: "center", gap: 4, opacity: disabled ? 0.35 : 1 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: color + "1a", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={{ fontSize: 10.5, color: theme.muted }}>{label}</Text>
    </Pressable>
  );

  const Row = ({ c }) => {
    const meta = TYPE[c.type] || TYPE.incoming;
    const open = expanded === c.id;
    return (
      <Pressable
        onPress={() => {
          // Navigate to call detail screen
          router.push({
            pathname: "/call-detail",
            params: { clientEventId: c.clientEventId, callId: c.id },
          });
        }}
        onLongPress={() => setExpanded(open ? null : c.id)}
        style={[{ flexDirection: "row", backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }, shadowSoft]}
      >
        <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: meta.color }} />
        <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", marginLeft: 4, backgroundColor: meta.color + "1f" }}>
          <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary, flex: 1 }} numberOfLines={1}>{c.name}</Text>
            <Text style={{ fontSize: 11.5, color: theme.muted }}>{c.time}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
            <Text style={{ fontSize: 13, color: theme.muted }}>{c.phone}</Text>
            <Text style={{ fontSize: 11, color: theme.dim }}>{c.ago}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: meta.color }}>{meta.label} · {c.duration}</Text>
            <View style={{ borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontSize: 10, color: theme.muted, fontWeight: "600" }}>{c.sim}</Text>
            </View>
            {c.recording && <Ionicons name="mic" size={13} color={theme.dim} />}
          </View>
          {/* Sync status badge */}
          <SyncBadge clientEventId={c.clientEventId} localStatuses={localStatuses} />

          {/* Long-press expanded actions */}
          {open && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Action icon="call" label="Call" color={palette.emerald} onPress={() => directCall(c.phone)} />
              <Action icon="logo-whatsapp" label="WhatsApp" color="#25D366"
                onPress={() => Linking.openURL(`whatsapp://send?phone=${c.phone.replace(/\D/g, "")}`)} />
              <Action icon="information-circle-outline" label="Details" color={palette.teal}
                onPress={() => router.push({ pathname: "/call-detail", params: { clientEventId: c.clientEventId, callId: c.id } })} />
              <Action icon="copy-outline" label="Copy"
                onPress={() => {
                  Clipboard.setString(c.phone);
                  if (Platform.OS === "android") ToastAndroid.show("Copied!", ToastAndroid.SHORT);
                }} />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <SyncProgressBar localStatuses={localStatuses} theme={theme} />
      <AppHeader title="Calls" right={
        <Pressable onPress={() => load(true)} style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="refresh-outline" size={18} color={theme.secondary} />
        </Pressable>
      } />

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={[{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border }, shadowSoft]}>
          <Ionicons name="search" size={18} color={theme.dim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by name or number…" placeholderTextColor={theme.dim} style={{ flex: 1, marginLeft: 8, fontSize: 14.5, color: theme.primary }} />
          {query.length > 0 && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={theme.dim} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CHIPS.map((f) => {
              const on = f === chip;
              const count =
                f === "All"      ? allCalls.length :
                f === "In"       ? allCalls.filter((c) => c.type === "incoming").length :
                f === "Out"      ? allCalls.filter((c) => c.type === "outgoing").length :
                f === "Missed"   ? allCalls.filter((c) => c.type === "missed").length :
                allCalls.filter((c) => c.recording).length;
              return (
                <Pressable key={f} onPress={() => setChip(f)} style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? palette.teal : theme.border, backgroundColor: on ? palette.teal : theme.surface, flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#04211d" : theme.muted }}>{f}</Text>
                  {count > 0 && (
                    <View style={{ backgroundColor: on ? "rgba(0,0,0,0.2)" : theme.border, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: on ? "#04211d" : theme.dim }}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
      >
        {loading && <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40 }}>Loading calls…</Text>}
        {!loading && filtered.length === 0 && (
          <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40 }}>
            {allCalls.length === 0 ? "No calls synced yet. Pull down to refresh." : "No calls match your filters."}
          </Text>
        )}
        {groups.map((g) => (
          <View key={g}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: theme.muted, marginVertical: 8, marginLeft: 2 }}>{g}</Text>
            {filtered.filter((c) => c.group === g).map((c) => <Row key={c.id} c={c} />)}
          </View>
        ))}
      </ScrollView>

      {/* Dial Pad FAB */}
      <Pressable onPress={() => setDialOpen(true)} style={{ position: "absolute", bottom: 100, right: 20, width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", elevation: 8 }}>
        <LinearGradient colors={gradientBrand} style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="keypad-outline" size={24} color="#fff" />
        </LinearGradient>
      </Pressable>

      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} theme={theme} />
    </SafeAreaView>
  );
}

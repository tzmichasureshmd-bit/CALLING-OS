import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, TYPE, SPACE, RADIUS, palette } from "../../src/theme";
import { getAllCallStatuses, STATUS } from "../../src/callStatusStore";
import { getRealCallLog } from "../../src/callLogService";
import { useAuth } from "../../src/AuthContext";

const TEAL = "#0ABFA3";

const CALL_TYPE_ICON = {
  incoming: "call-received",
  outgoing: "call-made",
  missed:   "call-missed",
  rejected: "call-missed",
};
const CALL_TYPE_COLOR = {
  incoming: TEAL,
  outgoing: palette.violet,
  missed:   palette.red,
  rejected: palette.amber,
};

function fmtDur(s) {
  if (!s) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function relTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function CallRow({ item, theme, onPress }) {
  const typeColor = CALL_TYPE_COLOR[item.call_type] || TEAL;
  const typeIcon  = CALL_TYPE_ICON[item.call_type]  || "call-outline";
  const name      = item.contact_name && item.contact_name !== "Unknown"
    ? item.contact_name : null;
  const synced    = item.sync_status === STATUS.SYNCED;
  const failed    = item.sync_status === STATUS.SYNC_FAILED || item.sync_status === STATUS.SYNC_OFFLINE;

  return (
    <Pressable onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: theme.border }}>

      {/* Call type icon */}
      <View style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: typeColor + "18", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <MaterialCommunityIcons name={typeIcon} size={18} color={typeColor} />
      </View>

      {/* Left: name + number */}
      <View style={{ flex: 1 }}>
        {name && (
          <Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary }} numberOfLines={1}>{name}</Text>
        )}
        <Text style={{ fontSize: name ? 12 : 14, color: name ? theme.muted : theme.primary, fontWeight: name ? "400" : "700", marginTop: name ? 1 : 0 }}>
          {item.phone_number || "Unknown"}
        </Text>
        <Text style={{ fontSize: 11, color: theme.dim, marginTop: 2 }}>
          {fmtDur(item.duration_seconds)} · {relTime(item.start_time)}
        </Text>
      </View>

      {/* Right: ✓ synced or ✗ device only */}
      <View style={{ alignItems: "center", gap: 3 }}>
        {synced ? (
          <>
            <Ionicons name="checkmark-circle" size={24} color={palette.emerald} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: palette.emerald }}>Synced</Text>
          </>
        ) : failed ? (
          <>
            <Ionicons name="close-circle" size={24} color={palette.red} />
            <Text style={{ fontSize: 10, fontWeight: "700", color: palette.red }}>Failed</Text>
          </>
        ) : (
          <>
            <Ionicons name="phone-portrait-outline" size={22} color={theme.dim} />
            <Text style={{ fontSize: 10, color: theme.dim }}>Device</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const FILTERS = [
  { key: "all",    label: "All"    },
  { key: "synced", label: "✓ Synced" },
  { key: "device", label: "✗ Device" },
  { key: "failed", label: "Failed" },
];

export default function SyncStatus() {
  const { theme } = useTheme();
  const router    = useRouter();
  const { syncCalls, deviceId } = useAuth();

  const [calls,      setCalls]      = useState([]);
  const [filter,     setFilter]     = useState("all");
  const [query,      setQuery]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing,    setSyncing]    = useState(false);

  const load = useCallback(async () => {
    try {
      const [raw, statuses] = await Promise.all([
        getRealCallLog(30),
        getAllCallStatuses(),
      ]);
      const statusMap = {};
      statuses.forEach(s => { statusMap[s.client_event_id] = s; });

      const merged = raw.map(c => ({
        ...c,
        sync_status:      statusMap[c.client_event_id]?.sync_status      || null,
        recording_status: statusMap[c.client_event_id]?.recording_status || null,
        call_id:          statusMap[c.client_event_id]?.call_id          || null,
      }));

      setCalls(merged);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
  }

  async function handleSync() {
    if (!deviceId) return;
    setSyncing(true);
    try { await syncCalls(); } catch {}
    await load();
    setSyncing(false);
  }

  // Apply filter + search
  const displayed = calls.filter(c => {
    if (filter === "synced") return c.sync_status === STATUS.SYNCED;
    if (filter === "failed") return c.sync_status === STATUS.SYNC_FAILED || c.sync_status === STATUS.SYNC_OFFLINE;
    if (filter === "device") return !c.sync_status || (c.sync_status !== STATUS.SYNCED && c.sync_status !== STATUS.SYNC_FAILED && c.sync_status !== STATUS.SYNC_OFFLINE);
    return true;
  }).filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (c.contact_name || "").toLowerCase().includes(q) || (c.phone_number || "").includes(q);
  });

  const synced  = calls.filter(c => c.sync_status === STATUS.SYNCED).length;
  const device  = calls.filter(c => !c.sync_status || (c.sync_status !== STATUS.SYNCED && c.sync_status !== STATUS.SYNC_FAILED && c.sync_status !== STATUS.SYNC_OFFLINE)).length;
  const failed  = calls.filter(c => c.sync_status === STATUS.SYNC_FAILED || c.sync_status === STATUS.SYNC_OFFLINE).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: SPACE.md }}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </Pressable>
        <Text style={{ ...TYPE.h3, color: theme.primary, flex: 1 }}>Sync Status</Text>
        <Pressable onPress={handleSync} disabled={syncing}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: TEAL + "1a", borderRadius: RADIUS.md, paddingHorizontal: 14, paddingVertical: 8 }}>
          {syncing
            ? <ActivityIndicator size="small" color={TEAL} />
            : <Ionicons name="cloud-upload-outline" size={16} color={TEAL} />}
          <Text style={{ ...TYPE.label, color: TEAL, fontWeight: "700" }}>Sync Now</Text>
        </Pressable>
      </View>

      {/* Summary row */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.sm }}>
        {[
          { label: "Total",  value: calls.length, color: theme.muted    },
          { label: "Synced", value: synced,        color: palette.emerald },
          { label: "Device", value: device,        color: theme.dim      },
          { label: "Failed", value: failed,        color: palette.red    },
        ].map(s => (
          <View key={s.label} style={{ flex: 1, backgroundColor: theme.card, borderRadius: RADIUS.md, padding: SPACE.sm, alignItems: "center", borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: s.color }}>{s.value}</Text>
            <Text style={{ ...TYPE.micro, color: theme.muted, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: SPACE.lg, marginBottom: SPACE.sm, backgroundColor: theme.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, paddingVertical: 9 }}>
        <Ionicons name="search-outline" size={16} color={theme.dim} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name or number…"
          placeholderTextColor={theme.dim}
          style={{ flex: 1, marginLeft: 8, fontSize: 13, color: theme.primary }}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={16} color={theme.dim} />
          </Pressable>
        )}
      </View>

      {/* Filter chips */}
      <View style={{ flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingBottom: SPACE.sm }}>
        {FILTERS.map(f => {
          const active = f.key === filter;
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: active ? TEAL : theme.card, borderWidth: 1, borderColor: active ? TEAL : theme.border }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#fff" : theme.muted }}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={TEAL} size="large" />
          <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 12 }}>Reading call log…</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.client_event_id}
          renderItem={({ item }) => (
            <CallRow
              item={item}
              theme={theme}
              onPress={() => router.push({ pathname: "/call-detail", params: { clientEventId: item.client_event_id || "", callId: item.call_id || "" } })}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          contentContainerStyle={displayed.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
              <Ionicons name="cloud-done-outline" size={52} color={theme.dim} />
              <Text style={{ ...TYPE.title, color: theme.muted }}>No calls found</Text>
              <Text style={{ ...TYPE.caption, color: theme.dim, textAlign: "center", paddingHorizontal: 40 }}>
                {query ? "Try a different search." : "Make a call or tap Sync Now."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

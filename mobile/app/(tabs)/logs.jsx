import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TextInput, Pressable, Linking, RefreshControl, ToastAndroid, Platform, Clipboard, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";

const CHIPS = ["All", "In", "Out", "Missed", "Recorded"];
const TYPE = {
  incoming: { icon: "call-received", color: palette.teal,   label: "Incoming" },
  outgoing: { icon: "call-made",     color: palette.violet, label: "Outgoing" },
  missed:   { icon: "call-missed",   color: palette.red,    label: "Missed"   },
  rejected: { icon: "call-missed",   color: palette.amber,  label: "Rejected" },
  blocked:  { icon: "call-missed",   color: palette.amber,  label: "Blocked"  },
};

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

// Direct call — no chooser popup
function directCall(phone) {
  const clean = phone.replace(/\s/g, "");
  Linking.openURL(`tel:${clean}`);
}

// ── Dial Pad Modal ────────────────────────────────────────────────────────────
function DialPad({ visible, onClose, theme }) {
  const [num, setNum] = useState("");
  const KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"];

  function press(k) { setNum((n) => n + k); }
  function del() { setNum((n) => n.slice(0, -1)); }
  function call() {
    if (!num) return;
    onClose();
    directCall(num);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 }}>
          {/* Number display */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 20, minHeight: 52 }}>
            <Text style={{ fontSize: 32, fontWeight: "700", color: theme.primary, letterSpacing: 3, flex: 1, textAlign: "center" }}>{num || " "}</Text>
            {num.length > 0 && (
              <Pressable onPress={del} style={{ padding: 8 }}>
                <Ionicons name="backspace-outline" size={24} color={theme.muted} />
              </Pressable>
            )}
          </View>

          {/* Keys grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16, marginBottom: 24 }}>
            {KEYS.map((k) => (
              <Pressable key={k} onPress={() => press(k)}
                style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "600", color: theme.primary }}>{k}</Text>
              </Pressable>
            ))}
          </View>

          {/* Call button */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 20 }}>
            <Pressable onPress={onClose} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={26} color={theme.muted} />
            </Pressable>
            <Pressable onPress={call} disabled={!num}>
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

export default function Calls() {
  const [query, setQuery]       = useState("");
  const [chip, setChip]         = useState("All");
  const [expanded, setExpanded] = useState(null);
  const [allCalls, setAllCalls] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dialOpen, setDialOpen] = useState(false);
  const { theme, shadowSoft } = useTheme();

  const load = useCallback((isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    api.getCalls({ page_size: 200 })
      .then((res) => {
        const items = (res.items || []).map((c) => ({
          id: c.id,
          type: c.call_type || "incoming",
          name: c.contact_name || "Unknown",
          phone: c.phone_number,
          duration: fmtDur(c.duration_seconds),
          durationSec: c.duration_seconds,
          time: new Date(c.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          ago: relTime(c.start_time),
          group: groupLabel(c.start_time),
          sim: c.source || "SIM 1",
          recording: c.recording_available,
          recordingUrl: c.recording_url || null,
        }));
        setAllCalls(items);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = allCalls.filter((c) => {
    const q = [c.name, c.phone].join(" ").toLowerCase().includes(query.toLowerCase());
    let f = true;
    if (chip === "In")         f = c.type === "incoming";
    else if (chip === "Out")   f = c.type === "outgoing";
    else if (chip === "Missed") f = c.type === "missed";
    else if (chip === "Recorded") f = !!c.recording;
    return q && f;
  });

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
      <Pressable onPress={() => setExpanded(open ? null : c.id)}
        style={[{ flexDirection: "row", backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }, shadowSoft]}>
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: meta.color }}>{meta.label} · {c.duration}</Text>
            <View style={{ borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}>
              <Text style={{ fontSize: 10, color: theme.muted, fontWeight: "600" }}>{c.sim}</Text>
            </View>
            {c.recording && <Ionicons name="mic" size={13} color={theme.dim} />}
          </View>
          {open && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
              {/* Direct call — no chooser */}
              <Action icon="call" label="Call" color={palette.emerald}
                onPress={() => directCall(c.phone)} />
              <Action icon="logo-whatsapp" label="WhatsApp" color="#25D366"
                onPress={() => Linking.openURL(`whatsapp://send?phone=${c.phone.replace(/\D/g, "")}`)} />
              <Action icon="play" label="Play" disabled={!c.recordingUrl}
                onPress={() => c.recordingUrl && Linking.openURL(c.recordingUrl)} />
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
      <AppHeader title="Calls" right={
        <Pressable onPress={() => load(true)} style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="refresh-outline" size={18} color={theme.secondary} />
        </Pressable>
      } />

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={[{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border }, shadowSoft]}>
          <Ionicons name="search" size={18} color={theme.dim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by name or number..." placeholderTextColor={theme.dim} style={{ flex: 1, marginLeft: 8, fontSize: 14.5, color: theme.primary }} />
          {query.length > 0 && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={18} color={theme.dim} /></Pressable>}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CHIPS.map((f) => {
              const on = f === chip;
              const count = f === "All" ? allCalls.length
                : f === "In"       ? allCalls.filter((c) => c.type === "incoming").length
                : f === "Out"      ? allCalls.filter((c) => c.type === "outgoing").length
                : f === "Missed"   ? allCalls.filter((c) => c.type === "missed").length
                : allCalls.filter((c) => c.recording).length;
              return (
                <Pressable key={f} onPress={() => setChip(f)} style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? palette.teal : theme.border, backgroundColor: on ? palette.teal : theme.surface, flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#04211d" : theme.muted }}>{f}</Text>
                  {count > 0 && <View style={{ backgroundColor: on ? "rgba(0,0,0,0.2)" : theme.border, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: on ? "#04211d" : theme.dim }}>{count}</Text>
                  </View>}
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
        {loading && <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40 }}>Loading calls...</Text>}
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
      <Pressable onPress={() => setDialOpen(true)} style={{
        position: "absolute", bottom: 100, right: 20,
        width: 58, height: 58, borderRadius: 29,
        alignItems: "center", justifyContent: "center",
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
      }}>
        <LinearGradient colors={gradientBrand} style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="keypad-outline" size={24} color="#fff" />
        </LinearGradient>
      </Pressable>

      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} theme={theme} />
    </SafeAreaView>
  );
}

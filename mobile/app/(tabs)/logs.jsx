import { useState, useEffect } from "react";
import { View, Text, ScrollView, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";
import { CALLS } from "../../src/mockData"; // fallback

const CHIPS = ["All", "In", "Out", "Missed", "Recorded"];
const TYPE = {
  incoming: { icon: "call-received", color: palette.teal },
  outgoing: { icon: "call-made", color: palette.violet },
  missed: { icon: "call-missed", color: palette.red },
};

export default function Calls() {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("All");
  const [expanded, setExpanded] = useState(null);
  const { theme, shadowSoft } = useTheme();
  const [allCalls, setAllCalls] = useState(CALLS);

  useEffect(() => {
    api.getCalls({ page_size: 100 })
      .then((res) => {
        const items = (res.items || []).map((c) => ({
          id: c.id,
          type: c.call_type,
          name: c.contact_name || "Unknown",
          phone: c.phone_number,
          duration: fmtDur(c.duration_seconds),
          time: new Date(c.start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          ago: relTime(c.start_time),
          sim: c.source || "SIM 1",
          recording: c.recording_available,
          day: isYesterday(c.start_time) ? "Yesterday" : undefined,
        }));
        if (items.length) setAllCalls(items);
      })
      .catch(() => {});
  }, []);

  function fmtDur(s) {
    if (!s) return "00:00";
    return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  }
  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m/60)}h ago`;
    return "Yesterday";
  }
  function isYesterday(iso) {
    const d = new Date(iso), now = new Date();
    return d.getDate() === now.getDate() - 1 && d.getMonth() === now.getMonth();
  }

  const filtered = allCalls.filter((c) => {
    const q = [c.name, c.phone].join(" ").toLowerCase().includes(query.toLowerCase());
    let f = true;
    if (chip === "In") f = c.type === "incoming";
    else if (chip === "Out") f = c.type === "outgoing";
    else if (chip === "Missed") f = c.type === "missed";
    else if (chip === "Recorded") f = c.recording;
    return q && f;
  });
  const today = filtered.filter((c) => c.day !== "Yesterday");
  const yesterday = filtered.filter((c) => c.day === "Yesterday");

  const Action = ({ icon, label, color = palette.teal, disabled }) => (
    <Pressable style={{ alignItems: "center", gap: 4, opacity: disabled ? 0.4 : 1 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: color + "1a", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={17} color={color} />
      </View>
      <Text style={{ fontSize: 10.5, color: theme.muted }}>{label}</Text>
    </Pressable>
  );

  const Row = ({ c }) => {
    const meta = TYPE[c.type];
    const open = expanded === c.id;
    return (
      <Pressable onPress={() => setExpanded(open ? null : c.id)} style={[{ flexDirection: "row", backgroundColor: theme.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.border, overflow: "hidden" }, shadowSoft]}>
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
            <Text style={{ fontSize: 11.5, fontWeight: "600", color: meta.color, textTransform: "capitalize" }}>{c.type} · {c.duration}</Text>
            <View style={{ borderWidth: 1, borderColor: theme.borderStrong, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ fontSize: 10, color: theme.muted, fontWeight: "600" }}>{c.sim}</Text></View>
            {c.recording && <Ionicons name="mic" size={13} color={theme.dim} />}
          </View>
          {open && (
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Action icon="call" label="Call" />
              <Action icon="logo-whatsapp" label="WhatsApp" color={palette.emerald} />
              <Action icon="play" label="Play" disabled={!c.recording} />
              <Action icon="pricetag-outline" label="Status" />
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Calls" right={<Pressable style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}><Ionicons name="options-outline" size={18} color={theme.secondary} /></Pressable>} />

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={[{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.border }, shadowSoft]}>
          <Ionicons name="search" size={18} color={theme.dim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search by name or number..." placeholderTextColor={theme.dim} style={{ flex: 1, marginLeft: 8, fontSize: 14.5, color: theme.primary }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {CHIPS.map((f) => {
              const on = f === chip;
              return (
                <Pressable key={f} onPress={() => setChip(f)} style={{ paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? palette.teal : theme.border, backgroundColor: on ? palette.teal : theme.surface }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: on ? "#04211d" : theme.muted }}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 8 }} showsVerticalScrollIndicator={false}>
        {today.length > 0 && <Text style={{ fontSize: 13, fontWeight: "700", color: theme.muted, marginVertical: 8, marginLeft: 2 }}>Today</Text>}
        {today.map((c) => <Row key={c.id} c={c} />)}
        {yesterday.length > 0 && <Text style={{ fontSize: 13, fontWeight: "700", color: theme.muted, marginVertical: 8, marginLeft: 2, marginTop: 8 }}>Yesterday</Text>}
        {yesterday.map((c) => <Row key={c.id} c={c} />)}
        {filtered.length === 0 && <Text style={{ textAlign: "center", color: theme.muted, marginTop: 40 }}>No calls match your filters.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

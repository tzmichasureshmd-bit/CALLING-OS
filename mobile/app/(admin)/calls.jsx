import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, FlatList, Pressable, TextInput,
  RefreshControl, ActivityIndicator, Modal, ScrollView,
  Platform, Linking, Animated, PanResponder, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { adminTheme, adminPalette, SPACE } from "../../src/theme";
import { api } from "../../src/api";

const C = adminTheme;
const SCREEN_H = Dimensions.get("window").height;

const CALL_STATUSES = [
  { key: "interested",     label: "Interested",     color: "#22C55E" },
  { key: "asked_details",  label: "Asked Details",  color: "#14B8A6" },
  { key: "follow_up",      label: "Follow Up",      color: "#8B5CF6" },
  { key: "callback",       label: "Callback",       color: "#3B82F6" },
  { key: "proposal_sent",  label: "Proposal Sent",  color: "#0EA5E9" },
  { key: "converted",      label: "Converted ✓",    color: "#22C55E" },
  { key: "not_interested", label: "Not Interested", color: "#EF4444" },
  { key: "__custom__",     label: "Custom",         color: "#F59E0B" },

];

const TYPE_META = {
  incoming: { label: "Incoming", color: "#22C55E",            icon: "call-received" },
  outgoing: { label: "Outgoing", color: adminPalette.primary,  icon: "call-made"     },
  missed:   { label: "Missed",   color: "#EF4444",            icon: "call-missed"   },
  rejected: { label: "Rejected", color: "#F59E0B",            icon: "call-missed"   },
  blocked:  { label: "Blocked",  color: "#F59E0B",            icon: "call-missed"   },
};

const FILTERS = ["All", "Incoming", "Outgoing", "Missed", "Recorded"];

function fmtDur(s) {
  if (!s) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function relTime(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

// ── Draggable Bottom Sheet ────────────────────────────────────────────────────
function CallDetailSheet({ call, onClose, onSaved }) {
  const [status, setStatus]     = useState(null);
  const [customStatus, setCustomStatus] = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);
  const [dropOpen, setDropOpen] = useState(false);
  const [history, setHistory]   = useState([]);
  const inFlight = useRef(false);

  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const lastY      = useRef(0);

  // Open/close animation
  useEffect(() => {
    if (call) {
      const known = CALL_STATUSES.find(s => s.key === call.call_status && s.key !== "__custom__");
      setStatus(known ? call.call_status : null);
      setCustomStatus("");
      setNotes(call.notes || "");
      setSaved(false); setError(null); setDropOpen(false);
      setHistory([]);
      // fetch history
      api.getNoteHistory(call.phone_number).then(res => setHistory(res?.items || [])).catch(() => {});
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true,
        tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_H, duration: 280, useNativeDriver: true,
      }).start();
    }
  }, [call?.id]);

  // Pan responder — drag down to close
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
      onPanResponderGrant: () => { lastY.current = 0; },
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.5) {
          Animated.timing(translateY, {
            toValue: SCREEN_H, duration: 250, useNativeDriver: true,
          }).start(onClose);
        } else {
          Animated.spring(translateY, {
            toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
          }).start();
        }
      },
    })
  ).current;

  async function handleSave() {
    if (inFlight.current || !call?.id) return;
    inFlight.current = true;
    setSaving(true); setError(null);
    try {
      const finalStatus = status === "__custom__" ? customStatus.trim() : status;
    await api.updateCallNote(call.id, finalStatus, notes);
      setSaved(true);
      onSaved?.();
      setTimeout(() => { setSaved(false); onClose(); }, 1200);
    } catch (e) {
      setError(e?.message || "Could not save.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  if (!call) return null;
  const meta      = TYPE_META[call.call_type] || TYPE_META.incoming;
  const ns        = CALL_STATUSES.find(s => s.key === status);
  const recStatus = call.recording_status || "not_available";
  const txStatus  = call.transcript_status || null;

  const PIPELINE = [
    { label: "Synced",      done: true,                     color: "#22C55E" },
    { label: "Recording",   done: recStatus === "uploaded", color: recStatus === "uploaded" ? "#22C55E" : recStatus === "not_available" ? C.dim : "#F59E0B" },
    { label: "Transcribed", done: txStatus === "completed", color: txStatus === "completed" ? "#22C55E" : txStatus === "processing" ? adminPalette.primary : C.dim },
  ];

  return (
    <Modal visible={!!call} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />

      {/* Sheet */}
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: C.card,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: SCREEN_H * 0.92,
        transform: [{ translateY }],
        shadowColor: "#000", shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.2, shadowRadius: 20, elevation: 20,
      }}>
        {/* Drag handle */}
        <View {...pan.panHandlers} style={{ paddingVertical: 14, alignItems: "center" }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: C.border }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 50 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: meta.color + "22", alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: C.primary }} numberOfLines={1}>
                  {call.contact_name && call.contact_name !== "Unknown" ? call.contact_name : "Unknown Contact"}
                </Text>
                <Text style={{ fontSize: 13, color: adminPalette.primary, fontWeight: "600" }}>{call.phone_number}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}
              style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={C.muted} />
            </Pressable>
          </View>

          {/* Meta grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Employee", value: call.employee_name || "—" },
              { label: "Date",     value: fmtDate(call.start_time) },
              { label: "Type",     value: meta.label, color: meta.color },
              { label: "Duration", value: fmtDur(call.duration_seconds) },
              { label: "SIM",      value: call.source || "—" },
            ].map(d => (
              <View key={d.label} style={{ backgroundColor: C.surface2, borderRadius: 10, padding: 10, minWidth: "47%", flex: 1 }}>
                <Text style={{ fontSize: 10, color: C.muted, fontWeight: "700", textTransform: "uppercase", marginBottom: 2 }}>{d.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: d.color || C.primary }}>{d.value}</Text>
              </View>
            ))}
          </View>

          {/* Pipeline */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10 }}>Processing Pipeline</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 18 }}>
            {PIPELINE.map((p) => (
              <View key={p.label} style={{ alignItems: "center", flex: 1 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: p.done ? p.color + "22" : C.surface2, borderWidth: 2, borderColor: p.done ? p.color : C.border, alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                  {p.done && <Ionicons name="checkmark" size={12} color={p.color} />}
                </View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: p.done ? p.color : C.dim, textAlign: "center" }}>{p.label}</Text>
              </View>
            ))}
          </View>

          {/* Full Progress History */}
          {history.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 12 }}>
                Progress History · {history.length} updates
              </Text>
              {history.map((h, i) => {
                const hStatus = CALL_STATUSES.find(s => s.key === h.status);
                const statusLabel = hStatus ? hStatus.label : h.status || null;
                const statusColor = hStatus ? hStatus.color : "#F59E0B";
                const role = (h.changed_by_role || "").toUpperCase();
                const roleLabel = role === "ADMIN" || role === "SUPER_ADMIN" ? "Admin" : "Employee";
                const roleColor = role === "ADMIN" || role === "SUPER_ADMIN" ? adminPalette.primary : "#8B5CF6";
                return (
                  <View key={h.id || i} style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
                    <View style={{ alignItems: "center", width: 18 }}>
                      <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, backgroundColor: roleColor }} />
                      {i < history.length - 1 && (
                        <View style={{ width: 2, flex: 1, backgroundColor: C.border, marginTop: 2, minHeight: 20 }} />
                      )}
                    </View>
                    <View style={{ flex: 1, backgroundColor: C.surface2, borderRadius: 12, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: C.border }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: roleColor + "22", alignItems: "center", justifyContent: "center" }}>
                            <Text style={{ fontSize: 10, fontWeight: "800", color: roleColor }}>
                              {(h.changed_by_name || "?").slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: "700", color: C.primary }}>{h.changed_by_name || "Unknown"}</Text>
                            <Text style={{ fontSize: 10, color: roleColor, fontWeight: "600" }}>{roleLabel}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 10, color: C.dim }}>{relTime(h.created_at)}</Text>
                      </View>
                      {statusLabel && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: statusColor + "18", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start", marginBottom: h.notes ? 6 : 0 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: statusColor }} />
                          <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor }}>{statusLabel}</Text>
                        </View>
                      )}
                      {h.notes ? (
                        <Text style={{ fontSize: 12, color: C.secondary, lineHeight: 18, fontStyle: "italic" }}>" {h.notes} "</Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Update Progress */}
          <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Update Progress</Text>

          <Pressable onPress={() => setDropOpen(o => !o)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1.5, borderColor: ns ? ns.color : C.border, paddingHorizontal: 14, paddingVertical: 12, marginBottom: dropOpen ? 0 : 12 }}>
            {ns
              ? <Text style={{ fontSize: 14, fontWeight: "700", color: ns.color }}>{ns.label}</Text>
              : <Text style={{ fontSize: 14, color: C.dim }}>Select status…</Text>}
            <Ionicons name={dropOpen ? "chevron-up" : "chevron-down"} size={16} color={C.muted} />
          </Pressable>

          {dropOpen && (
            <View style={{ backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginBottom: 12, overflow: "hidden" }}>
              {CALL_STATUSES.map((s, i) => (
                <Pressable key={s.key} onPress={() => { setStatus(s.key === status ? null : s.key); setDropOpen(false); }}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: status === s.key ? s.color + "18" : "transparent", borderTopWidth: i === 0 ? 0 : 1, borderTopColor: C.border }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                  <Text style={{ fontSize: 14, fontWeight: status === s.key ? "700" : "500", color: status === s.key ? s.color : C.secondary, flex: 1 }}>{s.label}</Text>
                  {status === s.key && <Ionicons name="checkmark" size={16} color={s.color} />}
                </Pressable>
              ))}
            </View>
          )}


          {status === "__custom__" && (
            <TextInput
              value={customStatus}
              onChangeText={setCustomStatus}
              placeholder="Type your status here…"
              placeholderTextColor={C.dim}
              maxLength={30}
              autoFocus
              style={{ backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1.5, borderColor: "#F59E0B", paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: C.primary, marginBottom: 12 }}
            />
          )}

          <Text style={{ fontSize: 11, fontWeight: "700", color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Notes</Text>
          <TextInput
            value={notes} onChangeText={setNotes} multiline
            placeholder="What was discussed? Objections, next steps…"
            placeholderTextColor={C.dim}
            style={{ backgroundColor: C.surface2, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 12, fontSize: 13, color: C.primary, minHeight: 80, textAlignVertical: "top", marginBottom: 14 }}
          />

          {error && (
            <View style={{ backgroundColor: "#EF444418", borderRadius: 10, borderWidth: 1, borderColor: "#EF444444", padding: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: "#EF4444" }}>{error}</Text>
            </View>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <Pressable onPress={handleSave} disabled={saving || saved} style={{ flex: 1 }}>
              <LinearGradient colors={saved ? ["#22C55E", "#22C55E"] : [adminPalette.primary, "#65A30D"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center", opacity: saving ? 0.7 : 1 }}>
                <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                  {saving ? "Saving…" : saved ? "✓ Saved!" : "Save Progress"}
                </Text>
              </LinearGradient>
            </Pressable>
            <Pressable onPress={onClose}
              style={{ height: 50, paddingHorizontal: 18, borderRadius: 13, borderWidth: 1.5, borderColor: C.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: C.muted }}>Done</Text>
            </Pressable>
          </View>

          {/* Quick actions */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => Linking.openURL(`tel:${call.phone_number}`)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#22C55E18", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#22C55E44" }}>
              <Ionicons name="call" size={16} color="#22C55E" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#22C55E" }}>Call</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`https://wa.me/${call.phone_number?.replace(/\D/g, "")}`)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#25D36618", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#25D36644" }}>
              <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#25D366" }}>WhatsApp</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(`sms:${call.phone_number}`)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#3B82F618", borderRadius: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#3B82F644" }}>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#3B82F6" />
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#3B82F6" }}>SMS</Text>
            </Pressable>
          </View>

        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Call Row ──────────────────────────────────────────────────────────────────
function CallRow({ call, onPress, isLast }) {
  const meta    = TYPE_META[call.call_type] || TYPE_META.incoming;
  const ns      = CALL_STATUSES.find(s => s.key === call.call_status);
  const hasName = call.contact_name && call.contact_name !== "Unknown" && call.contact_name !== "";
  const name    = hasName ? call.contact_name : "Unknown Contact";
  const phone   = call.phone_number || "—";

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center",
        backgroundColor: pressed ? C.surface2 : C.card,
        paddingHorizontal: 16, paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: C.border,
      })}>
      {/* Left color bar */}
      <View style={{ width: 4, height: 44, borderRadius: 4, backgroundColor: meta.color, marginRight: 12 }} />

      {/* Icon */}
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: meta.color + "18", alignItems: "center", justifyContent: "center", marginRight: 12 }}>
        <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color} />
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.primary }} numberOfLines={1}>{name}</Text>
        <Text style={{ fontSize: 12, color: adminPalette.primary, fontWeight: "600", marginTop: 1 }}>{phone}</Text>
        <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{call.employee_name || "—"} · {fmtDate(call.start_time)}</Text>
      </View>

      {/* Right */}
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "700", color: meta.color }}>{meta.label}</Text>
        <Text style={{ fontSize: 11, color: C.muted }}>{fmtDur(call.duration_seconds)}</Text>
        {ns && (
          <View style={{ backgroundColor: ns.color + "22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", color: ns.color }}>{ns.label}</Text>
          </View>
        )}
        {!ns && call.call_status && (
          <View style={{ backgroundColor: "#F59E0B22", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9.5, fontWeight: "700", color: "#F59E0B" }}>{call.call_status}</Text>
          </View>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={C.dim} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminCalls() {
  const [calls, setCalls]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]         = useState("All");
  const [query, setQuery]           = useState("");
  const [selected, setSelected]     = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getCalls({ page_size: 300 });
      setCalls(res?.items || (Array.isArray(res) ? res : []));
    } catch (e) {
      console.warn("AdminCalls fetch error:", e);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = calls.filter(c => {
    const q = query.toLowerCase();
    const matchQ = !q || (c.phone_number || "").includes(q) ||
      (c.contact_name || "").toLowerCase().includes(q) ||
      (c.employee_name || "").toLowerCase().includes(q);
    let matchF = true;
    if (filter === "Incoming")      matchF = c.call_type === "incoming";
    else if (filter === "Outgoing") matchF = c.call_type === "outgoing";
    else if (filter === "Missed")   matchF = c.call_type === "missed";
    else if (filter === "Recorded") matchF = c.recording_status === "uploaded";
    return matchQ && matchF;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: C.primary, marginBottom: 10 }}>All Calls</Text>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: C.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.border, marginBottom: 10 }}>
          <Ionicons name="search" size={16} color={C.dim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search name, number, employee…"
            placeholderTextColor={C.dim}
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: C.primary }} />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={16} color={C.dim} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {FILTERS.map(f => {
              const on = f === filter;
              return (
                <Pressable key={f} onPress={() => setFilter(f)}
                  style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1.5, borderColor: on ? adminPalette.primary : C.border, backgroundColor: on ? adminPalette.primary : C.card }}>
                  <Text style={{ fontSize: 12.5, fontWeight: "700", color: on ? "#fff" : C.muted }}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View style={{ paddingHorizontal: SPACE.lg, paddingVertical: 8 }}>
        <Text style={{ fontSize: 12, color: C.muted }}>{filtered.length} calls · tap a row for Call Intelligence</Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={adminPalette.primary} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 13 }}>Loading calls…</Text>
        </View>
      ) : (
        <View style={{ flex: 1, marginHorizontal: SPACE.lg, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
          <FlatList
            data={filtered}
            keyExtractor={(item, index) => item.id || String(index)}
            renderItem={({ item, index }) => (
              <CallRow call={item} onPress={() => setSelected(item)} isLast={index === filtered.length - 1} />
            )}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={adminPalette.primary} />}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 60 }}>
                <Ionicons name="call-outline" size={48} color={C.dim} />
                <Text style={{ fontSize: 15, fontWeight: "600", color: C.secondary, marginTop: 12 }}>No calls found</Text>
              </View>
            }
            removeClippedSubviews
            maxToRenderPerBatch={20}
            windowSize={8}
          />
        </View>
      )}

      <CallDetailSheet
        call={selected}
        onClose={() => setSelected(null)}
        onSaved={() => load()}
      />
    </SafeAreaView>
  );
}

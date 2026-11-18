import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, Pressable, TextInput, Modal, ScrollView,
  ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";

// Same status meta as web LEAD_STATUS_META
const LEAD_STATUS_META = {
  new:            { label: "New",            tone: "teal"    },
  contacted:      { label: "Contacted",      tone: "cyan"    },
  interested:     { label: "Interested",     tone: "violet"  },
  follow_up:      { label: "Follow Up",      tone: "amber"   },
  proposal_sent:  { label: "Proposal Sent",  tone: "blue"    },
  converted:      { label: "Converted",      tone: "emerald" },
  not_interested: { label: "Not Interested", tone: "red"     },
  lost:           { label: "Lost",           tone: "red"     },
};

const TONE_COLOR = {
  teal: palette.teal, cyan: palette.cyan, violet: palette.violet,
  amber: palette.amber, blue: palette.blue, emerald: palette.emerald, red: palette.red,
};

// Same sales flow strip as web
const FLOW = ["Call", "Connected", "Conversation", "Follow-up", "Lead", "Opportunity", "Won/Lost"];

const STATUS_KEYS = ["all", ...Object.keys(LEAD_STATUS_META)];

function fmt(n) {
  const v = parseFloat(n || 0);
  if (!v) return "—";
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

// ── Add Lead Modal (same fields as web) ───────────────────────────────────────
function AddLeadModal({ visible, onClose, onAdded, theme }) {
  const [name, setName]     = useState("");
  const [phone, setPhone]   = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes]   = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) { setName(""); setPhone(""); setSource(""); setNotes(""); }
  }, [visible]);

  async function submit() {
    if (!name.trim() || !phone.trim()) { Alert.alert("Required", "Name and phone are required"); return; }
    setSaving(true);
    try {
      await api.createLead({ name: name.trim(), phone: phone.trim(), source: source.trim() || "Manual", notes: notes.trim() || null });
      onAdded(); onClose();
    } catch (e) { Alert.alert("Error", e?.message || "Failed to add lead"); }
    finally { setSaving(false); }
  }

  const inp = { backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: theme.primary, marginTop: 6 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <KeyboardAvoidingView behavior="padding">
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>Add Lead</Text>
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
            </View>
            {[
              { label: "FULL NAME *", value: name, set: setName, ph: "Customer Name", kb: "default" },
              { label: "PHONE *",     value: phone, set: setPhone, ph: "+91 98765 43210", kb: "phone-pad" },
              { label: "SOURCE",      value: source, set: setSource, ph: "e.g. Cold Call, Referral", kb: "default" },
              { label: "NOTES",       value: notes, set: setNotes, ph: "Optional notes", kb: "default" },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.muted }}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={theme.dim}
                  keyboardType={f.kb} style={inp} />
              </View>
            ))}
            <Pressable onPress={submit} disabled={saving} style={{ marginTop: 8 }}>
              <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Add Lead</Text>}
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Lead row (same columns as web table: Lead, Source, Employee, Status, Priority, Next Follow-up, Value) ──
function LeadRow({ lead, theme, onStatusChange, updating }) {
  const meta = LEAD_STATUS_META[lead.status] || { label: lead.status || "New", tone: "teal" };
  const color = TONE_COLOR[meta.tone] || palette.teal;
  const [dropOpen, setDropOpen] = useState(false);

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: RADIUS.xl, marginBottom: SPACE.sm,
      borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
      {/* Left color bar */}
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }} />

      <View style={{ padding: SPACE.md, paddingLeft: SPACE.md + 4 }}>
        {/* Row 1: name + value */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary }} numberOfLines={1}>{lead.name}</Text>
            <Text style={{ fontSize: 13, color: palette.teal, marginTop: 2 }}>{lead.phone}</Text>
          </View>
          {lead.expected_value ? (
            <Text style={{ fontSize: 15, fontWeight: "800", color: theme.primary, marginLeft: 8 }}>{fmt(lead.expected_value)}</Text>
          ) : null}
        </View>

        {/* Row 2: source · employee */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: SPACE.sm, flexWrap: "wrap" }}>
          {lead.source ? (
            <Text style={{ fontSize: 12, color: theme.muted }}>{lead.source}</Text>
          ) : null}
          {lead.employee ? (
            <Text style={{ fontSize: 12, color: theme.dim }}>
              <Ionicons name="person-outline" size={11} color={theme.dim} /> {lead.employee}
            </Text>
          ) : null}
          {lead.priority ? (
            <Text style={{ fontSize: 12, color: theme.muted }}>Priority: {lead.priority}</Text>
          ) : null}
          {lead.next_follow_up ? (
            <Text style={{ fontSize: 12, color: lead.next_follow_up === "Overdue" ? palette.red : theme.muted,
              fontWeight: lead.next_follow_up === "Overdue" ? "700" : "400" }}>
              {lead.next_follow_up}
            </Text>
          ) : null}
        </View>

        {/* Status badge + dropdown */}
        <View style={{ marginTop: SPACE.sm }}>
          <Pressable onPress={() => setDropOpen((o) => !o)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
              backgroundColor: color + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4,
              borderWidth: 1, borderColor: color + "44" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color }}>{meta.label}</Text>
            <Ionicons name={dropOpen ? "chevron-up" : "chevron-down"} size={12} color={color} />
          </Pressable>

          {dropOpen && (
            <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1,
              borderColor: theme.border, marginTop: 6, overflow: "hidden" }}>
              {Object.entries(LEAD_STATUS_META).map(([key, m], i) => {
                const c = TONE_COLOR[m.tone] || palette.teal;
                const on = key === lead.status;
                return (
                  <Pressable key={key} onPress={() => { setDropOpen(false); onStatusChange(lead, key); }}
                    disabled={updating === lead.id}
                    style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11,
                      backgroundColor: on ? c + "18" : "transparent",
                      borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
                    <Text style={{ fontSize: 13, fontWeight: on ? "700" : "500", color: on ? c : theme.secondary, flex: 1 }}>{m.label}</Text>
                    {on && <Ionicons name="checkmark" size={14} color={c} />}
                    {updating === lead.id && on && <ActivityIndicator size="small" color={c} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function Leads() {
  const { theme } = useTheme();
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery]         = useState("");
  const [status, setStatus]       = useState("all");
  const [showAdd, setShowAdd]     = useState(false);
  const [updating, setUpdating]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getLeads({ page_size: 200 });
      setLeads(res?.items || []);
    } catch (e) { Alert.alert("Error", e?.message || "Failed to load leads"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  async function updateStatus(lead, nextStatus) {
    if (!nextStatus || nextStatus === lead.status) return;
    setUpdating(lead.id);
    try { await api.updateLead(lead.id, { status: nextStatus }); await load(true); }
    catch (e) { Alert.alert("Error", e?.message || "Unable to update lead"); }
    finally { setUpdating(null); }
  }

  const filtered = useMemo(() => {
    let list = leads;
    if (status !== "all") list = list.filter((l) => l.status === status);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((l) => [l.name, l.phone, l.employee].join(" ").toLowerCase().includes(q));
    }
    return list;
  }, [leads, status, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Leads" right={
        <Pressable onPress={() => setShowAdd(true)}
          style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: palette.teal, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      } />

      {/* Sales flow strip — same as web */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, borderBottomWidth: 1, borderBottomColor: theme.border }}
        contentContainerStyle={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {FLOW.map((s, i) => (
          <View key={s} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
              backgroundColor: i < 5 ? palette.teal + "18" : theme.surface,
              borderWidth: 1, borderColor: i < 5 ? palette.teal + "44" : theme.border }}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: i < 5 ? palette.teal : theme.muted }}>{s}</Text>
            </View>
            {i < FLOW.length - 1 && <Ionicons name="chevron-forward" size={12} color={theme.dim} />}
          </View>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm }}>
        {/* Search */}
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: RADIUS.md,
          paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.border, marginBottom: SPACE.sm }}>
          <Ionicons name="search" size={16} color={theme.dim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search leads..." placeholderTextColor={theme.dim}
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: theme.primary }} />
          {query.length > 0 && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={16} color={theme.dim} /></Pressable>}
        </View>

        {/* Status filter — same as web status buttons */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACE.sm }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {STATUS_KEYS.map((s) => {
              const on = s === status;
              const meta = LEAD_STATUS_META[s];
              const color = meta ? TONE_COLOR[meta.tone] : palette.teal;
              return (
                <Pressable key={s} onPress={() => setStatus(s)}
                  style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
                    borderColor: on ? "transparent" : theme.border,
                    backgroundColor: on ? (meta ? color : palette.teal) : "transparent" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: on ? "#fff" : theme.muted, textTransform: "capitalize" }}>
                    {s === "all" ? "All" : meta?.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={palette.teal} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <LeadRow lead={item} theme={theme} onStatusChange={updateStatus} updating={updating} />
          )}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="person-add-outline" size={48} color={theme.dim} />
              <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>No leads found</Text>
              <Text style={{ color: theme.dim, marginTop: 4, fontSize: 12, textAlign: "center" }}>
                Leads are created from connected calls.{"\n"}Adjust filters or sync new calls.
              </Text>
            </View>
          }
        />
      )}

      <AddLeadModal visible={showAdd} onClose={() => setShowAdd(false)} onAdded={() => load(true)} theme={theme} />
    </SafeAreaView>
  );
}

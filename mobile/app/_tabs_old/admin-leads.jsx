import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView, KeyboardAvoidingView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const LEAD_STATUS = {
  new:            { label: "New",            color: "#14b8a6" },
  contacted:      { label: "Contacted",      color: "#06b6d4" },
  interested:     { label: "Interested",     color: "#8b5cf6" },
  follow_up:      { label: "Follow Up",      color: "#f59e0b" },
  proposal_sent:  { label: "Proposal Sent",  color: "#3b82f6" },
  converted:      { label: "Converted",      color: "#10b981" },
  not_interested: { label: "Not Interested", color: "#ef4444" },
  lost:           { label: "Lost",           color: "#ef4444" },
};

function LeadCard({ lead, colors, onPress }) {
  const meta = LEAD_STATUS[lead.status] || { label: lead.status || "New", color: colors.accent };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      backgroundColor: colors.white, borderRadius: RADIUS.card, padding: SPACE.md,
      borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1,
      borderLeftWidth: 4, borderLeftColor: meta.color,
    })}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.body, { color: colors.primary, fontWeight: "700" }]} numberOfLines={1}>{lead.name}</Text>
          <Text style={[TYPE.caption, { color: colors.muted, marginTop: 2 }]}>{lead.phone}</Text>
          {lead.employee && <Text style={[TYPE.caption, { color: colors.muted }]}>👤 {lead.employee}</Text>}
        </View>
        <View style={{ backgroundColor: meta.color + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: meta.color }}>{meta.label}</Text>
        </View>
      </View>
      {lead.source && <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>Source: {lead.source}</Text>}
      {lead.expected_value ? <Text style={[TYPE.caption, { color: colors.accent, marginTop: 2, fontWeight: "700" }]}>₹{Number(lead.expected_value).toLocaleString()}</Text> : null}
    </Pressable>
  );
}

function AddLeadModal({ visible, onClose, onAdded, colors }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (visible) { setName(""); setPhone(""); setSource(""); } }, [visible]);

  async function submit() {
    if (!name.trim() || !phone.trim()) { Alert.alert("Required", "Name and phone are required"); return; }
    setSaving(true);
    try {
      await api.createLead({ name: name.trim(), phone: phone.trim(), source: source.trim() || "Manual" });
      onAdded(); onClose();
    } catch (e) { Alert.alert("Error", e?.message || "Failed to add lead"); }
    finally { setSaving(false); }
  }

  const inp = { backgroundColor: colors.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: colors.primary, marginTop: 6 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <KeyboardAvoidingView behavior="padding">
          <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>Add Lead</Text>
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
            </View>
            {[
              { label: "FULL NAME *", value: name,   set: setName,   ph: "Customer Name",        kb: "default" },
              { label: "PHONE *",     value: phone,  set: setPhone,  ph: "+91 98765 43210",       kb: "phone-pad" },
              { label: "SOURCE",      value: source, set: setSource, ph: "Cold Call, Referral…",  kb: "default" },
            ].map(f => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.muted }}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={colors.muted}
                  keyboardType={f.kb} style={inp} />
              </View>
            ))}
            <Pressable onPress={submit} disabled={saving} style={{ marginTop: 8 }}>
              <LinearGradient colors={[colors.accent, colors.accentDark || colors.accent]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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

export default function AdminLeads() {
  const router = useRouter();
  const colors = adminTheme;
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getLeads({ page_size: 200 });
      setLeads(res?.items || []);
    } catch (e) { Alert.alert("Error", e?.message || "Failed to load leads"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return leads;
    const q = query.toLowerCase();
    return leads.filter(l => [l.name, l.phone, l.employee].join(" ").toLowerCase().includes(q));
  }, [leads, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: SPACE.md }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={[TYPE.h2, { color: colors.primary, flex: 1 }]}>All Leads</Text>
        <Pressable onPress={() => setShowAdd(true)}
          style={{ width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={20} color={colors.white} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", margin: SPACE.lg, backgroundColor: colors.surface,
        borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search leads…" placeholderTextColor={colors.muted}
          style={{ flex: 1, marginLeft: SPACE.sm, fontSize: 14, color: colors.primary }} />
        {query.length > 0 && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={16} color={colors.muted} /></Pressable>}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <LeadCard lead={item} colors={colors} onPress={() => {}} />}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110, gap: SPACE.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="person-add-outline" size={48} color={colors.muted} />
              <Text style={[TYPE.body, { color: colors.muted, marginTop: 12 }]}>No leads found</Text>
            </View>
          }
        />
      )}

      <AddLeadModal visible={showAdd} onClose={() => setShowAdd(false)} onAdded={() => load(true)} colors={colors} />
    </SafeAreaView>
  );
}

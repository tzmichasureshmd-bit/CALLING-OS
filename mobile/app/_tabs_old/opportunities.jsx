import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, ScrollView, Pressable, Modal, TextInput,
  ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";
import { useRouter } from "expo-router";

// Same stages as web OPEN_STAGES
const OPEN_STAGES = ["New", "Qualified", "Proposal", "Negotiation"];
const ALL_STAGES  = [...OPEN_STAGES, "Won", "Lost"];

const STAGE_TONE = {
  New: palette.teal, Qualified: palette.cyan, Proposal: palette.violet,
  Negotiation: palette.amber, Won: palette.emerald, Lost: palette.red,
};

function fmt(n) {
  const v = Number(n || 0);
  if (!v) return "₹0";
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

// ── Add Opportunity Modal (same fields as web) ────────────────────────────────
function AddOpportunityModal({ visible, onClose, onAdded, theme }) {
  const [name, setName]         = useState("");
  const [customer, setCustomer] = useState("");
  const [phone, setPhone]       = useState("");
  const [stage, setStage]       = useState("New");
  const [value, setValue]       = useState("");
  const [probability, setProb]  = useState("");
  const [nextAction, setNext]   = useState("");
  const [notes, setNotes]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [stageOpen, setStageOpen] = useState(false);

  useEffect(() => {
    if (visible) { setName(""); setCustomer(""); setPhone(""); setStage("New"); setValue(""); setProb(""); setNext(""); setNotes(""); }
  }, [visible]);

  async function submit() {
    if (!name.trim()) { Alert.alert("Required", "Opportunity name is required"); return; }
    const prob = Number(probability || 0);
    if (prob < 0 || prob > 100) { Alert.alert("Invalid", "Probability must be 0–100"); return; }
    setSaving(true);
    try {
      await api.createOpportunity({
        name: name.trim(), phone: phone.trim() || null, customer: customer.trim() || null,
        stage, value: Number(value || 0), probability: prob / 100,
        next_action: nextAction.trim() || null, notes: notes.trim() || null,
      });
      onAdded(); onClose();
    } catch (e) { Alert.alert("Error", e?.message || "Unable to create opportunity"); }
    finally { setSaving(false); }
  }

  const inp = { backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: theme.primary, marginTop: 6 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <KeyboardAvoidingView behavior="padding">
          <ScrollView style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            contentContainerStyle={{ padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>Add opportunity</Text>
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
            </View>
            <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 20 }}>Create an open opportunity in your pipeline.</Text>

            {[
              { label: "OPPORTUNITY NAME *", value: name, set: setName, ph: "Customer or deal name" },
              { label: "CUSTOMER / COMPANY",  value: customer, set: setCustomer, ph: "Company or role" },
              { label: "PHONE",               value: phone, set: setPhone, ph: "+91 98765 43210" },
              { label: "VALUE (INR)",          value: value, set: setValue, ph: "0", kb: "numeric" },
              { label: "PROBABILITY (%)",      value: probability, set: setProb, ph: "0", kb: "numeric" },
              { label: "NEXT ACTION",          value: nextAction, set: setNext, ph: "Send proposal" },
              { label: "NOTES",               value: notes, set: setNotes, ph: "Context, objections, or next steps" },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.muted }}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={theme.dim}
                  keyboardType={f.kb || "default"} style={inp} />
              </View>
            ))}

            {/* Stage picker */}
            <View style={{ marginBottom: 14 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: theme.muted }}>STAGE</Text>
              <Pressable onPress={() => setStageOpen((o) => !o)}
                style={[inp, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
                <Text style={{ fontSize: 14, color: STAGE_TONE[stage] || theme.primary, fontWeight: "700" }}>{stage}</Text>
                <Ionicons name={stageOpen ? "chevron-up" : "chevron-down"} size={16} color={theme.muted} />
              </Pressable>
              {stageOpen && (
                <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border, marginTop: 4, overflow: "hidden" }}>
                  {OPEN_STAGES.map((s, i) => (
                    <Pressable key={s} onPress={() => { setStage(s); setStageOpen(false); }}
                      style={{ paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                        backgroundColor: stage === s ? STAGE_TONE[s] + "18" : "transparent" }}>
                      <Text style={{ fontSize: 14, fontWeight: stage === s ? "700" : "500", color: stage === s ? STAGE_TONE[s] : theme.secondary }}>{s}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <Pressable onPress={submit} disabled={saving} style={{ marginTop: 8 }}>
              <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Create opportunity</Text>}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Opportunity card (same info as web kanban card) ───────────────────────────
function OpportunityCard({ item, color, onMoveStage, updating, theme }) {
  const [moveOpen, setMoveOpen] = useState(false);

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: RADIUS.xl, padding: SPACE.md,
      marginBottom: SPACE.sm, borderWidth: 1, borderColor: theme.border }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary, marginBottom: 3 }} numberOfLines={1}>{item.name}</Text>
      {item.customer ? <Text style={{ fontSize: 11.5, color: theme.muted, marginBottom: SPACE.sm }}>{item.customer}</Text> : null}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm }}>
        <Text style={{ fontSize: 15, fontWeight: "800", color: theme.primary }}>{fmt(item.value)}</Text>
        <View style={{ backgroundColor: palette.teal + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: palette.teal }}>{Math.round((item.probability || 0) * 100)}%</Text>
        </View>
      </View>

      {item.close_date || item.closeDate ? (
        <Text style={{ fontSize: 11, color: theme.dim }}>Close: {new Date(item.close_date || item.closeDate).toLocaleDateString("en-IN")}</Text>
      ) : null}
      {item.next_action || item.nextAction ? (
        <Text style={{ fontSize: 11.5, color: palette.teal, marginTop: 4 }} numberOfLines={1}>{item.next_action || item.nextAction}</Text>
      ) : null}

      {/* Move to stage — same as web "Move to" select */}
      <Pressable onPress={() => setMoveOpen((o) => !o)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACE.sm, paddingTop: SPACE.sm,
          borderTopWidth: 1, borderTopColor: theme.border }}>
        <Text style={{ fontSize: 11, color: theme.muted }}>Move to</Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color }}>{item.stage}</Text>
        <Ionicons name={moveOpen ? "chevron-up" : "chevron-down"} size={12} color={theme.dim} />
        {updating === item.id && <ActivityIndicator size="small" color={palette.teal} />}
      </Pressable>

      {moveOpen && (
        <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border, marginTop: 4, overflow: "hidden" }}>
          {ALL_STAGES.map((s, i) => (
            <Pressable key={s} onPress={() => { setMoveOpen(false); onMoveStage(item, s); }}
              style={{ paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border,
                backgroundColor: item.stage === s ? (STAGE_TONE[s] || palette.teal) + "18" : "transparent" }}>
              <Text style={{ fontSize: 13, fontWeight: item.stage === s ? "700" : "500",
                color: item.stage === s ? (STAGE_TONE[s] || palette.teal) : theme.secondary }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function Opportunities() {
  const { theme } = useTheme();
  const router = useRouter();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [updating, setUpdating]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getOpportunities({ page_size: 200 });
      setItems(res?.items || []);
    } catch (e) { Alert.alert("Error", e?.message || "Failed to load opportunities"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  async function updateStage(opp, stage) {
    if (!stage || stage === opp.stage) return;
    setUpdating(opp.id);
    try { await api.updateOpportunity(opp.id, { stage }); await load(true); }
    catch (e) { Alert.alert("Error", e?.message || "Unable to update opportunity"); }
    finally { setUpdating(null); }
  }

  // Same 3 metrics as web: Open opportunities, Pipeline value, Weighted value
  const pipeline = useMemo(() => items.filter((i) => OPEN_STAGES.includes(i.stage)), [items]);
  const totalValue    = useMemo(() => pipeline.reduce((s, i) => s + Number(i.value || 0), 0), [pipeline]);
  const weightedValue = useMemo(() => pipeline.reduce((s, i) => s + Number(i.value || 0) * Number(i.probability || 0), 0), [pipeline]);

  // Same kanban columns as web byStage
  const byStage = useMemo(() =>
    OPEN_STAGES.map((stage) => ({ stage, items: pipeline.filter((i) => i.stage === stage) })),
  [pipeline]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Opportunities" right={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => router.push("/(tabs)/opportunities-closed")}
            style={{ paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>Closed</Text>
          </Pressable>
          <Pressable onPress={() => setShowAdd(true)}
            style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: palette.teal, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      } />

      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
        contentContainerStyle={{ paddingBottom: 110 }}>

        {/* 3 metric cards — same as web */}
        <View style={{ flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md }}>
          {[
            { label: "Open opportunities", value: pipeline.length, detail: "Active pipeline",        bg: palette.blue    },
            { label: "Pipeline value",      value: fmt(totalValue),    detail: "Total potential value", bg: palette.amber   },
            { label: "Weighted value",      value: fmt(Math.round(weightedValue)), detail: "Probability-adjusted", bg: palette.emerald },
          ].map((m) => (
            <View key={m.label} style={{ flex: 1, padding: SPACE.md, borderRadius: RADIUS.xl,
              backgroundColor: m.bg + "18", borderWidth: 1, borderColor: m.bg + "33" }}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }} numberOfLines={2}>{m.label}</Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary, marginTop: 6 }}>{m.value}</Text>
              <Text style={{ fontSize: 10, color: theme.dim, marginTop: 2 }}>{m.detail}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <View style={{ alignItems: "center", paddingVertical: 60 }}>
            <ActivityIndicator color={palette.teal} size="large" />
          </View>
        ) : (
          /* Kanban columns — same as web byStage layout, scrolled horizontally */
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.md }}>
            {byStage.map((col) => {
              const color = STAGE_TONE[col.stage] || palette.teal;
              return (
                <View key={col.stage} style={{ width: 220 }}>
                  {/* Column header — same as web Badge + count */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.sm }}>
                    <View style={{ backgroundColor: color + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4, borderWidth: 1, borderColor: color + "44" }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color }}>{col.stage}</Text>
                    </View>
                    <Text style={{ fontSize: 11, color: theme.dim }}>{col.items.length}</Text>
                  </View>

                  {col.items.length === 0 ? (
                    <View style={{ borderWidth: 1, borderColor: theme.border, borderStyle: "dashed", borderRadius: RADIUS.xl,
                      padding: SPACE.lg, alignItems: "center" }}>
                      <Text style={{ fontSize: 12, color: theme.dim }}>No opportunities</Text>
                    </View>
                  ) : (
                    col.items.map((item) => (
                      <OpportunityCard key={item.id} item={item} color={color}
                        onMoveStage={updateStage} updating={updating} theme={theme} />
                    ))
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      <AddOpportunityModal visible={showAdd} onClose={() => setShowAdd(false)} onAdded={() => load(true)} theme={theme} />
    </SafeAreaView>
  );
}

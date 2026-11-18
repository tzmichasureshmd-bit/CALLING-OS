import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, ScrollView, FlatList, Pressable, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const OPEN_STAGES = ["New", "Qualified", "Proposal", "Negotiation"];
const STAGE_COLOR = { New: "#14b8a6", Qualified: "#06b6d4", Proposal: "#8b5cf6", Negotiation: "#f59e0b", Won: "#10b981", Lost: "#ef4444" };

function fmt(n) {
  const v = Number(n || 0);
  if (!v) return "₹0";
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

function OppCard({ item, colors, onMoveStage, updating }) {
  const color = STAGE_COLOR[item.stage] || colors.accent;
  const [open, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: RADIUS.card, padding: SPACE.md,
      borderWidth: 1, borderColor: colors.border, marginBottom: SPACE.sm }}>
      <Text style={[TYPE.body, { color: colors.primary, fontWeight: "700" }]} numberOfLines={1}>{item.name}</Text>
      {item.customer && <Text style={[TYPE.caption, { color: colors.muted }]}>{item.customer}</Text>}
      {item.employee && <Text style={[TYPE.caption, { color: colors.muted }]}>👤 {item.employee}</Text>}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: SPACE.sm }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.primary }}>{fmt(item.value)}</Text>
        <Text style={[TYPE.caption, { color: colors.muted }]}>{Math.round((item.probability || 0) * 100)}% prob</Text>
      </View>
      <Pressable onPress={() => setOpen(o => !o)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACE.sm, paddingTop: SPACE.sm,
          borderTopWidth: 1, borderTopColor: colors.border }}>
        <View style={{ backgroundColor: color + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color }}>{item.stage}</Text>
        </View>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.muted} />
        {updating === item.id && <ActivityIndicator size="small" color={colors.accent} />}
      </Pressable>
      {open && (
        <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, marginTop: 4, overflow: "hidden" }}>
          {[...OPEN_STAGES, "Won", "Lost"].map((s, i) => (
            <Pressable key={s} onPress={() => { setOpen(false); onMoveStage(item, s); }}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.border,
                backgroundColor: item.stage === s ? (STAGE_COLOR[s] || colors.accent) + "18" : "transparent" }}>
              <Text style={{ fontSize: 13, fontWeight: item.stage === s ? "700" : "500",
                color: item.stage === s ? (STAGE_COLOR[s] || colors.accent) : colors.secondary }}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AdminOpportunities() {
  const router = useRouter();
  const colors = adminTheme;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [tab, setTab] = useState("open"); // "open" | "closed"

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [open, closed] = await Promise.all([
        api.getOpportunities({ page_size: 200 }),
        api.getOpportunities({ page_size: 200, status: "closed" }),
      ]);
      setItems([...(open?.items || []), ...(closed?.items || [])]);
    } catch (e) { Alert.alert("Error", e?.message || "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  async function moveStage(opp, stage) {
    if (stage === opp.stage) return;
    setUpdating(opp.id);
    try { await api.updateOpportunity(opp.id, { stage }); await load(true); }
    catch (e) { Alert.alert("Error", e?.message || "Failed to update"); }
    finally { setUpdating(null); }
  }

  const open   = useMemo(() => items.filter(i => OPEN_STAGES.includes(i.stage)), [items]);
  const closed = useMemo(() => items.filter(i => !OPEN_STAGES.includes(i.stage)), [items]);
  const shown  = tab === "open" ? open : closed;

  const totalValue    = open.reduce((s, i) => s + Number(i.value || 0), 0);
  const weightedValue = open.reduce((s, i) => s + Number(i.value || 0) * Number(i.probability || 0), 0);
  const won  = closed.filter(i => i.stage === "Won").length;
  const lost = closed.filter(i => i.stage === "Lost").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: SPACE.md }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={[TYPE.h2, { color: colors.primary, flex: 1 }]}>Opportunities</Text>
      </View>

      {/* Summary cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, gap: SPACE.sm }}>
        {[
          { label: "Open",     value: open.length,          color: colors.accent  },
          { label: "Pipeline", value: fmt(totalValue),       color: colors.info    },
          { label: "Weighted", value: fmt(Math.round(weightedValue)), color: colors.warning },
          { label: "Won",      value: won,                  color: colors.success },
          { label: "Lost",     value: lost,                 color: colors.danger  },
        ].map(s => (
          <View key={s.label} style={{ backgroundColor: s.color + "18", borderRadius: RADIUS.card,
            padding: SPACE.md, minWidth: 90, alignItems: "center", borderWidth: 1, borderColor: s.color + "33" }}>
            <Text style={{ fontSize: 20, fontWeight: "800", color: colors.primary }}>{s.value}</Text>
            <Text style={[TYPE.caption, { color: colors.muted, marginTop: 2 }]}>{s.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Tab */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, gap: SPACE.sm, marginBottom: SPACE.sm }}>
        {["open", "closed"].map(t => (
          <Pressable key={t} onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.md, alignItems: "center",
              backgroundColor: t === tab ? colors.accent : colors.surface,
              borderWidth: 1, borderColor: t === tab ? colors.accent : colors.border }}>
            <Text style={[TYPE.label, { color: t === tab ? colors.white : colors.muted, textTransform: "capitalize" }]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <OppCard item={item} colors={colors} onMoveStage={moveStage} updating={updating} />}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="trending-up-outline" size={48} color={colors.muted} />
              <Text style={[TYPE.body, { color: colors.muted, marginTop: 12 }]}>No {tab} opportunities</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, Pressable, ActivityIndicator,
  RefreshControl, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";

function fmt(n) {
  const v = Number(n || 0);
  if (!v) return "—";
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}K`;
  return `₹${v}`;
}

// ── Closed opportunity row — same columns as web table: Client, Phone, Employee, Value, Closed Date, Outcome ──
function ClosedRow({ item, theme, onUpdateOutcome, updating }) {
  const won = item.outcome === "Won" || item.stage === "Won";
  const [dropOpen, setDropOpen] = useState(false);

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: RADIUS.xl, marginBottom: SPACE.sm,
      borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
      <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4,
        backgroundColor: won ? palette.emerald : palette.red }} />

      <View style={{ padding: SPACE.md, paddingLeft: SPACE.md + 4 }}>
        {/* Client + Value */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary }} numberOfLines={1}>{item.name}</Text>
            {item.phone ? <Text style={{ fontSize: 13, color: palette.teal, marginTop: 2 }}>{item.phone}</Text> : null}
          </View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: theme.primary, marginLeft: 8 }}>{fmt(item.value)}</Text>
        </View>

        {/* Employee + Closed Date */}
        <View style={{ flexDirection: "row", gap: 12, marginTop: SPACE.sm, flexWrap: "wrap" }}>
          {item.employee ? (
            <Text style={{ fontSize: 12, color: theme.muted }}>
              <Ionicons name="person-outline" size={11} color={theme.dim} /> {item.employee}
            </Text>
          ) : null}
          {(item.closed_date || item.closedDate) ? (
            <Text style={{ fontSize: 12, color: theme.muted }}>
              {new Date(item.closed_date || item.closedDate).toLocaleDateString("en-IN")}
            </Text>
          ) : null}
        </View>

        {/* Outcome badge + dropdown (same as web select) */}
        <View style={{ marginTop: SPACE.sm }}>
          <Pressable onPress={() => setDropOpen((o) => !o)}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
              backgroundColor: (won ? palette.emerald : palette.red) + "22",
              borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4,
              borderWidth: 1, borderColor: (won ? palette.emerald : palette.red) + "44" }}>
            <Text style={{ fontSize: 11, fontWeight: "700", color: won ? palette.emerald : palette.red }}>
              {item.outcome || item.stage}
            </Text>
            <Ionicons name={dropOpen ? "chevron-up" : "chevron-down"} size={12} color={won ? palette.emerald : palette.red} />
            {updating === item.id && <ActivityIndicator size="small" color={palette.teal} />}
          </Pressable>

          {dropOpen && (
            <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1,
              borderColor: theme.border, marginTop: 4, overflow: "hidden" }}>
              {[
                { value: "Won",         label: "Won",    color: palette.emerald },
                { value: "Lost",        label: "Lost",   color: palette.red     },
                { value: "Negotiation", label: "Reopen", color: palette.amber   },
              ].map((opt, i) => (
                <Pressable key={opt.value} onPress={() => { setDropOpen(false); onUpdateOutcome(item, opt.value); }}
                  style={{ paddingHorizontal: 14, paddingVertical: 11,
                    borderTopWidth: i === 0 ? 0 : 1, borderTopColor: theme.border }}>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: opt.color }}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function OpportunitiesClosed() {
  const { theme } = useTheme();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getOpportunities({ page_size: 200, status: "closed" });
      setItems(res?.items || []);
    } catch (e) { Alert.alert("Error", e?.message || "Failed to load closed deals"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  async function updateOutcome(opp, stage) {
    setUpdating(opp.id);
    try { await api.updateOpportunity(opp.id, { stage }); await load(true); }
    catch (e) { Alert.alert("Error", e?.message || "Unable to update opportunity"); }
    finally { setUpdating(null); }
  }

  const won  = items.filter((o) => o.outcome === "Won"  || o.stage === "Won").length;
  const lost = items.filter((o) => o.outcome === "Lost" || o.stage === "Lost").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Closed Deals" />

      {/* Won / Lost summary cards — same as web */}
      <View style={{ flexDirection: "row", gap: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: SPACE.md,
          borderRadius: RADIUS.xl, backgroundColor: palette.emerald + "15", borderWidth: 1, borderColor: palette.emerald + "33" }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: palette.emerald + "22",
            alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark-circle" size={20} color={palette.emerald} />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: theme.primary }}>{won}</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>Won</Text>
          </View>
        </View>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, padding: SPACE.md,
          borderRadius: RADIUS.xl, backgroundColor: palette.red + "15", borderWidth: 1, borderColor: palette.red + "33" }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: palette.red + "22",
            alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close-circle" size={20} color={palette.red} />
          </View>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "800", color: theme.primary }}>{lost}</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>Lost</Text>
          </View>
        </View>
      </View>

      {/* Table header — same columns as web */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm,
        borderBottomWidth: 1, borderBottomColor: theme.border }}>
        {["Client", "Value", "Date", "Outcome"].map((h) => (
          <Text key={h} style={{ flex: 1, fontSize: 11, fontWeight: "700", color: theme.muted, textTransform: "uppercase" }}>{h}</Text>
        ))}
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={palette.teal} size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ClosedRow item={item} theme={theme} onUpdateOutcome={updateOutcome} updating={updating} />
          )}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110, paddingTop: SPACE.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="checkmark-circle-outline" size={48} color={theme.dim} />
              <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>No closed opportunities</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

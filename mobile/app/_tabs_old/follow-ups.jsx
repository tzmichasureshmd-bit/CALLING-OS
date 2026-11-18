import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, Pressable, Modal, ActivityIndicator,
  RefreshControl, Alert, ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";

const FILTERS = ["all", "pending", "completed"];

function fmtDue(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = d - now;
  const days = Math.floor(diff / 86400000);
  if (days < 0) return `Overdue · ${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
  if (days === 0) return `Today · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  if (days === 1) return `Tomorrow · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function isOverdue(item) {
  return item.status !== "completed" && item.status !== "cancelled" && new Date(item.due_at) < new Date();
}

function FollowUpDetailModal({ item, visible, onClose, onComplete, completing, theme }) {
  if (!item) return null;
  const overdue = isOverdue(item);
  const done = item.status === "completed";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginBottom: 16 }} />

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }} numberOfLines={2}>{item.title}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <View style={{ backgroundColor: (done ? palette.emerald : overdue ? palette.red : palette.teal) + "22",
                borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: done ? palette.emerald : overdue ? palette.red : palette.teal }}>
                  {done ? "Completed" : overdue ? "Overdue" : "Pending"}
                </Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
        </View>

        {[
          { icon: "time-outline", label: "Due", value: fmtDue(item.due_at) },
          { icon: "person-outline", label: "Employee", value: item.employee_name || "—" },
          { icon: "call-outline", label: "Type", value: item.follow_up_type || "call" },
        ].map((row) => (
          <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: SPACE.sm,
            borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Ionicons name={row.icon} size={16} color={palette.teal} />
            <Text style={{ fontSize: 12, color: theme.muted, width: 70 }}>{row.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary, flex: 1 }}>{row.value}</Text>
          </View>
        ))}

        {item.description ? (
          <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.md, padding: SPACE.md, marginTop: SPACE.md }}>
            <Text style={{ fontSize: 13, color: theme.secondary, lineHeight: 20 }}>{item.description}</Text>
          </View>
        ) : null}

        {!done && (
          <Pressable onPress={() => onComplete(item.id)} disabled={completing} style={{ marginTop: SPACE.lg }}>
            <LinearGradient colors={[palette.emerald, "#059669"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
              {completing
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Mark Complete</Text></>}
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

function FollowUpCard({ item, theme, onPress }) {
  const overdue = isOverdue(item);
  const done = item.status === "completed";
  const color = done ? palette.emerald : overdue ? palette.red : palette.teal;

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: theme.card, borderRadius: RADIUS.xl, padding: SPACE.md,
        marginBottom: SPACE.sm, borderWidth: 1, borderColor: theme.border,
        borderLeftWidth: 4, borderLeftColor: color,
        opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: done ? theme.muted : theme.primary,
            textDecorationLine: done ? "line-through" : "none" }} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
            <Ionicons name="time-outline" size={12} color={overdue && !done ? palette.red : theme.dim} />
            <Text style={{ fontSize: 12, color: overdue && !done ? palette.red : theme.muted, fontWeight: overdue && !done ? "700" : "400" }}>
              {fmtDue(item.due_at)}
            </Text>
          </View>
          {item.employee_name ? (
            <Text style={{ fontSize: 11, color: theme.dim, marginTop: 3 }}>
              <Ionicons name="person-outline" size={11} color={theme.dim} /> {item.employee_name}
            </Text>
          ) : null}
        </View>
        <View style={{ backgroundColor: color + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3, borderWidth: 1, borderColor: color + "44" }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color }}>{done ? "Done" : overdue ? "Overdue" : "Pending"}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function FollowUps() {
  const { theme } = useTheme();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState("pending");
  const [selected, setSelected]   = useState(null);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getFollowUps({ page_size: 200 });
      setItems(res?.items || []);
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to load follow-ups");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  async function handleComplete(id) {
    setCompleting(true);
    try {
      await api.completeFollowUp(id);
      setSelected(null);
      await load(true);
    } catch (e) {
      Alert.alert("Error", e?.message || "Failed to complete follow-up");
    } finally {
      setCompleting(false);
    }
  }

  const filtered = useMemo(() => {
    if (filter === "pending") return items.filter((i) => i.status !== "completed" && i.status !== "cancelled");
    if (filter === "completed") return items.filter((i) => i.status === "completed");
    return items;
  }, [items, filter]);

  const overdueCnt = useMemo(() => items.filter(isOverdue).length, [items]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Follow-ups" />

      {/* Summary strip */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm, gap: SPACE.sm }}>
        {[
          { label: "Pending", count: items.filter((i) => i.status !== "completed").length, color: palette.teal },
          { label: "Overdue", count: overdueCnt, color: palette.red },
          { label: "Done",    count: items.filter((i) => i.status === "completed").length, color: palette.emerald },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, backgroundColor: s.color + "15", borderRadius: RADIUS.md, padding: SPACE.sm, alignItems: "center", borderWidth: 1, borderColor: s.color + "33" }}>
            <Text style={{ fontSize: 18, fontWeight: "800", color: s.color }}>{s.count}</Text>
            <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Filter tabs */}
      <View style={{ flexDirection: "row", paddingHorizontal: SPACE.lg, gap: SPACE.sm, marginBottom: SPACE.sm }}>
        {FILTERS.map((f) => {
          const on = f === filter;
          return (
            <Pressable key={f} onPress={() => setFilter(f)}
              style={{ flex: 1, paddingVertical: SPACE.sm, borderRadius: RADIUS.md, alignItems: "center",
                borderWidth: 1, borderColor: on ? palette.teal : theme.border,
                backgroundColor: on ? palette.teal : theme.surface }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: on ? "#04211d" : theme.muted, textTransform: "capitalize" }}>{f}</Text>
            </Pressable>
          );
        })}
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
            <FollowUpCard item={item} theme={theme} onPress={() => setSelected(item)} />
          )}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="calendar-outline" size={48} color={theme.dim} />
              <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>No {filter} follow-ups</Text>
            </View>
          }
        />
      )}

      <FollowUpDetailModal
        item={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onComplete={handleComplete}
        completing={completing}
        theme={theme}
      />
    </SafeAreaView>
  );
}

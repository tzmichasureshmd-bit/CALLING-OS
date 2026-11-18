import { useState, useEffect, useCallback, useMemo } from "react";
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator, RefreshControl, Alert, Modal, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

function initials(name) {
  return String(name || "?").split(/\s+/).map(p => p[0]).join("").slice(0, 2).toUpperCase();
}
function formatDate(v) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function CustomerDrawer({ customerId, visible, onClose, colors }) {
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !customerId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.getCustomer(customerId), api.getCustomerTimeline(customerId)])
      .then(([profile, events]) => {
        if (!active) return;
        setCustomer(profile);
        setTimeline(events?.items || []);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customerId, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: "10%",
        backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginTop: 12 }} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={[TYPE.h3, { color: colors.primary }]}>{customer?.name || "Customer"}</Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.muted} /></Pressable>
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : customer ? (
          <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}>
            {/* Info tiles */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>
              {[
                { icon: "call-outline",     label: "Phone",    value: customer.phone },
                { icon: "mail-outline",     label: "Email",    value: customer.email || "—" },
                { icon: "business-outline", label: "Company",  value: customer.company || "—" },
                { icon: "person-outline",   label: "Assigned", value: customer.employee_name || "Unassigned" },
              ].map(row => (
                <View key={row.label} style={{ width: "48%", padding: SPACE.md, borderRadius: RADIUS.card,
                  backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 }}>
                    <Ionicons name={row.icon} size={13} color={colors.accent} />
                    <Text style={[TYPE.micro, { color: colors.muted, textTransform: "uppercase" }]}>{row.label}</Text>
                  </View>
                  <Text style={[TYPE.body, { color: colors.primary, fontWeight: "700" }]} numberOfLines={1}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Timeline */}
            <Text style={[TYPE.title, { color: colors.primary, marginBottom: SPACE.md }]}>Activity Timeline</Text>
            {timeline.length === 0 ? (
              <Text style={[TYPE.caption, { color: colors.muted }]}>No activity yet</Text>
            ) : timeline.map((event, i) => (
              <View key={event.id || i} style={{ flexDirection: "row", gap: 10, padding: SPACE.md,
                borderRadius: RADIUS.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginBottom: SPACE.sm }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[TYPE.body, { color: colors.primary, fontWeight: "700" }]} numberOfLines={1}>
                    {event.event_type?.replaceAll("_", " ")}
                  </Text>
                  <Text style={[TYPE.caption, { color: colors.muted }]}>{event.description || "Activity recorded"}</Text>
                  <Text style={[TYPE.micro, { color: colors.muted, marginTop: 2 }]}>{formatDate(event.event_at)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

function CustomerCard({ customer, colors, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({
      backgroundColor: colors.white, borderRadius: RADIUS.card, padding: SPACE.md,
      borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1,
    })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.accent,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.white }}>{initials(customer.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[TYPE.body, { color: colors.primary, fontWeight: "700" }]} numberOfLines={1}>{customer.name}</Text>
          <Text style={[TYPE.caption, { color: colors.muted }]}>{customer.phone}</Text>
          {customer.company && <Text style={[TYPE.caption, { color: colors.muted }]}>{customer.company}</Text>}
        </View>
        <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
          <Text style={[TYPE.micro, { color: colors.muted, fontWeight: "700" }]}>{customer.status || "new"}</Text>
        </View>
      </View>
      {customer.employee_name && (
        <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>👤 {customer.employee_name}</Text>
      )}
    </Pressable>
  );
}

export default function AdminCustomers() {
  const router = useRouter();
  const colors = adminTheme;
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getCustomers({ limit: 500 });
      setCustomers(res?.items || []);
    } catch (e) { Alert.alert("Error", e?.message || "Failed to load customers"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers;
    const q = query.toLowerCase();
    return customers.filter(c => [c.name, c.phone, c.email, c.company, c.employee_name].join(" ").toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: SPACE.md }}>
          <Ionicons name="chevron-back" size={24} color={colors.accent} />
        </Pressable>
        <Text style={[TYPE.h2, { color: colors.primary, flex: 1 }]}>All Customers</Text>
        <View style={{ backgroundColor: colors.surface, borderRadius: RADIUS.md, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
          <Text style={[TYPE.caption, { color: colors.muted }]}>{customers.length}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", margin: SPACE.lg, backgroundColor: colors.surface,
        borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderWidth: 1, borderColor: colors.border }}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search customers…" placeholderTextColor={colors.muted}
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
          renderItem={({ item }) => <CustomerCard customer={item} colors={colors} onPress={() => setSelected(item.id)} />}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110, gap: SPACE.sm }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="people-outline" size={48} color={colors.muted} />
              <Text style={[TYPE.body, { color: colors.muted, marginTop: 12 }]}>No customers found</Text>
            </View>
          }
        />
      )}

      <CustomerDrawer customerId={selected} visible={!!selected} onClose={() => setSelected(null)} colors={colors} />
    </SafeAreaView>
  );
}

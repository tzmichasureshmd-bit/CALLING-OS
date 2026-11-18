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

function initials(name) {
  return String(name || "?").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

// ── Customer Drawer — same info as web: profile + activity timeline ───────────
function CustomerDrawer({ customerId, visible, onClose, onEdit, theme }) {
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!visible || !customerId) return;
    let active = true;
    setLoading(true); setError("");
    Promise.all([api.getCustomer(customerId), api.getCustomerTimeline(customerId)])
      .then(([profile, events]) => {
        if (!active) return;
        setCustomer(profile);
        setTimeline(events?.items || []);
      })
      .catch((e) => active && setError(e?.message || "Unable to load customer profile"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customerId, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, top: "10%",
        backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginTop: 12 }} />

        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center",
          paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {customer && (
              <View style={{ width: 48, height: 48, borderRadius: 15, backgroundColor: palette.teal,
                alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>{initials(customer.name)}</Text>
              </View>
            )}
            <View>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>{customer?.name || "Customer profile"}</Text>
              {customer && <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{customer.phone} · {customer.company || "No company"}</Text>}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {customer && (
              <Pressable onPress={() => onEdit(customer)}
                style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>Edit</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
          </View>
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={palette.teal} size="large" />
          </View>
        ) : error ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.lg }}>
            <Ionicons name="alert-circle-outline" size={40} color={palette.red} />
            <Text style={{ color: palette.red, marginTop: 12, textAlign: "center" }}>{error}</Text>
          </View>
        ) : customer ? (
          <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {/* 4 info tiles — same as web: Phone, Email, Company, Assigned */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>
              {[
                { icon: "call-outline",    label: "Phone",    value: customer.phone },
                { icon: "mail-outline",    label: "Email",    value: customer.email || "—" },
                { icon: "business-outline",label: "Company",  value: customer.company || "—" },
                { icon: "person-outline",  label: "Assigned", value: customer.employee_name || "Unassigned" },
              ].map((row) => (
                <View key={row.label} style={{ width: "48%", padding: SPACE.md, borderRadius: RADIUS.xl,
                  backgroundColor: palette.emerald + "12", borderWidth: 1, borderColor: palette.emerald + "22" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6 }}>
                    <Ionicons name={row.icon} size={13} color={palette.teal} />
                    <Text style={{ fontSize: 10, fontWeight: "800", color: theme.muted, textTransform: "uppercase" }}>{row.label}</Text>
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary }} numberOfLines={1}>{row.value}</Text>
                </View>
              ))}
            </View>

            {/* Status + dates */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: SPACE.lg, flexWrap: "wrap" }}>
              <View style={{ backgroundColor: palette.emerald + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: palette.emerald }}>● {customer.status || "new"}</Text>
              </View>
              <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4 }}>
                <Text style={{ fontSize: 11, color: theme.muted }}>Created {formatDate(customer.created_at)}</Text>
              </View>
              {customer.next_follow_up && (
                <View style={{ backgroundColor: palette.amber + "22", borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: palette.amber }}>Next {formatDate(customer.next_follow_up)}</Text>
                </View>
              )}
            </View>

            {/* Activity timeline — same as web */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: SPACE.md }}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary }}>Activity timeline</Text>
                <Text style={{ fontSize: 11, color: theme.muted, marginTop: 3 }}>Calls, outcomes, leads, opportunities, and follow-ups.</Text>
              </View>
              <Ionicons name="calendar-outline" size={18} color={palette.teal} />
            </View>

            {timeline.length === 0 ? (
              <View style={{ alignItems: "center", paddingVertical: 32 }}>
                <Ionicons name="calendar-outline" size={40} color={theme.dim} />
                <Text style={{ color: theme.muted, marginTop: 10, fontSize: 13 }}>No activity yet</Text>
                <Text style={{ color: theme.dim, marginTop: 4, fontSize: 12, textAlign: "center" }}>
                  The customer timeline will appear after synced calls and CRM actions.
                </Text>
              </View>
            ) : (
              timeline.map((event) => (
                <View key={event.id} style={{ flexDirection: "row", gap: 10, padding: SPACE.md,
                  borderRadius: RADIUS.xl, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, marginBottom: SPACE.sm }}>
                  <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: palette.emerald, marginTop: 5, flexShrink: 0 }} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ fontSize: 12.5, fontWeight: "700", color: theme.primary, flex: 1 }} numberOfLines={1}>
                        {event.event_type?.replaceAll("_", " ")}
                      </Text>
                      <Text style={{ fontSize: 10, color: theme.muted }}>{formatDate(event.event_at)}</Text>
                    </View>
                    <Text style={{ fontSize: 12, color: theme.secondary, marginTop: 3 }}>{event.description || "Activity recorded"}</Text>
                    {event.employee_name && (
                      <Text style={{ fontSize: 10.5, color: theme.dim, marginTop: 4 }}>By {event.employee_name}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

// ── Add / Edit Customer Modal (same fields as web) ────────────────────────────
function AddCustomerModal({ visible, onClose, onAdded, customer, theme }) {
  const [name, setName]       = useState(customer?.name || "");
  const [phone, setPhone]     = useState(customer?.phone || "");
  const [email, setEmail]     = useState(customer?.email || "");
  const [company, setCompany] = useState(customer?.company || "");
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (visible) {
      setName(customer?.name || ""); setPhone(customer?.phone || "");
      setEmail(customer?.email || ""); setCompany(customer?.company || "");
    }
  }, [visible, customer]);

  async function submit() {
    if (!name.trim() || !phone.trim()) { Alert.alert("Required", "Name and phone are required"); return; }
    setSaving(true);
    try {
      const payload = { name: name.trim(), phone: phone.trim(), email: email.trim() || null, company: company.trim() || null };
      if (customer) await api.updateCustomer(customer.id, payload);
      else await api.createCustomer(payload);
      onAdded(); onClose();
    } catch (e) { Alert.alert("Error", e?.message || "Unable to save customer"); }
    finally { setSaving(false); }
  }

  const inp = { backgroundColor: theme.surface, borderRadius: RADIUS.md, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: theme.primary, marginTop: 5 };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}>
        <KeyboardAvoidingView behavior="padding">
          <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>{customer ? "Edit customer" : "Add customer"}</Text>
              <Pressable onPress={onClose}><Ionicons name="close" size={24} color={theme.muted} /></Pressable>
            </View>
            {[
              { label: "NAME *",   value: name,    set: setName,    ph: "Full name",          kb: "default" },
              { label: "PHONE *",  value: phone,   set: setPhone,   ph: "+91 98765 43210",    kb: "phone-pad" },
              { label: "EMAIL",    value: email,   set: setEmail,   ph: "email@example.com",  kb: "email-address" },
              { label: "COMPANY",  value: company, set: setCompany, ph: "Company name",       kb: "default" },
            ].map((f) => (
              <View key={f.label} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.muted }}>{f.label}</Text>
                <TextInput value={f.value} onChangeText={f.set} placeholder={f.ph} placeholderTextColor={theme.dim}
                  keyboardType={f.kb} autoCapitalize={f.kb === "email-address" ? "none" : "words"} style={inp} />
              </View>
            ))}
            <Pressable onPress={submit} disabled={saving} style={{ marginTop: 8 }}>
              <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{customer ? "Save changes" : "Add customer"}</Text>}
              </LinearGradient>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ── Customer card — same as web grid card ─────────────────────────────────────
function CustomerCard({ customer, theme, onPress }) {
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        padding: SPACE.md, borderRadius: RADIUS.xl, borderWidth: 1,
        borderColor: palette.emerald + "33", backgroundColor: palette.emerald + "0a",
        opacity: pressed ? 0.85 : 1, marginBottom: SPACE.sm,
      })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: palette.teal,
          alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 13, fontWeight: "800", color: "#fff" }}>{initials(customer.name)}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary }} numberOfLines={1}>{customer.name}</Text>
          <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{customer.phone}</Text>
        </View>
        <View style={{ backgroundColor: theme.surface, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.sm, paddingVertical: 3 }}>
          <Text style={{ fontSize: 10, fontWeight: "700", color: theme.muted }}>{customer.status || "new"}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm }}>
        <Text style={{ fontSize: 11, color: theme.secondary }}>{customer.company || "No company"}</Text>
        <Text style={{ fontSize: 11, color: theme.dim }}>Last {customer.last_contact_at ? formatDate(customer.last_contact_at) : "—"}</Text>
      </View>
    </Pressable>
  );
}

export default function Customers() {
  const { theme } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery]         = useState("");
  const [selected, setSelected]   = useState(null);
  const [editing, setEditing]     = useState(null);
  const [adding, setAdding]       = useState(false);

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
    return customers.filter((c) => [c.name, c.phone, c.email, c.company].join(" ").toLowerCase().includes(q));
  }, [customers, query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <AppHeader title="Customers" right={
        <Pressable onPress={() => setAdding(true)}
          style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: palette.teal, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      } />

      {/* Header description + search — same as web */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.sm }}>
        <Text style={{ fontSize: 12, color: theme.muted, marginBottom: SPACE.sm }}>
          One profile and timeline for every customer conversation.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: RADIUS.md,
          paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: theme.border }}>
          <Ionicons name="search" size={16} color={theme.dim} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search customers..." placeholderTextColor={theme.dim}
            style={{ flex: 1, marginLeft: 8, fontSize: 14, color: theme.primary }} />
          {query.length > 0 && <Pressable onPress={() => setQuery("")}><Ionicons name="close-circle" size={16} color={theme.dim} /></Pressable>}
        </View>
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
            <CustomerCard customer={item} theme={theme} onPress={() => setSelected(item.id)} />
          )}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: 110, paddingTop: 4 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={palette.teal} />}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="person-outline" size={48} color={theme.dim} />
              <Text style={{ color: theme.muted, marginTop: 12, fontSize: 14 }}>No customers found</Text>
              <Text style={{ color: theme.dim, marginTop: 4, fontSize: 12, textAlign: "center" }}>
                Customers appear after synced calls or manual creation.
              </Text>
            </View>
          }
        />
      )}

      <CustomerDrawer
        customerId={selected}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onEdit={(c) => { setEditing(c); setSelected(null); }}
        theme={theme}
      />
      <AddCustomerModal visible={adding} onClose={() => setAdding(false)} onAdded={() => load(true)} theme={theme} />
      <AddCustomerModal visible={!!editing} customer={editing} onClose={() => setEditing(null)} onAdded={() => load(true)} theme={theme} />
    </SafeAreaView>
  );
}

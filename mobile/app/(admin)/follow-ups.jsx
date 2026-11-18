import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, Pressable, Modal, ActivityIndicator,
  RefreshControl, ScrollView, TextInput, Dimensions, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { adminTheme, adminPalette, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const C = adminTheme;
const SCREEN_W = Dimensions.get("window").width;

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function isCompleted(i) { return i.status === "completed"; }
function isPending(i)   { return i.status !== "completed" && i.status !== "cancelled"; }
function isOverdue(i)   { return isPending(i) && new Date(i.due_at) < new Date(); }
function fmtDue(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = d - new Date();
  const days = Math.floor(diff / 86400000);
  if (days < 0) return `Overdue · ${d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}`;
  if (days === 0) return `Today · ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`;
  if (days === 1) return `Tomorrow · ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`;
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"});
}
function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const total = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const days  = Array.from({length: total}, (_,i) => new Date(month.getFullYear(), month.getMonth(), i+1));
  const lead  = Array.from({length: first.getDay()}, () => null);
  return [...lead, ...days];
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────
function DetailSheet({ item, onClose, onComplete, completing, onReschedule, onUpdateStatus }) {
  if (!item) return null;
  const done    = isCompleted(item);
  const overdue = isOverdue(item);
  const color   = done ? "#22C55E" : overdue ? "#EF4444" : adminPalette.primary;
  const [showReschedule, setShowReschedule] = useState(false);
  const [showStatus, setShowStatus]         = useState(false);
  const [pickedDate, setPickedDate]         = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [statusNote, setStatusNote]         = useState("");
  const [saving, setSaving]                 = useState(false);
  const [noteSaved, setNoteSaved]           = useState(false);

  async function handleReschedule() {
    setSaving(true);
    try {
      await onReschedule(item.id, pickedDate.toISOString());
      setShowReschedule(false);
    } finally { setSaving(false); }
  }

  async function handleStatusSave() {
    if (!statusNote.trim()) return;
    setSaving(true);
    try {
      await onUpdateStatus(item.id, statusNote.trim());
      setNoteSaved(true);
      setStatusNote("");
      setTimeout(() => setNoteSaved(false), 2000);
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position:"absolute", bottom:0, left:0, right:0,
        backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:44 }}>
        <View style={{ width:36, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:"center", marginBottom:16 }} />

        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:18, fontWeight:"800", color:C.primary }} numberOfLines={2}>{item.title}</Text>
            <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginTop:6 }}>
              <View style={{ backgroundColor:color+"22", borderRadius:8, paddingHorizontal:10, paddingVertical:3 }}>
                <Text style={{ fontSize:11, fontWeight:"700", color }}>{done?"Completed":overdue?"Overdue":"Pending"}</Text>
              </View>
              <View style={{ backgroundColor:C.surface2, borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ fontSize:11, color:C.muted }}>{item.follow_up_type||"call"}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={22} color={C.muted} /></Pressable>
        </View>

        {[
        { icon:"person-outline",        label:"By",       value:(item.employee_name || item.created_by_name || "Admin") + (item.employee_id ? " (Employee)" : " (Admin)") },
          { icon:"person-circle-outline", label:"Contact",  value:item.contact_name  || item.customer?.name  || "—" },
          { icon:"call-outline",          label:"Phone",    value:item.contact_phone || item.customer?.phone || "—" },
          { icon:"time-outline",          label:"Due",      value:fmtDue(item.due_at) },
          { icon:"calendar-outline",      label:"Added",    value:item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—" },
        ].map(row => (
          <View key={row.label} style={{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:9,
            borderBottomWidth:1, borderBottomColor:C.border }}>
            <Ionicons name={row.icon} size={16} color={adminPalette.primary} />
            <Text style={{ fontSize:12, color:C.muted, width:70 }}>{row.label}</Text>
            <Text style={{ fontSize:13, fontWeight:"600", color:C.primary, flex:1 }}>{row.value}</Text>
          </View>
        ))}

        {item.description ? (
          <View style={{ backgroundColor:C.surface2, borderRadius:12, padding:12, marginTop:12 }}>
            <Text style={{ fontSize:13, color:C.secondary, lineHeight:20 }}>{item.description}</Text>
          </View>
        ) : null}

        {!done && (
          <Pressable onPress={() => onComplete(item.id)} disabled={completing} style={{ marginTop:16 }}>
            <LinearGradient colors={["#22C55E","#059669"]} start={{x:0,y:0}} end={{x:1,y:0}}
              style={{ height:50, borderRadius:13, alignItems:"center", justifyContent:"center", flexDirection:"row", gap:8 }}>
              {completing
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={{ color:"#fff", fontSize:15, fontWeight:"700" }}>Mark Complete</Text></>}
            </LinearGradient>
          </Pressable>
        )}

        {!done && (
          <View style={{ flexDirection:"row", gap:8, marginTop:10 }}>
            {/* Reschedule */}
            <Pressable onPress={() => { setShowReschedule(s => !s); setShowStatus(false); }}
              style={{ flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6,
                backgroundColor: showReschedule ? adminPalette.primary+"22" : C.surface2,
                borderRadius:12, paddingVertical:12, borderWidth:1.5,
                borderColor: showReschedule ? adminPalette.primary : C.border }}>
              <Ionicons name="calendar-outline" size={16} color={adminPalette.primary} />
              <Text style={{ fontSize:13, fontWeight:"700", color:adminPalette.primary }}>Reschedule</Text>
            </Pressable>
            {/* Status note */}
            <Pressable onPress={() => { setShowStatus(s => !s); setShowReschedule(false); }}
              style={{ flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6,
                backgroundColor: showStatus ? "#8B5CF622" : C.surface2,
                borderRadius:12, paddingVertical:12, borderWidth:1.5,
                borderColor: showStatus ? "#8B5CF6" : C.border }}>
              <Ionicons name="chatbubble-outline" size={16} color="#8B5CF6" />
              <Text style={{ fontSize:13, fontWeight:"700", color:"#8B5CF6" }}>Add Note</Text>
            </Pressable>
          </View>
        )}

        {/* Reschedule form */}
        {showReschedule && (
          <View style={{ backgroundColor:adminPalette.primary+"10", borderRadius:12, padding:14, marginTop:10, borderWidth:1, borderColor:adminPalette.primary+"33" }}>
            <Text style={{ fontSize:12, fontWeight:"700", color:adminPalette.primary, marginBottom:12 }}>Set new follow-up date & time</Text>

            {/* Date picker button */}
            <Pressable onPress={() => setShowDatePicker(true)}
              style={{ flexDirection:"row", alignItems:"center", gap:10, backgroundColor:C.card,
                borderRadius:10, borderWidth:1, borderColor:C.border, padding:12, marginBottom:8 }}>
              <Ionicons name="calendar-outline" size={18} color={adminPalette.primary} />
              <Text style={{ fontSize:14, color:C.primary, flex:1 }}>
                {pickedDate.toLocaleDateString("en-IN", { weekday:"short", day:"2-digit", month:"short", year:"numeric" })}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={C.dim} />
            </Pressable>

            {/* Time picker button */}
            <Pressable onPress={() => setShowTimePicker(true)}
              style={{ flexDirection:"row", alignItems:"center", gap:10, backgroundColor:C.card,
                borderRadius:10, borderWidth:1, borderColor:C.border, padding:12, marginBottom:12 }}>
              <Ionicons name="time-outline" size={18} color={adminPalette.primary} />
              <Text style={{ fontSize:14, color:C.primary, flex:1 }}>
                {pickedDate.toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={C.dim} />
            </Pressable>

            {/* Native pickers */}
            {showDatePicker && (
              <DateTimePicker
                value={pickedDate}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(e, date) => { setShowDatePicker(false); if (date) setPickedDate(prev => { const d = new Date(date); d.setHours(prev.getHours(), prev.getMinutes()); return d; }); }}
              />
            )}
            {showTimePicker && (
              <DateTimePicker
                value={pickedDate}
                mode="time"
                display="default"
                onChange={(e, date) => { setShowTimePicker(false); if (date) setPickedDate(prev => { const d = new Date(prev); d.setHours(date.getHours(), date.getMinutes()); return d; }); }}
              />
            )}

            <Pressable onPress={handleReschedule} disabled={saving}
              style={{ backgroundColor:adminPalette.primary, borderRadius:10, paddingVertical:12, alignItems:"center" }}>
              <Text style={{ color:"#fff", fontSize:14, fontWeight:"700" }}>{saving ? "Saving…" : "Confirm Reschedule"}</Text>
            </Pressable>
          </View>
        )}

        {/* Status note form */}
        {showStatus && (
          <View style={{ backgroundColor:"#8B5CF610", borderRadius:12, padding:14, marginTop:10, borderWidth:1, borderColor:"#8B5CF633" }}>
            <Text style={{ fontSize:12, fontWeight:"700", color:"#8B5CF6", marginBottom:10 }}>Why waiting? Add a note</Text>
            <TextInput
              value={statusNote} onChangeText={setStatusNote}
              placeholder="e.g. Client asked to call back next week, waiting for budget approval…"
              placeholderTextColor={C.dim} multiline
              style={{ backgroundColor:C.card, borderRadius:9, borderWidth:1, borderColor:C.border,
                paddingHorizontal:12, paddingVertical:10, fontSize:13, color:C.primary,
                minHeight:80, textAlignVertical:"top", marginBottom:10 }}
            />
            <Pressable onPress={handleStatusSave} disabled={saving || !statusNote.trim()}
              style={{ backgroundColor: noteSaved ? "#22C55E" : "#8B5CF6", borderRadius:10, paddingVertical:11,
                alignItems:"center", opacity: !statusNote.trim() && !noteSaved ? 0.5 : 1 }}>
              <Text style={{ color:"#fff", fontSize:14, fontWeight:"700" }}>
                {saving ? "Saving…" : noteSaved ? "✓ Note Saved!" : "Save Note"}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Calendar View ─────────────────────────────────────────────────────────────
function CalendarView({ items, onSelect, month, onPrevMonth, onNextMonth }) {
  const days    = useMemo(() => monthDays(month), [month]);
  const grouped = useMemo(() => {
    const map = {};
    items.forEach(i => {
      const k = dateKey(i.due_at);
      if (!map[k]) map[k] = [];
      map[k].push(i);
    });
    return map;
  }, [items]);

  const todayKey = dateKey(new Date());
  const DAY_W    = Math.floor((SCREEN_W - 32) / 7);

  return (
    <View style={{ marginHorizontal: SPACE.lg }}>
      {/* Month nav */}
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between",
        backgroundColor: C.card, borderTopLeftRadius:16, borderTopRightRadius:16,
        borderWidth:1, borderColor:C.border, borderBottomWidth:0, padding:14 }}>
        <Pressable onPress={onPrevMonth} hitSlop={12}
          style={{ width:34, height:34, borderRadius:10, backgroundColor:C.surface2,
            alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.border }}>
          <Ionicons name="chevron-back" size={16} color={C.primary} />
        </Pressable>
        <Text style={{ fontSize:16, fontWeight:"800", color:C.primary }}>
          {month.toLocaleDateString("en-IN", { month:"long", year:"numeric" })}
        </Text>
        <Pressable onPress={onNextMonth} hitSlop={12}
          style={{ width:34, height:34, borderRadius:10, backgroundColor:C.surface2,
            alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:C.border }}>
          <Ionicons name="chevron-forward" size={16} color={C.primary} />
        </Pressable>
      </View>

      {/* Grid container */}
      <View style={{ borderWidth:1, borderColor:C.border, borderBottomLeftRadius:16, borderBottomRightRadius:16, overflow:"hidden", backgroundColor:C.card }}>
        {/* Day headers */}
        <View style={{ flexDirection:"row", borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.surface2 }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <View key={d} style={{ width:DAY_W, alignItems:"center", paddingVertical:8 }}>
              <Text style={{ fontSize:10, fontWeight:"700", color:C.muted }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View style={{ flexDirection:"row", flexWrap:"wrap" }}>
          {days.map((day, i) => {
            if (!day) return (
              <View key={`e-${i}`} style={{ width:DAY_W, height:72,
                borderRightWidth:1, borderBottomWidth:1, borderColor:C.border,
                backgroundColor:C.surface2 }} />
            );
            const key      = dateKey(day);
            const dayItems = grouped[key] || [];
            const isToday  = key === todayKey;

            return (
              <Pressable key={key}
                onPress={() => dayItems.length > 0 && onSelect(dayItems)}
                style={({ pressed }) => ({
                  width:DAY_W, minHeight:72,
                  borderRightWidth:1, borderBottomWidth:1, borderColor:C.border,
                  backgroundColor: isToday ? "#EFF6FF" : pressed ? C.surface2 : C.card,
                  padding:4,
                })}>
                {/* Date number */}
                <View style={{ alignItems:"center", marginBottom:3 }}>
                  <View style={{
                    width:22, height:22, borderRadius:11,
                    backgroundColor: isToday ? adminPalette.primary : "transparent",
                    alignItems:"center", justifyContent:"center",
                  }}>
                    <Text style={{ fontSize:12, fontWeight: isToday ? "800" : "500",
                      color: isToday ? "#fff" : C.primary }}>{day.getDate()}</Text>
                  </View>
                </View>

                {/* Event chips — max 2 visible */}
                {dayItems.slice(0, 2).map((item, idx) => {
                  const done    = isCompleted(item);
                  const overdue = isOverdue(item);
                  const color   = done ? "#22C55E" : overdue ? "#EF4444" : adminPalette.primary;
                  const name    = item.contact_name || item.customer?.name || item.title || "";
                  return (
                    <View key={item.id||idx} style={{
                      borderLeftWidth:3, borderLeftColor:color,
                      borderRadius:4, paddingHorizontal:3, paddingVertical:2,
                      marginBottom:2,
                      backgroundColor: done ? "#F0FDF4" : overdue ? "#FEF2F2" : adminPalette.primary+"12",
                    }}>
                      <Text style={{ fontSize:9, fontWeight:"700", color, lineHeight:12 }} numberOfLines={1}>
                        {name.length > 8 ? name.slice(0,7)+"…" : name}
                      </Text>
                      <Text style={{ fontSize:8, color:C.dim }}>{fmtTime(item.due_at)}</Text>
                    </View>
                  );
                })}
                {dayItems.length > 2 && (
                  <Text style={{ fontSize:8, color:C.muted, textAlign:"center" }}>+{dayItems.length-2} more</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={{ flexDirection:"row", gap:16, padding:10, borderTopWidth:1, borderTopColor:C.border }}>
          {[["#EF4444","Overdue"],[adminPalette.primary,"Pending"],["#22C55E","Done"]].map(([color,label]) => (
            <View key={label} style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
              <View style={{ width:8, height:8, borderRadius:2, backgroundColor:color }} />
              <Text style={{ fontSize:10, color:C.muted }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── List Row ──────────────────────────────────────────────────────────────────
function FollowUpRow({ item, onPress, isLast }) {
  const done    = isCompleted(item);
  const overdue = isOverdue(item);
  const color   = done ? "#22C55E" : overdue ? "#EF4444" : adminPalette.primary;
  const name    = item.contact_name || item.customer?.name || item.title;
  const phone   = item.contact_phone || item.customer?.phone;

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flexDirection:"row", alignItems:"center",
        backgroundColor: pressed ? C.surface2 : C.card,
        paddingHorizontal:16, paddingVertical:13,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor:C.border,
      })}>
      <View style={{ width:4, height:52, borderRadius:4, backgroundColor:color, marginRight:12 }} />
      <View style={{ width:40, height:40, borderRadius:12, backgroundColor:color+"18", alignItems:"center", justifyContent:"center", marginRight:12 }}>
        <Ionicons name={done?"checkmark-circle":overdue?"alert-circle":"calendar"} size={20} color={color} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:14, fontWeight:"700", color:done?C.muted:C.primary,
          textDecorationLine:done?"line-through":"none" }} numberOfLines={1}>{name}</Text>
        {phone && <Text style={{ fontSize:12, color:adminPalette.primary, fontWeight:"600", marginTop:1 }}>{phone}</Text>}
        <Text style={{ fontSize:11, color:C.muted, marginTop:1 }}>
          {item.employee_name || item.created_by_name || "Admin"}
          {item.employee_id ? " · Employee" : " · Admin"}
          {" · "}{item.follow_up_type||"call"}
        </Text>
        <Text style={{ fontSize:11, fontWeight:overdue&&!done?"700":"400",
          color:overdue&&!done?"#EF4444":C.dim, marginTop:2 }}>Due: {fmtDue(item.due_at)}</Text>
      </View>
      <View style={{ alignItems:"flex-end", gap:4 }}>
        <View style={{ backgroundColor:color+"22", borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
          <Text style={{ fontSize:10, fontWeight:"700", color }}>{done?"Done":overdue?"Overdue":"Pending"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={C.dim} />
      </View>
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminFollowUps() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [empFilter, setEmpFilter]   = useState("All");
  const [dayItems, setDayItems] = useState(null); // array of items for selected day
  const [selected, setSelected]     = useState(null);
  const [completing, setCompleting] = useState(false);
  const [viewMode, setViewMode]     = useState("calendar"); // "calendar" | "list"
  const [month, setMonth]           = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getFollowUps({ page_size: 500 });
      setItems(res?.items || []);
    } catch (e) { console.warn("AdminFollowUps:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleComplete(id) {
    setCompleting(true);
    try { await api.completeFollowUp(id); setSelected(null); await load(true); }
    catch (e) { console.warn(e); }
    finally { setCompleting(false); }
  }

  async function handleReschedule(id, newDueAt) {
    try {
      await fetch(`${(await import("../../src/api")).BASE_URL}/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await (await import("../../src/api")).getAccessToken()}` },
        body: JSON.stringify({ due_at: new Date(newDueAt).toISOString() }),
      });
      setSelected(null); await load(true);
    } catch (e) { console.warn(e); }
  }

  async function handleUpdateStatus(id, note) {
    try {
      await fetch(`${(await import("../../src/api")).BASE_URL}/follow-ups/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await (await import("../../src/api")).getAccessToken()}` },
        body: JSON.stringify({ description: note }),
      });
      // Don't close sheet — just reload data in background
      load(true);
    } catch (e) { console.warn(e); }
  }

  const employees = useMemo(() =>
    ["All", ...Array.from(new Set(items.map(i => i.employee_name).filter(Boolean))).sort()],
  [items]);

  const allFiltered = useMemo(() => {
    let list = items;
    if (empFilter !== "All") list = list.filter(i => i.employee_name === empFilter);
    return list.sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  }, [items, empFilter]);

  const filtered = useMemo(() => {
    let list = items;
    if (statusFilter === "pending")   list = list.filter(isPending);
    if (statusFilter === "completed") list = list.filter(isCompleted);
    if (statusFilter === "overdue")   list = list.filter(isOverdue);
    if (empFilter !== "All")          list = list.filter(i => i.employee_name === empFilter);
    return list.sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  }, [items, statusFilter, empFilter]);

  const counts = useMemo(() => ({
    pending:   items.filter(isPending).length,
    overdue:   items.filter(isOverdue).length,
    completed: items.filter(isCompleted).length,
  }), [items]);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal:SPACE.lg, paddingVertical:SPACE.md, borderBottomWidth:1, borderBottomColor:C.border, backgroundColor:C.card }}>
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <Text style={{ fontSize:20, fontWeight:"800", color:C.primary }}>Follow-ups</Text>
          {/* View toggle */}
          <View style={{ flexDirection:"row", backgroundColor:C.surface2, borderRadius:10, padding:3 }}>
            {[["calendar","calendar-outline"],["list","list-outline"]].map(([mode, icon]) => (
              <Pressable key={mode} onPress={() => setViewMode(mode)}
                style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:8,
                  backgroundColor: viewMode===mode ? C.card : "transparent" }}>
                <Ionicons name={icon} size={18} color={viewMode===mode ? adminPalette.primary : C.muted} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stats */}
        <View style={{ flexDirection:"row", gap:8, marginBottom:10 }}>
          {[
            { key:"pending",   label:"Pending",  color:adminPalette.primary },
            { key:"overdue",   label:"Overdue",  color:"#EF4444" },
            { key:"completed", label:"Done",     color:"#22C55E" },
          ].map(s => (
            <Pressable key={s.key} onPress={() => setStatusFilter(s.key)}
              style={{ flex:1, backgroundColor:statusFilter===s.key ? s.color : s.color+"15",
                borderRadius:10, padding:8, alignItems:"center", borderWidth:1, borderColor:s.color+"44" }}>
              <Text style={{ fontSize:16, fontWeight:"800", color:statusFilter===s.key?"#fff":s.color }}>{counts[s.key]}</Text>
              <Text style={{ fontSize:10, color:statusFilter===s.key?"#fff":C.muted, marginTop:1 }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Employee filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {employees.map(e => {
              const on = e === empFilter;
              return (
                <Pressable key={e} onPress={() => setEmpFilter(e)}
                  style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:999, borderWidth:1.5,
                    borderColor:on?adminPalette.primary:C.border, backgroundColor:on?adminPalette.primary:C.card }}>
                  <Text style={{ fontSize:12, fontWeight:"700", color:on?"#fff":C.muted }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator color={adminPalette.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={adminPalette.primary} />}
          contentContainerStyle={{ paddingVertical:SPACE.md, paddingBottom:120 }}>

          {viewMode === "calendar" && (
            <CalendarView
              items={allFiltered}
              onSelect={(dayItemsList) => {
                if (dayItemsList.length === 1) setSelected(dayItemsList[0]);
                else setDayItems(dayItemsList);
              }}
              month={month}
              onPrevMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
              onNextMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
            />
          )}

          {/* List view */}
          {viewMode === "list" && (
            <View style={{ marginHorizontal:SPACE.lg, backgroundColor:C.card, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:"hidden" }}>
              {filtered.length === 0 ? (
                <View style={{ alignItems:"center", paddingVertical:60 }}>
                  <Ionicons name="calendar-outline" size={48} color={C.dim} />
                  <Text style={{ fontSize:15, fontWeight:"600", color:C.secondary, marginTop:12 }}>No follow-ups</Text>
                </View>
              ) : filtered.map((item, index) => (
                <FollowUpRow key={item.id||index} item={item} onPress={() => setSelected(item)} isLast={index===filtered.length-1} />
              ))}
            </View>
          )}

          {/* Below calendar: today's list */}
          {viewMode === "calendar" && filtered.length > 0 && (
            <View style={{ marginHorizontal:SPACE.lg, marginTop:SPACE.md, backgroundColor:C.card, borderRadius:16, borderWidth:1, borderColor:C.border, overflow:"hidden" }}>
              <View style={{ padding:14, borderBottomWidth:1, borderBottomColor:C.border }}>
                <Text style={{ fontSize:14, fontWeight:"700", color:C.primary }}>{filtered.length} follow-ups · {statusFilter}</Text>
              </View>
              {filtered.slice(0,10).map((item, index) => (
                <FollowUpRow key={item.id||index} item={item} onPress={() => setSelected(item)} isLast={index===Math.min(filtered.length,10)-1} />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Day items picker */}
      <Modal visible={!!dayItems} transparent animationType="slide" onRequestClose={() => setDayItems(null)}>
        <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)" }} onPress={() => setDayItems(null)} />
        <View style={{ position:"absolute", bottom:0, left:0, right:0,
          backgroundColor:C.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40 }}>
          <View style={{ width:36, height:4, borderRadius:2, backgroundColor:C.border, alignSelf:"center", marginBottom:16 }} />
          <Text style={{ fontSize:16, fontWeight:"800", color:C.primary, marginBottom:14 }}>
            {dayItems?.[0] ? new Date(dayItems[0].due_at).toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long"}) : ""}
            {" · "}{dayItems?.length} follow-ups
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight:400 }}>
            {dayItems?.map((item, i) => {
              const done = isCompleted(item); const overdue = isOverdue(item);
              const color = done ? "#22C55E" : overdue ? "#EF4444" : adminPalette.primary;
              const name = item.contact_name || item.customer?.name || item.title;
              return (
                <Pressable key={item.id||i} onPress={() => { setDayItems(null); setSelected(item); }}
                  style={{ flexDirection:"row", alignItems:"center", gap:12, padding:12,
                    backgroundColor:C.surface2, borderRadius:12, marginBottom:8,
                    borderLeftWidth:4, borderLeftColor:color }}>
                  <View style={{ flex:1 }}>
                    <Text style={{ fontSize:14, fontWeight:"700", color:C.primary }} numberOfLines={1}>{name}</Text>
                    <Text style={{ fontSize:12, color:adminPalette.primary }}>{item.contact_phone || item.customer?.phone || ""}</Text>
                    <Text style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                      {item.employee_name || "Admin"} · {fmtTime(item.due_at)}
                    </Text>
                  </View>
                  <View style={{ backgroundColor:color+"22", borderRadius:8, paddingHorizontal:8, paddingVertical:4 }}>
                    <Text style={{ fontSize:10, fontWeight:"700", color }}>{done?"Done":overdue?"Overdue":"Pending"}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={C.dim} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      <DetailSheet item={selected} onClose={() => setSelected(null)} onComplete={handleComplete} completing={completing} onReschedule={handleReschedule} onUpdateStatus={handleUpdateStatus} />
    </SafeAreaView>
  );
}

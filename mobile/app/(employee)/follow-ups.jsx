import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, Pressable, Modal, ActivityIndicator,
  RefreshControl, ScrollView, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { api } from "../../src/api";

const TEAL    = "#0ABFA3";
const NAVY    = "#0D1B4B";
const SCREEN_W = Dimensions.get("window").width;

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateKey(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
function isOverdue(i) { return i.status !== "completed" && i.status !== "cancelled" && new Date(i.due_at) < new Date(); }
function isPending(i) { return i.status !== "completed" && i.status !== "cancelled"; }
function fmtDue(iso) {
  if (!iso) return "—";
  const d = new Date(iso), diff = d - new Date(), days = Math.floor(diff / 86400000);
  if (days < 0) return `Overdue · ${d.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}`;
  if (days === 0) return `Today · ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`;
  if (days === 1) return `Tomorrow · ${d.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`;
  return d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}); }
function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const total = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const days  = Array.from({length: total}, (_,i) => new Date(month.getFullYear(), month.getMonth(), i+1));
  const lead  = Array.from({length: first.getDay()}, () => null);
  return [...lead, ...days];
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ item, onClose, onComplete, completing, theme }) {
  if (!item) return null;
  const done    = item.status === "completed";
  const overdue = isOverdue(item);
  const color   = done ? palette.emerald : overdue ? palette.red : TEAL;
  const name    = item.contact_name || item.customer?.name || item.title;
  const phone   = item.contact_phone || item.customer?.phone;

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position:"absolute", bottom:0, left:0, right:0,
        backgroundColor:theme.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:44 }}>
        <View style={{ width:36, height:4, borderRadius:2, backgroundColor:theme.border, alignSelf:"center", marginBottom:16 }} />

        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <View style={{ flex:1 }}>
            <Text style={{ fontSize:18, fontWeight:"800", color:theme.primary }} numberOfLines={2}>{name}</Text>
            {phone && <Text style={{ fontSize:13, color:TEAL, fontWeight:"600", marginTop:3 }}>{phone}</Text>}
            <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginTop:6 }}>
              <View style={{ backgroundColor:color+"22", borderRadius:8, paddingHorizontal:10, paddingVertical:3 }}>
                <Text style={{ fontSize:11, fontWeight:"700", color }}>{done?"Completed":overdue?"Overdue":"Pending"}</Text>
              </View>
              <View style={{ backgroundColor:theme.surface, borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
                <Text style={{ fontSize:11, color:theme.muted }}>{item.follow_up_type||"call"}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={22} color={theme.muted} /></Pressable>
        </View>

        {[
          { icon:"time-outline",    label:"Due",     value:fmtDue(item.due_at) },
          { icon:"calendar-outline",label:"Added",   value:item.created_at ? new Date(item.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—" },
        ].map(row => (
          <View key={row.label} style={{ flexDirection:"row", alignItems:"center", gap:12, paddingVertical:9,
            borderBottomWidth:1, borderBottomColor:theme.border }}>
            <Ionicons name={row.icon} size={16} color={TEAL} />
            <Text style={{ fontSize:12, color:theme.muted, width:60 }}>{row.label}</Text>
            <Text style={{ fontSize:13, fontWeight:"600", color:theme.primary, flex:1 }}>{row.value}</Text>
          </View>
        ))}

        {item.description ? (
          <View style={{ backgroundColor:theme.surface, borderRadius:12, padding:12, marginTop:12 }}>
            <Text style={{ fontSize:13, color:theme.secondary, lineHeight:20 }}>{item.description}</Text>
          </View>
        ) : null}

        {!done && (
          <Pressable onPress={() => onComplete(item.id)} disabled={completing} style={{ marginTop:20 }}>
            <LinearGradient colors={[palette.emerald,"#059669"]} start={{x:0,y:0}} end={{x:1,y:0}}
              style={{ height:50, borderRadius:13, alignItems:"center", justifyContent:"center", flexDirection:"row", gap:8 }}>
              {completing
                ? <ActivityIndicator color="#fff" />
                : <><Ionicons name="checkmark-circle" size={20} color="#fff" /><Text style={{ color:"#fff", fontSize:15, fontWeight:"700" }}>Mark Complete</Text></>}
            </LinearGradient>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

// ── Day items modal ───────────────────────────────────────────────────────────
function DayModal({ items, onClose, onSelect, theme }) {
  if (!items) return null;
  return (
    <Modal visible={!!items} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position:"absolute", bottom:0, left:0, right:0,
        backgroundColor:theme.card, borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, paddingBottom:40 }}>
        <View style={{ width:36, height:4, borderRadius:2, backgroundColor:theme.border, alignSelf:"center", marginBottom:16 }} />
        <Text style={{ fontSize:16, fontWeight:"800", color:theme.primary, marginBottom:14 }}>
          {items[0] ? new Date(items[0].due_at).toLocaleDateString("en-IN",{weekday:"long",day:"2-digit",month:"long"}) : ""}
          {" · "}{items.length} follow-up{items.length > 1 ? "s" : ""}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight:360 }}>
          {items.map((item, i) => {
            const done = item.status === "completed", overdue = isOverdue(item);
            const color = done ? palette.emerald : overdue ? palette.red : TEAL;
            const name  = item.contact_name || item.customer?.name || item.title;
            const phone = item.contact_phone || item.customer?.phone;
            return (
              <Pressable key={item.id||i} onPress={() => { onClose(); onSelect(item); }}
                style={{ flexDirection:"row", alignItems:"center", gap:12, padding:12,
                  backgroundColor:theme.surface, borderRadius:12, marginBottom:8, borderLeftWidth:4, borderLeftColor:color }}>
                <View style={{ flex:1 }}>
                  <Text style={{ fontSize:14, fontWeight:"700", color:theme.primary }} numberOfLines={1}>{name}</Text>
                  {phone && <Text style={{ fontSize:12, color:TEAL, fontWeight:"600", marginTop:1 }}>{phone}</Text>}
                  <Text style={{ fontSize:11, color:theme.muted, marginTop:2 }}>{fmtTime(item.due_at)}</Text>
                </View>
                <View style={{ backgroundColor:color+"22", borderRadius:8, paddingHorizontal:8, paddingVertical:4 }}>
                  <Text style={{ fontSize:10, fontWeight:"700", color }}>{done?"Done":overdue?"Overdue":"Pending"}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={theme.dim} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function CalendarView({ items, onSelect, month, onPrevMonth, onNextMonth, theme }) {
  const days    = useMemo(() => monthDays(month), [month]);
  const grouped = useMemo(() => {
    const map = {};
    items.forEach(i => { const k = dateKey(i.due_at); if (!map[k]) map[k] = []; map[k].push(i); });
    return map;
  }, [items]);
  const todayKey = dateKey(new Date());
  const DAY_W   = Math.floor((SCREEN_W - 32) / 7);

  return (
    <View style={{ marginHorizontal:SPACE.lg }}>
      {/* Month nav */}
      <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between",
        backgroundColor:theme.card, borderTopLeftRadius:16, borderTopRightRadius:16,
        borderWidth:1, borderColor:theme.border, borderBottomWidth:0, padding:14 }}>
        <Pressable onPress={onPrevMonth} hitSlop={12}
          style={{ width:34, height:34, borderRadius:10, backgroundColor:theme.surface,
            alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:theme.border }}>
          <Ionicons name="chevron-back" size={16} color={theme.primary} />
        </Pressable>
        <Text style={{ fontSize:16, fontWeight:"800", color:theme.primary }}>
          {month.toLocaleDateString("en-IN",{month:"long",year:"numeric"})}
        </Text>
        <Pressable onPress={onNextMonth} hitSlop={12}
          style={{ width:34, height:34, borderRadius:10, backgroundColor:theme.surface,
            alignItems:"center", justifyContent:"center", borderWidth:1, borderColor:theme.border }}>
          <Ionicons name="chevron-forward" size={16} color={theme.primary} />
        </Pressable>
      </View>

      <View style={{ borderWidth:1, borderColor:theme.border, borderBottomLeftRadius:16, borderBottomRightRadius:16, overflow:"hidden", backgroundColor:theme.card }}>
        {/* Day headers */}
        <View style={{ flexDirection:"row", borderBottomWidth:1, borderBottomColor:theme.border, backgroundColor:theme.surface }}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <View key={d} style={{ width:DAY_W, alignItems:"center", paddingVertical:8 }}>
              <Text style={{ fontSize:10, fontWeight:"700", color:theme.muted }}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={{ flexDirection:"row", flexWrap:"wrap" }}>
          {days.map((day, i) => {
            if (!day) return (
              <View key={`e-${i}`} style={{ width:DAY_W, height:68,
                borderRightWidth:1, borderBottomWidth:1, borderColor:theme.border, backgroundColor:theme.surface }} />
            );
            const key      = dateKey(day);
            const dayItems = grouped[key] || [];
            const isToday  = key === todayKey;
            return (
              <Pressable key={key} onPress={() => dayItems.length > 0 && onSelect(dayItems)}
                style={({ pressed }) => ({
                  width:DAY_W, minHeight:68,
                  borderRightWidth:1, borderBottomWidth:1, borderColor:theme.border,
                  backgroundColor: isToday ? TEAL+"18" : pressed ? theme.surface : theme.card,
                  padding:3,
                })}>
                <View style={{ alignItems:"center", marginBottom:2 }}>
                  <View style={{ width:22, height:22, borderRadius:11,
                    backgroundColor: isToday ? TEAL : "transparent",
                    alignItems:"center", justifyContent:"center" }}>
                    <Text style={{ fontSize:12, fontWeight:isToday?"800":"500",
                      color:isToday?"#fff":theme.primary }}>{day.getDate()}</Text>
                  </View>
                </View>
                {dayItems.slice(0,2).map((item, idx) => {
                  const done = item.status==="completed", overdue = isOverdue(item);
                  const color = done ? palette.emerald : overdue ? palette.red : TEAL;
                  const name  = item.contact_name || item.customer?.name || item.title || "";
                  return (
                    <View key={item.id||idx} style={{ borderLeftWidth:3, borderLeftColor:color,
                      borderRadius:3, paddingHorizontal:2, paddingVertical:1, marginBottom:2,
                      backgroundColor:color+"18" }}>
                      <Text style={{ fontSize:9, fontWeight:"700", color, lineHeight:12 }} numberOfLines={1}>
                        {name.length > 7 ? name.slice(0,6)+"…" : name}
                      </Text>
                    </View>
                  );
                })}
                {dayItems.length > 2 && (
                  <Text style={{ fontSize:8, color:theme.muted, textAlign:"center" }}>+{dayItems.length-2}</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={{ flexDirection:"row", gap:14, padding:10, borderTopWidth:1, borderTopColor:theme.border }}>
          {[[palette.red,"Overdue"],[TEAL,"Pending"],[palette.emerald,"Done"]].map(([color,label]) => (
            <View key={label} style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
              <View style={{ width:8, height:8, borderRadius:2, backgroundColor:color }} />
              <Text style={{ fontSize:10, color:theme.muted }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────
function FollowUpRow({ item, onPress, isLast, theme }) {
  const done    = item.status === "completed";
  const overdue = isOverdue(item);
  const color   = done ? palette.emerald : overdue ? palette.red : TEAL;
  const name    = item.contact_name || item.customer?.name || item.title;
  const phone   = item.contact_phone || item.customer?.phone;

  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flexDirection:"row", alignItems:"center",
        backgroundColor: pressed ? theme.surface : theme.card,
        paddingHorizontal:16, paddingVertical:13,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor:theme.border,
      })}>
      <View style={{ width:4, height:48, borderRadius:4, backgroundColor:color, marginRight:12 }} />
      <View style={{ width:38, height:38, borderRadius:11, backgroundColor:color+"18",
        alignItems:"center", justifyContent:"center", marginRight:12 }}>
        <Ionicons name={done?"checkmark-circle":overdue?"alert-circle":"calendar"} size={18} color={color} />
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ fontSize:14, fontWeight:"700", color:done?theme.muted:theme.primary,
          textDecorationLine:done?"line-through":"none" }} numberOfLines={1}>{name}</Text>
        {phone && <Text style={{ fontSize:12, color:TEAL, fontWeight:"600", marginTop:1 }}>{phone}</Text>}
        <Text style={{ fontSize:11, fontWeight:overdue&&!done?"700":"400",
          color:overdue&&!done?palette.red:theme.dim, marginTop:2 }}>{fmtDue(item.due_at)}</Text>
      </View>
      <View style={{ alignItems:"flex-end", gap:4 }}>
        <View style={{ backgroundColor:color+"22", borderRadius:8, paddingHorizontal:8, paddingVertical:3 }}>
          <Text style={{ fontSize:10, fontWeight:"700", color }}>{done?"Done":overdue?"Overdue":"Pending"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={13} color={theme.dim} />
      </View>
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FollowUps() {
  const { theme } = useTheme();
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode,   setViewMode]   = useState("calendar");
  const [filter,     setFilter]     = useState("pending");
  const [month,      setMonth]      = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected,   setSelected]   = useState(null);
  const [dayItems,   setDayItems]   = useState(null);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getFollowUps({ page_size: 200 });
      setItems(res?.items || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleComplete(id) {
    setCompleting(true);
    try { await api.completeFollowUp(id); setSelected(null); await load(true); }
    catch {}
    finally { setCompleting(false); }
  }

  const counts = useMemo(() => ({
    pending:   items.filter(isPending).length,
    overdue:   items.filter(isOverdue).length,
    completed: items.filter(i => i.status === "completed").length,
  }), [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === "pending")   list = list.filter(isPending);
    if (filter === "completed") list = list.filter(i => i.status === "completed");
    if (filter === "overdue")   list = list.filter(isOverdue);
    return list.sort((a,b) => new Date(a.due_at) - new Date(b.due_at));
  }, [items, filter]);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:theme.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal:SPACE.lg, paddingVertical:SPACE.md,
        borderBottomWidth:1, borderBottomColor:theme.border, backgroundColor:theme.card }}>
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <Text style={{ fontSize:20, fontWeight:"800", color:theme.primary }}>Follow-ups</Text>
          {/* Calendar / List toggle */}
          <View style={{ flexDirection:"row", backgroundColor:theme.surface, borderRadius:10, padding:3 }}>
            {[["calendar","calendar-outline"],["list","list-outline"]].map(([mode, icon]) => (
              <Pressable key={mode} onPress={() => setViewMode(mode)}
                style={{ paddingHorizontal:12, paddingVertical:6, borderRadius:8,
                  backgroundColor: viewMode===mode ? theme.card : "transparent" }}>
                <Ionicons name={icon} size={18} color={viewMode===mode ? TEAL : theme.muted} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Summary pills */}
        <View style={{ flexDirection:"row", gap:8, marginBottom:10 }}>
          {[
            { key:"pending",   label:"Pending",  color:TEAL          },
            { key:"overdue",   label:"Overdue",  color:palette.red   },
            { key:"completed", label:"Done",     color:palette.emerald },
          ].map(s => (
            <Pressable key={s.key} onPress={() => setFilter(s.key)}
              style={{ flex:1, backgroundColor:filter===s.key ? s.color : s.color+"15",
                borderRadius:10, padding:8, alignItems:"center", borderWidth:1, borderColor:s.color+"44" }}>
              <Text style={{ fontSize:16, fontWeight:"800", color:filter===s.key?"#fff":s.color }}>{counts[s.key]}</Text>
              <Text style={{ fontSize:10, color:filter===s.key?"#fff":theme.muted, marginTop:1 }}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator color={TEAL} size="large" />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={TEAL} />}
          contentContainerStyle={{ paddingVertical:SPACE.md, paddingBottom:120 }}>

          {viewMode === "calendar" && (
            <CalendarView
              items={items}
              theme={theme}
              month={month}
              onPrevMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()-1, 1))}
              onNextMonth={() => setMonth(m => new Date(m.getFullYear(), m.getMonth()+1, 1))}
              onSelect={list => list.length === 1 ? setSelected(list[0]) : setDayItems(list)}
            />
          )}

          {/* List below calendar or in list mode */}
          {filtered.length > 0 && (
            <View style={{ marginHorizontal:SPACE.lg, marginTop:SPACE.md,
              backgroundColor:theme.card, borderRadius:16, borderWidth:1, borderColor:theme.border, overflow:"hidden" }}>
              <View style={{ padding:12, borderBottomWidth:1, borderBottomColor:theme.border }}>
                <Text style={{ fontSize:13, fontWeight:"700", color:theme.primary }}>
                  {filtered.length} · {filter}
                </Text>
              </View>
              {filtered.map((item, i) => (
                <FollowUpRow key={item.id||i} item={item} theme={theme}
                  onPress={() => setSelected(item)} isLast={i===filtered.length-1} />
              ))}
            </View>
          )}

          {filtered.length === 0 && (
            <View style={{ alignItems:"center", paddingVertical:60, gap:10 }}>
              <Ionicons name="calendar-outline" size={52} color={theme.dim} />
              <Text style={{ fontSize:15, fontWeight:"700", color:theme.primary }}>No {filter} follow-ups</Text>
              <Text style={{ fontSize:13, color:theme.muted, textAlign:"center", paddingHorizontal:40, lineHeight:20 }}>
                {filter === "pending"
                  ? "Go to Logs → tap a call → Progress → Schedule Follow-up"
                  : "Nothing here yet"}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <DayModal items={dayItems} onClose={() => setDayItems(null)} onSelect={setSelected} theme={theme} />
      <DetailModal item={selected} onClose={() => setSelected(null)} onComplete={handleComplete} completing={completing} theme={theme} />
    </SafeAreaView>
  );
}

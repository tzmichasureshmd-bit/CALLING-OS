import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View, Text, TextInput, Pressable, Linking,
  ToastAndroid, Platform, Clipboard, Modal,
  FlatList, ActivityIndicator, ScrollView, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "../../src/theme";
import { AppHeader } from "../../src/components";
import { getRealCallLog } from "../../src/callLogService";
import { useAuth } from "../../src/AuthContext";
import { api } from "../../src/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTES_KEY = "callos_call_notes"; // { [phone]: { status, notes, updatedAt } }

const STATUSES = [
  { key: "interested",    label: "Interested",      color: palette.emerald, icon: "checkmark-circle" },
  { key: "asked_details", label: "Asked Details",   color: palette.teal,    icon: "information-circle" },
  { key: "follow_up",     label: "Follow Up",       color: palette.violet,  icon: "time" },
  { key: "callback",      label: "Callback",        color: palette.cyan,    icon: "call" },
  { key: "proposal_sent", label: "Proposal Sent",   color: palette.blue,    icon: "document-text" },
  { key: "converted",     label: "Converted ✓",     color: palette.emerald, icon: "trophy" },
  { key: "not_interested",label: "Not Interested",  color: palette.red,     icon: "close-circle" },
];

async function loadAllNotes() {
  try {
    const raw = await AsyncStorage.getItem(NOTES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
async function saveNote(phone, data) {
  const all = await loadAllNotes();
  all[phone] = { ...data, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(all));
}

// ── Call Progress Bottom Sheet ────────────────────────────────────────────────
function CallProgressSheet({ visible, onClose, call, allCalls, syncedIds, theme, shadowSoft }) {
  const [status, setStatus]   = useState(null);
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  // History: all calls with same phone number
  const history = useMemo(() => {
    if (!call) return [];
    return allCalls
      .filter(c => c.phone === call.phone)
      .sort((a, b) => b._ts - a._ts)
      .slice(0, 20);
  }, [call, allCalls]);

  // Load saved note on open
  useEffect(() => {
    if (!visible || !call) return;
    setSaved(false);
    loadAllNotes().then(all => {
      const saved = all[call.phone] || {};
      setStatus(saved.status || null);
      setNotes(saved.notes || "");
    });
  }, [visible, call?.phone]);

  async function handleSave() {
    if (!call) return;
    setSaving(true);
    const data = { status, notes, phone: call.phone, name: call.name };
    await saveNote(call.phone, data);
    // Try push to backend leads
    try {
      await api.getCalls({ q: call.phone, page_size: 1 }); // just verify connection
      // Post as a lead note if status set
      if (status) {
        await api.request?.(
          "POST", "/leads",
          { name: call.name !== "Unknown" ? call.name : call.phone, phone: call.phone,
            status, notes, source: "mobile_call_log" }
        ).catch(() => {});
      }
    } catch { /* offline — saved locally */ }
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 800);
  }

  if (!call) return null;
  const isSynced = syncedIds.has(call.id);
  const selectedStatus = STATUSES.find(s => s.key === status);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.55)" }} onPress={onClose}/>
      <KeyboardAvoidingView behavior="padding" style={{ position:"absolute", bottom:0, left:0, right:0 }}>
        <View style={{ backgroundColor:theme.bg, borderTopLeftRadius:26, borderTopRightRadius:26, maxHeight:"88%" }}>
          {/* Handle */}
          <View style={{ width:36, height:4, borderRadius:2, backgroundColor:theme.border, alignSelf:"center", marginTop:10 }}/>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:20, paddingBottom:40 }}>
            {/* Header */}
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:18, fontWeight:"800", color:theme.primary }} numberOfLines={1}>{call.name}</Text>
                <Text style={{ fontSize:13, color:palette.teal, marginTop:2 }}>{call.phone}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={{top:12,bottom:12,left:12,right:12}}>
                <Ionicons name="close" size={22} color={theme.muted}/>
              </Pressable>
            </View>

            {/* Sync + Call info row */}
            <View style={{ flexDirection:"row", gap:8, marginBottom:16, flexWrap:"wrap" }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:5, backgroundColor: isSynced ? palette.emerald+"18" : palette.amber+"18", borderRadius:8, paddingHorizontal:10, paddingVertical:5 }}>
                <Ionicons name={isSynced ? "cloud-done-outline" : "cloud-upload-outline"} size={13} color={isSynced ? palette.emerald : palette.amber}/>
                <Text style={{ fontSize:11.5, fontWeight:"700", color: isSynced ? palette.emerald : palette.amber }}>{isSynced ? "Synced to web" : "Pending sync"}</Text>
              </View>
              <View style={{ flexDirection:"row", alignItems:"center", gap:5, backgroundColor:theme.surface, borderRadius:8, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:theme.border }}>
                <Ionicons name="time-outline" size={13} color={theme.muted}/>
                <Text style={{ fontSize:11.5, color:theme.muted }}>{call.time} · {call.ago}</Text>
              </View>
              <View style={{ flexDirection:"row", alignItems:"center", gap:5, backgroundColor:theme.surface, borderRadius:8, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:theme.border }}>
                <Ionicons name="call-outline" size={13} color={theme.muted}/>
                <Text style={{ fontSize:11.5, color:theme.muted }}>{call.duration} · {call.sim}</Text>
              </View>
            </View>

            {/* Status picker */}
            <Text style={{ fontSize:12, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Call Outcome / Progress</Text>
            <View style={{ flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:16 }}>
              {STATUSES.map(s => {
                const on = status === s.key;
                return (
                  <Pressable key={s.key} onPress={() => setStatus(on ? null : s.key)}
                    style={{ flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:10, borderWidth:1.5,
                      borderColor: on ? s.color : theme.border,
                      backgroundColor: on ? s.color+"22" : theme.surface }}>
                    <Ionicons name={s.icon} size={14} color={on ? s.color : theme.muted}/>
                    <Text style={{ fontSize:12.5, fontWeight:"700", color: on ? s.color : theme.muted }}>{s.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Notes */}
            <Text style={{ fontSize:12, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What was discussed? Customer interest, objections, next steps…"
              placeholderTextColor={theme.dim}
              multiline
              numberOfLines={4}
              style={{ backgroundColor:theme.surface, borderRadius:12, borderWidth:1, borderColor:theme.border,
                padding:12, fontSize:13.5, color:theme.primary, minHeight:90, textAlignVertical:"top", marginBottom:16 }}
            />

            {/* Call history with this number */}
            {history.length > 1 && (
              <>
                <Text style={{ fontSize:12, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>Call History · {history.length} calls</Text>
                {history.map((h, i) => {
                  const meta = TYPE[h.type] || TYPE.incoming;
                  return (
                    <View key={h.id} style={{ flexDirection:"row", alignItems:"center", gap:10, paddingVertical:9,
                      borderBottomWidth: i < history.length-1 ? 1 : 0, borderBottomColor:theme.border }}>
                      <View style={{ width:32, height:32, borderRadius:9, backgroundColor:meta.color+"18", alignItems:"center", justifyContent:"center" }}>
                        <MaterialCommunityIcons name={meta.icon} size={15} color={meta.color}/>
                      </View>
                      <View style={{ flex:1 }}>
                        <Text style={{ fontSize:13, fontWeight:"600", color:theme.primary }}>{meta.label} · {h.duration}</Text>
                        <Text style={{ fontSize:11.5, color:theme.muted }}>{h.time} · {h.ago}</Text>
                      </View>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
                        {syncedIds.has(h.id) && <Ionicons name="cloud-done-outline" size={13} color={palette.emerald}/>}
                        <Text style={{ fontSize:11, color:theme.dim }}>{h.sim}</Text>
                      </View>
                    </View>
                  );
                })}
                <View style={{ height:12 }}/>
              </>
            )}

            {/* Save button */}
            <Pressable onPress={handleSave} disabled={saving || saved}>
              <LinearGradient colors={saved ? [palette.emerald, palette.emerald] : gradientBrand}
                start={{x:0,y:0}} end={{x:1,y:0}}
                style={{ height:50, borderRadius:14, alignItems:"center", justifyContent:"center", flexDirection:"row", gap:8 }}>
                {saving
                  ? <ActivityIndicator color="#fff"/>
                  : saved
                    ? <><Ionicons name="checkmark" size={18} color="#fff"/><Text style={{ color:"#fff", fontSize:15, fontWeight:"700" }}>Saved!</Text></>
                    : <><Ionicons name="save-outline" size={18} color="#fff"/><Text style={{ color:"#fff", fontSize:15, fontWeight:"700" }}>Save Progress</Text></>}
              </LinearGradient>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CHIPS = ["All", "In", "Out", "Missed", "Rejected"];
const PAGE   = 40;
const BATCH  = 50;

const RANGES = [
  { label: "7 Days",  days: 7  },
  { label: "15 Days", days: 15 },
  { label: "30 Days", days: 30 },
  { label: "60 Days", days: 60 },
  { label: "90 Days", days: 90 },
];

const TYPE = {
  incoming: { icon: "call-received", color: palette.teal,   label: "Incoming" },
  outgoing: { icon: "call-made",     color: palette.violet, label: "Outgoing" },
  missed:   { icon: "call-missed",   color: palette.red,    label: "Missed"   },
  rejected: { icon: "call-missed",   color: palette.amber,  label: "Rejected" },
  blocked:  { icon: "call-missed",   color: palette.amber,  label: "Blocked"  },
};

function fmtDur(s) {
  if (!s) return "00:00";
  return `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
}
function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return "just now";
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m/60)}h ago`;
  return `${Math.floor(m/1440)}d ago`;
}
function groupLabel(iso) {
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const y = new Date(now); y.setDate(now.getDate()-1);
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

// ── Background batch sync (never blocks UI) ───────────────────────────────────
async function syncInBackground(deviceId, calls) {
  if (!deviceId || !calls.length) return;
  try {
    const raw = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
    const synced = raw ? new Set(JSON.parse(raw)) : new Set();
    const unsync = calls.filter((c) => !synced.has(c.client_event_id));
    if (!unsync.length) return;

    const newIds = [];
    for (let i = 0; i < unsync.length; i += BATCH) {
      const batch = unsync.slice(i, i + BATCH);
      try {
        const res = await api.syncCalls(deviceId, batch);
        if (res.accepted > 0 || res.duplicates > 0) {
          batch.forEach((c) => newIds.push(c.client_event_id));
        }
      } catch { /* silent — retry next time */ }
      // Yield to JS thread between batches
      await new Promise((r) => setTimeout(r, 600));
    }
    if (newIds.length) {
      const all = [...synced, ...newIds];
      const trimmed = all.length > 5000 ? all.slice(all.length - 5000) : all;
      await AsyncStorage.setItem("callos_synced_ids", JSON.stringify(trimmed));
      await AsyncStorage.setItem("callos_last_sync_ts", String(Date.now()));
    }
  } catch { /* silent */ }
}

// ── Dial Pad ──────────────────────────────────────────────────────────────────
function DialPad({ visible, onClose, theme }) {
  const [num, setNum] = useState("");
  const KEYS = ["1","2","3","4","5","6","7","8","9","*","0","#"];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex:1, justifyContent:"flex-end", backgroundColor:"rgba(0,0,0,0.6)" }}>
        <View style={{ backgroundColor:theme.bg, borderTopLeftRadius:28, borderTopRightRadius:28, padding:24, paddingBottom:40 }}>
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"center", marginBottom:20, minHeight:52 }}>
            <Text style={{ fontSize:32, fontWeight:"700", color:theme.primary, letterSpacing:3, flex:1, textAlign:"center" }}>{num||" "}</Text>
            {num.length>0 && <Pressable onPress={()=>setNum(n=>n.slice(0,-1))} style={{padding:8}}><Ionicons name="backspace-outline" size={24} color={theme.muted}/></Pressable>}
          </View>
          <View style={{ flexDirection:"row", flexWrap:"wrap", justifyContent:"center", gap:16, marginBottom:24 }}>
            {KEYS.map(k=>(
              <Pressable key={k} onPress={()=>setNum(n=>n+k)} style={{ width:72, height:72, borderRadius:36, backgroundColor:theme.surface, borderWidth:1, borderColor:theme.border, alignItems:"center", justifyContent:"center" }}>
                <Text style={{ fontSize:24, fontWeight:"600", color:theme.primary }}>{k}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection:"row", justifyContent:"center", gap:20 }}>
            <Pressable onPress={onClose} style={{ width:60, height:60, borderRadius:30, backgroundColor:theme.surface, borderWidth:1, borderColor:theme.border, alignItems:"center", justifyContent:"center" }}>
              <Ionicons name="close" size={26} color={theme.muted}/>
            </Pressable>
            <Pressable onPress={()=>{if(!num)return;onClose();Linking.openURL(`tel:${num.replace(/\s/g,"")}`);}} disabled={!num}>
              <LinearGradient colors={gradientBrand} style={{ width:72, height:72, borderRadius:36, alignItems:"center", justifyContent:"center" }}>
                <Ionicons name="call" size={28} color="#fff"/>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Call Row ──────────────────────────────────────────────────────────────────
const CallRow = ({ c, expanded, onToggle, onProgress, noteStatus, theme, shadowSoft }) => {
  const meta = TYPE[c.type] || TYPE.incoming;
  const open = expanded === c.id;
  const ns   = STATUSES.find(s => s.key === noteStatus);
  return (
    <Pressable onPress={onToggle} style={[{ flexDirection:"row", backgroundColor:theme.card, borderRadius:16, padding:14, marginBottom:8, borderWidth:1, borderColor: ns ? ns.color+"55" : theme.border, overflow:"hidden" }, shadowSoft]}>
      <View style={{ position:"absolute", left:0, top:0, bottom:0, width:4, backgroundColor: ns ? ns.color : meta.color }}/>
      <View style={{ width:40, height:40, borderRadius:12, alignItems:"center", justifyContent:"center", marginLeft:4, backgroundColor:meta.color+"1f" }}>
        <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color}/>
      </View>
      <View style={{ flex:1, marginLeft:12 }}>
        <View style={{ flexDirection:"row", justifyContent:"space-between" }}>
          <Text style={{ fontSize:15, fontWeight:"700", color:theme.primary, flex:1 }} numberOfLines={1}>{c.name}</Text>
          <Text style={{ fontSize:11.5, color:theme.muted }}>{c.time}</Text>
        </View>
        <View style={{ flexDirection:"row", justifyContent:"space-between", marginTop:2 }}>
          <Text style={{ fontSize:13, color:theme.muted }}>{c.phone}</Text>
          <Text style={{ fontSize:11, color:theme.dim }}>{c.ago}</Text>
        </View>
        <View style={{ flexDirection:"row", alignItems:"center", gap:8, marginTop:5, flexWrap:"wrap" }}>
          <Text style={{ fontSize:11.5, fontWeight:"600", color:meta.color }}>{meta.label} · {c.duration}</Text>
          <View style={{ borderWidth:1, borderColor:theme.border, borderRadius:6, paddingHorizontal:6, paddingVertical:1 }}>
            <Text style={{ fontSize:10, color:theme.muted, fontWeight:"600" }}>{c.sim}</Text>
          </View>
          {c.synced && <View style={{ backgroundColor:palette.emerald+"22", borderRadius:5, paddingHorizontal:5, paddingVertical:1 }}><Text style={{ fontSize:9, fontWeight:"700", color:palette.emerald }}>✓ Synced</Text></View>}
          {ns && <View style={{ backgroundColor:ns.color+"22", borderRadius:5, paddingHorizontal:6, paddingVertical:1 }}><Text style={{ fontSize:9, fontWeight:"700", color:ns.color }}>{ns.label}</Text></View>}
        </View>
        {open && (
          <View style={{ flexDirection:"row", justifyContent:"space-around", marginTop:12, paddingTop:12, borderTopWidth:1, borderTopColor:theme.border }}>
            {[
              { icon:"call",          label:"Call",      color:palette.emerald, fn:()=>Linking.openURL(`tel:${c.phone.replace(/\s/g,"")}`) },
              { icon:"logo-whatsapp", label:"WhatsApp",  color:"#25D366",       fn:()=>Linking.openURL(`whatsapp://send?phone=${c.phone.replace(/\D/g,"")}`) },
              { icon:"copy-outline",  label:"Copy",      color:palette.teal,    fn:()=>{ Clipboard.setString(c.phone); if(Platform.OS==="android") ToastAndroid.show("Copied!",ToastAndroid.SHORT); } },
              { icon:"stats-chart",   label:"Progress",  color:palette.violet,  fn:()=>onProgress(c) },
            ].map(a=>(
              <Pressable key={a.label} onPress={a.fn} style={{ alignItems:"center", gap:4 }}>
                <View style={{ width:40, height:40, borderRadius:12, backgroundColor:a.color+"1a", alignItems:"center", justifyContent:"center" }}>
                  <Ionicons name={a.icon} size={18} color={a.color}/>
                </View>
                <Text style={{ fontSize:10.5, color:theme.muted }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Calls() {
  const [rangeDays, setRangeDays] = useState(7);
  const [query,     setQuery]     = useState("");
  const [debouncedQ,setDebouncedQ]= useState("");
  const [chip,      setChip]      = useState("All");
  const [expanded,  setExpanded]  = useState(null);
  const [allCalls,  setAllCalls]  = useState([]);
  const [syncedIds, setSyncedIds] = useState(new Set());
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [dialOpen,  setDialOpen]  = useState(false);
  const [syncing,   setSyncing]   = useState(false);
  const [progressCall, setProgressCall] = useState(null);
  const [notesMap,  setNotesMap]  = useState({});
  const { theme, shadowSoft } = useTheme();
  const { deviceId } = useAuth();
  const debounceRef = useRef(null);
  const syncRef = useRef(false);

  // Debounce search 300ms
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Load synced IDs from storage
  const loadSyncedIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("callos_synced_ids");
      setSyncedIds(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setSyncedIds(new Set()); }
  }, []);

  // Load calls for selected range
  const load = useCallback(async (days = rangeDays, isRefresh = false) => {
    if (isRefresh) { setRefreshing(true); setPage(1); } else setLoading(true);
    try {
      const [raw, ids] = await Promise.all([
        getRealCallLog(days),
        AsyncStorage.getItem("callos_synced_ids").catch(() => null),
      ]);
      const synced = ids ? new Set(JSON.parse(ids)) : new Set();
      setSyncedIds(synced);
      const mapped = raw.map((c) => ({
        id:          c.client_event_id,
        rawCall:     c,
        type:        c.call_type || "incoming",
        name:        c.contact_name || "Unknown",
        phone:       c.phone_number || "",
        duration:    fmtDur(c.duration_seconds),
        durationSec: c.duration_seconds,
        time:        new Date(c._start_ms || c.start_time).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }),
        ago:         relTime(c.start_time),
        group:       groupLabel(c.start_time),
        sim:         c.source || "SIM 1",
        synced:      synced.has(c.client_event_id),
        _ts:         c._start_ms || new Date(c.start_time).getTime(),
      }));
      setAllCalls(mapped);

      // Background sync is handled by syncService.useAutoSync — no duplicate sync here
      setLoading(false);
      setRefreshing(false);
    }
  }, [rangeDays, deviceId]);

  useEffect(() => { load(rangeDays); }, [rangeDays]);

  // Load saved notes map on mount
  useEffect(() => { loadAllNotes().then(setNotesMap); }, []);

  // Filtered + memoized
  const filtered = useMemo(() => {
    let list = allCalls;
    if      (chip === "In")       list = list.filter(c => c.type === "incoming");
    else if (chip === "Out")      list = list.filter(c => c.type === "outgoing");
    else if (chip === "Missed")   list = list.filter(c => c.type === "missed");
    else if (chip === "Rejected") list = list.filter(c => c.type === "rejected");
    if (debouncedQ) {
      const q = debouncedQ.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return list;
  }, [allCalls, chip, debouncedQ]);

  const visible = useMemo(() => filtered.slice(0, page * PAGE), [filtered, page]);

  // Inject group headers
  const flatData = useMemo(() => {
    const result = []; let lastGroup = null;
    for (const c of visible) {
      if (c.group !== lastGroup) {
        result.push({ _isHeader:true, group:c.group, id:"hdr-"+c.group });
        lastGroup = c.group;
      }
      result.push(c);
    }
    return result;
  }, [visible]);

  const counts = useMemo(() => ({
    All:      allCalls.length,
    In:       allCalls.filter(c=>c.type==="incoming").length,
    Out:      allCalls.filter(c=>c.type==="outgoing").length,
    Missed:   allCalls.filter(c=>c.type==="missed").length,
    Rejected: allCalls.filter(c=>c.type==="rejected").length,
  }), [allCalls]);

  const renderItem = useCallback(({ item }) => {
    if (item._isHeader) return (
      <Text style={{ fontSize:12.5, fontWeight:"700", color:theme.muted, marginVertical:8, marginLeft:2 }}>{item.group}</Text>
    );
    return (
      <CallRow
        c={item}
        expanded={expanded}
        onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
        onProgress={(c) => setProgressCall(c)}
        noteStatus={notesMap[item.phone]?.status || null}
        theme={theme}
        shadowSoft={shadowSoft}
      />
    );
  }, [expanded, notesMap, theme, shadowSoft]);

  const keyExtractor = useCallback((item) => item.id, []);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:theme.bg }} edges={["top"]}>
      <AppHeader title="Calls" right={
        <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
          {syncing && <ActivityIndicator size="small" color={palette.teal}/>}
          <Pressable onPress={() => load(rangeDays, true)} style={{ width:38, height:38, borderRadius:11, backgroundColor:theme.surface, borderWidth:1, borderColor:theme.border, alignItems:"center", justifyContent:"center" }}>
            <Ionicons name="refresh-outline" size={18} color={theme.secondary}/>
          </Pressable>
        </View>
      }/>

      <View style={{ paddingHorizontal:16, paddingTop:8 }}>
        {/* Search */}
        <View style={[{ flexDirection:"row", alignItems:"center", backgroundColor:theme.surface, borderRadius:13, paddingHorizontal:14, paddingVertical:11, borderWidth:1, borderColor:theme.border, marginBottom:10 }, shadowSoft]}>
          <Ionicons name="search" size={18} color={theme.dim}/>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search name or number…" placeholderTextColor={theme.dim} style={{ flex:1, marginLeft:8, fontSize:14, color:theme.primary }}/>
          {query.length>0 && <Pressable onPress={()=>setQuery("")}><Ionicons name="close-circle" size={18} color={theme.dim}/></Pressable>}
        </View>

        {/* Range pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {RANGES.map(r => {
              const on = r.days === rangeDays;
              return (
                <Pressable key={r.days} onPress={() => { setRangeDays(r.days); setPage(1); setChip("All"); }}
                  style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:999, borderWidth:1.5, borderColor: on ? palette.violet : theme.border, backgroundColor: on ? palette.violet : theme.surface }}>
                  <Text style={{ fontSize:12.5, fontWeight:"700", color: on ? "#fff" : theme.muted }}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Type chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:6 }}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {CHIPS.map(f => {
              const on = f === chip;
              return (
                <Pressable key={f} onPress={() => { setChip(f); setPage(1); }}
                  style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:999, borderWidth:1, borderColor: on ? palette.teal : theme.border, backgroundColor: on ? palette.teal : theme.surface, flexDirection:"row", alignItems:"center", gap:5 }}>
                  <Text style={{ fontSize:12.5, fontWeight:"600", color: on ? "#04211d" : theme.muted }}>{f}</Text>
                  {counts[f] > 0 && (
                    <View style={{ backgroundColor: on ? "rgba(0,0,0,0.2)" : theme.border, borderRadius:8, paddingHorizontal:5, paddingVertical:1 }}>
                      <Text style={{ fontSize:10, fontWeight:"700", color: on ? "#04211d" : theme.dim }}>{counts[f]}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Summary bar */}
        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:6, paddingHorizontal:2 }}>
          <Text style={{ fontSize:12, color:theme.muted }}>{filtered.length} calls · Last {rangeDays} days</Text>
          {syncing
            ? <View style={{ flexDirection:"row", alignItems:"center", gap:5 }}>
                <ActivityIndicator size="small" color={palette.teal}/>
                <Text style={{ fontSize:11, color:palette.teal, fontWeight:"600" }}>Syncing…</Text>
              </View>
            : <Text style={{ fontSize:11, color:theme.dim }}>{filtered.length} shown</Text>
          }
        </View>
      </View>

      {loading ? (
        <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
          <ActivityIndicator color={palette.teal} size="large"/>
          <Text style={{ color:theme.muted, marginTop:12, fontSize:13 }}>Loading last {rangeDays} days…</Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal:16, paddingBottom:120, paddingTop:4 }}
          showsVerticalScrollIndicator={false}
          onRefresh={() => load(rangeDays, true)}
          refreshing={refreshing}
          onEndReached={() => { if (visible.length < filtered.length) setPage(p=>p+1); }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <Text style={{ textAlign:"center", color:theme.muted, marginTop:40 }}>
              {allCalls.length===0 ? `No calls in last ${rangeDays} days.` : "No calls match your filters."}
            </Text>
          }
          ListFooterComponent={visible.length < filtered.length ? <ActivityIndicator color={palette.teal} style={{ marginVertical:16 }}/> : null}
          removeClippedSubviews
          maxToRenderPerBatch={15}
          windowSize={8}
          initialNumToRender={20}
        />
      )}

      <Pressable onPress={() => setDialOpen(true)} style={{ position:"absolute", bottom:100, right:20, elevation:8 }}>
        <LinearGradient colors={gradientBrand} style={{ width:58, height:58, borderRadius:29, alignItems:"center", justifyContent:"center" }}>
          <Ionicons name="keypad-outline" size={24} color="#fff"/>
        </LinearGradient>
      </Pressable>

      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} theme={theme}/>

      <CallProgressSheet
        visible={!!progressCall}
        onClose={() => {
          setProgressCall(null);
          loadAllNotes().then(setNotesMap);
        }}
        call={progressCall}
        allCalls={allCalls}
        syncedIds={syncedIds}
        theme={theme}
        shadowSoft={shadowSoft}
      />
    </SafeAreaView>
  );
}

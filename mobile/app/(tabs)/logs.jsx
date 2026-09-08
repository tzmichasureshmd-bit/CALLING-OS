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

const NOTES_KEY = "callos_call_notes";

const STATUSES = [
  { key: "interested",     label: "Interested",     color: palette.emerald, icon: "checkmark-circle"  },
  { key: "asked_details",  label: "Asked Details",  color: palette.teal,    icon: "information-circle"},
  { key: "follow_up",      label: "Follow Up",      color: palette.violet,  icon: "time"              },
  { key: "callback",       label: "Callback",       color: palette.cyan,    icon: "call"              },
  { key: "proposal_sent",  label: "Proposal Sent",  color: palette.blue,    icon: "document-text"     },
  { key: "converted",      label: "Converted ✓",    color: palette.emerald, icon: "trophy"            },
  { key: "not_interested", label: "Not Interested", color: palette.red,     icon: "close-circle"      },
];

const CHIPS  = ["All", "In", "Out", "Missed", "Rejected"];
const PAGE   = 40;
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

// Pipeline stages for Details sheet
const PIPELINE = [
  { key: "detected",    label: "Detected"   },
  { key: "log_read",    label: "Log Read"   },
  { key: "synced",      label: "Synced"     },
  { key: "recording",   label: "Recording"  },
  { key: "uploaded",    label: "Uploaded"   },
  { key: "transcribed", label: "Transcribed"},
];

function getPipelineStage(c) {
  // Returns index 0-5 of how far this call has progressed
  if (!c.synced) return 1; // detected + log read done, sync pending
  if (!c.hasRecording) return 2; // synced, no recording
  if (!c.recordingUploaded) return 3; // has recording, not uploaded
  if (!c.transcribed) return 4; // uploaded, not transcribed
  return 5; // fully complete
}

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
function copyPhone(phone) {
  Clipboard.setString(phone);
  if (Platform.OS === "android") ToastAndroid.show("Number copied!", ToastAndroid.SHORT);
}

async function loadAllNotes() {
  try { const r = await AsyncStorage.getItem(NOTES_KEY); return r ? JSON.parse(r) : {}; }
  catch { return {}; }
}
async function saveNote(phone, data) {
  const all = await loadAllNotes();
  all[phone] = { ...data, updatedAt: new Date().toISOString() };
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(all));
}

// ── Progress Sheet ────────────────────────────────────────────────────────────
function ProgressSheet({ visible, onClose, call, theme }) {
  const [status, setStatus] = useState(null);
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    if (!visible || !call) return;
    setSaved(false); setDropOpen(false);
    loadAllNotes().then(all => {
      const n = all[call.phone] || {};
      setStatus(n.status || null);
      setNotes(n.notes || "");
    });
  }, [visible, call?.phone]);

  async function handleSave() {
    if (!call) return;
    setSaving(true);
    await saveNote(call.phone, { status, notes, phone: call.phone, name: call.name });
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  }

  if (!call) return null;
  const selected = STATUSES.find(s => s.key === status);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)" }} onPress={onClose}/>
      <KeyboardAvoidingView behavior="padding" style={{ position:"absolute", bottom:0, left:0, right:0 }}>
        <View style={{ backgroundColor:theme.bg, borderTopLeftRadius:24, borderTopRightRadius:24 }}>
          <View style={{ width:36, height:4, borderRadius:2, backgroundColor:theme.border, alignSelf:"center", marginTop:10 }}/>
          <View style={{ padding:20, paddingBottom:40 }}>

            {/* Header */}
            <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:17, fontWeight:"800", color:theme.primary }} numberOfLines={1}>{call.name}</Text>
                <Text style={{ fontSize:13, color:theme.muted, marginTop:2 }}>{call.phone}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={{top:12,bottom:12,left:12,right:12}}>
                <Ionicons name="close" size={22} color={theme.muted}/>
              </Pressable>
            </View>

            {/* Status dropdown */}
            <Text style={{ fontSize:11, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>Call Status</Text>
            <Pressable onPress={() => setDropOpen(o => !o)}
              style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between",
                backgroundColor:theme.surface, borderRadius:12, borderWidth:1.5,
                borderColor: selected ? selected.color : theme.border,
                paddingHorizontal:14, paddingVertical:13, marginBottom: dropOpen ? 0 : 16 }}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
                {selected
                  ? <><Ionicons name={selected.icon} size={16} color={selected.color}/>
                      <Text style={{ fontSize:14, fontWeight:"700", color:selected.color }}>{selected.label}</Text></>
                  : <Text style={{ fontSize:14, color:theme.dim }}>Select status…</Text>}
              </View>
              <Ionicons name={dropOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.muted}/>
            </Pressable>

            {dropOpen && (
              <View style={{ backgroundColor:theme.surface, borderRadius:12, borderWidth:1,
                borderColor:theme.border, marginBottom:16, overflow:"hidden" }}>
                {STATUSES.map((s, i) => {
                  const on = status === s.key;
                  return (
                    <Pressable key={s.key} onPress={() => { setStatus(on ? null : s.key); setDropOpen(false); }}
                      style={{ flexDirection:"row", alignItems:"center", gap:10,
                        paddingHorizontal:14, paddingVertical:13,
                        backgroundColor: on ? s.color+"18" : "transparent",
                        borderTopWidth: i===0 ? 0 : 1, borderTopColor:theme.border }}>
                      <Ionicons name={s.icon} size={16} color={on ? s.color : theme.muted}/>
                      <Text style={{ fontSize:14, fontWeight: on ? "700" : "500", color: on ? s.color : theme.secondary, flex:1 }}>{s.label}</Text>
                      {on && <Ionicons name="checkmark" size={16} color={s.color}/>}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Notes */}
            <Text style={{ fontSize:11, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:8 }}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="What was discussed? Customer interest, objections, next steps…"
              placeholderTextColor={theme.dim}
              multiline
              style={{ backgroundColor:theme.surface, borderRadius:12, borderWidth:1, borderColor:theme.border,
                padding:12, fontSize:13.5, color:theme.primary, minHeight:100, textAlignVertical:"top", marginBottom:20 }}
            />

            {/* Save */}
            <Pressable onPress={handleSave} disabled={saving || saved}>
              <LinearGradient colors={saved ? [palette.emerald, palette.emerald] : gradientBrand}
                start={{x:0,y:0}} end={{x:1,y:0}}
                style={{ height:50, borderRadius:13, alignItems:"center", justifyContent:"center", flexDirection:"row", gap:8 }}>
                {saving
                  ? <ActivityIndicator color="#fff"/>
                  : saved
                    ? <><Ionicons name="checkmark" size={18} color="#fff"/><Text style={{ color:"#fff", fontSize:15, fontWeight:"700" }}>Saved!</Text></>
                    : <><Ionicons name="save-outline" size={18} color="#fff"/><Text style={{ color:"#fff", fontSize:15, fontWeight:"700" }}>Save Progress</Text></>}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Details Sheet (pipeline timeline + call history) ─────────────────────────
function DetailsSheet({ visible, onClose, call, allCalls, syncedIds, theme }) {
  const history = useMemo(() => {
    if (!call) return [];
    return allCalls.filter(c => c.phone === call.phone).sort((a,b) => b._ts - a._ts).slice(0,20);
  }, [call, allCalls]);

  if (!call) return null;
  const stage = getPipelineStage(call);
  const pct   = Math.round((stage / (PIPELINE.length - 1)) * 100);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex:1, backgroundColor:"rgba(0,0,0,0.5)" }} onPress={onClose}/>
      <View style={{ position:"absolute", bottom:0, left:0, right:0,
        backgroundColor:theme.bg, borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:"88%" }}>
        <View style={{ width:36, height:4, borderRadius:2, backgroundColor:theme.border, alignSelf:"center", marginTop:10 }}/>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding:20, paddingBottom:40 }}>

          {/* Header */}
          <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <View style={{ flex:1 }}>
              <Text style={{ fontSize:17, fontWeight:"800", color:theme.primary }} numberOfLines={1}>{call.name}</Text>
              <Pressable onPress={() => copyPhone(call.phone)}>
                <Text style={{ fontSize:13, color:palette.teal, marginTop:2 }}>{call.phone} <Text style={{ fontSize:10, color:theme.dim }}>tap to copy</Text></Text>
              </Pressable>
            </View>
            <Pressable onPress={onClose} hitSlop={{top:12,bottom:12,left:12,right:12}}>
              <Ionicons name="close" size={22} color={theme.muted}/>
            </Pressable>
          </View>

          {/* Call meta row */}
          <View style={{ flexDirection:"row", gap:8, marginBottom:18, flexWrap:"wrap" }}>
            {[
              `${TYPE[call.type]?.label || "Call"} · ${call.sim}`,
              `${call.time} · ${call.ago}`,
              `Duration: ${call.duration}`,
            ].map((t,i) => (
              <View key={i} style={{ backgroundColor:theme.surface, borderRadius:8, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:theme.border }}>
                <Text style={{ fontSize:11.5, color:theme.muted }}>{t}</Text>
              </View>
            ))}
          </View>

          {/* Pipeline progress bar */}
          <Text style={{ fontSize:11, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:10 }}>Processing Pipeline</Text>
          <View style={{ height:6, backgroundColor:theme.border, borderRadius:3, marginBottom:14, overflow:"hidden" }}>
            <View style={{ width:`${pct}%`, height:"100%", backgroundColor: pct===100 ? palette.emerald : palette.teal, borderRadius:3 }}/>
          </View>

          {/* Pipeline steps */}
          <View style={{ flexDirection:"row", justifyContent:"space-between", marginBottom:20 }}>
            {PIPELINE.map((p, i) => {
              const done    = i <= stage;
              const current = i === stage && pct < 100;
              const color   = done ? (pct===100 && i===PIPELINE.length-1 ? palette.emerald : palette.teal) : theme.dim;
              return (
                <View key={p.key} style={{ alignItems:"center", flex:1 }}>
                  <View style={{ width:22, height:22, borderRadius:11, marginBottom:4,
                    backgroundColor: done ? color+"22" : theme.surface,
                    borderWidth:1.5, borderColor: done ? color : theme.border,
                    alignItems:"center", justifyContent:"center" }}>
                    {done
                      ? <Ionicons name={current ? "time-outline" : "checkmark"} size={12} color={color}/>
                      : <View style={{ width:6, height:6, borderRadius:3, backgroundColor:theme.border }}/>}
                  </View>
                  <Text style={{ fontSize:8.5, color: done ? color : theme.dim, fontWeight: done ? "700" : "400", textAlign:"center" }}>{p.label}</Text>
                </View>
              );
            })}
          </View>

          {/* Status summary */}
          <View style={{ backgroundColor:theme.surface, borderRadius:12, padding:14, borderWidth:1, borderColor:theme.border, marginBottom:20 }}>
            {[
              { label:"Sync",        val: call.synced ? "Synced ✓" : "Pending",          color: call.synced ? palette.emerald : palette.amber },
              { label:"Recording",   val: call.hasRecording ? "Available" : "Not available", color: call.hasRecording ? palette.teal : theme.dim },
              { label:"Upload",      val: call.recordingUploaded ? "Uploaded ✓" : "Not uploaded", color: call.recordingUploaded ? palette.emerald : theme.dim },
              { label:"Transcription", val: call.transcribed ? "Completed ✓" : "Pending", color: call.transcribed ? palette.emerald : theme.dim },
            ].map((r,i) => (
              <View key={r.label} style={{ flexDirection:"row", justifyContent:"space-between", paddingVertical:7,
                borderTopWidth: i===0 ? 0 : 1, borderTopColor:theme.border }}>
                <Text style={{ fontSize:13, color:theme.muted }}>{r.label}</Text>
                <Text style={{ fontSize:13, fontWeight:"700", color:r.color }}>{r.val}</Text>
              </View>
            ))}
          </View>

          {/* Call history */}
          {history.length > 1 && (
            <>
              <Text style={{ fontSize:11, fontWeight:"700", color:theme.muted, textTransform:"uppercase", letterSpacing:0.6, marginBottom:10 }}>
                Call History · {history.length} calls with this number
              </Text>
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
                      <Text style={{ fontSize:11.5, color:theme.muted }}>{h.time} · {h.ago} · {h.sim}</Text>
                    </View>
                    {syncedIds.has(h.id) && <Ionicons name="cloud-done-outline" size={14} color={palette.emerald}/>}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
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
const CallRow = ({ c, expanded, onToggle, onProgress, onDetails, noteStatus, theme, shadowSoft }) => {
  const meta = TYPE[c.type] || TYPE.incoming;
  const open = expanded === c.id;
  const ns   = STATUSES.find(s => s.key === noteStatus);

  return (
    <Pressable onPress={onToggle}
      style={[{ backgroundColor:theme.card, borderRadius:16, padding:14, marginBottom:8,
        borderWidth:1, borderColor: ns ? ns.color+"55" : theme.border, overflow:"hidden" }, shadowSoft]}>
      {/* Left color bar */}
      <View style={{ position:"absolute", left:0, top:0, bottom:0, width:4, backgroundColor: ns ? ns.color : meta.color }}/>

      <View style={{ flexDirection:"row" }}>
        {/* Avatar */}
        <View style={{ width:40, height:40, borderRadius:12, alignItems:"center", justifyContent:"center",
          marginLeft:4, backgroundColor:meta.color+"1f" }}>
          <MaterialCommunityIcons name={meta.icon} size={19} color={meta.color}/>
        </View>

        <View style={{ flex:1, marginLeft:12 }}>
          {/* Row 1: name + time */}
          <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center" }}>
            <Text style={{ fontSize:15, fontWeight:"700", color:theme.primary, flex:1 }} numberOfLines={1}>{c.name}</Text>
            <Text style={{ fontSize:11.5, color:theme.muted, marginLeft:8 }}>{c.time}</Text>
          </View>

          {/* Row 2: phone (tappable copy) + ago */}
          <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginTop:2 }}>
            <Pressable onPress={() => copyPhone(c.phone)} style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
              <Text style={{ fontSize:13, color:theme.muted }}>{c.phone}</Text>
              <Ionicons name="copy-outline" size={11} color={theme.dim}/>
            </Pressable>
            <Text style={{ fontSize:11, color:theme.dim }}>{c.ago}</Text>
          </View>

          {/* Row 3: type · duration · sim · synced · note status */}
          <View style={{ flexDirection:"row", alignItems:"center", gap:6, marginTop:5, flexWrap:"wrap" }}>
            <Text style={{ fontSize:11.5, fontWeight:"600", color:meta.color }}>{meta.label} · {c.duration}</Text>
            <View style={{ borderWidth:1, borderColor:theme.border, borderRadius:6, paddingHorizontal:6, paddingVertical:1 }}>
              <Text style={{ fontSize:10, color:theme.muted, fontWeight:"600" }}>{c.sim}</Text>
            </View>
            {c.synced && (
              <View style={{ backgroundColor:palette.emerald+"22", borderRadius:5, paddingHorizontal:5, paddingVertical:1 }}>
                <Text style={{ fontSize:9, fontWeight:"700", color:palette.emerald }}>✓ Synced</Text>
              </View>
            )}
            {ns && (
              <View style={{ backgroundColor:ns.color+"22", borderRadius:5, paddingHorizontal:6, paddingVertical:1 }}>
                <Text style={{ fontSize:9, fontWeight:"700", color:ns.color }}>{ns.label}</Text>
              </View>
            )}
          </View>

          {/* Expanded actions */}
          {open && (
            <View style={{ flexDirection:"row", justifyContent:"space-around", marginTop:12,
              paddingTop:12, borderTopWidth:1, borderTopColor:theme.border }}>
              {[
                { icon:"call",         label:"Call",     color:palette.emerald, fn:()=>Linking.openURL(`tel:${c.phone.replace(/\s/g,"")}`) },
                { icon:"logo-whatsapp",label:"WhatsApp", color:"#25D366",       fn:()=>Linking.openURL(`whatsapp://send?phone=${c.phone.replace(/\D/g,"")}`) },
                { icon:"stats-chart",  label:"Progress", color:palette.violet,  fn:()=>onProgress(c) },
                { icon:"information-circle-outline", label:"Details", color:palette.teal, fn:()=>onDetails(c) },
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
      </View>
    </Pressable>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Calls() {
  const [rangeDays,    setRangeDays]    = useState(7);
  const [query,        setQuery]        = useState("");
  const [debouncedQ,   setDebouncedQ]   = useState("");
  const [chip,         setChip]         = useState("All");
  const [expanded,     setExpanded]     = useState(null);
  const [allCalls,     setAllCalls]     = useState([]);
  const [syncedIds,    setSyncedIds]    = useState(new Set());
  const [page,         setPage]         = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [dialOpen,     setDialOpen]     = useState(false);
  const [progressCall, setProgressCall] = useState(null);
  const [detailsCall,  setDetailsCall]  = useState(null);
  const [notesMap,     setNotesMap]     = useState({});
  const { theme, shadowSoft } = useTheme();
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQ(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const load = useCallback(async (days = rangeDays, isRefresh = false) => {
    if (isRefresh) { setRefreshing(true); setPage(1); } else setLoading(true);
    try {
      const [raw, ids] = await Promise.all([
        getRealCallLog(days),
        AsyncStorage.getItem("callos_synced_ids").catch(() => null),
      ]);
      const synced = ids ? new Set(JSON.parse(ids)) : new Set();
      setSyncedIds(synced);
      const mapped = raw.map(c => ({
        id:               c.client_event_id,
        type:             c.call_type || "incoming",
        name:             c.contact_name || "Unknown",
        phone:            c.phone_number || "",
        duration:         fmtDur(c.duration_seconds),
        durationSec:      c.duration_seconds,
        time:             new Date(c._start_ms || c.start_time).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" }),
        ago:              relTime(c.start_time),
        group:            groupLabel(c.start_time),
        sim:              c.source || "SIM 1",
        synced:           synced.has(c.client_event_id),
        hasRecording:     c.recording_available || false,
        recordingUploaded:false,
        transcribed:      false,
        _ts:              c._start_ms || new Date(c.start_time).getTime(),
      }));
      setAllCalls(mapped);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [rangeDays]);

  useEffect(() => { load(rangeDays); }, [rangeDays]);
  useEffect(() => { loadAllNotes().then(setNotesMap); }, []);

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
        onProgress={c => setProgressCall(c)}
        onDetails={c => setDetailsCall(c)}
        noteStatus={notesMap[item.phone]?.status || null}
        theme={theme}
        shadowSoft={shadowSoft}
      />
    );
  }, [expanded, notesMap, theme, shadowSoft]);

  const keyExtractor = useCallback(item => item.id, []);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:theme.bg }} edges={["top"]}>
      <AppHeader title="Calls" right={
        <Pressable onPress={() => load(rangeDays, true)}
          style={{ width:38, height:38, borderRadius:11, backgroundColor:theme.surface,
            borderWidth:1, borderColor:theme.border, alignItems:"center", justifyContent:"center" }}>
          <Ionicons name="refresh-outline" size={18} color={theme.secondary}/>
        </Pressable>
      }/>

      <View style={{ paddingHorizontal:16, paddingTop:8 }}>
        {/* Search */}
        <View style={[{ flexDirection:"row", alignItems:"center", backgroundColor:theme.surface,
          borderRadius:13, paddingHorizontal:14, paddingVertical:11,
          borderWidth:1, borderColor:theme.border, marginBottom:10 }, shadowSoft]}>
          <Ionicons name="search" size={18} color={theme.dim}/>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search name or number…"
            placeholderTextColor={theme.dim}
            style={{ flex:1, marginLeft:8, fontSize:14, color:theme.primary }}/>
          {query.length>0 && <Pressable onPress={()=>setQuery("")}><Ionicons name="close-circle" size={18} color={theme.dim}/></Pressable>}
        </View>

        {/* Range pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom:8 }}>
          <View style={{ flexDirection:"row", gap:8 }}>
            {RANGES.map(r => {
              const on = r.days === rangeDays;
              return (
                <Pressable key={r.days} onPress={() => { setRangeDays(r.days); setPage(1); setChip("All"); }}
                  style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:999, borderWidth:1.5,
                    borderColor: on ? palette.violet : theme.border,
                    backgroundColor: on ? palette.violet : theme.surface }}>
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
                  style={{ paddingHorizontal:14, paddingVertical:7, borderRadius:999, borderWidth:1,
                    borderColor: on ? palette.teal : theme.border,
                    backgroundColor: on ? palette.teal : theme.surface,
                    flexDirection:"row", alignItems:"center", gap:5 }}>
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

        {/* Summary */}
        <View style={{ flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:6, paddingHorizontal:2 }}>
          <Text style={{ fontSize:12, color:theme.muted }}>{filtered.length} calls · Last {rangeDays} days</Text>
          <Text style={{ fontSize:11, color:theme.dim }}>{visible.length} shown</Text>
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

      {/* Dial FAB */}
      <Pressable onPress={() => setDialOpen(true)} style={{ position:"absolute", bottom:100, right:20, elevation:8 }}>
        <LinearGradient colors={gradientBrand} style={{ width:58, height:58, borderRadius:29, alignItems:"center", justifyContent:"center" }}>
          <Ionicons name="keypad-outline" size={24} color="#fff"/>
        </LinearGradient>
      </Pressable>

      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} theme={theme}/>

      <ProgressSheet
        visible={!!progressCall}
        onClose={() => { setProgressCall(null); loadAllNotes().then(setNotesMap); }}
        call={progressCall}
        theme={theme}
      />

      <DetailsSheet
        visible={!!detailsCall}
        onClose={() => setDetailsCall(null)}
        call={detailsCall}
        allCalls={allCalls}
        syncedIds={syncedIds}
        theme={theme}
      />
    </SafeAreaView>
  );
}

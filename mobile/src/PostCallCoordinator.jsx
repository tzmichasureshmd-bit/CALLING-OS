import { useCallback, useEffect, useState } from "react";
import { AppState, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "./AuthContext";
import { api } from "./api";
import { syncSelectedCall } from "./syncService";
import { getPendingCalls, removePendingCall, skipPendingCall } from "./pendingCallSyncStore";
import { getPendingPostCalls, markPostCallAttempt, removePendingPostCall } from "./pendingPostCallStore";
import { useTheme, TYPE, SPACE, RADIUS } from "./theme";

const OUTCOMES = [
  ["interested", "Interested"],
  ["asked_details", "Asked details"],
  ["follow_up", "Follow-up required"],
  ["callback", "Callback"],
  ["proposal_sent", "Proposal sent"],
  ["converted", "Converted"],
  ["not_interested", "Not interested"],
];

export default function PostCallCoordinator() {
  const { isAuthed, deviceId } = useAuth();
  const { theme } = useTheme();
  const [pendingSync, setPendingSync] = useState(null);
  const [pendingPost, setPendingPost] = useState(null);
  const [status, setStatus] = useState(null);
  const [notes, setNotes] = useState("");
  const [createLead, setCreateLead] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadPending = useCallback(async () => {
    if (!isAuthed) return;
    const syncItems = await getPendingCalls();
    if (syncItems.length) {
      setPendingSync(syncItems[0]);
      setPendingPost(null);
      return;
    }
    setPendingSync(null);
    const postItems = await getPendingPostCalls();
    setPendingPost(postItems[0] || null);
  }, [isAuthed]);

  useEffect(() => {
    loadPending();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") loadPending();
    });
    const timer = setInterval(loadPending, 15000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [loadPending]);

  useEffect(() => {
    if (!pendingPost) return;
    setStatus(pendingPost.callStatus && OUTCOMES.some(([key]) => key === pendingPost.callStatus) ? pendingPost.callStatus : null);
    setNotes(pendingPost.notes || "");
    setCreateLead(false); setFollowUp(false); setFollowUpDate(""); setError("");
  }, [pendingPost?.callId, pendingPost?.clientEventId]);

  async function decideSync(shouldSync) {
    if (!pendingSync) return;
    setSaving(true); setError("");
    try {
      if (!shouldSync) {
        await skipPendingCall(pendingSync.client_event_id);
      } else {
        if (!deviceId) throw new Error("Device is not registered yet. Please wait and retry.");
        const result = await syncSelectedCall(deviceId, pendingSync);
        if ((result?.failed || 0) > 0) throw new Error(result.error || "Call sync failed. It remains pending.");
      }
      await loadPending();
    } catch (e) {
      setError(e?.message || "Unable to process this call decision.");
    } finally { setSaving(false); }
  }

  async function saveProgress() {
    if (!pendingPost?.callId) { setError("This call is still syncing. Please wait and try again."); return; }
    if (!status) { setError("Select a call outcome before saving."); return; }
    if (notes.length > 2000) { setError("Notes must be 2000 characters or fewer."); return; }
    if (createLead && !pendingPost.phone_number) { setError("A phone number is required to create a lead."); return; }
    setSaving(true); setError("");
    try {
      await api.postCallProgress(pendingPost.callId, {
        call_status: status,
        notes,
        lead: createLead ? {
          name: pendingPost.contact_name && pendingPost.contact_name !== "Unknown" ? pendingPost.contact_name : pendingPost.phone_number,
          phone: pendingPost.phone_number,
          source: "Phone Call",
          next_follow_up: followUp && followUpDate ? new Date(followUpDate).toISOString() : null,
          notes,
        } : null,
      });
      await removePendingPostCall(pendingPost.callId || pendingPost.clientEventId);
      setPendingPost(null);
      await loadPending();
    } catch (e) {
      await markPostCallAttempt(pendingPost.callId || pendingPost.clientEventId, e?.message);
      setError(e?.message || "Unable to save post-call progress. Changes remain pending.");
    } finally { setSaving(false); }
  }

  if (!pendingSync && !pendingPost) return null;
  const call = pendingSync || pendingPost;
  const displayName = call.contact_name && call.contact_name !== "Unknown" ? call.contact_name : call.phone_number || "Unknown caller";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => { setPendingSync(null); setPendingPost(null); }}>
      <Pressable onPress={() => { setPendingSync(null); setPendingPost(null); }} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.48)" }} />
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%", backgroundColor: theme.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: SPACE.lg, paddingBottom: 34 }}>
        <View style={{ alignItems: "center", marginBottom: SPACE.md }}><View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: theme.border }} /></View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {pendingSync ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}><View style={{ width: 48, height: 48, borderRadius: RADIUS.lg, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="cloud-upload" size={22} color={theme.accent} /></View><View style={{ flex: 1 }}><Text style={{ ...TYPE.h3, color: theme.primary }}>Choose call sync</Text><Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 3 }}>This call will stay on this phone until you choose.</Text></View></View>
              <View style={{ padding: SPACE.lg, borderRadius: RADIUS.xl, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginBottom: SPACE.lg }}><Text style={{ ...TYPE.bodyBold, color: theme.primary }}>{displayName}</Text><Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 5 }}>{pendingSync.phone_number || "Unknown number"} · {pendingSync.call_type} · {Math.floor((pendingSync.duration_seconds || 0) / 60)}m {(pendingSync.duration_seconds || 0) % 60}s</Text><Text style={{ ...TYPE.micro, color: theme.dim, marginTop: 8 }}>{new Date(pendingSync.start_time).toLocaleString()}</Text></View>
              {error ? <View style={{ marginBottom: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: theme.dangerSoft }}><Text style={{ ...TYPE.caption, color: theme.red }}>{error}</Text></View> : null}
              <Pressable disabled={saving} onPress={() => decideSync(true)} style={{ backgroundColor: theme.primary, borderRadius: RADIUS.md, alignItems: "center", paddingVertical: SPACE.md, opacity: saving ? 0.6 : 1 }}><Text style={{ ...TYPE.bodyBold, color: "#fff" }}>{saving ? "Syncing…" : "Sync this call"}</Text></Pressable>
              <Pressable disabled={saving} onPress={() => decideSync(false)} style={{ alignItems: "center", paddingVertical: SPACE.md }}><Text style={{ ...TYPE.caption, color: theme.muted }}>Keep on device</Text></Pressable>
            </>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}><View style={{ width: 48, height: 48, borderRadius: RADIUS.lg, backgroundColor: theme.accentSoft, alignItems: "center", justifyContent: "center" }}><Ionicons name="call" size={22} color={theme.accent} /></View><View style={{ flex: 1 }}><Text style={{ ...TYPE.h3, color: theme.primary }}>Continue call progress</Text><Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 3 }}>{displayName} · {pendingPost.phone_number || "Unknown number"}</Text></View></View>
              <Text style={{ ...TYPE.label, color: theme.muted, marginBottom: SPACE.sm }}>Call outcome</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm, marginBottom: SPACE.lg }}>{OUTCOMES.map(([key, label]) => <Pressable key={key} onPress={() => setStatus(key)} style={{ paddingHorizontal: 11, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: status === key ? theme.accent : theme.border, backgroundColor: status === key ? theme.accentSoft : theme.card }}><Text style={{ ...TYPE.caption, color: status === key ? theme.accent : theme.secondary, fontWeight: "700" }}>{label}</Text></Pressable>)}</View>
              <Text style={{ ...TYPE.label, color: theme.muted, marginBottom: SPACE.sm }}>Notes</Text><TextInput value={notes} onChangeText={setNotes} multiline numberOfLines={4} placeholder="What happened? What is the next step?" placeholderTextColor={theme.dim} style={{ minHeight: 96, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.md, backgroundColor: theme.input, color: theme.primary, padding: SPACE.md, textAlignVertical: "top", marginBottom: SPACE.md }} />
              <Pressable onPress={() => setCreateLead((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.sm }}><Ionicons name={createLead ? "checkbox" : "square-outline"} size={21} color={createLead ? theme.accent : theme.muted} /><View><Text style={{ ...TYPE.bodyBold, color: theme.primary }}>Create or link a lead</Text><Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2 }}>Use this caller as a sales lead</Text></View></Pressable>
              {createLead && <Pressable onPress={() => setFollowUp((value) => !value)} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm, paddingVertical: SPACE.sm }}><Ionicons name={followUp ? "checkbox" : "square-outline"} size={21} color={followUp ? theme.accent : theme.muted} /><View><Text style={{ ...TYPE.bodyBold, color: theme.primary }}>Schedule follow-up</Text><Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2 }}>Create the next step for this call</Text></View></Pressable>}
              {createLead && followUp && <TextInput value={followUpDate} onChangeText={setFollowUpDate} placeholder="2026-12-01T10:30:00" placeholderTextColor={theme.dim} style={{ borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.md, backgroundColor: theme.input, color: theme.primary, padding: SPACE.md, marginTop: SPACE.xs }} />}
              {error ? <View style={{ marginTop: SPACE.md, padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: theme.dangerSoft }}><Text style={{ ...TYPE.caption, color: theme.red }}>{error}</Text></View> : null}
              <Pressable disabled={saving} onPress={saveProgress} style={{ marginTop: SPACE.lg, backgroundColor: theme.primary, borderRadius: RADIUS.md, alignItems: "center", paddingVertical: SPACE.md, opacity: saving ? 0.6 : 1 }}><Text style={{ ...TYPE.bodyBold, color: "#fff" }}>{saving ? "Saving…" : "Save progress"}</Text></Pressable>
              <Pressable onPress={() => { setPendingPost(null); loadPending(); }} style={{ alignItems: "center", paddingVertical: SPACE.md }}><Text style={{ ...TYPE.caption, color: theme.muted }}>Later</Text></Pressable>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

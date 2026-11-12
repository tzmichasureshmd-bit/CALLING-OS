import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Linking, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "../src/theme";
import { api, BASE_URL } from "../src/api";
import { getCallStatus, STATUS, STATUS_LABEL } from "../src/callStatusStore";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDur(s) {
  if (!s || s <= 0) return "—";
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function fmtTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const TYPE_COLOR = {
  incoming: palette.teal,
  outgoing: palette.violet,
  missed:   palette.red,
  rejected: palette.amber,
};

const TYPE_ICON = {
  incoming: "call-received",
  outgoing: "call-made",
  missed:   "call-missed",
  rejected: "call-missed",
};

// ── Transcript parser ─────────────────────────────────────────────────────────
// Whisper returns a flat string. We split on sentence boundaries and alternate
// speakers: ME (index 0, 2, 4…) vs OTHER (index 1, 3, 5…).
// If the transcript already has speaker tags like "[SPEAKER_00]" or "Speaker 1:"
// we parse those directly instead.
function parseTranscript(text) {
  if (!text || !text.trim()) return [];

  // Check for explicit speaker tags from diarization
  // Patterns: "[SPEAKER_00] text" or "Speaker 1: text" or "SPEAKER_0: text"
  const diarizedPattern = /\[SPEAKER_\d+\]|Speaker\s*\d+:|SPEAKER_\d+:/i;
  if (diarizedPattern.test(text)) {
    const lines = text
      .split(/(?=\[SPEAKER_\d+\]|Speaker\s*\d+:|SPEAKER_\d+:)/i)
      .map(l => l.trim())
      .filter(Boolean);
    const speakerMap = {}  // maps raw speaker label -> "ME" or "OTHER"
    let speakerCount = 0;
    return lines.map(line => {
      const match = line.match(/^(\[SPEAKER_\d+\]|Speaker\s*\d+:|SPEAKER_\d+:)\s*/i);
      if (!match) return null;
      const rawLabel = match[1].replace(/[\[\]:]/g, "").trim();
      if (!(rawLabel in speakerMap)) {
        speakerMap[rawLabel] = speakerCount === 0 ? "ME" : "OTHER";
        speakerCount++;
      }
      const speaker = speakerMap[rawLabel];
      const content = line.slice(match[0].length).trim();
      return content ? { speaker, text: content } : null;
    }).filter(Boolean);
  }

  // No speaker tags — split on sentence boundaries and alternate
  // Split on: . ! ? followed by space or end, or newlines
  const sentences = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map(s => s.trim())
    .filter(s => s.length > 2);

  if (sentences.length === 0) return [{ speaker: "ME", text: text.trim() }];

  // Group consecutive short sentences into turns (max ~3 sentences per turn)
  const turns = [];
  let buffer = [];
  let speakerIdx = 0;

  for (let i = 0; i < sentences.length; i++) {
    buffer.push(sentences[i]);
    // End a turn after 2-3 sentences or at end
    const isLast = i === sentences.length - 1;
    const shouldFlip = buffer.length >= 2 || isLast;
    if (shouldFlip) {
      turns.push({
        speaker: speakerIdx % 2 === 0 ? "ME" : "OTHER",
        text: buffer.join(" "),
      });
      buffer = [];
      speakerIdx++;
    }
  }
  return turns;
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ speaker, text, theme }) {
  const isMe = speaker === "ME";
  return (
    <View style={{
      flexDirection: "row",
      justifyContent: isMe ? "flex-end" : "flex-start",
      marginBottom: 10,
      paddingHorizontal: 4,
    }}>
      {!isMe && (
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: palette.violet + "22",
          alignItems: "center", justifyContent: "center",
          marginRight: 8, marginTop: 2, flexShrink: 0,
        }}>
          <Ionicons name="person-outline" size={14} color={palette.violet} />
        </View>
      )}
      <View style={{ maxWidth: "75%" }}>
        <Text style={{
          fontSize: 10, fontWeight: "700",
          color: isMe ? palette.teal : palette.violet,
          marginBottom: 3,
          textAlign: isMe ? "right" : "left",
        }}>
          {isMe ? "ME" : "OTHER"}
        </Text>
        <View style={{
          backgroundColor: isMe ? palette.teal + "22" : palette.violet + "18",
          borderRadius: 14,
          borderTopRightRadius: isMe ? 4 : 14,
          borderTopLeftRadius: isMe ? 14 : 4,
          paddingHorizontal: 13,
          paddingVertical: 9,
          borderWidth: 1,
          borderColor: isMe ? palette.teal + "44" : palette.violet + "33",
        }}>
          <Text style={{ fontSize: 13.5, color: theme.primary, lineHeight: 21 }}>{text}</Text>
        </View>
      </View>
      {isMe && (
        <View style={{
          width: 28, height: 28, borderRadius: 14,
          backgroundColor: palette.teal + "22",
          alignItems: "center", justifyContent: "center",
          marginLeft: 8, marginTop: 2, flexShrink: 0,
        }}>
          <Ionicons name="person" size={14} color={palette.teal} />
        </View>
      )}
    </View>
  );
}

// ── Timeline step component ───────────────────────────────────────────────────
function TimelineStep({ icon, label, sublabel, status, isLast }) {
  const { theme } = useTheme();
  const color =
    status === "done"    ? palette.emerald :
    status === "active"  ? palette.teal    :
    status === "failed"  ? palette.red     :
    theme.dim;

  const iconName =
    status === "done"   ? "checkmark-circle" :
    status === "active" ? "sync-circle"      :
    status === "failed" ? "close-circle"     :
    "ellipse-outline";

  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ alignItems: "center", width: 24 }}>
        <Ionicons name={iconName} size={22} color={color} />
        {!isLast && (
          <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: theme.border, marginTop: 4 }} />
        )}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: status === "pending" ? theme.dim : theme.primary }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
function syncStepStatus(currentStatus, targetStatus) {
  // Current state machine: DETECTED → SYNCING → SYNCED
  // Failure: SYNC_FAILED | SYNC_OFFLINE
  const order = [STATUS.DETECTED, STATUS.SYNCING, STATUS.SYNCED];
  const failStatuses = [STATUS.SYNC_FAILED, STATUS.SYNC_OFFLINE];

  if (failStatuses.includes(currentStatus) && targetStatus === STATUS.SYNCED) return "failed";
  if (failStatuses.includes(currentStatus) && order.indexOf(targetStatus) >= order.indexOf(STATUS.SYNCING)) return "failed";

  const currentIdx = order.indexOf(currentStatus);
  const targetIdx  = order.indexOf(targetStatus);
  if (currentIdx > targetIdx)  return "done";
  if (currentIdx === targetIdx) return "active";
  return "pending";
}

function recStepStatus(recStatus, targetStatus) {
  const order = [
    STATUS.RECORDING_CHECK,
    STATUS.RECORDING_QUEUED,
    STATUS.RECORDING_UPLOADING,
    STATUS.RECORDING_UPLOADED,
  ];
  if (recStatus === STATUS.RECORDING_NOT_AVAILABLE) return "pending";
  if (recStatus === STATUS.RECORDING_FAILED) return "failed";

  const ci = order.indexOf(recStatus);
  const ti = order.indexOf(targetStatus);
  if (ci > ti)  return "done";
  if (ci === ti) return "active";
  return "pending";
}

function transStepStatus(transStatus, targetStatus) {
  const order = [
    STATUS.TRANSCRIPTION_PENDING, STATUS.TRANSCRIBING, STATUS.TRANSCRIPTION_COMPLETED,
  ];
  if (!transStatus) return "pending";
  if (transStatus === STATUS.TRANSCRIPTION_FAILED && targetStatus === STATUS.TRANSCRIPTION_COMPLETED) return "failed";

  const ci = order.indexOf(transStatus);
  const ti = order.indexOf(targetStatus);
  if (ci > ti)  return "done";
  if (ci === ti) return "active";
  return "pending";
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CallDetail() {
  const { clientEventId, callId } = useLocalSearchParams();
  const router = useRouter();
  const { theme, shadowSoft } = useTheme();

  const [localStatus, setLocalStatus] = useState(null);
  const [serverCall, setServerCall]   = useState(null);
  const [transcript, setTranscript]   = useState(null);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);

  // ── Manual recording upload ───────────────────────────────────────────────
  async function handleManualUpload() {
    const id = callId || localStatus?.call_id;
    if (!id) {
      Alert.alert("Not Synced", "This call has not been synced to the server yet. Sync it first from the Logs screen.");
      return;
    }

    let picked;
    try {
      picked = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "video/mp4"],
        copyToCacheDirectory: true,
      });
    } catch {
      return;
    }
    if (picked.canceled || !picked.assets?.length) return;

    const asset = picked.assets[0];
    const mimeType = asset.mimeType || "audio/mp4";

    setUploading(true);
    try {
      let token = null;
      try { token = await SecureStore.getItemAsync("callos_token"); } catch {}
      if (!token) token = await AsyncStorage.getItem("callos_token").catch(() => null);
      if (!token) throw new Error("Not logged in");

      const result = await FileSystem.uploadAsync(
        `${BASE_URL}/calls/${id}/recording`,
        asset.uri,
        {
          httpMethod:  "POST",
          uploadType:  FileSystem.FileSystemUploadType.MULTIPART,
          fieldName:   "file",
          mimeType,
          headers:     { Authorization: `Bearer ${token}` },
        }
      );

      if (result.status === 200 || result.status === 201) {
        let parsed = null;
        try { parsed = result.body ? JSON.parse(result.body) : null; } catch {}
        if (parsed?.recording_available === true) {
          Alert.alert("Upload Successful", "Recording uploaded! Transcription will begin shortly.");
          load();
          return;
        }
      }
      let detail = "Upload failed";
      try { detail = JSON.parse(result.body)?.detail || detail; } catch {}
      throw new Error(`HTTP ${result.status}: ${detail}`);
    } catch (e) {
      Alert.alert("Upload Failed", e?.message || "Could not upload the recording. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (clientEventId) {
        const ls = await getCallStatus(clientEventId);
        setLocalStatus(ls);
      }
      const id = callId || localStatus?.call_id;
      if (id) {
        const [sc, tx] = await Promise.all([
          api.getCall(id).catch(() => null),
          api.getTranscript(id).catch(() => null),
        ]);
        // Ensure objects, not null
        setServerCall(sc || { id: null, phone_number: "—", contact_name: "Unknown", call_type: "incoming" });
        setTranscript(tx || { text: "" });
      }
    } finally {
      setLoading(false);
    }
  }, [clientEventId, callId]);

  useEffect(() => { load(); }, [load]);

  // Merge local + server data
  const call = {
    client_event_id: clientEventId,
    call_id:         callId || localStatus?.call_id || serverCall?.id,
    phone_number:    serverCall?.phone_number || localStatus?.phone_number || "—",
    contact_name:    serverCall?.contact_name || localStatus?.contact_name || "Unknown",
    call_type:       serverCall?.call_type    || localStatus?.call_type    || "incoming",
    duration_seconds: serverCall?.duration_seconds ?? localStatus?.duration_seconds ?? 0,
    start_time:      serverCall?.start_time   || localStatus?.start_time,
    sim:             serverCall?.source       || "SIM 1",
    sync_status:     localStatus?.sync_status || (serverCall ? STATUS.SYNCED : STATUS.SYNC_QUEUED),
    recording_status: localStatus?.recording_status || (
      serverCall?.recording_available ? STATUS.RECORDING_UPLOADED : STATUS.RECORDING_NOT_AVAILABLE
    ),
    recording_error:   localStatus?.recording_error || serverCall?.recording_error || null,
    transcript_status: localStatus?.transcript_status || serverCall?.transcript_status || null,
    last_error:      localStatus?.last_error,
    sync_attempts:   localStatus?.sync_attempts || 0,
  };

  const typeColor = TYPE_COLOR[call.call_type] || palette.teal;

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={palette.teal} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.surface }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: SPACE.md, width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: theme.surface2, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={20} color={theme.primary} />
        </Pressable>
        <Text style={{ ...TYPE.h3, color: theme.primary, flex: 1 }}>Call Details</Text>
        <Pressable onPress={load} style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: theme.surface2, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="refresh-outline" size={18} color={theme.muted} />
        </Pressable>
      </View>

      {/* Scrollable content — paddingBottom leaves room for sticky bar */}
      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* ── Call info card ── */}
        <View style={[{ backgroundColor: theme.card, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: theme.border, marginBottom: SPACE.md, overflow: "hidden" }, shadowSoft]}>
          {/* Gradient accent strip */}
          <LinearGradient colors={[typeColor + "18", "transparent"]} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 60 }} />
          <View style={{ padding: SPACE.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}>
              <View style={{ width: 52, height: 52, borderRadius: RADIUS.xl, backgroundColor: typeColor + "22", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: typeColor + "44" }}>
                <Ionicons name={TYPE_ICON[call.call_type] || "call"} size={24} color={typeColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.h2, color: theme.primary }}>{call.contact_name}</Text>
                <Text style={{ ...TYPE.caption, color: palette.teal, marginTop: 2 }}>{call.phone_number}</Text>
              </View>
            </View>
            {/* 2x2 metadata grid */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: SPACE.sm }}>
              {[
                { label: "Type",     value: call.call_type.charAt(0).toUpperCase() + call.call_type.slice(1), color: typeColor },
                { label: "Duration", value: fmtDur(call.duration_seconds) },
                { label: "Time",     value: fmtTime(call.start_time) },
                { label: "SIM",      value: call.sim },
              ].map((r) => (
                <View key={r.label} style={{ flex: 1, minWidth: "45%", backgroundColor: theme.surface2, borderRadius: RADIUS.md, padding: SPACE.md, borderWidth: 1, borderColor: theme.border }}>
                  <Text style={{ ...TYPE.micro, color: theme.muted, marginBottom: 3 }}>{r.label}</Text>
                  <Text style={{ ...TYPE.bodyBold, color: r.color || theme.primary }}>{r.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Status pills card — replaces 3 separate timeline cards ── */}
        <View style={[{ backgroundColor: theme.card, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: theme.border, padding: SPACE.lg, marginBottom: SPACE.md }, shadowSoft]}>
          <Text style={{ ...TYPE.label, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACE.md }}>Pipeline Status</Text>
          <View style={{ flexDirection: "row", gap: SPACE.sm }}>
            {/* Sync pill */}
            {(() => {
              const synced  = call.sync_status === STATUS.SYNCED;
              const failed  = call.sync_status === STATUS.SYNC_FAILED || call.sync_status === STATUS.SYNC_OFFLINE;
              const active  = call.sync_status === STATUS.SYNCING;
              const color   = synced ? palette.emerald : failed ? palette.red : active ? palette.teal : theme.dim;
              const icon    = synced ? "checkmark-circle" : failed ? "close-circle" : active ? "sync-circle" : "ellipse-outline";
              const label   = synced ? "Synced" : failed ? "Sync Failed" : active ? "Syncing…" : "Pending";
              return (
                <View style={{ flex: 1, backgroundColor: color + "14", borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1, borderColor: color + "33", alignItems: "center", gap: SPACE.xs }}>
                  <Ionicons name={icon} size={20} color={color} />
                  <Text style={{ ...TYPE.label, color }}>{label}</Text>
                  <Text style={{ ...TYPE.micro, color: theme.muted }}>Sync</Text>
                </View>
              );
            })()}
            {/* Recording pill */}
            {(() => {
              const uploaded  = call.recording_status === STATUS.RECORDING_UPLOADED;
              const uploading = call.recording_status === STATUS.RECORDING_UPLOADING;
              const failed    = call.recording_status === STATUS.RECORDING_FAILED;
              const na        = call.recording_status === STATUS.RECORDING_NOT_AVAILABLE;
              const color     = uploaded ? palette.emerald : uploading ? palette.violet : failed ? palette.red : theme.dim;
              const icon      = uploaded ? "checkmark-circle" : uploading ? "cloud-upload-outline" : failed ? "close-circle" : "mic-off-outline";
              const label     = uploaded ? "Uploaded" : uploading ? "Uploading…" : failed ? "Failed" : na ? "N/A" : "Pending";
              return (
                <View style={{ flex: 1, backgroundColor: color + "14", borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1, borderColor: color + "33", alignItems: "center", gap: SPACE.xs }}>
                  <Ionicons name={icon} size={20} color={color} />
                  <Text style={{ ...TYPE.label, color }}>{label}</Text>
                  <Text style={{ ...TYPE.micro, color: theme.muted }}>Recording</Text>
                </View>
              );
            })()}
            {/* Transcript pill */}
            {(() => {
              const done    = call.transcript_status === STATUS.TRANSCRIPTION_COMPLETED;
              const active  = call.transcript_status === STATUS.TRANSCRIBING;
              const failed  = call.transcript_status === STATUS.TRANSCRIPTION_FAILED;
              const color   = done ? palette.emerald : active ? palette.cyan : failed ? palette.red : theme.dim;
              const icon    = done ? "checkmark-circle" : active ? "sparkles-outline" : failed ? "close-circle" : "sparkles-outline";
              const label   = done ? "Done" : active ? "Processing" : failed ? "Failed" : "Waiting";
              return (
                <View style={{ flex: 1, backgroundColor: color + "14", borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1, borderColor: color + "33", alignItems: "center", gap: SPACE.xs }}>
                  <Ionicons name={icon} size={20} color={color} />
                  <Text style={{ ...TYPE.label, color }}>{label}</Text>
                  <Text style={{ ...TYPE.micro, color: theme.muted }}>Transcript</Text>
                </View>
              );
            })()}
          </View>
          {/* Sync error detail */}
          {(call.sync_status === STATUS.SYNC_FAILED || call.sync_status === STATUS.SYNC_OFFLINE) && call.last_error && (
            <View style={{ marginTop: SPACE.md, backgroundColor: palette.red + "12", borderRadius: RADIUS.md, padding: SPACE.md, borderWidth: 1, borderColor: palette.red + "33" }}>
              <Text style={{ ...TYPE.caption, color: palette.red }}>{call.last_error}</Text>
            </View>
          )}
        </View>

        {/* ── AI Transcript — promoted above fold ── */}
        {call.sync_status === STATUS.SYNCED && (
          <View style={[{ backgroundColor: theme.card, borderRadius: RADIUS.xxl, borderWidth: 1, borderColor: theme.border, marginBottom: SPACE.md, overflow: "hidden" }, shadowSoft]}>
            <View style={{ padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                <Ionicons name="sparkles-outline" size={16} color={palette.teal} />
                <Text style={{ ...TYPE.title, color: theme.primary }}>AI Transcript</Text>
                {call.transcript_status === STATUS.TRANSCRIPTION_COMPLETED && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginLeft: "auto" }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.emerald }} />
                    <Text style={{ ...TYPE.micro, color: palette.emerald }}>Me</Text>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: palette.violet, marginLeft: SPACE.sm }} />
                    <Text style={{ ...TYPE.micro, color: palette.violet }}>Other</Text>
                  </View>
                )}
              </View>
            </View>
            {!call.transcript_status ? (
              <View style={{ padding: SPACE.lg, flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
                <Ionicons name="sparkles-outline" size={20} color={theme.dim} />
                <Text style={{ ...TYPE.caption, color: theme.muted }}>
                  {call.recording_status === STATUS.RECORDING_UPLOADED ? "Transcription not yet requested" : "Requires a recording to transcribe"}
                </Text>
              </View>
            ) : call.transcript_status !== STATUS.TRANSCRIPTION_COMPLETED ? (
              <View style={{ padding: SPACE.lg, flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
                <ActivityIndicator color={palette.teal} size="small" />
                <Text style={{ ...TYPE.caption, color: theme.muted }}>{STATUS_LABEL[call.transcript_status] || "Processing…"}</Text>
              </View>
            ) : transcript?.transcript_text ? (
              <View style={{ padding: SPACE.md }}>
                {parseTranscript(transcript.transcript_text).map((turn, i) => (
                  <ChatBubble key={i} speaker={turn.speaker} text={turn.text} theme={theme} />
                ))}
              </View>
            ) : (
              <View style={{ padding: SPACE.lg }}>
                <Text style={{ ...TYPE.caption, color: theme.muted }}>Transcript unavailable.</Text>
              </View>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── Sticky action bar ── */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: theme.surface,
        borderTopWidth: 1, borderTopColor: theme.border,
        paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
        paddingBottom: SPACE.lg,
        flexDirection: "row", gap: SPACE.sm,
      }}>
        {/* Manual upload — visible when recording not uploaded */}
        {(call.recording_status === STATUS.RECORDING_NOT_AVAILABLE ||
          call.recording_status === STATUS.RECORDING_FAILED ||
          !call.recording_status) && call.sync_status === STATUS.SYNCED && (
          <Pressable
            onPress={handleManualUpload}
            disabled={uploading}
            style={{ flex: 1, overflow: "hidden", borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: palette.violet + "88", backgroundColor: palette.violet + "18", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, height: 52 }}
          >
            {uploading
              ? <ActivityIndicator color={palette.violet} size="small" />
              : <Ionicons name="cloud-upload-outline" size={20} color={palette.violet} />}
            <Text style={{ ...TYPE.bodyBold, color: palette.violet }}>
              {uploading ? "Uploading…" : "Upload Recording"}
            </Text>
          </Pressable>
        )}
        <Pressable
          onPress={() => Linking.openURL(`tel:${call.phone_number.replace(/\s/g, "")}`)}
          style={{ flex: 1, overflow: "hidden", borderRadius: RADIUS.lg }}
        >
          <LinearGradient
            colors={["#22c55e", "#16a34a"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.sm, height: 52,
              shadowColor: "#22c55e", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 }}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>Call Back</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

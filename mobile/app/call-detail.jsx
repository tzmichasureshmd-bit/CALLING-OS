import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../../src/theme";
import { api } from "../../src/api";
import { getCallStatus, STATUS, STATUS_LABEL } from "../../src/callStatusStore";

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

// ── Timeline step component ───────────────────────────────────────────────────
function TimelineStep({ icon, label, sublabel, status, isLast }) {
  // status: "done" | "active" | "pending" | "failed"
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
      {/* Line + dot */}
      <View style={{ alignItems: "center", width: 24 }}>
        <Ionicons name={iconName} size={22} color={color} />
        {!isLast && (
          <View style={{ width: 2, flex: 1, minHeight: 20, backgroundColor: theme.border, marginTop: 4 }} />
        )}
      </View>
      {/* Content */}
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
  const order = [
    STATUS.DETECTED, STATUS.LOCAL_SAVED, STATUS.SYNC_QUEUED,
    STATUS.SYNCING, STATUS.SYNCED,
  ];
  const failStatuses = [STATUS.SYNC_FAILED];

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
    STATUS.RECORDING_QUEUED, STATUS.RECORDING_UPLOADING, STATUS.RECORDING_UPLOADED,
  ];
  if (recStatus === STATUS.RECORDING_NOT_AVAILABLE) return "pending";
  if (recStatus === STATUS.RECORDING_FAILED && targetStatus === STATUS.RECORDING_UPLOADED) return "failed";

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
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Load local status store entry
      if (clientEventId) {
        const ls = await getCallStatus(clientEventId);
        setLocalStatus(ls);
      }
      // Load server call record if we have a call_id
      const id = callId || localStatus?.call_id;
      if (id) {
        const sc = await api.getCall(id).catch(() => null);
        setServerCall(sc);
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
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: "700", color: theme.primary, flex: 1 }}>Call Details</Text>
        <Pressable onPress={load}>
          <Ionicons name="refresh-outline" size={20} color={theme.muted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* ── Call info card ── */}
        <View style={[{ backgroundColor: theme.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }, shadowSoft]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: typeColor + "1f", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={TYPE_ICON[call.call_type] || "call"} size={24} color={typeColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>{call.contact_name}</Text>
              <Text style={{ fontSize: 14, color: palette.teal, marginTop: 2 }}>{call.phone_number}</Text>
            </View>
          </View>
          {[
            { label: "Type",     value: call.call_type.charAt(0).toUpperCase() + call.call_type.slice(1), color: typeColor },
            { label: "Duration", value: fmtDur(call.duration_seconds) },
            { label: "Time",     value: fmtTime(call.start_time) },
            { label: "SIM",      value: call.sim },
          ].map((r) => (
            <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
              <Text style={{ fontSize: 13, color: theme.muted }}>{r.label}</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: r.color || theme.primary }}>{r.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Sync status timeline ── */}
        <View style={[{ backgroundColor: theme.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }, shadowSoft]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary, marginBottom: 16 }}>Synchronization</Text>
          <TimelineStep
            icon="radio-button-on"
            label="Call detected"
            sublabel="Found in Android call log"
            status={syncStepStatus(call.sync_status, STATUS.DETECTED)}
          />
          <TimelineStep
            icon="save-outline"
            label="Saved locally"
            sublabel="Stored in sync queue"
            status={syncStepStatus(call.sync_status, STATUS.LOCAL_SAVED)}
          />
          <TimelineStep
            icon="cloud-upload-outline"
            label="Uploading to server"
            sublabel={call.sync_status === STATUS.SYNCING ? "In progress…" : undefined}
            status={syncStepStatus(call.sync_status, STATUS.SYNCING)}
          />
          <TimelineStep
            icon="checkmark-done-outline"
            label="Server confirmed"
            sublabel={
              call.sync_status === STATUS.SYNCED
                ? "Call is on the dashboard"
                : call.sync_status === STATUS.SYNC_FAILED
                  ? `Failed · ${call.last_error || "unknown error"} · ${call.sync_attempts} attempt(s)`
                  : undefined
            }
            status={syncStepStatus(call.sync_status, STATUS.SYNCED)}
            isLast
          />
        </View>

        {/* ── Recording status ── */}
        <View style={[{ backgroundColor: theme.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }, shadowSoft]}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary, marginBottom: 16 }}>Recording</Text>
          {call.recording_status === STATUS.RECORDING_NOT_AVAILABLE ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="mic-off-outline" size={20} color={theme.dim} />
              <Text style={{ fontSize: 13, color: theme.muted }}>Recording unavailable on this device</Text>
            </View>
          ) : (
            <>
              <TimelineStep
                icon="mic-outline"
                label="Recording discovered"
                sublabel="Found on device storage"
                status={recStepStatus(call.recording_status, STATUS.RECORDING_QUEUED)}
              />
              <TimelineStep
                icon="cloud-upload-outline"
                label="Uploading recording"
                sublabel={call.recording_status === STATUS.RECORDING_UPLOADING ? "In progress…" : undefined}
                status={recStepStatus(call.recording_status, STATUS.RECORDING_UPLOADING)}
              />
              <TimelineStep
                icon="checkmark-circle-outline"
                label="Recording available"
                sublabel={
                  call.recording_status === STATUS.RECORDING_UPLOADED
                    ? "Playable on web dashboard"
                    : call.recording_status === STATUS.RECORDING_FAILED
                      ? "Upload failed — will retry"
                      : undefined
                }
                status={recStepStatus(call.recording_status, STATUS.RECORDING_UPLOADED)}
                isLast
              />
            </>
          )}
        </View>

        {/* ── Transcription status ── */}
        {call.sync_status === STATUS.SYNCED && (
          <View style={[{ backgroundColor: theme.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }, shadowSoft]}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: theme.primary, marginBottom: 16 }}>AI Transcription</Text>
            {!call.transcript_status ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ionicons name="sparkles-outline" size={20} color={theme.dim} />
                <Text style={{ fontSize: 13, color: theme.muted }}>
                  {call.recording_status === STATUS.RECORDING_UPLOADED
                    ? "Transcription not yet requested"
                    : "Requires a recording to transcribe"}
                </Text>
              </View>
            ) : (
              <>
                <TimelineStep
                  icon="time-outline"
                  label="Transcription pending"
                  status={transStepStatus(call.transcript_status, STATUS.TRANSCRIPTION_PENDING)}
                />
                <TimelineStep
                  icon="sparkles-outline"
                  label="Transcribing…"
                  status={transStepStatus(call.transcript_status, STATUS.TRANSCRIBING)}
                />
                <TimelineStep
                  icon="document-text-outline"
                  label="Transcription complete"
                  sublabel={
                    call.transcript_status === STATUS.TRANSCRIPTION_COMPLETED
                      ? "View on web dashboard"
                      : call.transcript_status === STATUS.TRANSCRIPTION_FAILED
                        ? "Failed — retry from web dashboard"
                        : undefined
                  }
                  status={transStepStatus(call.transcript_status, STATUS.TRANSCRIPTION_COMPLETED)}
                  isLast
                />
              </>
            )}
          </View>
        )}

        {/* ── Actions ── */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => Linking.openURL(`tel:${call.phone_number.replace(/\s/g, "")}`)}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: palette.teal + "1a", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: palette.teal + "44" }}
          >
            <Ionicons name="call-outline" size={18} color={palette.teal} />
            <Text style={{ fontSize: 14, fontWeight: "700", color: palette.teal }}>Call Back</Text>
          </Pressable>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * diagnostic.jsx — Full diagnostic screen per spec.
 * Shows: Android info, SIM inventory, selected SIM, call log stats,
 * sync stats, recording stats, transcription stats, source.
 */
import { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../src/theme";
import { readSimInfo, checkSimPermission, getSimCount, getDeviceInfo, checkPermissions } from "../src/nativeModules";
import { getSimSelection } from "../src/simSelectionService";
import { getRealCallLog } from "../src/callLogService";
import { getAllCallStatuses, STATUS } from "../src/callStatusStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules, Platform } from "react-native";

function Section({ title, children }) {
  const { theme } = useTheme();
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 12 }}>
      <Text style={{ fontSize: 13, fontWeight: "800", color: theme.accent, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, valueColor }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.border }}>
      <Text style={{ fontSize: 12, color: theme.muted, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: "600", color: valueColor || theme.primary, flex: 1, textAlign: "right" }} numberOfLines={1}>{String(value ?? "—")}</Text>
    </View>
  );
}

function Badge({ label, ok }) {
  const color = ok ? palette.emerald : palette.red;
  return (
    <View style={{ backgroundColor: color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: color + "55" }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color }}>{label}</Text>
    </View>
  );
}

export default function DiagnosticScreen() {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  async function runDiagnostic() {
    setLoading(true);
    try {
      const [simPerm, simCount, sims, selection, perms, statuses] = await Promise.all([
        checkSimPermission(),
        getSimCount(),
        readSimInfo(),
        getSimSelection(),
        checkPermissions(),
        getAllCallStatuses(),
      ]);

      const deviceInfo = getDeviceInfo();

      // Call log stats
      let callStats = { total: 0, eligible: 0, unknownSim: 0, incoming: 0, outgoing: 0, missed: 0, rejected: 0 };
      try {
        const calls = await getRealCallLog(7);
        callStats.total = calls.length;
        for (const c of calls) {
          if (c.call_type === "incoming") callStats.incoming++;
          else if (c.call_type === "outgoing") callStats.outgoing++;
          else if (c.call_type === "missed") callStats.missed++;
          else if (c.call_type === "rejected") callStats.rejected++;

          const hasSimId = c.subscription_id !== null || c.sim_slot !== null;
          if (!hasSimId) { callStats.unknownSim++; continue; }

          // Check if matches selected SIM
          if (selection.subscriptionId && c.subscription_id) {
            if (c.subscription_id === selection.subscriptionId) callStats.eligible++;
          } else if (selection.slot !== null && c.sim_slot !== null) {
            if (c.sim_slot === selection.slot + 1) callStats.eligible++;
          } else if (!selection.subscriptionId && selection.slot === null) {
            callStats.eligible++; // no filter = all eligible
          }
        }
      } catch {}

      // Sync stats from status store + synced IDs
      let syncStats = { queued: 0, syncing: 0, synced: 0, failed: 0 };
      try {
        const raw = await AsyncStorage.getItem("callos_synced_ids").catch(() => null);
        const syncedSet = raw ? new Set(JSON.parse(raw)) : new Set();
        syncStats.synced = syncedSet.size;
        syncStats.queued = statuses.filter(s => s.sync_status === STATUS.SYNC_QUEUED).length;
        syncStats.syncing = statuses.filter(s => s.sync_status === STATUS.SYNCING).length;
        syncStats.failed = statuses.filter(s => s.sync_status === STATUS.SYNC_FAILED).length;
      } catch {}

      // Recording stats
      const recStats = {
        available:   statuses.filter(s => s.recording_status === STATUS.RECORDING_QUEUED || s.recording_status === STATUS.RECORDING_UPLOADING || s.recording_status === STATUS.RECORDING_UPLOADED).length,
        unavailable: statuses.filter(s => s.recording_status === STATUS.RECORDING_NOT_AVAILABLE).length,
        queued:      statuses.filter(s => s.recording_status === STATUS.RECORDING_QUEUED).length,
        uploaded:    statuses.filter(s => s.recording_status === STATUS.RECORDING_UPLOADED).length,
        failed:      statuses.filter(s => s.recording_status === STATUS.RECORDING_FAILED).length,
      };

      // Transcription stats
      const txStats = {
        pending:    statuses.filter(s => s.transcript_status === STATUS.TRANSCRIPTION_PENDING).length,
        processing: statuses.filter(s => s.transcript_status === STATUS.TRANSCRIBING).length,
        completed:  statuses.filter(s => s.transcript_status === STATUS.TRANSCRIPTION_COMPLETED).length,
        failed:     statuses.filter(s => s.transcript_status === STATUS.TRANSCRIPTION_FAILED).length,
      };

      const source = NativeModules.CallLogModule ? "Native Kotlin (CallLogModule + SimModule)" : "Fallback library (react-native-call-log)";

      setData({ deviceInfo, simPerm, simCount, sims, selection, perms, callStats, syncStats, recStats, txStats, source });
    } catch (e) {
      setData({ error: e?.message });
    }
    setLoading(false);
  }

  useEffect(() => { runDiagnostic(); }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>Diagnostic</Text>
          <Pressable onPress={runDiagnostic} disabled={loading}
            style={{ backgroundColor: palette.teal + "22", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: palette.teal + "55" }}>
            {loading ? <ActivityIndicator size="small" color={palette.teal} /> : <Text style={{ fontSize: 13, fontWeight: "700", color: palette.teal }}>Refresh</Text>}
          </Pressable>
        </View>

        {data?.error && (
          <View style={{ backgroundColor: palette.red + "15", borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Text style={{ color: palette.red, fontSize: 13 }}>{data.error}</Text>
          </View>
        )}

        {data && !data.error && (
          <>
            {/* Android Device */}
            <Section title="Android Device">
              <Row label="Android Version" value={data.deviceInfo?.androidVersion} />
              <Row label="Manufacturer" value={data.deviceInfo?.manufacturer} />
              <Row label="Model" value={data.deviceInfo?.model} />
              <Row label="Platform API" value={Platform.Version} />
            </Section>

            {/* Permissions */}
            <Section title="Permissions">
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Text style={{ fontSize: 12, color: theme.muted }}>READ_PHONE_STATE</Text>
                <Badge label={data.simPerm?.READ_PHONE_STATE ? "GRANTED" : "DENIED"} ok={data.simPerm?.READ_PHONE_STATE} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Text style={{ fontSize: 12, color: theme.muted }}>READ_PHONE_NUMBERS</Text>
                <Badge label={data.simPerm?.READ_PHONE_NUMBERS ? "GRANTED" : "DENIED"} ok={data.simPerm?.READ_PHONE_NUMBERS} />
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: 1, borderTopColor: theme.border }}>
                <Text style={{ fontSize: 12, color: theme.muted }}>READ_CALL_LOG</Text>
                <Badge label={data.perms?.callLog ? "GRANTED" : "DENIED"} ok={data.perms?.callLog} />
              </View>
            </Section>

            {/* SIM Inventory */}
            <Section title={`SIM Inventory (${data.sims?.length ?? 0} detected)`}>
              <Row label="Active SIM count" value={data.simCount?.count ?? "—"} valueColor={data.simCount?.count > 0 ? palette.emerald : palette.red} />
              {data.sims?.length === 0 && (
                <Text style={{ fontSize: 12, color: palette.amber, marginTop: 8 }}>No SIMs detected. Check READ_PHONE_STATE permission.</Text>
              )}
              {data.sims?.map((s, i) => (
                <View key={i} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: palette.teal + "44" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: palette.teal }}>SIM {s.display_slot ?? (s.slot + 1)}</Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Badge label={s.isActive ? "ACTIVE" : "INACTIVE"} ok={s.isActive} />
                      <View style={{ backgroundColor: palette.violet + "22", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: palette.violet }}>{s._source === "android_subscription_manager" ? "NATIVE" : "FALLBACK"}</Text>
                      </View>
                    </View>
                  </View>
                  {[
                    ["slotIndex", s.slot],
                    ["subscriptionId", s.subscriptionId ?? "—"],
                    ["carrier", s.carrierName ?? "—"],
                    ["phoneNumber", s.phoneNumber ?? "Not available"],
                    ["MCC", s.mcc ?? "—"],
                    ["MNC", s.mnc ?? "—"],
                    ["country", s.countryIso?.toUpperCase() ?? "—"],
                    ["network", s.networkType ?? "—"],
                  ].map(([label, value]) => (
                    <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: 1, borderTopColor: theme.border }}>
                      <Text style={{ fontSize: 11, color: theme.muted }}>{label}</Text>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: theme.primary }}>{String(value)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </Section>

            {/* Selected SIM */}
            <Section title="Selected SIM">
              {data.selection?.subscriptionId || data.selection?.slot !== null ? (
                <>
                  <Row label="subscriptionId" value={data.selection.subscriptionId ?? "—"} valueColor={palette.teal} />
                  <Row label="slot (0-indexed)" value={data.selection.slot ?? "—"} />
                  <Row label="carrier" value={data.selection.carrier ?? "—"} />
                </>
              ) : (
                <Text style={{ fontSize: 12, color: palette.amber }}>No SIM selected — all calls will sync.</Text>
              )}
            </Section>

            {/* Call Log */}
            <Section title="Call Log (last 7 days)">
              <Row label="Total Android calls" value={data.callStats.total} />
              <Row label="Eligible (selected SIM)" value={data.callStats.eligible} valueColor={palette.emerald} />
              <Row label="Calls with unknown SIM" value={data.callStats.unknownSim} valueColor={data.callStats.unknownSim > 0 ? palette.amber : theme.muted} />
              <Row label="Incoming" value={data.callStats.incoming} />
              <Row label="Outgoing" value={data.callStats.outgoing} />
              <Row label="Missed" value={data.callStats.missed} />
              <Row label="Rejected" value={data.callStats.rejected} />
            </Section>

            {/* Sync */}
            <Section title="Sync">
              <Row label="Queued" value={data.syncStats.queued} valueColor={palette.amber} />
              <Row label="Syncing" value={data.syncStats.syncing} valueColor={palette.violet} />
              <Row label="Synced" value={data.syncStats.synced} valueColor={palette.emerald} />
              <Row label="Failed" value={data.syncStats.failed} valueColor={data.syncStats.failed > 0 ? palette.red : theme.muted} />
            </Section>

            {/* Recording */}
            <Section title="Recording">
              <Row label="Available" value={data.recStats.available} />
              <Row label="Unavailable" value={data.recStats.unavailable} />
              <Row label="Queued" value={data.recStats.queued} valueColor={palette.amber} />
              <Row label="Uploaded" value={data.recStats.uploaded} valueColor={palette.emerald} />
              <Row label="Failed" value={data.recStats.failed} valueColor={data.recStats.failed > 0 ? palette.red : theme.muted} />
            </Section>

            {/* Transcription */}
            <Section title="Transcription">
              <Row label="Pending" value={data.txStats.pending} valueColor={palette.amber} />
              <Row label="Processing" value={data.txStats.processing} valueColor={palette.violet} />
              <Row label="Completed" value={data.txStats.completed} valueColor={palette.emerald} />
              <Row label="Failed" value={data.txStats.failed} valueColor={data.txStats.failed > 0 ? palette.red : theme.muted} />
            </Section>

            {/* Source */}
            <Section title="Source">
              <Text style={{ fontSize: 12, color: NativeModules.CallLogModule ? palette.emerald : palette.amber, fontWeight: "700" }}>
                {data.source}
              </Text>
            </Section>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * diagnostic.jsx — TASK 5: Android Call Log Diagnostic Screen
 *
 * Access: Settings tab → "Call Log Diagnostic" (dev/admin only)
 * Shows real permission state, raw provider results, and comparison.
 * Never exposes full phone numbers in production.
 */
import { useState } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { palette, useTheme } from "../src/theme";
import {
  checkCallLogPermissionReal,
  queryCallLogDirect,
  runCallLogComparison,
  ANDROID_CALL_TYPES,
} from "../src/callLogDiagnostic";

function mask(num) {
  if (!num) return "—";
  const s = String(num);
  return s.length > 4 ? "***" + s.slice(-4) : "****";
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
  const [permResult, setPermResult] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [compareResult, setCompareResult] = useState(null);
  const [activeTest, setActiveTest] = useState("");

  const card = { backgroundColor: theme.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 12 };
  const row  = { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 5, borderTopWidth: 1, borderTopColor: theme.border };
  const lbl  = { fontSize: 12.5, color: theme.muted };
  const val  = { fontSize: 12.5, fontWeight: "600", color: theme.primary, flex: 1, textAlign: "right" };

  async function checkPerms() {
    setLoading(true); setActiveTest("perms");
    const r = await checkCallLogPermissionReal();
    setPermResult(r);
    setLoading(false); setActiveTest("");
  }

  async function readLatest20() {
    setLoading(true); setActiveTest("latest20");
    const r = await queryCallLogDirect({ limitDays: 90, maxRecords: 20 });
    setQueryResult(r);
    setLoading(false); setActiveTest("");
  }

  async function read90Days() {
    setLoading(true); setActiveTest("90days");
    const r = await queryCallLogDirect({ limitDays: 90, maxRecords: 100 });
    setQueryResult(r);
    setLoading(false); setActiveTest("");
  }

  async function runFullTest() {
    setLoading(true); setActiveTest("full");
    const [perm, query, compare] = await Promise.all([
      checkCallLogPermissionReal(),
      queryCallLogDirect({ limitDays: 90, maxRecords: 20 }),
      runCallLogComparison(7),
    ]);
    setPermResult(perm);
    setQueryResult(query);
    setCompareResult(compare);
    setLoading(false); setActiveTest("");
  }

  const BtnRow = ({ label, testKey, onPress, color = palette.teal }) => (
    <Pressable onPress={onPress} disabled={loading}
      style={{ backgroundColor: color + "22", borderRadius: 11, padding: 13, borderWidth: 1, borderColor: color + "55", flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
      {loading && activeTest === testKey
        ? <ActivityIndicator size="small" color={color} />
        : <Ionicons name="play-circle-outline" size={18} color={color} />}
      <Text style={{ fontSize: 13.5, fontWeight: "700", color }}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary, marginBottom: 4 }}>
          Android Call Log Diagnostic
        </Text>
        <Text style={{ fontSize: 12, color: theme.muted, marginBottom: 16 }}>
          Provider: CallLog.Calls.CONTENT_URI
        </Text>

        {/* Buttons */}
        <BtnRow label="CHECK PERMISSIONS"    testKey="perms"   onPress={checkPerms}  color={palette.teal} />
        <BtnRow label="READ LATEST 20"       testKey="latest20" onPress={readLatest20} color={palette.violet} />
        <BtnRow label="READ LAST 90 DAYS"    testKey="90days"  onPress={read90Days}  color={palette.cyan} />
        <BtnRow label="RUN FULL CALL LOG TEST" testKey="full"  onPress={runFullTest} color={palette.amber} />

        {/* Permission result */}
        {permResult && (
          <View style={card}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary, marginBottom: 8 }}>Permission</Text>
            {[
              { label: "READ_CALL_LOG",    ok: permResult.READ_CALL_LOG },
              { label: "READ_PHONE_STATE", ok: permResult.READ_PHONE_STATE },
              { label: "READ_CONTACTS",    ok: permResult.READ_CONTACTS },
            ].map((p) => (
              <View key={p.label} style={row}>
                <Text style={lbl}>{p.label}</Text>
                <Badge label={p.ok ? "GRANTED" : "DENIED"} ok={p.ok} />
              </View>
            ))}
            <View style={row}><Text style={lbl}>Package</Text><Text style={val}>{permResult.packageName}</Text></View>
            <View style={row}><Text style={lbl}>Android API</Text><Text style={val}>{permResult.androidApiLevel}</Text></View>
            <View style={row}><Text style={lbl}>Manufacturer</Text><Text style={val}>{permResult.manufacturer}</Text></View>
            <View style={row}><Text style={lbl}>Model</Text><Text style={val}>{permResult.model}</Text></View>
            {!permResult.READ_CALL_LOG && (
              <Pressable onPress={() => Linking.openSettings()}
                style={{ marginTop: 10, backgroundColor: palette.red + "22", borderRadius: 9, padding: 10, alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: palette.red }}>Open App Settings to Grant Permission</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Query result */}
        {queryResult && (
          <View style={card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary }}>Provider Result</Text>
              <Badge label={queryResult.success ? "SUCCESS" : "FAILED"} ok={queryResult.success} />
            </View>
            <View style={row}><Text style={lbl}>Permission granted</Text><Badge label={queryResult.permissionGranted ? "YES" : "NO"} ok={queryResult.permissionGranted} /></View>
            <View style={row}><Text style={lbl}>Records found</Text><Text style={[val, { color: queryResult.count > 0 ? palette.emerald : palette.red }]}>{queryResult.count}</Text></View>
            {queryResult.source && <View style={row}><Text style={lbl}>Source</Text><Text style={[val, { color: queryResult.source === "native_kotlin_module" ? palette.emerald : palette.amber }]}>{queryResult.source}</Text></View>}
            {queryResult.latestDate && <View style={row}><Text style={lbl}>Latest date</Text><Text style={val}>{queryResult.latestDate}</Text></View>}
            {queryResult.error && (
              <View style={{ backgroundColor: palette.red + "15", borderRadius: 9, padding: 10, marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: palette.red, fontWeight: "700" }}>Error: {queryResult.errorCode}</Text>
                <Text style={{ fontSize: 11.5, color: palette.red, marginTop: 4 }}>{queryResult.error}</Text>
              </View>
            )}
            {queryResult.attempts && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: theme.muted, marginBottom: 4 }}>API form attempts:</Text>
                {queryResult.attempts.map((a, i) => (
                  <Text key={i} style={{ fontSize: 11, color: a.success ? palette.emerald : palette.red }}>
                    {a.form}: {a.success ? "OK count=" + (a.count ?? a.filteredCount) : "FAIL " + (a.error || "")}
                  </Text>
                ))}
              </View>
            )}

            {/* Latest 20 records */}
            {queryResult.records?.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: theme.primary, marginBottom: 8 }}>
                  Latest {queryResult.records.length} records
                </Text>
                {queryResult.records.map((r, i) => (
                  <View key={i} style={{ backgroundColor: theme.surface, borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: theme.border }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: theme.primary }}>#{r._id}</Text>
                      <View style={{ backgroundColor: (r.typeName === "MISSED" ? palette.red : r.typeName === "OUTGOING" ? palette.violet : palette.teal) + "22", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: r.typeName === "MISSED" ? palette.red : r.typeName === "OUTGOING" ? palette.violet : palette.teal }}>{r.typeName}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 3 }}>
                      {mask(r.number)} · {r.durationSec}s · {r.dateISO?.slice(0, 16).replace("T", " ")}
                    </Text>
                    {r.cachedName && <Text style={{ fontSize: 11, color: theme.dim }}>{r.cachedName}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Comparison result */}
        {compareResult && (
          <View style={card}>
            <Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary, marginBottom: 8 }}>Layer Comparison (7 days)</Text>
            <View style={row}><Text style={lbl}>Native provider count</Text><Text style={[val, { color: compareResult.nativeProviderCount > 0 ? palette.emerald : palette.red }]}>{compareResult.nativeProviderCount}</Text></View>
            <View style={row}><Text style={lbl}>callLogService count</Text><Text style={[val, { color: compareResult.callLogServiceCount > 0 ? palette.emerald : palette.red }]}>{compareResult.callLogServiceCount}</Text></View>
            <View style={row}><Text style={lbl}>IDs matched</Text><Text style={val}>{compareResult.idMatch?.length ?? 0}</Text></View>
            <View style={row}><Text style={lbl}>IDs missing in service</Text><Text style={[val, { color: compareResult.idMismatch?.length > 0 ? palette.red : palette.emerald }]}>{compareResult.idMismatch?.length ?? 0}</Text></View>
            <View style={{ backgroundColor: theme.surface, borderRadius: 9, padding: 10, marginTop: 8, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: theme.primary }}>Diagnosis:</Text>
              <Text style={{ fontSize: 12, color: theme.muted, marginTop: 4, lineHeight: 18 }}>{compareResult.diagnosis}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


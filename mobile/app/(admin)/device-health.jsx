import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { adminTheme, adminPalette, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

const C = adminTheme;

const STATUS = {
  healthy: { label: "Healthy", color: "#22C55E", soft: "#F0FDF4" },
  warning: { label: "Warning", color: "#F59E0B", soft: "#FFFBEB" },
  stale:   { label: "Stale",   color: "#F59E0B", soft: "#FFFBEB" },
  offline: { label: "Offline", color: "#EF4444", soft: "#FEF2F2" },
};

function relTime(iso) {
  if (!iso) return "Never";
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 10)  return "Just now";
  if (s < 60)  return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

function BatteryBar({ level }) {
  const color = level < 20 ? "#EF4444" : level < 40 ? "#F59E0B" : "#22C55E";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: C.border, overflow: "hidden" }}>
        <View style={{ width: `${level}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: "700", color, minWidth: 36 }}>{level}%</Text>
    </View>
  );
}

function PermRow({ status, label, desc, isLast }) {
  const granted = status === true;
  const unknown = status === null || status === undefined;
  const color = granted ? "#22C55E" : unknown ? C.muted : "#EF4444";
  const icon  = granted ? "checkmark-circle" : unknown ? "help-circle" : "close-circle";
  const text  = granted ? "Granted" : unknown ? "Unknown" : "Denied";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10,
      borderBottomWidth: isLast ? 0 : 1, borderBottomColor: C.border }}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: color + "22",
        alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, fontWeight: "600", color: C.primary }}>{label}</Text>
        {desc && <Text style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{desc}</Text>}
      </View>
      <Text style={{ fontSize: 11.5, fontWeight: "700", color }}>{text}</Text>
    </View>
  );
}

// ── Device Detail Sheet ───────────────────────────────────────────────────────
function DeviceDetailSheet({ device, onClose }) {
  if (!device) return null;
  const s = STATUS[device.status] || STATUS.offline;
  const perms = device.permissions || {};
  const allOk = perms.callLog && perms.phoneState && perms.contacts && perms.recording;

  return (
    <Modal visible={!!device} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose} />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        maxHeight: "92%" }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.border,
          alignSelf: "center", marginTop: 10 }} />

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>

          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: s.soft,
                alignItems: "center", justifyContent: "center", position: "relative" }}>
                <Ionicons name="phone-portrait-outline" size={28} color={s.color} />
                <View style={{ position: "absolute", bottom: 2, right: 2, width: 12, height: 12,
                  borderRadius: 6, backgroundColor: device.is_online ? "#22C55E" : "#EF4444",
                  borderWidth: 2, borderColor: C.card }} />
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: C.primary }}>{device.employee}</Text>
                <Text style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{device.device}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <View style={{ backgroundColor: s.soft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: s.color }}>{s.label}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3,
                      backgroundColor: device.is_online ? "#22C55E" : "#EF4444" }} />
                    <Text style={{ fontSize: 11, color: device.is_online ? "#22C55E" : "#EF4444", fontWeight: "600" }}>
                      {device.is_online ? "Online" : "Offline"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12}
              style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: C.surface2,
                alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={C.muted} />
            </Pressable>
          </View>

          {/* Permission warning */}
          {!allOk && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12,
              backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, marginBottom: 16,
              borderWidth: 1, borderColor: "#F59E0B44" }}>
              <Ionicons name="warning-outline" size={18} color="#F59E0B" />
              <Text style={{ fontSize: 12, color: C.secondary, flex: 1, lineHeight: 18 }}>
                Missing required permissions. Ask employee to open app and grant them.
              </Text>
            </View>
          )}

          {/* Stats grid */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Last Seen",    value: relTime(device.lastSeenAt) },
              { label: "App Version",  value: device.appVersion || "—" },
              { label: "Android",      value: device.android || "—" },
            ].map(s => (
              <View key={s.label} style={{ flex: 1, backgroundColor: C.surface2, borderRadius: 12, padding: 12 }}>
                <Text style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</Text>
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.primary }}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Battery */}
          <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 14,
            borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="battery-half-outline" size={16} color={C.muted} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.primary }}>Battery</Text>
              </View>
              {device.battery < 20 && (
                <View style={{ backgroundColor: "#FEF2F2", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444" }}>⚠ Low</Text>
                </View>
              )}
            </View>
            <BatteryBar level={device.battery || 0} />
          </View>

          {/* Permissions */}
          <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 14,
            borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <Ionicons name={allOk ? "shield-checkmark" : "shield-outline"} size={16}
                color={allOk ? "#22C55E" : "#F59E0B"} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.primary }}>Permissions</Text>
            </View>
            <PermRow status={perms.callLog}    label="Call Log"    desc="Read device call history" />
            <PermRow status={perms.phoneState} label="Phone State" desc="Detect active calls" />
            <PermRow status={perms.contacts}   label="Contacts"    desc="Match numbers to names" />
            <PermRow status={perms.recording}  label="Recordings"  desc="Access call recordings" isLast />
          </View>

          {/* SIM info */}
          {device.sims && device.sims.length > 0 && (
            <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 14,
              borderWidth: 1, borderColor: C.border }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Ionicons name="phone-portrait-outline" size={15} color={C.muted} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: C.primary }}>SIM Configuration</Text>
                <Text style={{ fontSize: 11, color: C.dim, marginLeft: "auto" }}>{device.sims.length} SIM{device.sims.length > 1 ? "s" : ""}</Text>
              </View>
              {device.sims.map((sim, i) => (
                <View key={sim.id || i} style={{ padding: 10, borderRadius: 8, marginBottom: i < device.sims.length - 1 ? 8 : 0,
                  backgroundColor: sim.is_selected ? "#F0FDF4" : C.surface2,
                  borderWidth: 1, borderColor: sim.is_selected ? "#22C55E44" : C.border }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    {sim.is_selected && <Ionicons name="checkmark-circle" size={14} color="#22C55E" />}
                    <Text style={{ fontSize: 13, fontWeight: "600", color: C.primary, flex: 1 }}>
                      {sim.display_name || sim.carrier || `SIM ${(sim.slot || 0) + 1}`}
                    </Text>
                    {sim.is_selected && (
                      <View style={{ backgroundColor: "#22C55E22", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#22C55E" }}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                  {sim.phone_number && <Text style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>📱 {sim.phone_number}</Text>}
                </View>
              ))}
            </View>
          )}

          {/* Device info */}
          <View style={{ backgroundColor: C.card, borderRadius: 14, padding: 16,
            borderWidth: 1, borderColor: C.border }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name="hardware-chip-outline" size={15} color={C.muted} />
              <Text style={{ fontSize: 13, fontWeight: "600", color: C.primary }}>Device Info</Text>
            </View>
            {[
              ["Model",      device.device],
              ["Android",    device.android],
              ["App",        device.appVersion],
              ["SIM",        device.sim],
              ["Device ID",  device.id?.slice(0, 16) + "…"],
            ].map(([k, v], i, arr) => (
              <View key={k} style={{ flexDirection: "row", justifyContent: "space-between",
                paddingVertical: 8, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                <Text style={{ fontSize: 13, color: C.muted }}>{k}</Text>
                <Text style={{ fontSize: 13, fontWeight: "500", color: C.primary, maxWidth: "60%", textAlign: "right" }} numberOfLines={1}>{v || "—"}</Text>
              </View>
            ))}
          </View>

        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Device Row ────────────────────────────────────────────────────────────────
function DeviceRow({ device, onPress, isLast }) {
  const s = STATUS[device.status] || STATUS.offline;
  return (
    <Pressable onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center",
        backgroundColor: pressed ? C.surface2 : C.card,
        paddingHorizontal: 16, paddingVertical: 13,
        borderBottomWidth: isLast ? 0 : 1, borderBottomColor: C.border,
      })}>
      {/* Status bar */}
      <View style={{ width: 4, height: 44, borderRadius: 4, backgroundColor: s.color, marginRight: 12 }} />

      {/* Icon */}
      <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: s.soft,
        alignItems: "center", justifyContent: "center", marginRight: 12, position: "relative" }}>
        <Ionicons name="phone-portrait-outline" size={20} color={s.color} />
        <View style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10,
          borderRadius: 5, backgroundColor: device.is_online ? "#22C55E" : "#EF4444",
          borderWidth: 2, borderColor: C.card }} />
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: C.primary }} numberOfLines={1}>{device.employee}</Text>
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 1 }} numberOfLines={1}>{device.device}</Text>
        <Text style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{relTime(device.lastSeenAt)}</Text>
      </View>

      {/* Right */}
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <View style={{ backgroundColor: s.soft, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: s.color }}>{s.label}</Text>
        </View>
        <Text style={{ fontSize: 11, color: device.battery < 20 ? "#EF4444" : C.muted }}>
          🔋 {device.battery || 0}%
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={14} color={C.dim} style={{ marginLeft: 6 }} />
    </Pressable>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDeviceHealth() {
  const [devices, setDevices]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected]   = useState(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.getDevices();
      const raw = Array.isArray(res) ? res : res?.items || [];
      const mapped = raw.map(d => {
        const perms = d.permissions_status || {};
        const allOk = perms.callLog && perms.phoneState;
        const diff  = d.last_seen_at ? Date.now() - new Date(d.last_seen_at).getTime() : null;
        const stale = diff !== null && diff > 30 * 60 * 1000; // 30 min
        const status = !d.is_online ? "offline" : stale ? "stale" : !allOk ? "warning" : "healthy";
        return {
          id:          d.id,
          employee:    d.employee_name || d.employee_id || "—",
          device:      d.model || "Unknown",
          android:     d.android_version || "—",
          appVersion:  d.app_version || "—",
          battery:     d.battery_level ?? 0,
          lastSeenAt:  d.last_seen_at,
          is_online:   d.is_online,
          status,
          sim:         "SIM 1",
          sims:        d.sims || [],
          permissions: {
            callLog:    perms.callLog    ?? perms.call_log    ?? null,
            phoneState: perms.phoneState ?? perms.phone_state ?? null,
            contacts:   perms.contacts   ?? null,
            recording:  perms.recording  ?? perms.storage     ?? null,
          },
        };
      });
      setDevices(mapped);
    } catch (e) { console.warn("DeviceHealth:", e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    healthy: devices.filter(d => d.status === "healthy").length,
    warning: devices.filter(d => d.status === "warning" || d.status === "stale").length,
    offline: devices.filter(d => d.status === "offline").length,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
        borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.card }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: C.primary }}>Device Health</Text>
          <Pressable onPress={() => load(true)}
            style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: C.surface2,
              alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border }}>
            <Ionicons name="refresh-outline" size={18} color={C.muted} />
          </Pressable>
        </View>

        {/* Summary pills */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { key: "healthy", label: "Healthy", color: "#22C55E" },
            { key: "warning", label: "Warning", color: "#F59E0B" },
            { key: "offline", label: "Offline", color: "#EF4444" },
          ].map(s => (
            <View key={s.key} style={{ backgroundColor: s.color + "18", borderRadius: 8,
              paddingHorizontal: 12, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: s.color }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: s.color }}>{counts[s.key]} {s.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={adminPalette.primary} size="large" />
          <Text style={{ color: C.muted, marginTop: 12, fontSize: 13 }}>Loading devices…</Text>
        </View>
      ) : (
        <View style={{ flex: 1, marginHorizontal: SPACE.lg, marginTop: SPACE.md,
          backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: "hidden" }}>
          {devices.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 60 }}>
              <Ionicons name="phone-portrait-outline" size={48} color={C.dim} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: C.secondary, marginTop: 12 }}>No devices registered</Text>
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 6, textAlign: "center" }}>
                Employees register their device when they first log in.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={adminPalette.primary} />}
              contentContainerStyle={{ paddingBottom: 120 }}>
              {devices.map((d, i) => (
                <DeviceRow key={d.id} device={d} onPress={() => setSelected(d)} isLast={i === devices.length - 1} />
              ))}
            </ScrollView>
          )}
        </View>
      )}

      <DeviceDetailSheet device={selected} onClose={() => setSelected(null)} />
    </SafeAreaView>
  );
}

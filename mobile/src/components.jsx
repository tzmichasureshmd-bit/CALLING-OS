import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, Image, Modal, ScrollView } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "./theme";
import { getInAppNotifications, markAllRead } from "./notificationStore";

// ---- Logo — uses real Os_logo.png ----
export function Logo({ size = 19 }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Image
        source={require("../assets/logo.png")}
        style={{ width: size + 14, height: size + 14, borderRadius: 10 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: 0.3, color: theme.primary }}>
        Call<Text style={{ color: palette.teal }}>Nexa</Text>
      </Text>
    </View>
  );
}

// ---- Notification Panel ----
function NotifPanel({ visible, onClose, onRead }) {
  const { theme } = useTheme();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getInAppNotifications()
      .then((items) => { if (!cancelled) setNotifs(items); })
      .catch(() => { if (!cancelled) setNotifs([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible]);

  async function handleClose() {
    await markAllRead().catch(() => {});
    onRead?.();
    onClose();
  }

  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }

  const typeColor = {
    call_completed:          palette.teal,
    call_synced:             palette.emerald,
    recording_uploaded:      palette.violet,
    transcription_completed: palette.cyan,
    sync_failed:             palette.red,
    missed_call:             palette.red,
  };

  const typeIcon = {
    call_completed:          "call-outline",
    call_synced:             "cloud-done-outline",
    recording_uploaded:      "mic-outline",
    transcription_completed: "sparkles-outline",
    sync_failed:             "alert-circle-outline",
    missed_call:             "call-outline",
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={handleClose}>
        <View style={{ position: "absolute", top: 90, right: 16, left: 16, backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, maxHeight: 480, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary }}>Notifications</Text>
            <Pressable onPress={handleClose}><Ionicons name="close" size={22} color={theme.muted} /></Pressable>
          </View>
          <ScrollView>
            {loading ? (
              <Text style={{ textAlign: "center", color: theme.muted, padding: 32 }}>Loading...</Text>
            ) : notifs.length === 0 ? (
              <View style={{ alignItems: "center", padding: 40, gap: 10 }}>
                <Ionicons name="notifications-off-outline" size={36} color={theme.dim} />
                <Text style={{ fontSize: 14, color: theme.muted }}>No notifications yet</Text>
              </View>
            ) : notifs.map((n) => {
              const color = typeColor[n.type] || palette.teal;
              const icon  = typeIcon[n.type]  || "notifications-outline";
              return (
                <View key={n.id} style={{
                  flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14,
                  borderBottomWidth: 1, borderBottomColor: theme.border,
                  backgroundColor: n.read ? "transparent" : color + "08",
                }}>
                  <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ionicons name={icon} size={18} color={color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 13.5, fontWeight: n.read ? "600" : "700", color: theme.primary, flex: 1 }} numberOfLines={1}>{n.title}</Text>
                      {!n.read && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />}
                    </View>
                    <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2, lineHeight: 17 }}>{n.message}</Text>
                    <Text style={{ fontSize: 11, color: theme.dim, marginTop: 3 }}>{relTime(n.timestamp)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---- Connection Status Hook ----
// Module-level cache so all AppHeader instances share one check — no duplicate fetches
let _connStatus = "connected";
let _connListeners = [];
let _connTimer = null;
let _connFailCount = 0;
let _connStarted = false;

function _startConnCheck() {
  if (_connStarted) return;
  _connStarted = true;
  async function check() {
    try {
      const BASE = process.env.EXPO_PUBLIC_API_URL || "https://api.callingos.tzmicha.com/api/v1";
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(BASE.replace("/api/v1", "") + "/health", { signal: ctrl.signal });
      clearTimeout(t);
      _connFailCount = 0;
      const next = res.ok ? "connected" : "disconnected";
      if (next !== _connStatus) { _connStatus = next; _connListeners.forEach(fn => fn(next)); }
    } catch {
      _connFailCount++;
      if (_connFailCount >= 2) {
        const next = "disconnected";
        if (next !== _connStatus) { _connStatus = next; _connListeners.forEach(fn => fn(next)); }
      }
    }
    _connTimer = setTimeout(check, 120000); // 2 min — not 90s
  }
  check();
}

function useConnectionStatus() {
  const [status, setStatus] = useState(_connStatus);
  useEffect(() => {
    _startConnCheck();
    _connListeners.push(setStatus);
    return () => { _connListeners = _connListeners.filter(fn => fn !== setStatus); };
  }, []);
  return status;
}

// ---- Header ----
export function AppHeader({ title, subtitle, right, showStatus = true }) {
  const { theme } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(0);
  const connStatus = useConnectionStatus();

  const connMeta = {
    connected:    { color: palette.emerald, bg: palette.emerald + "22", label: "Connected",    dot: palette.emerald },
    disconnected: { color: palette.red,     bg: palette.red     + "22", label: "No Internet",  dot: palette.red     },
  };
  const cm = connMeta[connStatus];

  useEffect(() => {
    let cancelled = false;
    getInAppNotifications()
      .then((items) => {
        if (!cancelled) setUnread(items.filter(n => !n.read).length);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12, backgroundColor: theme.surface }}>
        <View>
          {title ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary }}>{title}</Text>
              {subtitle ? <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>{subtitle}</Text> : null}
            </>
          ) : <Logo />}
          {!title && <Text style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>{today}</Text>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {right}
          {showStatus && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: cm.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cm.dot }} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: cm.color }}>{cm.label}</Text>
            </View>
          )}
          <Pressable onPress={() => setShowNotifs(true)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }} accessibilityLabel="Notifications">
            <Ionicons name="notifications-outline" size={22} color={theme.secondary} />
            {unread > 0 && (
              <View style={{ position: "absolute", top: -6, right: -8, backgroundColor: palette.red, borderRadius: 9, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "700" }}>{unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <NotifPanel visible={showNotifs} onClose={() => setShowNotifs(false)} onRead={() => setUnread(0)} />
    </>
  );
}

export function Delta({ value }) {
  const { theme } = useTheme();
  if (value == null) return null;
  const up = value >= 0;
  return <Text style={{ fontSize: 11, fontWeight: "700", color: up ? theme.success : theme.danger }}>{up ? "▲" : "▼"} {Math.abs(value)}%</Text>;
}

export function SectionRow({ title, right }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary }}>{title}</Text>
      {right}
    </View>
  );
}

export function RangeChip({ label, onPress }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 6 }}>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.secondary }}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={theme.muted} />
    </Pressable>
  );
}

export function Card({ children, style }) {
  const { theme, shadowSoft } = useTheme();
  return <View style={[{ backgroundColor: theme.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.border }, shadowSoft, style]}>{children}</View>;
}

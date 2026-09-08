import { useState, useEffect } from "react";
import { View, Text, Pressable, Image, Modal, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "./theme";
import { api } from "./api";

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
function NotifPanel({ visible, onClose }) {
  const { theme } = useTheme();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    // Pull last 20 calls as notification feed
    api.getCalls({ page_size: 20 })
      .then((res) => {
        const items = (res.items || []).map((c) => ({
          id: c.id,
          type: c.call_type,
          title: c.call_type === "missed"
            ? `Missed call from ${c.contact_name || c.phone_number}`
            : `${c.call_type === "incoming" ? "Incoming" : "Outgoing"} · ${c.contact_name || c.phone_number}`,
          sub: `${c.source || "SIM 1"} · ${fmtDur(c.duration_seconds)} · ${relTime(c.start_time)}`,
          tone: c.call_type === "missed" ? "danger" : c.call_type === "incoming" ? "success" : "info",
        }));
        setNotifs(items);
      })
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, [visible]);

  function fmtDur(s) {
    if (!s) return "0s";
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }
  function relTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.floor(m / 60)}h ago`;
    return `${Math.floor(m / 1440)}d ago`;
  }

  const toneColor = { danger: palette.red, success: palette.emerald, info: palette.teal };
  const toneIcon  = { danger: "call-outline", success: "call-outline", info: "arrow-up-outline" };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }} onPress={onClose}>
        <View style={{ position: "absolute", top: 90, right: 16, left: 16, backgroundColor: theme.card, borderRadius: 20, borderWidth: 1, borderColor: theme.border, maxHeight: 480, overflow: "hidden" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
            <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary }}>Recent Calls</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color={theme.muted} /></Pressable>
          </View>
          <ScrollView>
            {loading ? (
              <Text style={{ textAlign: "center", color: theme.muted, padding: 32 }}>Loading...</Text>
            ) : notifs.length === 0 ? (
              <Text style={{ textAlign: "center", color: theme.muted, padding: 32 }}>No recent calls</Text>
            ) : notifs.map((n) => (
              <View key={n.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: n.tone === "danger" ? palette.red + "08" : "transparent" }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: toneColor[n.tone] + "22", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={toneIcon[n.tone]} size={18} color={toneColor[n.tone]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: n.tone === "danger" ? "700" : "600", color: n.tone === "danger" ? palette.red : theme.primary }} numberOfLines={1}>{n.title}</Text>
                  <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2 }}>{n.sub}</Text>
                </View>
                {n.tone === "danger" && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: palette.red }} />}
              </View>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

// ---- Connection Status Hook ----
// Shows whether the backend sync is reachable — not internet connectivity.
// App always works offline (local call log). Only shows "Offline" if backend unreachable.
function useConnectionStatus() {
  const [status, setStatus] = useState("connected");

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function check() {
      try {
        const BASE = process.env.EXPO_PUBLIC_API_URL || "https://api.callingos.tzmicha.com/api/v1";
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const res = await fetch(BASE.replace("/api/v1", "") + "/health", { signal: ctrl.signal });
        clearTimeout(t);
        if (!cancelled) setStatus(res.ok ? "connected" : "disconnected");
      } catch {
        if (!cancelled) setStatus("disconnected");
      }
      if (!cancelled) timer = setTimeout(check, 60000); // re-check every 60s only
    }

    check();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  return status;
}

// ---- Header ----
export function AppHeader({ title, subtitle, right }) {
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
    api.getCalls({ page_size: 5 })
      .then((res) => {
        const missed = (res.items || []).filter((c) => c.call_type === "missed").length;
        setUnread(missed);
      })
      .catch(() => {});
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          {right}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: cm.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: cm.dot }} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: cm.color }}>{cm.label}</Text>
          </View>
          <Pressable onPress={() => setShowNotifs(true)}>
            <Ionicons name="notifications-outline" size={22} color={theme.secondary} />
            {unread > 0 && (
              <View style={{ position: "absolute", top: -6, right: -8, backgroundColor: palette.red, borderRadius: 9, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "700" }}>{unread}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
      <NotifPanel visible={showNotifs} onClose={() => setShowNotifs(false)} />
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

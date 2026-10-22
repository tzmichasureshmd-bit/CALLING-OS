import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, Pressable, Image, Modal, ScrollView,
  Animated, Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, gradientBrand, gradientBrandSoft, useTheme, TYPE, SPACE, RADIUS } from "./theme";
import { getInAppNotifications, markAllRead } from "./notificationStore";

// ── Logo ──────────────────────────────────────────────────────────────────────
export function Logo({ size = 19 }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
      <Image
        source={require("../assets/logo.png")}
        style={{ width: size + 14, height: size + 14, borderRadius: RADIUS.sm }}
        resizeMode="contain"
      />
      <Text style={{ ...TYPE.h3, color: theme.primary }}>
        Call<Text style={{ color: palette.teal }}>Nexa</Text>
      </Text>
    </View>
  );
}

// ── Badge — matches web Badge component ──────────────────────────────────────
export function Badge({ children, tone = "neutral", dot = false, style }) {
  const { theme } = useTheme();
  const tones = {
    neutral: { bg: theme.surface2,                  fg: theme.muted,    bd: theme.border },
    teal:    { bg: theme.accentSoft,                fg: theme.accent,   bd: "transparent" },
    violet:  { bg: theme.violetSoft,                fg: theme.accent2,  bd: "transparent" },
    success: { bg: theme.successSoft,               fg: theme.success,  bd: "transparent" },
    danger:  { bg: theme.dangerSoft,                fg: theme.danger,   bd: "transparent" },
    warning: { bg: theme.warningSoft,               fg: theme.warning,  bd: "transparent" },
    info:    { bg: theme.infoSoft,                  fg: theme.info,     bd: "transparent" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <View style={[{
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: SPACE.sm, paddingVertical: 3,
      borderRadius: RADIUS.full,
      backgroundColor: t.bg,
      borderWidth: 1, borderColor: t.bd,
    }, style]}>
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.fg }} />}
      <Text style={{ ...TYPE.label, color: t.fg }}>{children}</Text>
    </View>
  );
}

// ── Animated live dot (matches web .nova-live-dot) ───────────────────────────
export function LiveDot({ color = palette.emerald }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(pulse, { toValue: 1,   duration: 1000, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    ).start();
    return () => pulse.stopAnimation();
  }, []);
  return (
    <Animated.View style={{
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: color,
      opacity: pulse,
      shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4,
    }} />
  );
}

// ── CountUp — matches web CountUp component ───────────────────────────────────
export function CountUp({ value, duration = 700 }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const target = Number(value) || 0;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);
  return <>{display}</>;
}

// ── Skeleton — matches web .nova-skeleton ────────────────────────────────────
export function Skeleton({ width = "100%", height = 14, radius = RADIUS.sm, style }) {
  const { theme } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1400, useNativeDriver: false, easing: Easing.linear })
    ).start();
    return () => shimmer.stopAnimation();
  }, []);
  const bg = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [theme.surface2, theme.elevated || theme.surface, theme.surface2],
  });
  return (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: bg }, style]} />
  );
}

export function SkeletonCard() {
  return (
    <Card style={{ gap: SPACE.md }}>
      <Skeleton width={120} height={12} />
      <Skeleton width="60%" height={28} />
      <Skeleton height={12} />
      <Skeleton width="80%" height={12} />
    </Card>
  );
}

// ── EmptyState — matches web EmptyState ──────────────────────────────────────
export function EmptyState({ icon = "call-outline", title = "Nothing here yet", message, action }) {
  const { theme } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: SPACE.huge, gap: SPACE.md }}>
      <LinearGradient
        colors={gradientBrandSoft}
        style={{ width: 56, height: 56, borderRadius: RADIUS.xl, alignItems: "center", justifyContent: "center" }}
      >
        <Ionicons name={icon} size={26} color={theme.accent} />
      </LinearGradient>
      <Text style={{ ...TYPE.title, color: theme.secondary, textAlign: "center" }}>{title}</Text>
      {message && <Text style={{ ...TYPE.caption, color: theme.muted, textAlign: "center", lineHeight: 20, maxWidth: 280 }}>{message}</Text>}
      {action}
    </View>
  );
}

// ── Card — matches web nova-card ─────────────────────────────────────────────
export function Card({ children, style, padding = SPACE.lg }) {
  const { theme, shadowSoft } = useTheme();
  return (
    <View style={[{
      backgroundColor: theme.card,
      borderRadius: RADIUS.xl,
      borderWidth: 1,
      borderColor: theme.border,
      padding,
    }, shadowSoft, style]}>
      {children}
    </View>
  );
}

// ── CardHeader — matches web CardHeader ──────────────────────────────────────
export function CardHeader({ icon, title, subtitle, action }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: SPACE.lg, gap: SPACE.md }}>
      <View style={{ flexDirection: "row", gap: SPACE.md, alignItems: "center", flex: 1 }}>
        {icon && (
          <LinearGradient
            colors={gradientBrandSoft}
            style={{ width: 34, height: 34, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name={icon} size={17} color={theme.accent} />
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ ...TYPE.title, color: theme.primary }}>{title}</Text>
          {subtitle && <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2 }}>{subtitle}</Text>}
        </View>
      </View>
      {action}
    </View>
  );
}

// ── KpiCard — matches web KpiCard ────────────────────────────────────────────
export function KpiCard({ icon, label, value, sub, tone = "teal", countUp = false, onPress }) {
  const { theme, shadowSoft } = useTheme();
  const COLORS = {
    teal:    palette.teal,
    violet:  palette.violet,
    cyan:    palette.cyan,
    success: palette.emerald,
    warning: palette.amber,
    danger:  palette.red,
    info:    palette.info,
  };
  const color = COLORS[tone] || palette.teal;
  const scale = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  }
  function onPressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={!onPress}>
      <Animated.View style={[{
        backgroundColor: theme.card,
        borderRadius: RADIUS.xl,
        borderWidth: 2,
        borderColor: color,
        padding: SPACE.lg,
        gap: SPACE.md,
        transform: [{ scale }],
      }, shadowSoft]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ ...TYPE.micro, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</Text>
          <View style={{ width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={icon} size={17} color={color} />
          </View>
        </View>
        <Text style={{ fontSize: 30, fontWeight: "700", color: theme.primary, lineHeight: 36 }}>
          {countUp ? <CountUp value={value} /> : value}
        </Text>
        {sub && <Text style={{ ...TYPE.caption, color: theme.dim }}>{sub}</Text>}
      </Animated.View>
    </Pressable>
  );
}

// ── Notification Panel — proper bottom sheet ──────────────────────────────────
function NotifPanel({ visible, onClose, onRead }) {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
      setLoading(true);
      getInAppNotifications()
        .then(setNotifs)
        .catch(() => setNotifs([]))
        .finally(() => setLoading(false));
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
    }
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
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,6,12,0.55)" }} onPress={handleClose} />
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: theme.elevated || theme.surface,
        borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl,
        borderWidth: 1, borderColor: theme.border,
        maxHeight: "78%",
        transform: [{ translateY: slideY }],
        shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.3, shadowRadius: 24, elevation: 20,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong, alignSelf: "center", marginTop: SPACE.md }} />

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACE.lg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
            <Text style={{ ...TYPE.h3, color: theme.primary }}>Notifications</Text>
            {notifs.filter(n => !n.read).length > 0 && (
              <Badge tone="danger">{notifs.filter(n => !n.read).length}</Badge>
            )}
          </View>
          <Pressable onPress={handleClose} hitSlop={12} style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: theme.surface2, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={16} color={theme.muted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: bottom + SPACE.xxl }}>
          {loading ? (
            <View style={{ padding: SPACE.xxl, gap: SPACE.md }}>
              {[1, 2, 3].map(i => <Skeleton key={i} height={56} radius={RADIUS.lg} />)}
            </View>
          ) : notifs.length === 0 ? (
            <EmptyState icon="notifications-off-outline" title="No notifications yet" message="Call events, sync updates, and transcriptions will appear here." />
          ) : notifs.map((n) => {
            const color = typeColor[n.type] || palette.teal;
            const icon  = typeIcon[n.type]  || "notifications-outline";
            return (
              <View key={n.id} style={{
                flexDirection: "row", alignItems: "flex-start", gap: SPACE.md,
                padding: SPACE.lg,
                borderBottomWidth: 1, borderBottomColor: theme.border,
                backgroundColor: n.read ? "transparent" : color + "08",
              }}>
                <View style={{ width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: color + "22", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.sm }}>
                    <Text style={{ ...TYPE.bodyBold, color: theme.primary, flex: 1 }} numberOfLines={1}>{n.title}</Text>
                    {!n.read && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />}
                  </View>
                  <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2, lineHeight: 18 }}>{n.message}</Text>
                  <Text style={{ ...TYPE.micro, color: theme.dim, marginTop: 3 }}>{relTime(n.timestamp)}</Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ── Connection status hook ────────────────────────────────────────────────────
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
    _connTimer = setTimeout(check, 120000);
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

// ── AppHeader — matches web Topbar visual language ────────────────────────────
export function AppHeader({ title, subtitle, right, showStatus = true }) {
  const { theme } = useTheme();
  const [showNotifs, setShowNotifs] = useState(false);
  const [unread, setUnread] = useState(0);
  const connStatus = useConnectionStatus();
  const badgeScale = useRef(new Animated.Value(1)).current;

  const connMeta = {
    connected:    { color: palette.emerald, bg: palette.emerald + "22", label: "Connected",   dot: palette.emerald },
    disconnected: { color: palette.red,     bg: palette.red     + "22", label: "No Internet", dot: palette.red     },
  };
  const cm = connMeta[connStatus];

  const loadUnread = useCallback(() => {
    getInAppNotifications()
      .then((items) => {
        const count = items.filter(n => !n.read).length;
        setUnread(prev => {
          if (count > prev) {
            // Pop animation when new notification arrives
            Animated.sequence([
              Animated.spring(badgeScale, { toValue: 1.4, useNativeDriver: true, speed: 60 }),
              Animated.spring(badgeScale, { toValue: 1,   useNativeDriver: true, speed: 60 }),
            ]).start();
          }
          return count;
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadUnread(); }, [loadUnread]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

  return (
    <>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: SPACE.lg + 2, paddingVertical: SPACE.md,
        backgroundColor: theme.surface,
        borderBottomWidth: 1, borderBottomColor: theme.border,
      }}>
        <View>
          {title ? (
            <>
              <Text style={{ ...TYPE.h2, color: theme.primary }}>{title}</Text>
              {subtitle && <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2 }}>{subtitle}</Text>}
            </>
          ) : <Logo />}
          {!title && <Text style={{ ...TYPE.micro, color: theme.muted, marginTop: 2 }}>{today}</Text>}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md }}>
          {right}

          {/* Connection status pill */}
          {showStatus && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: cm.bg, paddingHorizontal: SPACE.sm + 1, paddingVertical: 4, borderRadius: RADIUS.full }}>
              <LiveDot color={cm.dot} />
              <Text style={{ ...TYPE.micro, color: cm.color }}>{cm.label}</Text>
            </View>
          )}

          {/* Notification bell */}
          <Pressable
            onPress={() => setShowNotifs(true)}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityLabel="Notifications"
            accessibilityRole="button"
          >
            <Ionicons name="notifications-outline" size={22} color={theme.secondary} />
            {unread > 0 && (
              <Animated.View style={{
                position: "absolute", top: -6, right: -8,
                backgroundColor: palette.red,
                borderRadius: RADIUS.full,
                minWidth: 16, height: 16,
                alignItems: "center", justifyContent: "center",
                paddingHorizontal: 4,
                transform: [{ scale: badgeScale }],
              }}>
                <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "700" }}>{unread}</Text>
              </Animated.View>
            )}
          </Pressable>
        </View>
      </View>

      <NotifPanel
        visible={showNotifs}
        onClose={() => setShowNotifs(false)}
        onRead={() => setUnread(0)}
      />
    </>
  );
}

// ── Section header — matches web SectionTitle ─────────────────────────────────
export function SectionHeader({ title, action }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md, paddingHorizontal: 2 }}>
      <Text style={{ ...TYPE.micro, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.8 }}>{title}</Text>
      {action}
    </View>
  );
}

// ── Primary button — matches web Button variant="primary" ────────────────────
export function PrimaryButton({ label, loading, onPress, disabled, icon, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  function onPressIn() { Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start(); }
  function onPressOut() { Animated.spring(scale, { toValue: 1,    useNativeDriver: true, speed: 50 }).start(); }
  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled || loading}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <LinearGradient
          colors={gradientBrand}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 52, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: SPACE.sm, opacity: (disabled || loading) ? 0.7 : 1 }}
        >
          {loading
            ? <Text style={{ color: "#fff", ...TYPE.bodyBold }}>Loading…</Text>
            : <>
                {icon && <Ionicons name={icon} size={18} color="#fff" />}
                <Text style={{ color: "#fff", ...TYPE.bodyBold }}>{label}</Text>
              </>
          }
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

// ── Back-compat exports ───────────────────────────────────────────────────────
export function Delta({ value }) {
  const { theme } = useTheme();
  if (value == null) return null;
  const up = value >= 0;
  return <Text style={{ ...TYPE.label, color: up ? theme.success : theme.danger }}>{up ? "▲" : "▼"} {Math.abs(value)}%</Text>;
}

export function SectionRow({ title, right }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACE.md }}>
      <Text style={{ ...TYPE.h3, color: theme.primary }}>{title}</Text>
      {right}
    </View>
  );
}

export function RangeChip({ label, onPress }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm }}>
      <Text style={{ ...TYPE.caption, color: theme.secondary }}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={theme.muted} />
    </Pressable>
  );
}

/**
 * PostCallPopup.jsx
 *
 * Appears automatically when a call is synced.
 * - 5-minute countdown ring — if user ignores it, auto-dismisses to sync-status page.
 * - Tap "View Details" → call-detail page.
 * - Tap "Dismiss" → closes immediately.
 * - Listens to callStatusStore for new SYNCED entries.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Pressable, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme, TYPE, SPACE, RADIUS, palette } from "./theme";
import { getAllCallStatuses, STATUS } from "./callStatusStore";

const TEAL        = "#0ABFA3";
const TIMEOUT_MS  = 5 * 60 * 1000; // 5 minutes
const POLL_MS     = 2000;           // check for new synced calls every 2s
const TICK_MS     = 1000;           // countdown tick

const CALL_TYPE_ICON = {
  incoming: "call-received",
  outgoing: "call-made",
  missed:   "call-missed",
  rejected: "call-missed",
};
const CALL_TYPE_COLOR = {
  incoming: TEAL,
  outgoing: palette.violet,
  missed:   palette.red,
  rejected: palette.amber,
};

function fmtDur(s) {
  if (!s || s <= 0) return "0:00";
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtCountdown(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function PostCallPopup() {
  const { theme } = useTheme();
  const router    = useRouter();

  const [visible, setVisible]   = useState(false);
  const [call, setCall]         = useState(null);
  const [remaining, setRemaining] = useState(TIMEOUT_MS);

  const seenRef      = useRef(new Set());   // client_event_ids already shown
  const timerRef     = useRef(null);
  const countdownRef = useRef(null);
  const callRef      = useRef(null);

  // Slide-up animation
  const slideY = useRef(new Animated.Value(300)).current;

  function showPopup(entry) {
    setCall(entry);
    callRef.current = entry;
    setRemaining(TIMEOUT_MS);
    setVisible(true);
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }).start();
    startCountdown();
  }

  function dismiss(navigate = false) {
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);
    Animated.timing(slideY, { toValue: 300, duration: 250, easing: Easing.in(Easing.ease), useNativeDriver: true }).start(() => {
      setVisible(false);
      setCall(null);
      if (navigate) router.push("/(employee)/sync-status");
    });
  }

  function startCountdown() {
    clearTimeout(timerRef.current);
    clearInterval(countdownRef.current);

    const endAt = Date.now() + TIMEOUT_MS;

    countdownRef.current = setInterval(() => {
      const left = endAt - Date.now();
      if (left <= 0) {
        clearInterval(countdownRef.current);
        setRemaining(0);
      } else {
        setRemaining(left);
      }
    }, TICK_MS);

    timerRef.current = setTimeout(() => {
      clearInterval(countdownRef.current);
      dismiss(true); // auto-navigate to sync-status
    }, TIMEOUT_MS);
  }

  // Poll callStatusStore for newly synced calls
  useEffect(() => {
    const poll = setInterval(async () => {
      const all = await getAllCallStatuses();
      const fresh = all.find(
        e => e.sync_status === STATUS.SYNCED && !seenRef.current.has(e.client_event_id)
      );
      if (fresh) {
        seenRef.current.add(fresh.client_event_id);
        showPopup(fresh);
      }
    }, POLL_MS);

    return () => {
      clearInterval(poll);
      clearTimeout(timerRef.current);
      clearInterval(countdownRef.current);
    };
  }, []);

  if (!visible || !call) return null;

  const typeColor = CALL_TYPE_COLOR[call.call_type] || TEAL;
  const typeIcon  = CALL_TYPE_ICON[call.call_type]  || "call";
  const name      = call.contact_name && call.contact_name !== "Unknown"
    ? call.contact_name
    : call.phone_number || "Unknown";

  const pct = remaining / TIMEOUT_MS; // 1.0 → 0.0

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Dim backdrop — tap to dismiss */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
        onPress={() => dismiss(false)}
      >
        <Animated.View
          style={{ transform: [{ translateY: slideY }] }}
          // Prevent backdrop tap from firing when touching the card
          onStartShouldSetResponder={() => true}
        >
          <Pressable onPress={() => {}} style={{ backgroundColor: theme.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: SPACE.xl, paddingBottom: 40, borderTopWidth: 1, borderTopColor: theme.border }}>

            {/* Drag handle */}
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginBottom: SPACE.lg }} />

            {/* Header row */}
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACE.lg }}>
              <View style={{ width: 48, height: 48, borderRadius: RADIUS.xl, backgroundColor: typeColor + "1a", alignItems: "center", justifyContent: "center", marginRight: SPACE.md }}>
                <Ionicons name={typeIcon} size={22} color={typeColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ ...TYPE.h3, color: theme.primary }} numberOfLines={1}>{name}</Text>
                <Text style={{ ...TYPE.caption, color: theme.muted, marginTop: 2, textTransform: "capitalize" }}>
                  {call.call_type} · {fmtDur(call.duration_seconds)}
                </Text>
              </View>
              {/* Countdown badge */}
              <View style={{ alignItems: "center", backgroundColor: pct > 0.4 ? TEAL + "18" : palette.amber + "18", borderRadius: RADIUS.md, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: pct > 0.4 ? TEAL + "44" : palette.amber + "44" }}>
                <Ionicons name="time-outline" size={13} color={pct > 0.4 ? TEAL : palette.amber} />
                <Text style={{ fontSize: 13, fontWeight: "800", color: pct > 0.4 ? TEAL : palette.amber, marginTop: 2 }}>
                  {fmtCountdown(remaining)}
                </Text>
              </View>
            </View>

            {/* Countdown bar */}
            <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, marginBottom: SPACE.lg, overflow: "hidden" }}>
              <View style={{ height: 4, borderRadius: 2, width: `${pct * 100}%`, backgroundColor: pct > 0.4 ? TEAL : palette.amber }} />
            </View>

            {/* Hint text */}
            <Text style={{ ...TYPE.caption, color: theme.muted, textAlign: "center", marginBottom: SPACE.lg }}>
              Call synced! Add a note or update status before it auto-closes.
            </Text>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: SPACE.sm }}>
              <Pressable
                onPress={() => dismiss(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: theme.border, alignItems: "center" }}
              >
                <Text style={{ ...TYPE.bodyBold, color: theme.muted }}>Dismiss</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  dismiss(false);
                  router.push({
                    pathname: "/call-detail",
                    params: { clientEventId: call.client_event_id || "", callId: call.call_id || "" },
                  });
                }}
                style={{ flex: 2, paddingVertical: 14, borderRadius: RADIUS.lg, backgroundColor: TEAL, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
              >
                <Ionicons name="open-outline" size={16} color="#fff" />
                <Text style={{ ...TYPE.bodyBold, color: "#fff" }}>View Details</Text>
              </Pressable>
            </View>

          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Modal, Linking, Vibration, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, gradientBrand, useTheme, TYPE, SPACE, RADIUS } from "./theme";

const ICONS  = { index: "grid-outline",       logs: "call-outline",        insights: "stats-chart-outline", settings: "settings-outline" };
const ICONS_ACTIVE = { index: "grid",         logs: "call",                insights: "stats-chart",         settings: "settings" };
const LABELS = { index: "Home",               logs: "Calls",               insights: "Insights",            settings: "Settings" };

// ── Animated tab item ─────────────────────────────────────────────────────────
function TabItem({ route, focused, onPress }) {
  const { theme } = useTheme();
  const scale     = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const opacity   = useRef(new Animated.Value(focused ? 1 : 0.55)).current;
  const dotScale  = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,    { toValue: focused ? 1 : 0.9, useNativeDriver: true, speed: 60, bounciness: 8 }),
      Animated.timing(opacity,  { toValue: focused ? 1 : 0.55, duration: 180, useNativeDriver: true }),
      Animated.spring(dotScale, { toValue: focused ? 1 : 0, useNativeDriver: true, speed: 60, bounciness: 10 }),
    ]).start();
  }, [focused]);

  function handlePress() {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.85, useNativeDriver: true, speed: 80 }),
      Animated.spring(scale, { toValue: focused ? 1 : 0.9, useNativeDriver: true, speed: 60, bounciness: 8 }),
    ]).start();
    onPress();
  }

  return (
    <Pressable
      onPress={handlePress}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4 }}
      accessibilityRole="tab"
      accessibilityLabel={LABELS[route.name]}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <Ionicons
          name={focused ? ICONS_ACTIVE[route.name] : ICONS[route.name]}
          size={22}
          color={focused ? palette.teal : theme.dim}
        />
      </Animated.View>
      <Text style={{
        ...TYPE.micro,
        color: focused ? palette.teal : theme.dim,
        fontWeight: focused ? "700" : "600",
      }}>
        {LABELS[route.name]}
      </Text>
      {/* Active indicator dot */}
      <Animated.View style={{
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: palette.teal,
        transform: [{ scale: dotScale }],
        marginTop: 1,
      }} />
    </Pressable>
  );
}

// ── Dial Pad ──────────────────────────────────────────────────────────────────
function DialPad({ visible, onClose }) {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [number, setNumber] = useState("");
  const slideY = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
    }
  }, [visible]);

  const KEYS = [
    [{ k: "1", sub: "" },    { k: "2", sub: "ABC" }, { k: "3", sub: "DEF"  }],
    [{ k: "4", sub: "GHI" }, { k: "5", sub: "JKL" }, { k: "6", sub: "MNO"  }],
    [{ k: "7", sub: "PQRS"},{ k: "8", sub: "TUV" }, { k: "9", sub: "WXYZ" }],
    [{ k: "*", sub: "" },    { k: "0", sub: "+" },   { k: "#", sub: ""     }],
  ];

  function press(k) {
    Vibration.vibrate(20);
    setNumber(n => n + k);
  }
  function backspace() {
    Vibration.vibrate(20);
    setNumber(n => n.slice(0, -1));
  }
  function makeCall() {
    if (!number) return;
    Linking.openURL(`tel:${number}`);
    onClose();
    setNumber("");
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(3,6,12,0.6)" }} onPress={onClose} />
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: theme.surface,
        borderTopLeftRadius: RADIUS.xxl + 4, borderTopRightRadius: RADIUS.xxl + 4,
        borderWidth: 1, borderColor: theme.border,
        paddingBottom: Math.max(bottom, SPACE.xxl),
        paddingTop: SPACE.lg,
        transform: [{ translateY: slideY }],
        shadowColor: "#000", shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 20,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong, alignSelf: "center", marginBottom: SPACE.xl }} />

        {/* Number display */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: SPACE.xxxl, marginBottom: SPACE.xxl, minHeight: 52 }}>
          <Text style={{ fontSize: 36, fontWeight: "300", color: theme.primary, letterSpacing: 4, flex: 1, textAlign: "center" }} numberOfLines={1}>
            {number || <Text style={{ color: theme.dim, fontSize: 18 }}>Enter number</Text>}
          </Text>
          {number.length > 0 && (
            <Pressable onPress={backspace} onLongPress={() => setNumber("")} style={{ padding: SPACE.sm }} hitSlop={8}>
              <Ionicons name="backspace-outline" size={26} color={theme.muted} />
            </Pressable>
          )}
        </View>

        {/* Keys */}
        {KEYS.map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", justifyContent: "space-evenly", marginBottom: SPACE.md }}>
            {row.map(({ k, sub }) => {
              const keyScale = useRef(new Animated.Value(1)).current;
              return (
                <Pressable
                  key={k}
                  onPressIn={() => Animated.spring(keyScale, { toValue: 0.88, useNativeDriver: true, speed: 80 }).start()}
                  onPressOut={() => Animated.spring(keyScale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 10 }).start()}
                  onPress={() => press(k)}
                  accessibilityLabel={k}
                >
                  <Animated.View style={{
                    width: 76, height: 76, borderRadius: 38,
                    backgroundColor: theme.surface2,
                    alignItems: "center", justifyContent: "center",
                    borderWidth: 1, borderColor: theme.border,
                    transform: [{ scale: keyScale }],
                  }}>
                    <Text style={{ fontSize: 28, fontWeight: "300", color: theme.primary }}>{k}</Text>
                    {sub ? <Text style={{ ...TYPE.micro, color: theme.dim, letterSpacing: 1 }}>{sub}</Text> : null}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {/* Call button row */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: SPACE.md, gap: SPACE.xxxl }}>
          <Pressable onPress={onClose} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={24} color={theme.muted} />
          </Pressable>

          <Pressable onPress={makeCall} disabled={!number}>
            <LinearGradient
              colors={number ? ["#22c55e", "#16a34a"] : [theme.border, theme.border]}
              style={{
                width: 72, height: 72, borderRadius: 36,
                alignItems: "center", justifyContent: "center",
                shadowColor: "#22c55e", shadowOffset: { width: 0, height: 6 },
                shadowOpacity: number ? 0.45 : 0, shadowRadius: 16, elevation: number ? 10 : 0,
              }}
            >
              <Ionicons name="call" size={30} color="#fff" />
            </LinearGradient>
          </Pressable>

          <Pressable style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person-add-outline" size={22} color={theme.muted} />
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Dock ──────────────────────────────────────────────────────────────────────
export default function Dock({ state, navigation }) {
  const { theme } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [dialOpen, setDialOpen] = useState(false);
  const fabScale = useRef(new Animated.Value(1)).current;

  const routes = state.routes.filter(r => r.name !== "onboarding");
  const left   = routes.slice(0, 2);
  const right  = routes.slice(2);

  function onFabPressIn() { Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true, speed: 80 }).start(); }
  function onFabPressOut() { Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 12 }).start(); }

  const dockBottom = Math.max(bottom, 14);

  return (
    <>
      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: dockBottom }}
        pointerEvents="box-none"
      >
        {/* Floating pill */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          backgroundColor: theme.navBar,
          borderRadius: RADIUS.xxl,
          paddingHorizontal: SPACE.lg,
          height: 66,
          width: "92%",
          borderWidth: 1, borderColor: theme.border,
          shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 14,
        }}>
          {left.map(route => {
            const idx = state.routes.findIndex(r => r.key === route.key);
            return (
              <TabItem
                key={route.key}
                route={route}
                focused={state.index === idx}
                onPress={() => navigation.navigate(route.name)}
              />
            );
          })}

          {/* FAB spacer */}
          <View style={{ width: 64 }} />

          {right.map(route => {
            const idx = state.routes.findIndex(r => r.key === route.key);
            return (
              <TabItem
                key={route.key}
                route={route}
                focused={state.index === idx}
                onPress={() => navigation.navigate(route.name)}
              />
            );
          })}
        </View>

        {/* Center FAB */}
        <Pressable
          style={{ position: "absolute", top: -14, alignSelf: "center" }}
          onPressIn={onFabPressIn}
          onPressOut={onFabPressOut}
          onPress={() => setDialOpen(true)}
          accessibilityLabel="Open dial pad"
          accessibilityRole="button"
        >
          <Animated.View style={{ transform: [{ scale: fabScale }] }}>
            <LinearGradient
              colors={gradientBrand}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                width: 60, height: 60, borderRadius: 30,
                alignItems: "center", justifyContent: "center",
                borderWidth: 4, borderColor: theme.bg || theme.navBar,
                shadowColor: palette.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.45, shadowRadius: 16, elevation: 12,
              }}
            >
              <Ionicons name="keypad" size={24} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>

      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} />
    </>
  );
}

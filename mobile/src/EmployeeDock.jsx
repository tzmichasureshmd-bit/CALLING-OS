import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Animated, Modal, Linking, Vibration, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { employeePalette, TYPE, SPACE, RADIUS } from "./theme";

const TABS = [
  { name: "index",     label: "Home",      icon: "home-outline",         iconActive: "home"          },
  { name: "logs",      label: "Logs",      icon: "document-text-outline", iconActive: "document-text" },
  { name: "follow-ups",label: "Follow-ups",icon: "calendar-outline",      iconActive: "calendar"      },
  { name: "settings",  label: "Profile",   icon: "person-circle-outline", iconActive: "person-circle" },
];

// Navy + mint color scheme
const NAVY   = employeePalette.navy;    // #0D1B4B
const TEAL   = employeePalette.primary; // #0ABFA3
const MINT   = employeePalette.mintBg;  // #F0FFF8

function TabItem({ tab, focused, onPress }) {
  const scale    = useRef(new Animated.Value(focused ? 1 : 0.88)).current;
  const dotOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,      { toValue: focused ? 1 : 0.88, useNativeDriver: true, speed: 60, bounciness: 8 }),
      Animated.timing(dotOpacity, { toValue: focused ? 1 : 0,    useNativeDriver: true, duration: 180 }),
    ]).start();
  }, [focused]);

  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 6, gap: 3 }}>
      <Animated.View style={{
        transform: [{ scale }],
        width: 40, height: 40, borderRadius: 12,
        alignItems: "center", justifyContent: "center",
        backgroundColor: focused ? TEAL + "22" : "transparent",
      }}>
        <Ionicons
          name={focused ? tab.iconActive : tab.icon}
          size={22}
          color={focused ? TEAL : NAVY + "66"}
        />
      </Animated.View>
      <Text style={{
        fontSize: 10, fontWeight: focused ? "700" : "500",
        color: focused ? TEAL : NAVY + "66",
        letterSpacing: 0.2,
      }}>
        {tab.label}
      </Text>
      <Animated.View style={{
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: TEAL,
        opacity: dotOpacity,
      }} />
    </Pressable>
  );
}

function DialPad({ visible, onClose }) {
  const { bottom } = useSafeAreaInsets();
  const [number, setNumber] = useState("");
  const slideY = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    if (visible) Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    else Animated.timing(slideY, { toValue: 700, duration: 220, useNativeDriver: true, easing: Easing.in(Easing.ease) }).start();
  }, [visible]);

  const KEYS = [
    [{ k: "1", sub: "" }, { k: "2", sub: "ABC" }, { k: "3", sub: "DEF" }],
    [{ k: "4", sub: "GHI" }, { k: "5", sub: "JKL" }, { k: "6", sub: "MNO" }],
    [{ k: "7", sub: "PQRS" }, { k: "8", sub: "TUV" }, { k: "9", sub: "WXYZ" }],
    [{ k: "*", sub: "" }, { k: "0", sub: "+" }, { k: "#", sub: "" }],
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(13,27,75,0.55)" }} onPress={onClose} />
      <Animated.View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: "#fff",
        borderTopLeftRadius: 28, borderTopRightRadius: 28,
        paddingBottom: Math.max(bottom, SPACE.xxl), paddingTop: SPACE.lg,
        transform: [{ translateY: slideY }], elevation: 20,
      }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb", alignSelf: "center", marginBottom: SPACE.xl }} />
        {/* Number display */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 40, marginBottom: SPACE.xxl, minHeight: 52 }}>
          <Text style={{ fontSize: 36, fontWeight: "300", color: NAVY, letterSpacing: 4, flex: 1, textAlign: "center" }} numberOfLines={1}>
            {number || <Text style={{ color: "#9ca3af", fontSize: 18 }}>Enter number</Text>}
          </Text>
          {number.length > 0 && (
            <Pressable onPress={() => setNumber(n => n.slice(0, -1))} onLongPress={() => setNumber("")} hitSlop={8}>
              <Ionicons name="backspace-outline" size={26} color="#6b7280" />
            </Pressable>
          )}
        </View>
        {/* Keys */}
        {KEYS.map((row, ri) => (
          <View key={ri} style={{ flexDirection: "row", justifyContent: "space-evenly", marginBottom: SPACE.md }}>
            {row.map(({ k, sub }) => (
              <Pressable key={k} onPress={() => { Vibration.vibrate(20); setNumber(n => n + k); }}>
                <View style={{
                  width: 76, height: 76, borderRadius: 38,
                  backgroundColor: MINT,
                  alignItems: "center", justifyContent: "center",
                  borderWidth: 1, borderColor: employeePalette.mintBorder,
                }}>
                  <Text style={{ fontSize: 28, fontWeight: "400", color: NAVY }}>{k}</Text>
                  {sub ? <Text style={{ fontSize: 10, color: TEAL, letterSpacing: 1, fontWeight: "600" }}>{sub}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        ))}
        {/* Call / Close */}
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: SPACE.md, gap: 40 }}>
          <Pressable onPress={onClose} style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: MINT, borderWidth: 1, borderColor: employeePalette.mintBorder,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="close" size={24} color={NAVY} />
          </Pressable>
          <Pressable
            onPress={() => { if (!number) return; Linking.openURL(`tel:${number}`); onClose(); setNumber(""); }}
            disabled={!number}
          >
            <LinearGradient
              colors={number ? [employeePalette.primaryDark, employeePalette.primary] : ["#e5e7eb", "#e5e7eb"]}
              style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", elevation: number ? 10 : 0 }}
            >
              <Ionicons name="call" size={30} color="#fff" />
            </LinearGradient>
          </Pressable>
          <View style={{ width: 56, height: 56 }} />
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function EmployeeDock({ state, navigation }) {
  const { bottom } = useSafeAreaInsets();
  const [dialOpen, setDialOpen] = useState(false);
  const fabScale = useRef(new Animated.Value(1)).current;

  const visibleTabs = TABS.filter(t => state.routes.some(r => r.name === t.name));
  const left  = visibleTabs.slice(0, 2);
  const right = visibleTabs.slice(2, 4);

  return (
    <>
      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: Math.max(bottom, 12) }}
        pointerEvents="box-none"
      >
        {/* Dock bar — white with mint border */}
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          backgroundColor: "#FFFFFF",
          borderRadius: 28,
          paddingHorizontal: SPACE.md,
          height: 72,
          width: "92%",
          borderWidth: 1.5,
          borderColor: employeePalette.mintBorder,
          shadowColor: NAVY,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 20,
          elevation: 12,
        }}>
          {left.map(tab => {
            const idx = state.routes.findIndex(r => r.name === tab.name);
            return <TabItem key={tab.name} tab={tab} focused={state.index === idx} onPress={() => navigation.navigate(tab.name)} />;
          })}

          {/* FAB spacer */}
          <View style={{ width: 68 }} />

          {right.map(tab => {
            const idx = state.routes.findIndex(r => r.name === tab.name);
            return <TabItem key={tab.name} tab={tab} focused={state.index === idx} onPress={() => navigation.navigate(tab.name)} />;
          })}
        </View>

        {/* Center FAB — navy gradient with teal glow */}
        <Pressable
          style={{ position: "absolute", top: -18, alignSelf: "center" }}
          onPressIn={() => Animated.spring(fabScale, { toValue: 0.88, useNativeDriver: true, speed: 80 }).start()}
          onPressOut={() => Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, speed: 60, bounciness: 12 }).start()}
          onPress={() => setDialOpen(true)}
        >
          <Animated.View style={{ transform: [{ scale: fabScale }] }}>
            <LinearGradient
              colors={[NAVY, employeePalette.navyLight]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                width: 62, height: 62, borderRadius: 31,
                alignItems: "center", justifyContent: "center",
                borderWidth: 3, borderColor: "#fff",
                shadowColor: TEAL,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 14,
              }}
            >
              <Ionicons name="keypad" size={26} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>

      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} />
    </>
  );
}

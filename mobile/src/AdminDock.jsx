import { useRef, useEffect } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { adminPalette, TYPE, SPACE, RADIUS } from "./theme";

const TABS = [
  { name: "dashboard", label: "Dashboard", icon: "home-outline",   iconActive: "home"   },
  { name: "employees", label: "Employees", icon: "people-outline", iconActive: "people" },
  { name: "calls",     label: "Calls",     icon: "call-outline",   iconActive: "call"   },
  { name: "settings",  label: "Settings",  icon: "settings-outline",iconActive: "settings"},
];

function TabItem({ tab, focused, onPress }) {
  const scale    = useRef(new Animated.Value(focused ? 1 : 0.9)).current;
  const dotScale = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,    { toValue: focused ? 1 : 0.9, useNativeDriver: true, speed: 60, bounciness: 8 }),
      Animated.spring(dotScale, { toValue: focused ? 1 : 0,   useNativeDriver: true, speed: 60, bounciness: 10 }),
    ]).start();
  }, [focused]);

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 4 }}
    >
      <Animated.View style={{ transform: [{ scale }], opacity: focused ? 1 : 0.55 }}>
        <Ionicons
          name={focused ? tab.iconActive : tab.icon}
          size={22}
          color={focused ? adminPalette.primary : adminPalette.gray400}
        />
      </Animated.View>
      <Text style={{ ...TYPE.micro, color: focused ? adminPalette.primary : adminPalette.gray400, fontWeight: focused ? "700" : "600" }}>
        {tab.label}
      </Text>
      <Animated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: adminPalette.primary, transform: [{ scale: dotScale }], marginTop: 1 }} />
    </Pressable>
  );
}

export default function AdminDock({ state, navigation }) {
  const { bottom } = useSafeAreaInsets();

  // Only show the 4 visible admin tabs
  const visibleTabs = TABS.filter(t => state.routes.some(r => r.name === t.name));

  const left  = visibleTabs.slice(0, 2);
  const right = visibleTabs.slice(2, 4);

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: Math.max(bottom, 14) }} pointerEvents="box-none">
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: adminPalette.white, borderRadius: RADIUS.xxl,
        paddingHorizontal: SPACE.lg, height: 66, width: "92%",
        borderWidth: 1, borderColor: adminPalette.border,
        shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 14,
      }}>
        {left.map(tab => {
          const route = state.routes.find(r => r.name === tab.name);
          const idx   = state.routes.findIndex(r => r.name === tab.name);
          return <TabItem key={tab.name} tab={tab} focused={state.index === idx} onPress={() => navigation.navigate(tab.name)} />;
        })}

        {/* FAB spacer */}
        <View style={{ width: 64 }} />

        {right.map(tab => {
          const route = state.routes.find(r => r.name === tab.name);
          const idx   = state.routes.findIndex(r => r.name === tab.name);
          return <TabItem key={tab.name} tab={tab} focused={state.index === idx} onPress={() => navigation.navigate(tab.name)} />;
        })}
      </View>

      {/* Center FAB — no dial pad for admin */}
      <View style={{ position: "absolute", top: -14, alignSelf: "center" }}>
        <LinearGradient
          colors={[adminPalette.primary, adminPalette.navyLight || adminPalette.primary]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", borderWidth: 4, borderColor: adminPalette.white, elevation: 12 }}
        >
          <Ionicons name="business-outline" size={24} color="#fff" />
        </LinearGradient>
      </View>
    </View>
  );
}

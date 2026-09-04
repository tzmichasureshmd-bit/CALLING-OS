import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "./theme";

const ICONS = { index: "grid-outline", logs: "call-outline", insights: "stats-chart-outline", settings: "person-outline" };
const LABELS = { index: "Home", logs: "Calls", insights: "Insights", settings: "Profile" };

export default function Dock({ state, navigation }) {
  const { theme } = useTheme();
  const routes = state.routes.filter((r) => r.name !== "onboarding");
  const left = routes.slice(0, 2);
  const right = routes.slice(2);

  const renderTab = (route) => {
    const idx = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === idx;
    return (
      <Pressable key={route.key} onPress={() => navigation.navigate(route.name)} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 3 }}>
        <Ionicons name={ICONS[route.name]} size={22} color={focused ? palette.teal : theme.dim} />
        <Text style={{ fontSize: 10.5, fontWeight: "600", color: focused ? palette.teal : theme.dim }}>{LABELS[route.name]}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 14 }} pointerEvents="box-none">
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        backgroundColor: theme.navBar, borderRadius: 24, paddingHorizontal: 14, height: 66,
        width: "92%", borderWidth: 1, borderColor: theme.border,
        shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: theme.mode === "dark" ? 0.4 : 0.14, shadowRadius: 20, elevation: 12,
      }}>
        {left.map(renderTab)}
        <View style={{ width: 64 }} />
        {right.map(renderTab)}
      </View>
      <Pressable style={{ position: "absolute", top: -14, alignSelf: "center" }} onPress={() => {}}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
          width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center",
          borderWidth: 4, borderColor: theme.bg,
          shadowColor: palette.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
        }}>
          <Ionicons name="keypad" size={24} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

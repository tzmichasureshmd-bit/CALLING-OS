import { View, Text, Pressable } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "./theme";

// ---- Logo ----
export function Logo({ size = 19 }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size + 8, height: size + 8, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
        <MaterialCommunityIcons name="pulse" size={size - 3} color="#fff" />
      </LinearGradient>
      <Text style={{ fontSize: size, fontWeight: "800", letterSpacing: 0.3, color: theme.primary }}>
        Call<Text style={{ color: palette.teal }}>Nexa</Text>
      </Text>
    </View>
  );
}

// ---- Header ----
export function AppHeader({ title, subtitle, right, badge = 1 }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 12, backgroundColor: theme.surface }}>
      <View>
        {title ? (
          <>
            <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary }}>{title}</Text>
            {subtitle ? <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 1 }}>{subtitle}</Text> : null}
          </>
        ) : <Logo />}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        {right}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.successSoft, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: palette.emerald }} />
          <Text style={{ fontSize: 11, fontWeight: "700", color: theme.success }}>Live</Text>
        </View>
        <View>
          <Ionicons name="notifications-outline" size={22} color={theme.secondary} />
          {badge > 0 && (
            <View style={{ position: "absolute", top: -6, right: -8, backgroundColor: palette.red, borderRadius: 9, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
              <Text style={{ color: "#fff", fontSize: 9.5, fontWeight: "700" }}>{badge}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export function Delta({ value }) {
  const { theme } = useTheme();
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

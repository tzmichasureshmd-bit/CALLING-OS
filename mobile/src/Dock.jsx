import { useState } from "react";
import { View, Text, Pressable, Modal, Linking, Vibration } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "./theme";

const ICONS  = { index: "grid-outline", logs: "call-outline", insights: "stats-chart-outline", settings: "person-outline" };
const LABELS = { index: "Home", logs: "Calls", insights: "Insights", settings: "Profile" };

// ── Dial Pad ──────────────────────────────────────────────────────────────────
function DialPad({ visible, onClose }) {
  const { theme } = useTheme();
  const [number, setNumber] = useState("");

  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  function press(k) {
    Vibration.vibrate(30);
    setNumber((n) => n + k);
  }

  function backspace() {
    Vibration.vibrate(30);
    setNumber((n) => n.slice(0, -1));
  }

  function makeCall() {
    if (!number) return;
    Linking.openURL(`tel:${number}`);
    onClose();
    setNumber("");
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View style={{ backgroundColor: theme.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, paddingTop: 16 }}>
          {/* Handle */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: "center", marginBottom: 20 }} />

          {/* Number display */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 32, marginBottom: 24, minHeight: 52 }}>
            <Text style={{ fontSize: 36, fontWeight: "300", color: theme.primary, letterSpacing: 4, flex: 1, textAlign: "center" }} numberOfLines={1}>
              {number || <Text style={{ color: theme.dim, fontSize: 18 }}>Enter number</Text>}
            </Text>
            {number.length > 0 && (
              <Pressable onPress={backspace} onLongPress={() => setNumber("")} style={{ padding: 8 }}>
                <Ionicons name="backspace-outline" size={26} color={theme.muted} />
              </Pressable>
            )}
          </View>

          {/* Keys */}
          {KEYS.map((row, ri) => (
            <View key={ri} style={{ flexDirection: "row", justifyContent: "space-evenly", marginBottom: 12 }}>
              {row.map((k) => (
                <Pressable
                  key={k}
                  onPress={() => press(k)}
                  style={({ pressed }) => ({
                    width: 76, height: 76, borderRadius: 38,
                    backgroundColor: pressed ? theme.border : theme.surface,
                    alignItems: "center", justifyContent: "center",
                    borderWidth: 1, borderColor: theme.border,
                  })}
                >
                  <Text style={{ fontSize: 28, fontWeight: "300", color: theme.primary }}>{k}</Text>
                  {k === "2" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>ABC</Text>}
                  {k === "3" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>DEF</Text>}
                  {k === "4" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>GHI</Text>}
                  {k === "5" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>JKL</Text>}
                  {k === "6" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>MNO</Text>}
                  {k === "7" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>PQRS</Text>}
                  {k === "8" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>TUV</Text>}
                  {k === "9" && <Text style={{ fontSize: 9, color: theme.dim, letterSpacing: 1 }}>WXYZ</Text>}
                </Pressable>
              ))}
            </View>
          ))}

          {/* Call button */}
          <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 8, gap: 32 }}>
            <Pressable onPress={onClose} style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </Pressable>

            <Pressable onPress={makeCall} disabled={!number}>
              <LinearGradient
                colors={number ? ["#22c55e", "#16a34a"] : [theme.border, theme.border]}
                style={{ width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", shadowColor: "#22c55e", shadowOffset: { width: 0, height: 6 }, shadowOpacity: number ? 0.4 : 0, shadowRadius: 12, elevation: number ? 8 : 0 }}
              >
                <Ionicons name="call" size={30} color="#fff" />
              </LinearGradient>
            </Pressable>

            <Pressable style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="person-add-outline" size={22} color={theme.muted} />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Dock ──────────────────────────────────────────────────────────────────────
export default function Dock({ state, navigation }) {
  const { theme } = useTheme();
  const [dialOpen, setDialOpen] = useState(false);
  const routes = state.routes.filter((r) => r.name !== "onboarding");
  const left  = routes.slice(0, 2);
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
    <>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: 14 }} pointerEvents="box-none">
        <View style={{
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          backgroundColor: theme.navBar, borderRadius: 24, paddingHorizontal: 14, height: 66,
          width: "92%", borderWidth: 1, borderColor: theme.border,
          shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 12,
        }}>
          {left.map(renderTab)}
          <View style={{ width: 64 }} />
          {right.map(renderTab)}
        </View>
        <Pressable style={{ position: "absolute", top: -14, alignSelf: "center" }} onPress={() => setDialOpen(true)}>
          <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{
            width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center",
            borderWidth: 4, borderColor: theme.bg,
            shadowColor: palette.teal, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
          }}>
            <Ionicons name="keypad" size={24} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
      <DialPad visible={dialOpen} onClose={() => setDialOpen(false)} />
    </>
  );
}

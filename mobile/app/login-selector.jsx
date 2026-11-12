import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { employeePalette, adminPalette, TYPE, SPACE, RADIUS } from "../src/theme";

export default function LoginSelectorScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleSelect = (type) => {
    setSelected(type);
    setTimeout(() => {
      router.push({
        pathname: "/login",
        params: { userType: type }, // "company" or "employee"
      });
    }, 300);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#F9FAFB", "#F3F4F6"]} style={styles.background}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={[TYPE.h1, { color: employeePalette.navy, textAlign: "center" }]}>
              Welcome to CALL
            </Text>
            <Text style={[TYPE.body, { color: employeePalette.gray600, textAlign: "center", marginTop: SPACE.md }]}>
              Choose your login type
            </Text>
          </View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Login Options */}
          <Animated.View
            style={[
              styles.optionsContainer,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Company/Organization Login */}
            <Pressable
              onPress={() => handleSelect("company")}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  opacity: pressed ? 0.9 : 1,
                  borderColor: selected === "company" ? adminPalette.primary : adminPalette.gray200,
                  borderWidth: 2,
                  backgroundColor: selected === "company" ? adminPalette.primaryLight : "#fff",
                },
              ]}
            >
              <LinearGradient
                colors={[adminPalette.warmMint, adminPalette.warmPeach]}
                style={styles.optionIconBg}
              >
                <MaterialCommunityIcons name="office-building" size={32} color="#fff" />
              </LinearGradient>
              <Text style={[TYPE.h3, { color: adminPalette.navy, marginTop: SPACE.md }]}>
                Company / Organization
              </Text>
              <Text style={[TYPE.caption, { color: adminPalette.gray600, marginTop: SPACE.sm, textAlign: "center" }]}>
                Admin access to manage company, view all employees & analytics
              </Text>
              <View style={styles.badgeContainer}>
                <Text style={[TYPE.micro, { color: adminPalette.primary }]}>ORGANIZATION</Text>
              </View>
            </Pressable>

            {/* Spacer */}
            <View style={{ height: SPACE.lg }} />

            {/* Employee Login */}
            <Pressable
              onPress={() => handleSelect("employee")}
              style={({ pressed }) => [
                styles.optionCard,
                {
                  opacity: pressed ? 0.9 : 1,
                  borderColor: selected === "employee" ? employeePalette.primary : employeePalette.gray200,
                  borderWidth: 2,
                  backgroundColor: selected === "employee" ? employeePalette.primaryLight : "#fff",
                },
              ]}
            >
              <LinearGradient
                colors={[employeePalette.primary, employeePalette.primaryDark]}
                style={styles.optionIconBg}
              >
                <Ionicons name="person" size={32} color="#fff" />
              </LinearGradient>
              <Text style={[TYPE.h3, { color: employeePalette.navy, marginTop: SPACE.md }]}>
                Employee
              </Text>
              <Text style={[TYPE.caption, { color: employeePalette.gray600, marginTop: SPACE.sm, textAlign: "center" }]}>
                Employee login to view calls, logs, and personal analytics
              </Text>
              <View style={styles.badgeContainer}>
                <Text style={[TYPE.micro, { color: employeePalette.primary }]}>EMPLOYEE</Text>
              </View>
            </Pressable>
          </Animated.View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Help Section */}
          <View style={styles.helpSection}>
            <Ionicons name="help-circle-outline" size={18} color={employeePalette.gray500} />
            <Text style={[TYPE.caption, { color: employeePalette.gray600, marginLeft: SPACE.sm }]}>
              Not sure which one? Contact your admin
            </Text>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.xl,
    justifyContent: "space-between",
  },
  headerSection: {
    marginTop: SPACE.xxl,
  },
  optionsContainer: {
    gap: SPACE.md,
  },
  optionCard: {
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  optionIconBg: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeContainer: {
    marginTop: SPACE.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderRadius: RADIUS.md,
  },
  helpSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderTopWidth: 1,
    borderTopColor: employeePalette.gray200,
    marginHorizontal: -SPACE.lg,
    marginBottom: -SPACE.xl,
  },
});

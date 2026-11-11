import { useState, useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated, Easing, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { employeePalette, adminPalette, TYPE, SPACE, RADIUS, gradientBrand } from "../src/theme";

export default function IntroScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#D1F4E8", "#E8F5E9"]} style={styles.background}>
        <View style={styles.content}>
          {/* Header Section */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LinearGradient colors={[employeePalette.primary, employeePalette.primaryDark]} style={styles.logoBg}>
                <Ionicons name="call" size={48} color="#fff" />
              </LinearGradient>
            </View>

            {/* App Name */}
            <Text style={[TYPE.h1, styles.appName, { color: employeePalette.navy }]}>
              CALL
            </Text>
            <Text style={[TYPE.caption, styles.subtitle, { color: employeePalette.gray500 }]}>
              Analytics & Monitoring
            </Text>

            {/* Description */}
            <Text style={[TYPE.body, styles.description, { color: employeePalette.gray600 }]}>
              Intelligent call monitoring and sales analytics for modern teams
            </Text>
          </Animated.View>

          {/* Feature List */}
          <Animated.View
            style={[
              styles.featuresSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <FeatureRow
              icon="phone"
              title="Real-time Monitoring"
              description="Track calls as they happen"
              color={employeePalette.primary}
            />
            <FeatureRow
              icon="analytics"
              title="Performance Analytics"
              description="Detailed insights and metrics"
              color={employeePalette.primary}
            />
            <FeatureRow
              icon="people"
              title="Team Management"
              description="Manage and track your team"
              color={employeePalette.primary}
            />
            <FeatureRow
              icon="lock-closed"
              title="Secure & Reliable"
              description="Enterprise-grade security"
              color={employeePalette.primary}
            />
          </Animated.View>

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* CTA Buttons */}
          <Animated.View
            style={[
              styles.ctaSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Pressable
              onPress={() => router.push("/login-selector")}
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <LinearGradient colors={gradientBrand} style={styles.buttonContent}>
                <Text style={[TYPE.body, { color: "#fff", fontWeight: "600" }]}>
                  Get Started
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: SPACE.sm }} />
              </LinearGradient>
            </Pressable>

            {/* Footer Text */}
            <Text style={[TYPE.caption, styles.footerText, { color: employeePalette.gray500 }]}>
              Trusted by sales teams worldwide
            </Text>
          </Animated.View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Feature Row Component
// ════════════════════════════════════════════════════════════════════════════
function FeatureRow({ icon, title, description, color }) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, { backgroundColor: color, opacity: 0.15 }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.title, { color: employeePalette.navy }]}>{title}</Text>
        <Text style={[TYPE.caption, { color: employeePalette.gray500, marginTop: SPACE.xs }]}>
          {description}
        </Text>
      </View>
    </View>
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
    alignItems: "center",
    marginTop: SPACE.xxxl,
  },
  logoContainer: {
    marginBottom: SPACE.xl,
  },
  logoBg: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: employeePalette.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  appName: {
    marginBottom: SPACE.xs,
  },
  subtitle: {
    marginBottom: SPACE.lg,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginHorizontal: SPACE.lg,
  },
  featuresSection: {
    marginTop: SPACE.xxxl,
    gap: SPACE.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: "center",
    alignItems: "center",
  },
  ctaSection: {
    gap: SPACE.lg,
    alignItems: "center",
  },
  primaryButton: {
    width: "100%",
    borderRadius: RADIUS.md,
    overflow: "hidden",
  },
  buttonContent: {
    flexDirection: "row",
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    textAlign: "center",
  },
});

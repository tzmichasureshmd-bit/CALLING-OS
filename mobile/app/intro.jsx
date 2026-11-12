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
  const slideAnim = useRef(new Animated.Value(100)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 1000, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
    ]).start();

    // Button pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(buttonScaleAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(buttonScaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulseAnimation.start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient 
        colors={["#D1F4E8", "#E8F5E9", "#C7F0DD"]} 
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.background}
      >
        <View style={styles.content}>
          {/* Animated Background Elements */}
          <Animated.View style={[styles.bgElement1, { opacity: fadeAnim }]} />
          <Animated.View style={[styles.bgElement2, { opacity: fadeAnim }]} />

          {/* Header Section */}
          <Animated.View
            style={[
              styles.headerSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
              },
            ]}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Animated.View
                style={{
                  transform: [
                    {
                      rotate: rotateAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", "360deg"],
                      }),
                    },
                  ],
                }}
              >
                <LinearGradient 
                  colors={[employeePalette.primary, employeePalette.primaryDark, employeePalette.navy]} 
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoBg}
                >
                  <Ionicons name="call" size={52} color="#fff" />
                </LinearGradient>
              </Animated.View>
              
              {/* Glow Effect */}
              <View style={styles.glowEffect} />
            </View>

            {/* App Name with gradient */}
            <Text style={[TYPE.h1, styles.appName, { color: employeePalette.navy }]}>
              CALL
            </Text>
            <Text style={[TYPE.caption, styles.subtitle, { color: employeePalette.primary, fontWeight: "700" }]}>
              Analytics & Monitoring
            </Text>

            {/* Description */}
            <Text style={[TYPE.body, styles.description, { color: employeePalette.gray600, lineHeight: 24 }]}>
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
                transform: [{ translateY: slideAnim }, { scale: buttonScaleAnim }],
              },
            ]}
          >
            <Pressable
              onPress={() => router.push("/login-selector")}
              style={({ pressed }) => [
                styles.primaryButton,
                { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
              ]}
            >
              <LinearGradient 
                colors={gradientBrand}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.buttonContent}
              >
                <Text style={[TYPE.bodyBold, { color: "#fff", fontSize: 16 }]}>
                  Get Started
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: SPACE.sm }} />
              </LinearGradient>
            </Pressable>

            {/* Footer Text */}
            <Text style={[TYPE.caption, styles.footerText, { color: employeePalette.gray500, marginTop: SPACE.md }]}>
              ✓ Trusted by sales teams worldwide
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
  bgElement1: {
    position: "absolute",
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  bgElement2: {
    position: "absolute",
    bottom: -80,
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: "rgba(16, 185, 129, 0.08)",
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
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  logoBg: {
    width: 90,
    height: 90,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: employeePalette.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  glowEffect: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.3)",
    top: -10,
    left: -10,
  },
  appName: {
    marginBottom: SPACE.xs,
    fontSize: 32,
  },
  subtitle: {
    marginBottom: SPACE.lg,
    letterSpacing: 1,
  },
  description: {
    textAlign: "center",
    lineHeight: 22,
    marginHorizontal: SPACE.md,
  },
  featuresSection: {
    marginTop: SPACE.xxxl,
    gap: SPACE.lg,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  featureIcon: {
    width: 52,
    height: 52,
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
    paddingVertical: SPACE.md + 2,
    paddingHorizontal: SPACE.lg,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: RADIUS.md,
    shadowColor: employeePalette.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  footerText: {
    textAlign: "center",
  },
});

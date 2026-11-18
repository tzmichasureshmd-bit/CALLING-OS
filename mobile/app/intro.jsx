import { useEffect, useRef } from "react";
import { View, Text, Pressable, Animated, Easing, Image, useWindowDimensions, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFonts, DancingScript_700Bold } from "@expo-google-fonts/dancing-script";

const NAVY = "#0D1B4B";
const TEAL = "#0ABFA3";

function CallWaves() {
  const anim = useRef(new Animated.Value(0)).current;
  const bars = [
    8,12,20,32,18,44,28,52,36,48,22,40,16,38,24,50,34,46,20,42,
    30,52,38,44,26,48,18,36,28,44,32,50,22,40,16,34,24,46,30,48,
  ];
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1600, useNativeDriver: false, easing: Easing.inOut(Easing.sin) })
    ).start();
    return () => anim.stopAnimation();
  }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 70 }}>
      {bars.map((h, i) => {
        const phase = (i / bars.length) * Math.PI * 2;
        const animH = anim.interpolate({
          inputRange: [0, 0.25, 0.5, 0.75, 1],
          outputRange: [
            h,
            Math.max(6, h * (0.5 + 0.3 * Math.sin(phase))),
            Math.max(6, h * (0.8 + 0.4 * Math.cos(phase))),
            Math.max(6, h * (0.6 + 0.3 * Math.sin(phase + 1))),
            h,
          ],
        });
        const isTeal = i > bars.length * 0.2 && i < bars.length * 0.8;
        return (
          <Animated.View key={i} style={{
            width: 4, height: animH, borderRadius: 3,
            backgroundColor: isTeal ? TEAL : NAVY + "44",
          }} />
        );
      })}
    </View>
  );
}

const AVATARS = ["SU", "HA", "RA", "KA", "+13"];
const AVATAR_COLORS = [TEAL, NAVY, TEAL, NAVY, NAVY];

// Creative pulsing CTA button
function PulseButton({ onPress }) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse1Opacity = useRef(new Animated.Value(0.5)).current;
  const pulse2Opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const p1 = Animated.loop(Animated.parallel([
      Animated.timing(pulse1, { toValue: 1.5, duration: 1500, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      Animated.timing(pulse1Opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ]));
    const p2 = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(pulse2, { toValue: 1.8, duration: 1500, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
      ]),
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(pulse2Opacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    ]));
    p1.start(); p2.start();
    return () => { p1.stop(); p2.stop(); };
  }, []);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, alignItems: "center", justifyContent: "center", width: "100%" })}>
      {/* Pulse rings */}
      <Animated.View style={{
        position: "absolute",
        width: "100%", height: 56, borderRadius: 28,
        backgroundColor: TEAL,
        transform: [{ scale: pulse1 }],
        opacity: pulse1Opacity,
      }} />
      <Animated.View style={{
        position: "absolute",
        width: "100%", height: 56, borderRadius: 28,
        backgroundColor: TEAL,
        transform: [{ scale: pulse2 }],
        opacity: pulse2Opacity,
      }} />
      {/* Main button */}
      <LinearGradient
        colors={[TEAL, "#089E88"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          width: "100%", height: 56, borderRadius: 28,
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
          shadowColor: TEAL, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
        }}>
        <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.5 }}>Start Monitoring</Text>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 16, color: "#fff", fontWeight: "700" }}>→</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function IntroScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [fontsLoaded] = useFonts({ DancingScript_700Bold });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EDFFF5" }}>
      <LinearGradient
        colors={["#EDFFF5", "#D8F9E8", "#C5F2DA"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* ── TOP BAR: Logo + name left, nothing right ── */}
          <View style={{
            flexDirection: "row", alignItems: "center",
            paddingHorizontal: 28, paddingTop: 20, marginBottom: 8,
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Image source={require("../assets/logo.png")} style={{ width: 38, height: 38, borderRadius: 10 }} resizeMode="contain" />
              <View>
                <Text style={{ fontSize: 18, fontWeight: "900", color: NAVY, letterSpacing: -0.3 }}>
                  Call<Text style={{ color: TEAL }}>Nexa</Text>
                </Text>
                <Text style={{ fontSize: 9, fontWeight: "700", color: TEAL, letterSpacing: 2 }}>ANALYTICS</Text>
              </View>
            </View>
          </View>

          {/* ── MAIN CONTENT ── */}
          <View style={{ flex: 1, paddingHorizontal: 28 }}>

            {/* Big heading */}
            <View style={{ marginTop: 24, marginBottom: 12 }}>
              <Text style={{
                fontSize: 58,
                fontFamily: fontsLoaded ? "DancingScript_700Bold" : undefined,
                fontWeight: fontsLoaded ? undefined : "900",
                color: NAVY, lineHeight: 66, letterSpacing: -1,
              }}>
                Call
              </Text>
              <Text style={{ fontSize: 48, fontWeight: "900", color: NAVY, lineHeight: 56, letterSpacing: -2 }}>
                Monitoring
              </Text>
              <Text style={{
                fontSize: 48,
                fontFamily: fontsLoaded ? "DancingScript_700Bold" : undefined,
                fontWeight: fontsLoaded ? undefined : "300",
                color: TEAL, lineHeight: 56, letterSpacing: -1,
              }}>
                Suite
              </Text>
            </View>

            {/* Subtitle */}
            <Text style={{ fontSize: 15, color: NAVY + "77", lineHeight: 22, marginBottom: 28 }}>
              Analyze the Team Productivity{"\n"}with Ease!
            </Text>

            {/* Waveform */}
            <CallWaves />

            <View style={{ flex: 1 }} />

            {/* ── BOTTOM CARD ── */}
            <View style={{
              backgroundColor: NAVY,
              borderRadius: 28,
              padding: 24,
              marginBottom: 8,
            }}>
              {/* Avatar row inside card */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 20 }}>
                {AVATARS.map((av, i) => (
                  <View key={i} style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: AVATAR_COLORS[i] === NAVY ? TEAL : AVATAR_COLORS[i],
                    alignItems: "center", justifyContent: "center",
                    marginLeft: i === 0 ? 0 : -10,
                    borderWidth: 2.5, borderColor: NAVY,
                    zIndex: AVATARS.length - i,
                  }}>
                    <Text style={{ fontSize: av.startsWith("+") ? 9 : 11, fontWeight: "800", color: "#fff" }}>{av}</Text>
                  </View>
                ))}
                <View style={{ marginLeft: 14 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>12 of 15 on work</Text>
                  <Text style={{ fontSize: 11, color: TEAL, marginTop: 2 }}>Team is active now</Text>
                </View>
              </View>

              {/* CTA Button - simple, no animation */}
              <Pressable onPress={() => router.push("/login-selector")}
                style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
                <View style={{ height: 54, borderRadius: 16, backgroundColor: TEAL, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: "#fff", letterSpacing: 0.3 }}>Start Monitoring</Text>
                </View>
              </Pressable>

              {/* Tzmicha branding inside card */}
              <Pressable
                onPress={() => Linking.openURL("https://www.tzmicha.com/")}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                  gap: 8, marginTop: 16,
                })}>
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: "500" }}>A product by</Text>
                <Image
                  source={require("../assets/tzmicha-logo.png")}
                  style={{ width: 80, height: 20, tintColor: "rgba(255,255,255,0.7)" }}
                  resizeMode="contain"
                />
              </Pressable>
            </View>

          </View>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

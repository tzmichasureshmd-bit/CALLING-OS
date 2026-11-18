import { useState, useRef, useEffect } from "react";
import { View, Text, Pressable, Animated, Easing, Image, ScrollView, Modal, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const NAVY = "#0D1B4B";
const TEAL = "#0ABFA3";

function ContactModal({ visible, onClose }) {
  const contacts = [
    { icon: "globe-outline",    label: "Website",  value: "www.tzmicha.com",          action: () => Linking.openURL("https://www.tzmicha.com/") },
    { icon: "mail-outline",     label: "Email",    value: "suresh.md@tzmicha.com",    action: () => Linking.openURL("mailto:suresh.md@tzmicha.com") },
    { icon: "call-outline",     label: "Phone",    value: "+91 83415 51387",           action: () => Linking.openURL("tel:+918341551387") },
  ];
  const packages = [
    { name: "Starter",    price: "Contact Sales", desc: "Up to 5 members · 1 month",    color: TEAL      },
    { name: "Growth",     price: "Contact Sales", desc: "Up to 20 members · 6 months",  color: "#8b5cf6" },
    { name: "Enterprise", price: "Contact Sales", desc: "Unlimited members · 1 year",   color: NAVY      },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(13,27,75,0.5)" }} onPress={onClose} />
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40 }}>
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: "#e5e7eb", alignSelf: "center", marginTop: 12, marginBottom: 20 }} />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: "900", color: NAVY }}>Get in Touch</Text>
              <Text style={{ fontSize: 13, color: NAVY + "66", marginTop: 2 }}>Choose your plan & start monitoring</Text>
            </View>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={NAVY} />
            </Pressable>
          </View>

          {/* Contact options */}
          {contacts.map((c, i) => (
            <Pressable key={i} onPress={c.action}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 14, backgroundColor: pressed ? TEAL + "11" : "#f8fffe", marginBottom: 10, borderWidth: 1, borderColor: TEAL + "33" })}>
              <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: TEAL + "18", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={c.icon} size={20} color={TEAL} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: NAVY + "66", textTransform: "uppercase", letterSpacing: 0.5 }}>{c.label}</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY, marginTop: 1 }}>{c.value}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={TEAL} />
            </Pressable>
          ))}

          {/* Packages */}
          <Text style={{ fontSize: 16, fontWeight: "900", color: NAVY, marginTop: 16, marginBottom: 4 }}>Choose Your Package</Text>
          <Text style={{ fontSize: 12, color: NAVY + "66", marginBottom: 12 }}>For flexible pricing & deals, contact our team</Text>
          {packages.map((p, i) => (
            <Pressable key={i} onPress={() => Linking.openURL("https://www.tzmicha.com/")}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderRadius: 14, backgroundColor: p.color + "12", marginBottom: 10, borderWidth: 1.5, borderColor: p.color + "44", opacity: pressed ? 0.8 : 1 })}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: "800", color: p.color }}>{p.name}</Text>
                <Text style={{ fontSize: 12, color: NAVY + "66", marginTop: 2 }}>{p.desc}</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <View style={{ backgroundColor: p.color, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{p.price}</Text>
                </View>
                <Text style={{ fontSize: 9, color: NAVY + "55", fontWeight: "600" }}>Tap to enquire</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function LoginSelectorScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  function handleSelect(type) {
    setSelected(type);
    setTimeout(() => router.push({ pathname: "/login", params: { userType: type } }), 250);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EDFFF5" }}>
      <LinearGradient colors={["#EDFFF5", "#D4F9E6", "#BFF0D8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fade, transform: [{ translateY: slide }] }}>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>

            {/* Logo left, name center */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingTop: 24, marginBottom: 20 }}>
              <Image source={require("../assets/logo.png")} style={{ width: 42, height: 42, borderRadius: 12 }} resizeMode="contain" />
              <View style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 22, fontWeight: "900", color: NAVY }}>Call<Text style={{ color: TEAL }}>Nexa</Text></Text>
              </View>
              <View style={{ width: 42 }} />
            </View>

            {/* Who are you */}
            <Text style={{ fontSize: 28, fontWeight: "900", color: NAVY, letterSpacing: -1, marginBottom: 4, textAlign: "center" }}>Who are you?</Text>
            <Text style={{ fontSize: 14, color: NAVY + "66", marginBottom: 28, lineHeight: 20, textAlign: "center" }}>Select your role to continue</Text>

            {/* Company Card */}
            <Pressable onPress={() => handleSelect("company")} style={{ marginBottom: 16 }}>
              <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 2.5, borderColor: selected === "company" ? TEAL : "transparent" }}>
                <LinearGradient colors={[NAVY, "#1A2D6B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, gap: 12 }}>
                  <View style={{ borderRadius: 14, overflow: "hidden", height: 110 }}>
                    <Image source={require("../assets/company.jpg")} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                    <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: TEAL + "dd", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 1 }}>ADMIN</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 2 }}>Company</Text>
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>Manage employees & analytics</Text>
                    </View>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: TEAL + "33", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="chevron-forward" size={18} color={TEAL} />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </Pressable>

            {/* OR divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: NAVY + "18" }} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: NAVY + "44" }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: NAVY + "18" }} />
            </View>

            {/* Employee Card */}
            <Pressable onPress={() => handleSelect("employee")} style={{ marginBottom: 24 }}>
              <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 2.5, borderColor: selected === "employee" ? TEAL : "transparent" }}>
                <LinearGradient colors={[NAVY, "#1A2D6B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, gap: 12 }}>
                  <View style={{ borderRadius: 14, overflow: "hidden", height: 110 }}>
                    <Image source={require("../assets/employees.jpg")} style={{ width: "100%", height: 110 }} resizeMode="cover" />
                    <View style={{ position: "absolute", top: 10, right: 10, backgroundColor: NAVY + "dd", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#fff", letterSpacing: 1 }}>STAFF</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View>
                      <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff", marginBottom: 2 }}>Employee</Text>
                      <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>View calls, logs & analytics</Text>
                    </View>
                    <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: TEAL + "33", alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name="chevron-forward" size={18} color={TEAL} />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </Pressable>

            {/* Contact Us button */}
            <Pressable onPress={() => setContactOpen(true)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: NAVY + "0a", borderWidth: 1.5, borderColor: NAVY + "18", opacity: pressed ? 0.7 : 1 })}>
              <Ionicons name="help-circle-outline" size={18} color={NAVY} />
              <Text style={{ fontSize: 14, fontWeight: "700", color: NAVY }}>Not sure? Contact us & choose your package</Text>
            </Pressable>

          </ScrollView>
        </Animated.View>
      </LinearGradient>

      <ContactModal visible={contactOpen} onClose={() => setContactOpen(false)} />
    </SafeAreaView>
  );
}

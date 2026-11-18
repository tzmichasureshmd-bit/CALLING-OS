import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  ScrollView, Platform, Keyboard, Image, ImageBackground,
  KeyboardAvoidingView, StatusBar, StyleSheet, Modal, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/AuthContext";

const CHARCOAL = "#1a1a1a";
const GRAY     = "#9ca3af";
const BORDER   = "#e5e7eb";
const TEAL     = "#0ABFA3";
const NAVY     = "#0D1B4B";

// Same ContactModal as login-selector
function ContactModal({ visible, onClose }) {
  const contacts = [
    { icon: "globe-outline",  label: "Website", value: "www.tzmicha.com",       action: () => Linking.openURL("https://www.tzmicha.com/") },
    { icon: "mail-outline",   label: "Email",   value: "suresh.md@tzmicha.com", action: () => Linking.openURL("mailto:suresh.md@tzmicha.com") },
    { icon: "call-outline",   label: "Phone",   value: "+91 83415 51387",        action: () => Linking.openURL("tel:+918341551387") },
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
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 22, fontWeight: "900", color: NAVY }}>Get in Touch</Text>
              <Text style={{ fontSize: 13, color: NAVY + "66", marginTop: 2 }}>Choose your plan & start monitoring</Text>
            </View>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="close" size={18} color={NAVY} />
            </Pressable>
          </View>
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

export default function LoginScreen() {
  const [tab, setTab]     = useState("login");
  const [error, setError] = useState("");
  const { userType = "employee" } = useLocalSearchParams();
  const isCompany = userType === "company";

  return (
    <ImageBackground
      source={require("../assets/bg-login.jpg")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 24 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* White login panel */}
            <View style={styles.panel}>

              {/* Logo + App name */}
              <View style={{ alignItems: "center", marginBottom: 28 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Image source={require("../assets/logo.png")} style={{ width: 22, height: 22, borderRadius: 6 }} resizeMode="contain" />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: CHARCOAL, letterSpacing: -0.3 }}>
                    Call<Text style={{ color: TEAL }}>Nexa</Text>
                  </Text>
                </View>
              </View>

              {/* Heading */}
              <Text style={{ fontSize: 26, fontWeight: "700", color: CHARCOAL, textAlign: "center", marginBottom: 6, letterSpacing: -0.5 }}>
                {isCompany ? "Log in to CallNexa" : "Log in to CallNexa"}
              </Text>
              <Text style={{ fontSize: 13, color: GRAY, textAlign: "center", marginBottom: 28, lineHeight: 19 }}>
                {isCompany ? "Your organization dashboard starts here" : "Your sales conversations start here"}
              </Text>

              {/* Tab switcher — employee only */}
              {!isCompany && (
                <View style={{ flexDirection: "row", backgroundColor: "#f3f4f6", borderRadius: 10, padding: 3, marginBottom: 24 }}>
                  {[{ key: "login", label: "Sign In" }, { key: "register", label: "Register" }].map(t => (
                    <Pressable key={t.key} onPress={() => { setTab(t.key); setError(""); Keyboard.dismiss(); }}
                      style={{ flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: tab === t.key ? "#fff" : "transparent", alignItems: "center",
                        shadowColor: tab === t.key ? "#000" : "transparent", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: tab === t.key ? 2 : 0 }}>
                      <Text style={{ fontSize: 13, fontWeight: "600", color: tab === t.key ? CHARCOAL : GRAY }}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Error */}
              {!!error && (
                <View style={{ backgroundColor: "#fef2f2", borderRadius: 8, padding: 10, marginBottom: 16, borderWidth: 1, borderColor: "#fecaca", flexDirection: "row", gap: 8 }}>
                  <Ionicons name="alert-circle" size={15} color="#ef4444" />
                  <Text style={{ fontSize: 12, color: "#ef4444", flex: 1, lineHeight: 17 }}>{error}</Text>
                </View>
              )}

              {/* Form */}
              {tab === "login" || isCompany
                ? <LoginForm setError={setError} expectedMode={isCompany ? "company" : "employee"} isCompany={isCompany} />
                : <RegisterForm />
              }

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

function LoginForm({ setError, expectedMode, isCompany }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const { login }   = useAuth();
  const router      = useRouter();
  const passwordRef = useRef(null);

  const SAVED_EMAIL_KEY = `callos_saved_email_${expectedMode}`;
  const SAVED_PASS_KEY  = `callos_saved_pass_${expectedMode}`;

  useEffect(() => {
    AsyncStorage.multiGet([SAVED_EMAIL_KEY, SAVED_PASS_KEY]).then(pairs => {
      if (pairs[0][1]) setEmail(pairs[0][1]);
      if (pairs[1][1]) setPassword(pairs[1][1]);
    }).catch(() => {});
  }, []);

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) { setError("Please enter your email and password"); return; }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) { setError("Please enter a valid email address"); return; }
    setError(""); setLoading(true); Keyboard.dismiss();
    try {
      await login(trimmedEmail, password, expectedMode);
      await AsyncStorage.multiSet([[SAVED_EMAIL_KEY, trimmedEmail], [SAVED_PASS_KEY, password]]);
      if (expectedMode === "company") router.replace("/(admin)/dashboard");
      else router.replace("/onboarding?mode=returning");
    } catch (e) {
      setError(e.message || "Login failed. Check your credentials.");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 0 }}>

      {/* ── "or" divider (no social login — not configured) ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
        <Text style={{ fontSize: 12, color: GRAY }}>or</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
      </View>

      {/* Email */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: CHARCOAL, marginBottom: 8 }}>Email address</Text>
        <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: BORDER, paddingBottom: 8 }}>
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="Enter your email address" placeholderTextColor={GRAY}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            autoComplete="email" returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false}
            style={{ flex: 1, fontSize: 15, color: CHARCOAL, paddingVertical: 0 }}
          />
          {email.length > 0 && (
            <Pressable onPress={() => { setEmail(""); setPassword(""); AsyncStorage.multiRemove([SAVED_EMAIL_KEY, SAVED_PASS_KEY]).catch(() => {}); }} hitSlop={8}>
              <Text style={{ fontSize: 10, color: TEAL, fontWeight: "700" }}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Password */}
      <View style={{ marginBottom: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: CHARCOAL }}>Password</Text>
          <Pressable onPress={() => setError("Please contact your administrator to reset your password.")} hitSlop={8}>
            <Text style={{ fontSize: 12, color: TEAL, fontWeight: "600" }}>Forgot password?</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: BORDER, paddingBottom: 8 }}>
          <TextInput
            ref={passwordRef} value={password} onChangeText={setPassword}
            placeholder="Enter your password" placeholderTextColor={GRAY}
            secureTextEntry={!showPwd} autoCapitalize="none" autoCorrect={false}
            autoComplete="password" returnKeyType="done" onSubmitEditing={handleLogin}
            style={{ flex: 1, fontSize: 15, color: CHARCOAL, paddingVertical: 0 }}
          />
          <Pressable onPress={() => setShowPwd(s => !s)} hitSlop={8}>
            <Ionicons name={showPwd ? "eye-off-outline" : "eye-outline"} size={18} color={GRAY} />
          </Pressable>
        </View>
      </View>

      {/* Continue with Email */}
      <Pressable onPress={handleLogin} disabled={loading} style={{ marginTop: 28, marginBottom: 20 }}>
        <View style={{ height: 52, borderRadius: 12, backgroundColor: CHARCOAL, alignItems: "center", justifyContent: "center", opacity: loading ? 0.7 : 1 }}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: 0.2 }}>Continue with Email</Text>
          }
        </View>
      </Pressable>

      {/* Sign up / Get in Touch */}
      {isCompany ? (
        <Pressable onPress={() => setContactOpen(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 })}>
          <Ionicons name="headset-outline" size={14} color={TEAL} />
          <Text style={{ fontSize: 13, color: GRAY }}>Need access? <Text style={{ fontWeight: "700", color: CHARCOAL }}>Get in touch</Text></Text>
        </Pressable>
      ) : (
        <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: GRAY }}>Don't have an account?</Text>
          <Pressable onPress={() => router.push("/onboarding")} hitSlop={8}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: CHARCOAL }}>Sign up</Text>
          </Pressable>
        </View>
      )}

      <ContactModal visible={contactOpen} onClose={() => setContactOpen(false)} />

    </View>
  );
}

function RegisterForm() {
  const router = useRouter();
  const { isAuthed, logout } = useAuth();

  async function startOnboarding() {
    Keyboard.dismiss();
    if (isAuthed) await logout();
    router.replace("/onboarding");
  }

  const steps = [
    { icon: "key-outline",              text: "Enter company code",  color: TEAL      },
    { icon: "person-add-outline",       text: "Create your account", color: "#8b5cf6" },
    { icon: "shield-checkmark-outline", text: "Grant permissions",   color: "#10b981" },
    { icon: "phone-portrait-outline",   text: "Select SIM card",     color: "#f59e0b" },
    { icon: "checkmark-done-outline",   text: "Start syncing",       color: "#06b6d4" },
  ];

  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 13, color: GRAY, lineHeight: 20 }}>
        Get your <Text style={{ fontWeight: "700", color: CHARCOAL }}>Company Code</Text> from your manager and complete the 2-minute setup.
      </Text>
      <View style={{ gap: 8 }}>
        {steps.map((step, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#f9fafb", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: BORDER }}>
            <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: step.color + "18", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={step.icon} size={17} color={step.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, fontWeight: "700", color: step.color, letterSpacing: 0.5 }}>STEP {i + 1}</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: CHARCOAL, marginTop: 1 }}>{step.text}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable onPress={startOnboarding}>
        <View style={{ height: 52, borderRadius: 12, backgroundColor: CHARCOAL, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff" }}>Begin Setup</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 24,
    maxWidth: 420,
    width: "100%",
    alignSelf: "center",
  },
});

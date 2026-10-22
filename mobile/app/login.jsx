import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { palette, gradientBrand, gradientHero, useTheme, TYPE, SPACE, RADIUS } from "../src/theme";
import { useAuth } from "../src/AuthContext";

export default function LoginScreen() {
  const [tab, setTab]     = useState("login");
  const [error, setError] = useState("");
  const { theme }         = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top","bottom"]}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header — matches web hero dark bg */}
          <LinearGradient
            colors={gradientHero}
            style={{ paddingTop: 56, paddingBottom: 40, paddingHorizontal: SPACE.xxl, position: "relative", overflow: "hidden" }}
          >
            {/* Radial glow */}
            <View style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: palette.teal + "12" }} />
            <View style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: palette.violet + "0a" }} />
            {/* Logo row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, marginBottom: SPACE.lg }}>
              <View style={{ width: 44, height: 44, borderRadius: RADIUS.lg, backgroundColor: palette.teal + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.teal + "44" }}>
                <Ionicons name="call" size={22} color={palette.teal} />
              </View>
              <Text style={{ fontSize: 22, fontWeight: "800", color: "#eef2f9", letterSpacing: 0.3 }}>
                Call<Text style={{ color: palette.teal }}>Nexa</Text>
              </Text>
            </View>
            <Text style={{ fontSize: 28, fontWeight: "800", color: "#eef2f9", letterSpacing: -0.5, lineHeight: 34 }}>
              {tab === "login" ? "Welcome back" : "Get started"}
            </Text>
            <Text style={{ ...TYPE.body, color: "rgba(238,242,249,0.65)", marginTop: SPACE.sm }}>
              {tab === "login" ? "Sign in to your CallNexa account" : "New here? Set up your employee account"}
            </Text>
          </LinearGradient>

          {/* Form card — overlaps header */}
          <View style={{
            flex: 1,
            backgroundColor: theme.surface,
            borderTopLeftRadius: RADIUS.xxl + 4,
            borderTopRightRadius: RADIUS.xxl + 4,
            marginTop: -SPACE.xl,
            paddingHorizontal: SPACE.xxl,
            paddingTop: SPACE.xxl,
            paddingBottom: SPACE.huge,
          }}>
            {/* Tab switcher */}
            <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: SPACE.xxxl }}>
              {["login", "register"].map((t) => (
                <Pressable
                  key={t}
                  onPress={() => { setTab(t); setError(""); }}
                  style={{ flex: 1, paddingBottom: SPACE.md, alignItems: "center", borderBottomWidth: 2, borderBottomColor: tab === t ? palette.teal : "transparent", marginBottom: -1 }}
                >
                  <Text style={{ ...TYPE.bodyBold, color: tab === t ? palette.teal : theme.muted }}>
                    {t === "login" ? "Sign In" : "Register"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Error */}
            {!!error && (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: SPACE.sm, backgroundColor: theme.dangerSoft, borderRadius: RADIUS.md, padding: SPACE.md, marginBottom: SPACE.lg, borderWidth: 1, borderColor: theme.danger + "33" }}>
                <Ionicons name="alert-circle" size={16} color={theme.danger} style={{ marginTop: 1 }} />
                <Text style={{ ...TYPE.caption, color: theme.danger, flex: 1, lineHeight: 20 }}>{error}</Text>
              </View>
            )}

            {tab === "login" ? <LoginForm setError={setError} /> : <RegisterForm />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoginForm({ setError }) {
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const { login }             = useAuth();
  const router                = useRouter();
  const { theme }             = useTheme();

  async function handle() {
    if (!email.trim() || !password.trim()) { setError("Please enter your email and password"); return; }
    setError(""); setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/onboarding?mode=returning");
    } catch (e) {
      setError(e.message || "Incorrect email or password");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 18 }}>
      <InputField
        label="Email address"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        theme={theme}
      />
      <InputField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Enter your password"
        secureTextEntry={!showPw}
        theme={theme}
        right={
          <Pressable onPress={() => setShowPw(s => !s)} hitSlop={8}>
            <Ionicons name={showPw ? "eye-off" : "eye"} size={18} color={theme.dim} />
          </Pressable>
        }
      />
      <PrimaryButton label="Sign In" loading={loading} onPress={handle} />
    </View>
  );
}

function RegisterForm() {
  const router        = useRouter();
  const { theme }     = useTheme();
  const { isAuthed, logout } = useAuth();

  async function start() {
    if (isAuthed) await logout();
    router.replace("/onboarding");
  }

  return (
    <View style={{ gap: SPACE.lg }}>
      <Text style={{ ...TYPE.body, color: theme.muted, lineHeight: 22 }}>
        You'll need a <Text style={{ color: theme.primary, fontWeight: "600" }}>Company Code</Text> from your manager. The setup wizard takes about 2 minutes.
      </Text>

      <View style={{ gap: SPACE.sm }}>
        {[
          { n: "1", text: "Enter your company code",    color: palette.teal   },
          { n: "2", text: "Create your account",         color: palette.violet },
          { n: "3", text: "Grant call log permissions",  color: palette.emerald},
          { n: "4", text: "Select your SIM card",        color: palette.cyan   },
          { n: "5", text: "Start syncing calls",         color: palette.amber  },
        ].map(s => (
          <View key={s.n} style={{ flexDirection: "row", alignItems: "center", gap: SPACE.md, backgroundColor: theme.surface2, borderRadius: RADIUS.lg, padding: SPACE.md, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ width: 30, height: 30, borderRadius: RADIUS.md, backgroundColor: s.color + "22", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: s.color + "44" }}>
              <Text style={{ ...TYPE.label, color: s.color }}>{s.n}</Text>
            </View>
            <Text style={{ ...TYPE.body, color: theme.secondary, flex: 1 }}>{s.text}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton label="Begin Setup" onPress={start} />
    </View>
  );
}

function InputField({ label, right, theme, ...props }) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={{ ...TYPE.label, color: theme.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: SPACE.sm }}>{label}</Text>
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: theme.surface2,
        borderRadius: RADIUS.lg,
        borderWidth: 1.5,
        borderColor: focused ? palette.teal : theme.border,
        paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md,
        shadowColor: focused ? palette.teal : "transparent",
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: focused ? 0.2 : 0,
        shadowRadius: 8,
        elevation: focused ? 2 : 0,
      }}>
        <TextInput
          {...props}
          placeholderTextColor={theme.dim}
          style={{ flex: 1, ...TYPE.body, color: theme.primary }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {right}
      </View>
    </View>
  );
}

function PrimaryButton({ label, loading, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={{ marginTop: SPACE.xs }}>
      <LinearGradient
        colors={gradientBrand}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{
          height: 52, borderRadius: RADIUS.lg,
          alignItems: "center", justifyContent: "center",
          opacity: loading ? 0.75 : 1,
          shadowColor: palette.teal, shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35, shadowRadius: 14, elevation: 6,
        }}
      >
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ ...TYPE.bodyBold, color: "#fff", letterSpacing: 0.2 }}>{label}</Text>
        }
      </LinearGradient>
    </Pressable>
  );
}

import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { palette, gradientBrand, useTheme } from "../src/theme";
import { useAuth } from "../src/AuthContext";

export default function LoginScreen() {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24 }} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={{ alignItems: "center", marginTop: 36, marginBottom: 32 }}>
            <Image source={require("../assets/logo.png")} style={{ width: 76, height: 76, borderRadius: 22, marginBottom: 14 }} resizeMode="contain" />
            <Text style={{ fontSize: 26, fontWeight: "800", color: theme.primary }}>
              Call<Text style={{ color: palette.teal }}>Nexa</Text>
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>Employee Sales Monitoring</Text>
          </View>

          {/* Toggle */}
          <View style={{ flexDirection: "row", backgroundColor: theme.surface, borderRadius: 14, padding: 4, marginBottom: 24, borderWidth: 1, borderColor: theme.border }}>
            {["login", "register"].map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setError(""); }}
                style={{ flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: "center", backgroundColor: mode === m ? theme.accent : "transparent" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: mode === m ? "#fff" : theme.muted }}>
                  {m === "login" ? "Sign In" : "Register"}
                </Text>
              </Pressable>
            ))}
          </View>

          {!!error && (
            <View style={{ backgroundColor: palette.red + "18", borderRadius: 10, padding: 12, marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="alert-circle-outline" size={16} color={palette.red} />
              <Text style={{ fontSize: 13, color: palette.red, flex: 1 }}>{error}</Text>
            </View>
          )}

          {mode === "login" ? <LoginForm setError={setError} /> : <RegisterForm setError={setError} />}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Login: email + password → straight to tabs ────────────────────────────────
function LoginForm({ setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  async function handle() {
    if (!email.trim() || !password.trim()) { setError("Email and password are required"); return; }
    setError(""); setLoading(true);
    try {
      await login(email.trim(), password);
      // Go to onboarding to re-verify permissions + SIM on each login
      router.replace("/onboarding?mode=returning");
    } catch (e) {
      setError(e.message || "Invalid email or password");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 16 }}>
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com"
        keyboardType="email-address" autoCapitalize="none" theme={theme} />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••"
        secureTextEntry={!showPw} theme={theme}
        right={<Pressable onPress={() => setShowPw((s) => !s)}>
          <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={theme.dim} />
        </Pressable>} />
      <SubmitBtn loading={loading} label="Sign In" onPress={handle} />
    </View>
  );
}

// ── Register: goes to onboarding (company code first) ────────────────────────
function RegisterForm({ setError }) {
  const router = useRouter();
  const { theme } = useTheme();
  const { logout, isAuthed } = useAuth();

  async function startWizard() {
    if (isAuthed) await logout();
    router.replace("/onboarding");
  }

  // Register just redirects to onboarding — all steps happen there
  return (
    <View style={{ gap: 16 }}>
      <View style={{ backgroundColor: palette.teal + "12", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: palette.teal + "33" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <MaterialCommunityIcons name="shield-key-outline" size={20} color={palette.teal} />
          <Text style={{ fontSize: 14, fontWeight: "700", color: theme.primary }}>New Employee?</Text>
        </View>
        <Text style={{ fontSize: 13, color: theme.muted, lineHeight: 20 }}>
          You'll need your <Text style={{ fontWeight: "700", color: palette.teal }}>Company Code</Text> from your manager to register.{"\n"}
          The setup wizard will guide you through everything.
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {[
          { icon: "shield-key-outline",       label: "Enter Company Code" },
          { icon: "person-add-outline",        label: "Create your account" },
          { icon: "shield-checkmark-outline",  label: "Grant permissions" },
          { icon: "phone-portrait-outline",    label: "Select & verify SIM" },
          { icon: "checkmark-done-outline",    label: "Start syncing calls" },
        ].map((s, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: palette.teal + "1a", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={s.icon} size={16} color={palette.teal} />
            </View>
            <Text style={{ fontSize: 13.5, color: theme.secondary }}>{s.label}</Text>
          </View>
        ))}
      </View>

      <Pressable onPress={startWizard} style={{ marginTop: 4 }}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Start Setup Wizard</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function Field({ label, right, theme, ...props }) {
  return (
    <View>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.secondary, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 13, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 13 }}>
        <TextInput {...props} placeholderTextColor={theme.dim} style={{ flex: 1, fontSize: 14.5, color: theme.primary }} />
        {right}
      </View>
    </View>
  );
}

function SubmitBtn({ loading, label, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={{ marginTop: 4 }}>
      <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
        {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

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
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [error, setError] = useState("");
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={{ alignItems: "center", marginTop: 32, marginBottom: 28 }}>
            <Image
              source={require("../assets/logo.png")}
              style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 12 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 24, fontWeight: "800", color: theme.primary }}>
              Call<Text style={{ color: palette.teal }}>Nexa</Text>
            </Text>
            <Text style={{ fontSize: 13, color: theme.muted, marginTop: 4 }}>Employee Sales Monitoring</Text>
          </View>

          {/* Mode toggle */}
          <View style={{ flexDirection: "row", backgroundColor: theme.surface, borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: theme.border }}>
            {["login", "register"].map((m) => (
              <Pressable key={m} onPress={() => { setMode(m); setError(""); }}
                style={{ flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: "center",
                  backgroundColor: mode === m ? theme.accent : "transparent" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: mode === m ? "#fff" : theme.muted }}>
                  {m === "login" ? "Sign In" : "Register"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Error */}
          {!!error && (
            <View style={{ backgroundColor: theme.dangerSoft, borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={{ fontSize: 13, color: theme.danger, flex: 1 }}>{error}</Text>
            </View>
          )}

          {mode === "login"
            ? <LoginForm setError={setError} />
            : <RegisterForm setError={setError} />
          }

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function LoginForm({ setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setError("Email and password are required"); return; }
    setError(""); setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e) {
      setError(e.message || "Invalid email or password");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 14 }}>
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="your@email.com"
        keyboardType="email-address" autoCapitalize="none" theme={theme} />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="••••••••"
        secureTextEntry={!showPw} theme={theme}
        right={<Pressable onPress={() => setShowPw((s) => !s)}>
          <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={theme.dim} />
        </Pressable>} />
      <SubmitBtn loading={loading} label="Sign In" onPress={handleLogin} />
    </View>
  );
}

function RegisterForm({ setError }) {
  const [f, setF] = useState({ name: "", email: "", password: "", company_code: "" });
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  async function handleRegister() {
    if (!f.name.trim())         { setError("Name is required"); return; }
    if (!f.email.trim())        { setError("Email is required"); return; }
    if (!f.password.trim())     { setError("Password is required"); return; }
    if (!f.company_code.trim()) { setError("Company code is required"); return; }
    setError(""); setLoading(true);
    try {
      await register({ name: f.name.trim(), email: f.email.trim(), password: f.password, company_code: f.company_code.trim().toUpperCase() });
      router.replace("/onboarding");
    } catch (e) {
      setError(e.message || "Registration failed. Check your company code.");
    } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 14 }}>
      <Field label="Full Name" value={f.name} onChangeText={set("name")} placeholder="Rahul Sharma" theme={theme} />
      <Field label="Email" value={f.email} onChangeText={set("email")} placeholder="rahul@company.com"
        keyboardType="email-address" autoCapitalize="none" theme={theme} />
      <Field label="Password" value={f.password} onChangeText={set("password")} placeholder="Min 8 characters"
        secureTextEntry={!showPw} theme={theme}
        right={<Pressable onPress={() => setShowPw((s) => !s)}>
          <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={theme.dim} />
        </Pressable>} />

      {/* Company Code — highlighted */}
      <View>
        <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.secondary, marginBottom: 6 }}>Company Code</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.accentSoft,
          borderRadius: 13, borderWidth: 1.5, borderColor: theme.accent, paddingHorizontal: 14, paddingVertical: 13, gap: 10 }}>
          <MaterialCommunityIcons name="shield-key-outline" size={18} color={theme.accent} />
          <TextInput
            value={f.company_code}
            onChangeText={set("company_code")}
            placeholder="e.g. TZM-2026-5823"
            placeholderTextColor={theme.dim}
            autoCapitalize="characters"
            style={{ flex: 1, fontSize: 15, fontWeight: "700", color: theme.accent, letterSpacing: 0.5 }}
          />
        </View>
        <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 5 }}>
          Ask your manager for the company code to join your organization.
        </Text>
      </View>

      <SubmitBtn loading={loading} label="Create Account & Join" onPress={handleRegister} />
    </View>
  );
}

function Field({ label, right, theme, ...props }) {
  return (
    <View>
      <Text style={{ fontSize: 12.5, fontWeight: "600", color: theme.secondary, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.surface,
        borderRadius: 13, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 14, paddingVertical: 13 }}>
        <TextInput
          {...props}
          placeholderTextColor={theme.dim}
          style={{ flex: 1, fontSize: 14.5, color: theme.primary }}
        />
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
        {loading
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{label}</Text>
        }
      </LinearGradient>
    </Pressable>
  );
}

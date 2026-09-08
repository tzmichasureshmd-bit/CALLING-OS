import { useState } from "react";
import {
  View, Text, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { palette, useTheme } from "../src/theme";
import { useAuth } from "../src/AuthContext";

export default function LoginScreen() {
  const [tab, setTab]     = useState("login");
  const [error, setError] = useState("");
  const { theme }         = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={["top","bottom"]}>
      <StatusBar barStyle={theme.mode === "dark" ? "light-content" : "dark-content"} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ paddingTop: 48, paddingBottom: 40 }}>
            <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: palette.teal + "18", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
              <Ionicons name="call" size={24} color={palette.teal} />
            </View>
            <Text style={{ fontSize: 28, fontWeight: "700", color: theme.primary, letterSpacing: -0.5 }}>
              {tab === "login" ? "Welcome back" : "Get started"}
            </Text>
            <Text style={{ fontSize: 15, color: theme.muted, marginTop: 6, lineHeight: 22 }}>
              {tab === "login"
                ? "Sign in to your CallNexa account"
                : "New here? Set up your employee account"}
            </Text>
          </View>

          {/* Tab switcher */}
          <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: theme.border, marginBottom: 32 }}>
            {["login", "register"].map((t) => (
              <Pressable
                key={t}
                onPress={() => { setTab(t); setError(""); }}
                style={{ flex: 1, paddingBottom: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: tab === t ? palette.teal : "transparent", marginBottom: -1 }}
              >
                <Text style={{ fontSize: 14, fontWeight: tab === t ? "700" : "500", color: tab === t ? palette.teal : theme.muted }}>
                  {t === "login" ? "Sign In" : "Register"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Error */}
          {!!error && (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: theme.dangerSoft, borderRadius: 10, padding: 12, marginBottom: 20 }}>
              <Ionicons name="alert-circle" size={16} color={theme.danger} style={{ marginTop: 1 }} />
              <Text style={{ fontSize: 13.5, color: theme.danger, flex: 1, lineHeight: 20 }}>{error}</Text>
            </View>
          )}

          {tab === "login" ? <LoginForm setError={setError} /> : <RegisterForm />}

          <View style={{ height: 40 }} />
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
    <View style={{ gap: 20 }}>
      <Text style={{ fontSize: 14, color: theme.muted, lineHeight: 22 }}>
        You'll need a <Text style={{ color: theme.primary, fontWeight: "600" }}>Company Code</Text> from your manager. The setup wizard takes about 2 minutes.
      </Text>

      <View style={{ gap: 12 }}>
        {[
          { n: "1", text: "Enter your company code" },
          { n: "2", text: "Create your account" },
          { n: "3", text: "Grant call log permissions" },
          { n: "4", text: "Select your SIM card" },
          { n: "5", text: "Start syncing calls" },
        ].map(s => (
          <View key={s.n} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: theme.surface2 || theme.surface, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: theme.muted }}>{s.n}</Text>
            </View>
            <Text style={{ fontSize: 14, color: theme.secondary }}>{s.text}</Text>
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
      <Text style={{ fontSize: 13, fontWeight: "600", color: theme.secondary, marginBottom: 8 }}>{label}</Text>
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: theme.surface,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: focused ? palette.teal : theme.border,
        paddingHorizontal: 14, paddingVertical: 13,
      }}>
        <TextInput
          {...props}
          placeholderTextColor={theme.dim}
          style={{ flex: 1, fontSize: 15, color: theme.primary }}
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
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => ({
        backgroundColor: pressed ? palette.tealDark : palette.teal,
        borderRadius: 12,
        paddingVertical: 15,
        alignItems: "center",
        marginTop: 4,
        opacity: loading ? 0.8 : 1,
      })}
    >
      {loading
        ? <ActivityIndicator color="#fff" size="small" />
        : <Text style={{ fontSize: 15, fontWeight: "700", color: "#fff", letterSpacing: 0.2 }}>{label}</Text>
      }
    </Pressable>
  );
}

import { useState } from "react";
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  ScrollView, StatusBar, Platform, Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { palette, gradientBrand, useTheme } from "../src/theme";
import { useAuth } from "../src/AuthContext";

export default function LoginScreen() {
  const [tab, setTab] = useState("login");
  const [error, setError] = useState("");
  const { theme } = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.bg} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, padding: 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Tagline */}
        <View style={{ alignItems: "center", marginTop: 40, marginBottom: 40 }}>
          <View style={{ 
            width: 72, 
            height: 72, 
            borderRadius: 20, 
            backgroundColor: palette.teal + "15",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            borderWidth: 2,
            borderColor: palette.teal + "30",
          }}>
            <Ionicons name="call" size={36} color={palette.teal} />
          </View>
          <Text style={{ 
            fontSize: 28, 
            fontWeight: "800", 
            color: theme.primary,
            marginBottom: 8,
          }}>
            CallNexa
          </Text>
          <Text style={{ 
            fontSize: 15, 
            color: theme.muted,
            textAlign: "center",
          }}>
            Track your calls. Grow your sales.
          </Text>
        </View>

        {/* Tab Switcher */}
        <View style={{ 
          flexDirection: "row", 
          backgroundColor: theme.surface, 
          borderRadius: 12, 
          padding: 4,
          marginBottom: 32,
        }}>
          {[
            { key: "login", label: "Sign In" },
            { key: "register", label: "Register" }
          ].map((t) => (
            <Pressable
              key={t.key}
              onPress={() => { 
                setTab(t.key); 
                setError(""); 
                Keyboard.dismiss();
              }}
              style={{ 
                flex: 1, 
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: tab === t.key ? palette.teal : "transparent",
                alignItems: "center",
              }}
            >
              <Text style={{ 
                fontSize: 15, 
                fontWeight: "700",
                color: tab === t.key ? "#fff" : theme.muted,
              }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Error Message */}
        {!!error && (
          <View style={{ 
            backgroundColor: "#ef444415",
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: "#ef444430",
            flexDirection: "row",
            gap: 10,
          }}>
            <Ionicons name="alert-circle" size={18} color="#ef4444" />
            <Text style={{ 
              fontSize: 13, 
              color: "#ef4444",
              flex: 1,
              lineHeight: 19,
            }}>
              {error}
            </Text>
          </View>
        )}

        {/* Form Content */}
        {tab === "login" ? (
          <LoginForm setError={setError} />
        ) : (
          <RegisterForm />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Login Form ─────────────────────────────────────────────────────────────────
function LoginForm({ setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();

  async function handleLogin() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Please enter your email and password");
      return;
    }

    setError("");
    setLoading(true);
    Keyboard.dismiss();

    try {
      await login(trimmedEmail, password);
      router.replace("/onboarding?mode=returning");
    } catch (e) {
      setError(e.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={{ gap: 20 }}>
      {/* Email Input */}
      <View>
        <Text style={{ 
          fontSize: 13, 
          fontWeight: "600", 
          color: theme.muted,
          marginBottom: 8,
        }}>
          Email
        </Text>
        <View style={{ 
          backgroundColor: theme.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
        }}>
          <Ionicons name="mail-outline" size={18} color={theme.dim} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@company.com"
            placeholderTextColor={theme.dim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            returnKeyType="next"
            style={{
              flex: 1,
              fontSize: 15,
              color: theme.primary,
              paddingVertical: Platform.OS === "android" ? 12 : 16,
              paddingHorizontal: 12,
            }}
          />
        </View>
      </View>

      {/* Password Input */}
      <View>
        <Text style={{ 
          fontSize: 13, 
          fontWeight: "600", 
          color: theme.muted,
          marginBottom: 8,
        }}>
          Password
        </Text>
        <View style={{ 
          backgroundColor: theme.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: theme.border,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
        }}>
          <Ionicons name="lock-closed-outline" size={18} color={theme.dim} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            placeholderTextColor={theme.dim}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            style={{
              flex: 1,
              fontSize: 15,
              color: theme.primary,
              paddingVertical: Platform.OS === "android" ? 12 : 16,
              paddingHorizontal: 12,
            }}
          />
          <Pressable 
            onPress={() => setShowPassword(s => !s)}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Ionicons 
              name={showPassword ? "eye-off-outline" : "eye-outline"} 
              size={18} 
              color={theme.dim} 
            />
          </Pressable>
        </View>
      </View>

      {/* Login Button */}
      <Pressable 
        onPress={handleLogin} 
        disabled={loading}
        style={{ marginTop: 12 }}
      >
        <LinearGradient
          colors={[palette.teal, "#0d9488"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            height: 52,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ 
                fontSize: 16, 
                fontWeight: "700", 
                color: "#fff",
              }}>
                Sign In
              </Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </View>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Register Form ──────────────────────────────────────────────────────────────
function RegisterForm() {
  const router = useRouter();
  const { theme } = useTheme();
  const { isAuthed, logout } = useAuth();

  async function startOnboarding() {
    Keyboard.dismiss();
    if (isAuthed) await logout();
    router.replace("/onboarding");
  }

  const steps = [
    { icon: "key-outline", text: "Enter company code", color: palette.teal },
    { icon: "person-add-outline", text: "Create your account", color: "#8b5cf6" },
    { icon: "shield-checkmark-outline", text: "Grant permissions", color: "#10b981" },
    { icon: "phone-portrait-outline", text: "Select SIM card", color: "#f59e0b" },
    { icon: "checkmark-done-outline", text: "Start syncing", color: "#06b6d4" },
  ];

  return (
    <View style={{ gap: 24 }}>
      <Text style={{ 
        fontSize: 15, 
        color: theme.muted,
        lineHeight: 22,
      }}>
        New to CallNexa? Get your <Text style={{ fontWeight: "700", color: theme.primary }}>Company Code</Text> from your manager and complete the 2-minute setup.
      </Text>

      {/* Setup Steps */}
      <View style={{ gap: 12 }}>
        {steps.map((step, index) => (
          <View 
            key={index}
            style={{ 
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              backgroundColor: theme.surface,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <View style={{ 
              width: 40, 
              height: 40, 
              borderRadius: 10,
              backgroundColor: step.color + "15",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: step.color + "30",
            }}>
              <Ionicons name={step.icon} size={20} color={step.color} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ 
                  fontSize: 11, 
                  fontWeight: "700",
                  color: step.color,
                }}>
                  STEP {index + 1}
                </Text>
              </View>
              <Text style={{ 
                fontSize: 14, 
                fontWeight: "600",
                color: theme.primary,
                marginTop: 2,
              }}>
                {step.text}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Begin Setup Button */}
      <Pressable onPress={startOnboarding} style={{ marginTop: 8 }}>
        <LinearGradient
          colors={[palette.teal, "#0d9488"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            height: 52,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: "700", 
              color: "#fff",
            }}>
              Begin Setup
            </Text>
            <Ionicons name="arrow-forward-circle" size={20} color="#fff" />
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

import { useState } from "react";
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "../src/theme";
import { useAuth } from "../src/AuthContext";

let Permissions = null;
try { Permissions = require("react-native-permissions"); } catch {}

const STEPS = [
  { icon: "shield-checkmark-outline", label: "Permissions" },
  { icon: "person-add-outline",        label: "Sign Up" },
  { icon: "phone-portrait-outline",    label: "SIM\nSelection" },
  { icon: "checkmark-done-outline",    label: "SIM\nVerification" },
  { icon: "grid-outline",              label: "Dashboard" },
];

const PERMS = [
  { icon: "call-outline",           title: "Call Log",    sub: "Read call history" },
  { icon: "phone-portrait-outline", title: "Phone State", sub: "Detect calls" },
  { icon: "people-outline",         title: "Contacts",    sub: "Match names" },
  { icon: "folder-outline",         title: "Storage",     sub: "Access recordings" },
];

export default function Onboarding() {
  const router = useRouter();
  const { theme, shadow } = useTheme();
  const [step, setStep] = useState(0);

  const goNext = () => {
    if (step === STEPS.length - 1) router.replace("/(tabs)");
    else setStep((s) => s + 1);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary }}>Let's Get You Set Up</Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>Step {step + 1} of 5</Text>
          </View>
          <Text style={{ fontSize: 13.5, color: theme.muted, marginBottom: 20 }}>
            Follow the steps to activate CallNexa on your device.
          </Text>

          {/* Step indicators */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24, position: "relative" }}>
            <View style={{ position: "absolute", top: 20, left: 20, right: 20, height: 2, backgroundColor: theme.border }} />
            {STEPS.map((s, i) => {
              const done = i <= step;
              return (
                <Pressable key={i} onPress={() => i < step && setStep(i)} style={{ alignItems: "center", flex: 1, zIndex: 1 }}>
                  {done ? (
                    <LinearGradient colors={gradientBrand} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={s.icon} size={17} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                      <Ionicons name={s.icon} size={17} color={theme.dim} />
                    </View>
                  )}
                  <Text style={{ fontSize: 9.5, color: i === step ? theme.accent : theme.dim, fontWeight: i === step ? "700" : "500", textAlign: "center", marginTop: 5 }}>
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Step content */}
          <View style={[{ backgroundColor: theme.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: theme.border }, shadow]}>
            <View style={{ alignSelf: "center", width: 60, height: 5, borderRadius: 3, backgroundColor: theme.border, marginBottom: 16 }} />

            {step === 0 && <PermissionsStep />}
            {step === 1 && <SignUpStep onDone={goNext} />}
            {step === 2 && <SimStep theme={theme} />}
            {step === 3 && <SimVerifyStep theme={theme} />}
            {step === 4 && <DoneStep theme={theme} />}
          </View>

          <View style={{ flex: 1, minHeight: 20 }} />

          {/* Bottom CTA — only for non-form steps */}
          {step !== 1 && (
            <>
              <Pressable onPress={goNext}>
                <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 16 }}>
                  <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
                    {step === 0 ? "Grant Permissions" : step === STEPS.length - 1 ? "Go to Dashboard" : "Continue"}
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => router.replace("/(tabs)")} style={{ alignItems: "center", marginTop: 12 }}>
                <Text style={{ fontSize: 12.5, color: theme.muted }}>You can change this later from settings</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Step 0: Permissions ───────────────────────────────────────────────────────
function PermissionsStep() {
  const { theme } = useTheme();
  const [granted, setGranted] = useState({});

  async function requestAll() {
    if (!Permissions || Platform.OS !== "android") {
      setGranted({ callLog: true, phoneState: true, contacts: true, storage: true });
      return;
    }
    const { PERMISSIONS, requestMultiple, RESULTS } = Permissions;
    const results = await requestMultiple([
      PERMISSIONS.ANDROID.READ_CALL_LOG,
      PERMISSIONS.ANDROID.READ_PHONE_STATE,
      PERMISSIONS.ANDROID.READ_CONTACTS,
      PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    ]);
    setGranted({
      callLog: results[PERMISSIONS.ANDROID.READ_CALL_LOG] === RESULTS.GRANTED,
      phoneState: results[PERMISSIONS.ANDROID.READ_PHONE_STATE] === RESULTS.GRANTED,
      contacts: results[PERMISSIONS.ANDROID.READ_CONTACTS] === RESULTS.GRANTED,
      storage: results[PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE] === RESULTS.GRANTED,
    });
  }

  const perms = [
    { key: "callLog",    icon: "call-outline",           title: "Call Log",    sub: "Read call history" },
    { key: "phoneState", icon: "phone-portrait-outline", title: "Phone State", sub: "Detect calls & SIM" },
    { key: "contacts",   icon: "people-outline",         title: "Contacts",    sub: "Match caller names" },
    { key: "storage",    icon: "folder-outline",         title: "Storage",     sub: "Access recordings" },
  ];

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary, marginBottom: 6 }}>Grant Permissions</Text>
      {perms.map((p) => (
        <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: theme.surface2 || theme.bg, borderRadius: 12, padding: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: palette.teal + "1a", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name={p.icon} size={16} color={theme.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "600", color: theme.primary }}>{p.title}</Text>
            <Text style={{ fontSize: 11, color: theme.dim }}>{p.sub}</Text>
          </View>
          <Ionicons name={granted[p.key] ? "checkmark-circle" : "ellipse-outline"} size={19} color={granted[p.key] ? palette.emerald : theme.dim} />
        </View>
      ))}
      <Pressable onPress={requestAll} style={{ marginTop: 6 }}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Request All Permissions</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Step 1: Sign Up (real form) ───────────────────────────────────────────────
function SignUpStep({ onDone }) {
  const { theme } = useTheme();
  const { register, isAuthed } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", company_code: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  // If already logged in, skip this step
  if (isAuthed) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 20 }}>
        <Ionicons name="checkmark-circle" size={48} color={palette.emerald} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary, marginTop: 12 }}>Already signed in!</Text>
        <Text style={{ fontSize: 13, color: theme.muted, marginTop: 6, textAlign: "center" }}>Your account is connected. Continue to set up your SIM.</Text>
        <Pressable onPress={onDone} style={{ marginTop: 16 }}>
          <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 48, borderRadius: 13, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Continue</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  async function handleRegister() {
    if (!f.name.trim())         { setError("Name is required"); return; }
    if (!f.email.trim())        { setError("Email is required"); return; }
    if (!f.password.trim())     { setError("Password is required"); return; }
    if (!f.company_code.trim()) { setError("Company code is required"); return; }
    setError(""); setLoading(true);
    try {
      await register({ name: f.name.trim(), email: f.email.trim(), password: f.password, company_code: f.company_code.trim().toUpperCase() });
      onDone();
    } catch (e) {
      setError(e.message || "Registration failed. Check your company code.");
    } finally { setLoading(false); }
  }

  const inp = (label, key, props = {}) => (
    <View key={key}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: theme.secondary, marginBottom: 5 }}>{label}</Text>
      <TextInput
        value={f[key]}
        onChangeText={set(key)}
        placeholderTextColor={theme.dim}
        style={{ backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border,
          paddingHorizontal: 13, paddingVertical: 12, fontSize: 14, color: theme.primary }}
        {...props}
      />
    </View>
  );

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary, marginBottom: 2 }}>Create Your Account</Text>
      <Text style={{ fontSize: 12.5, color: theme.muted, marginBottom: 4 }}>Enter your company code to join your organization.</Text>

      {!!error && (
        <View style={{ backgroundColor: theme.dangerSoft, borderRadius: 9, padding: 10, flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Ionicons name="alert-circle-outline" size={15} color={theme.danger} />
          <Text style={{ fontSize: 12.5, color: theme.danger, flex: 1 }}>{error}</Text>
        </View>
      )}

      {inp("Full Name", "name", { placeholder: "Rahul Sharma" })}
      {inp("Email", "email", { placeholder: "rahul@company.com", keyboardType: "email-address", autoCapitalize: "none" })}

      {/* Password with show/hide */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.secondary, marginBottom: 5 }}>Password</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13 }}>
          <TextInput
            value={f.password} onChangeText={set("password")}
            placeholder="Min 8 characters" placeholderTextColor={theme.dim}
            secureTextEntry={!showPw}
            style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: theme.primary }}
          />
          <Pressable onPress={() => setShowPw((s) => !s)}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={theme.dim} />
          </Pressable>
        </View>
      </View>

      {/* Company Code */}
      <View>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.secondary, marginBottom: 5 }}>Company Code</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.accentSoft,
          borderRadius: 11, borderWidth: 1.5, borderColor: theme.accent, paddingHorizontal: 13, gap: 9 }}>
          <MaterialCommunityIcons name="shield-key-outline" size={17} color={theme.accent} />
          <TextInput
            value={f.company_code} onChangeText={set("company_code")}
            placeholder="e.g. TZM-2026-5823" placeholderTextColor={theme.dim}
            autoCapitalize="characters"
            style={{ flex: 1, paddingVertical: 12, fontSize: 14, fontWeight: "700", color: theme.accent, letterSpacing: 0.5 }}
          />
        </View>
        <Text style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>Get this from your manager.</Text>
      </View>

      <Pressable onPress={handleRegister} disabled={loading} style={{ marginTop: 4 }}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 50, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Create Account & Join</Text>
          }
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center", marginTop: 4 }}>
        <Text style={{ fontSize: 13, color: theme.muted }}>Already have an account? <Text style={{ color: theme.accent, fontWeight: "700" }}>Sign In</Text></Text>
      </Pressable>
    </View>
  );
}

// ── Step 2: SIM Selection ─────────────────────────────────────────────────────
function SimStep({ theme }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: palette.teal + "1a", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Ionicons name="phone-portrait-outline" size={30} color={palette.teal} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary, marginBottom: 8 }}>SIM Selection</Text>
      <Text style={{ fontSize: 13.5, color: theme.muted, textAlign: "center", lineHeight: 20 }}>
        Choose which SIM card(s) to monitor for call logs and recordings.
      </Text>
      {["SIM 1 — Primary", "SIM 2 — Secondary"].map((s, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14, backgroundColor: i === 0 ? palette.teal + "1a" : "transparent",
          borderRadius: 12, padding: 12, borderWidth: 1, borderColor: i === 0 ? palette.teal : theme.border, width: "100%" }}>
          <Ionicons name={i === 0 ? "checkmark-circle" : "ellipse-outline"} size={20} color={i === 0 ? palette.teal : theme.dim} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }}>{s}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Step 3: SIM Verification ──────────────────────────────────────────────────
function SimVerifyStep({ theme }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: palette.violet + "1a", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <Ionicons name="checkmark-done-outline" size={30} color={palette.violet} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "800", color: theme.primary, marginBottom: 8 }}>SIM Verification</Text>
      <Text style={{ fontSize: 13.5, color: theme.muted, textAlign: "center", lineHeight: 20 }}>
        We'll verify your SIM by reading the phone number. This links your calls to your account.
      </Text>
    </View>
  );
}

// ── Step 4: Done ──────────────────────────────────────────────────────────────
function DoneStep({ theme }) {
  return (
    <View style={{ alignItems: "center", paddingVertical: 24 }}>
      <LinearGradient colors={gradientBrand} style={{ width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
        <Ionicons name="checkmark-circle-outline" size={38} color="#fff" />
      </LinearGradient>
      <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary, marginBottom: 8 }}>You're All Set!</Text>
      <Text style={{ fontSize: 13.5, color: theme.muted, textAlign: "center", lineHeight: 20 }}>
        Your account is connected to your organization. Call logs and recordings will sync automatically.
      </Text>
    </View>
  );
}

import { useState, useRef, useEffect } from "react";
import {
  View, Text, Pressable, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert, Animated, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { palette, gradientBrand, useTheme } from "../src/theme";
import { useAuth } from "../src/AuthContext";
import { requestAllPermissions, readSimInfo } from "../src/nativeModules";
import { BASE_URL } from "../src/api";

// NEW user:      Company Code → Sign Up → Permissions → SIM Select → Done
// RETURNING user: Permissions → SIM Select → Done
const NEW_STEPS     = ["Company","Sign Up","Permissions","SIM","Done"];
const RETURN_STEPS  = ["Permissions","SIM","Done"];
const NEW_ICONS     = ["shield-key-outline","person-add-outline","shield-checkmark-outline","phone-portrait-outline","checkmark-done-outline"];
const RETURN_ICONS  = ["shield-checkmark-outline","phone-portrait-outline","checkmark-done-outline"];

export default function Onboarding() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const returning = mode === "returning";
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [companyCode, setCompanyCode] = useState("");
  const [simData, setSimData] = useState(null);

  const STEPS = returning ? RETURN_STEPS : NEW_STEPS;
  const ICONS = returning ? RETURN_ICONS : NEW_ICONS;
  const total = STEPS.length;

  const goNext = (data) => {
    if (data?.companyCode) setCompanyCode(data.companyCode);
    if (data?.sim) setSimData(data.sim);
    if (step === total - 1) { router.replace("/(tabs)"); return; }
    setStep((s) => s + 1);
  };

  // Map step index to component
  const renderStep = () => {
    if (returning) {
      if (step === 0) return <PermissionsStep onDone={goNext} />;
      if (step === 1) return <SimDetectStep onDone={goNext} />;
      if (step === 2) return <DoneStep onDone={goNext} />;
    } else {
      if (step === 0) return <CompanyCodeStep onDone={goNext} />;
      if (step === 1) return <SignUpStep companyCode={companyCode} onDone={goNext} />;
      if (step === 2) return <PermissionsStep onDone={goNext} />;
      if (step === 3) return <SimDetectStep onDone={goNext} />;
      if (step === 4) return <DoneStep onDone={goNext} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 20 }} keyboardShouldPersistTaps="handled">

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <Text style={{ fontSize: 21, fontWeight: "800", color: theme.primary }}>
              {returning ? "Welcome Back!" : "Let's Get You Set Up"}
            </Text>
            <Text style={{ fontSize: 12, color: theme.muted }}>{step + 1}/{total}</Text>
          </View>
          <Text style={{ fontSize: 13, color: theme.muted, marginBottom: 16 }}>
            {returning ? "Quick check — permissions & SIM verification." : "Follow the steps to activate CallNexa."}
          </Text>

          {/* Progress bar */}
          <View style={{ height: 4, backgroundColor: theme.border, borderRadius: 2, marginBottom: 20 }}>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: palette.teal, width: `${((step + 1) / total) * 100}%` }} />
          </View>

          {/* Step dots */}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 24, position: "relative" }}>
            <View style={{ position: "absolute", top: 19, left: 19, right: 19, height: 2, backgroundColor: theme.border }} />
            {STEPS.map((s, i) => {
              const done = i < step, active = i === step;
              return (
                <Pressable key={i} onPress={() => i < step && setStep(i)} style={{ alignItems: "center", flex: 1, zIndex: 1 }}>
                  {done || active ? (
                    <LinearGradient colors={done ? ["#14b8a6","#14b8a6"] : gradientBrand} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={done ? "checkmark" : ICONS[i]} size={16} color="#fff" />
                    </LinearGradient>
                  ) : (
                    <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
                      <Ionicons name={ICONS[i]} size={16} color={theme.dim} />
                    </View>
                  )}
                  <Text style={{ fontSize: 9, color: active ? theme.accent : done ? palette.teal : theme.dim, fontWeight: active ? "700" : "500", textAlign: "center", marginTop: 4 }}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Step card */}
          <View style={{ backgroundColor: theme.surface, borderRadius: 22, padding: 20, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ alignSelf: "center", width: 48, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: 18 }} />
            {renderStep()}
          </View>

          <View style={{ flex: 1, minHeight: 20 }} />

          {/* Skip only on SIM step */}
          {((!returning && step === 3) || (returning && step === 1)) && (
            <Pressable onPress={() => goNext({})} style={{ alignItems: "center", marginTop: 14 }}>
              <Text style={{ fontSize: 12.5, color: theme.muted }}>Skip this step</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Step: Company Code ────────────────────────────────────────────────────────
function CompanyCodeStep({ onDone }) {
  const { theme } = useTheme();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");

  async function verify() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { setError("Enter your company code"); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE_URL}/auth/verify-company-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.detail || "Invalid company code. Ask your manager.");
      setOrgName(d.organization_name || "");
      setTimeout(() => onDone({ companyCode: trimmed }), 600);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <View style={{ width: 68, height: 68, borderRadius: 20, backgroundColor: palette.teal + "1a", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <MaterialCommunityIcons name="shield-key-outline" size={34} color={palette.teal} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: theme.primary }}>Enter Company Code</Text>
        <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginTop: 6, lineHeight: 19 }}>
          Your manager gave you a unique code.{"\n"}This links your calls to the right organization.
        </Text>
      </View>

      <View style={{ backgroundColor: palette.teal + "12", borderRadius: 14, borderWidth: 2, borderColor: palette.teal + "55", paddingHorizontal: 16, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <MaterialCommunityIcons name="shield-key-outline" size={20} color={palette.teal} />
        <TextInput
          value={code}
          onChangeText={(t) => { setCode(t); setError(""); setOrgName(""); }}
          placeholder="e.g. TZM-2026-5823"
          placeholderTextColor={theme.dim}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{ flex: 1, fontSize: 20, fontWeight: "800", color: palette.teal, letterSpacing: 2, paddingVertical: 14 }}
          onSubmitEditing={verify}
        />
      </View>

      {orgName ? (
        <View style={{ backgroundColor: palette.emerald + "15", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="checkmark-circle" size={16} color={palette.emerald} />
          <Text style={{ fontSize: 13, color: palette.emerald, fontWeight: "600" }}>✓ {orgName}</Text>
        </View>
      ) : error ? (
        <View style={{ backgroundColor: palette.red + "15", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Ionicons name="alert-circle-outline" size={16} color={palette.red} />
          <Text style={{ fontSize: 13, color: palette.red, flex: 1 }}>{error}</Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 12, color: theme.dim, textAlign: "center" }}>Don't have a code? Ask your manager.</Text>

      <Pressable onPress={verify} disabled={loading}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="arrow-forward-circle" size={20} color="#fff" /><Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Verify & Continue</Text></>}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Step: Sign Up ─────────────────────────────────────────────────────────────
function SignUpStep({ companyCode, onDone }) {
  const { theme } = useTheme();
  const { register, isAuthed } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  if (isAuthed) {
    return (
      <View style={{ alignItems: "center", paddingVertical: 20, gap: 12 }}>
        <Ionicons name="checkmark-circle" size={52} color={palette.emerald} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: theme.primary }}>Already signed in!</Text>
        <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center" }}>Continue to set up permissions.</Text>
        <Pressable onPress={() => onDone({})}>
          <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ height: 48, borderRadius: 13, paddingHorizontal: 32, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Continue</Text>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  async function handle() {
    if (!f.name.trim())     { setError("Name is required"); return; }
    if (!f.email.trim())    { setError("Email is required"); return; }
    if (!f.password.trim()) { setError("Password is required"); return; }
    setError(""); setLoading(true);
    try {
      await register({ name: f.name.trim(), email: f.email.trim(), password: f.password, company_code: companyCode });
      onDone({});
    } catch (e) { setError(e.message || "Registration failed."); }
    finally { setLoading(false); }
  }

  const inp = { backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 13, fontSize: 14, color: theme.primary };

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: theme.primary }}>Create Your Account</Text>
      <View style={{ backgroundColor: palette.teal + "15", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MaterialCommunityIcons name="shield-key-outline" size={15} color={palette.teal} />
        <Text style={{ fontSize: 13, color: palette.teal, fontWeight: "700" }}>Company Code: {companyCode}</Text>
      </View>
      {error ? (
        <View style={{ backgroundColor: palette.red + "15", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8 }}>
          <Ionicons name="alert-circle-outline" size={15} color={palette.red} />
          <Text style={{ fontSize: 12.5, color: palette.red, flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>FULL NAME</Text>
        <TextInput value={f.name} onChangeText={set("name")} placeholder="Rahul Sharma" placeholderTextColor={theme.dim} style={inp} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>EMAIL</Text>
        <TextInput value={f.email} onChangeText={set("email")} placeholder="rahul@company.com" placeholderTextColor={theme.dim} keyboardType="email-address" autoCapitalize="none" style={inp} />
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>PASSWORD</Text>
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13 }}>
          <TextInput value={f.password} onChangeText={set("password")} placeholder="Min 8 characters" placeholderTextColor={theme.dim} secureTextEntry={!showPw} style={{ flex: 1, paddingVertical: 13, fontSize: 14, color: theme.primary }} />
          <Pressable onPress={() => setShowPw((s) => !s)} style={{ padding: 4 }}>
            <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={theme.dim} />
          </Pressable>
        </View>
      </View>
      <Pressable onPress={handle} disabled={loading} style={{ marginTop: 4 }}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
          style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Create Account & Join</Text>}
        </LinearGradient>
      </Pressable>
      <Pressable onPress={() => router.replace("/login")} style={{ alignItems: "center" }}>
        <Text style={{ fontSize: 13, color: theme.muted }}>Already have an account? <Text style={{ color: theme.accent, fontWeight: "700" }}>Sign In</Text></Text>
      </Pressable>
    </View>
  );
}

// ── Step: Permissions ─────────────────────────────────────────────────────────
function PermissionsStep({ onDone }) {
  const { theme } = useTheme();
  const [perms, setPerms] = useState({});
  const [requesting, setRequesting] = useState(false);
  const [success, setSuccess] = useState(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  const LIST = [
    { key: "callLog",    icon: "call-outline",           title: "Read Call Log",    sub: "Sync your call history to dashboard",     critical: true },
    { key: "phoneState", icon: "phone-portrait-outline", title: "Phone State",      sub: "Detect active calls & SIM info",          critical: true },
    { key: "contacts",   icon: "people-outline",         title: "Contacts",         sub: "Match caller names automatically",        critical: false },
    { key: "storage",    icon: "folder-outline",         title: "Storage",          sub: "Access call recordings",                  critical: false },
    { key: "recording",  icon: "mic-outline",            title: "Microphone",       sub: "Record calls for transcription",          critical: false },
  ];

  async function request() {
    setRequesting(true);
    try {
      const result = await requestAllPermissions();
      setPerms(result);
      if (result.callLog && result.phoneState) {
        setSuccess(true);
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }).start();
        setTimeout(() => onDone({}), 1800);
      } else {
        Alert.alert(
          "⚠️ Required Permissions Missing",
          "Call Log and Phone State are required for CallNexa to sync your calls.",
          [
            { text: "Try Again", onPress: request },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
      }
    } finally { setRequesting(false); }
  }

  const checked = Object.keys(perms).length > 0;

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: "800", color: theme.primary, marginBottom: 2 }}>App Permissions</Text>
      <Text style={{ fontSize: 13, color: theme.muted, lineHeight: 19, marginBottom: 4 }}>
        CallNexa needs these to read your call logs and sync them — just like other call tracking apps.
      </Text>
      {LIST.map((p) => {
        const granted = perms[p.key];
        const denied  = checked && !granted;
        return (
          <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: granted ? palette.emerald + "0f" : denied && p.critical ? palette.red + "0f" : theme.bg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: granted ? palette.emerald + "44" : denied && p.critical ? palette.red + "44" : theme.border }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (granted ? palette.emerald : p.critical ? palette.red : palette.teal) + "1a", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name={p.icon} size={18} color={granted ? palette.emerald : p.critical ? palette.red : theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontSize: 13.5, fontWeight: "600", color: theme.primary }}>{p.title}</Text>
                {p.critical && <View style={{ backgroundColor: palette.red + "22", borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 9, fontWeight: "700", color: palette.red }}>REQUIRED</Text></View>}
              </View>
              <Text style={{ fontSize: 11, color: theme.dim, marginTop: 1 }}>{p.sub}</Text>
            </View>
            <Ionicons name={granted ? "checkmark-circle" : checked ? "close-circle" : "ellipse-outline"} size={20} color={granted ? palette.emerald : checked ? (p.critical ? palette.red : theme.dim) : theme.dim} />
          </View>
        );
      })}
      <View style={{ backgroundColor: palette.amber + "15", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: palette.amber + "33", flexDirection: "row", gap: 10 }}>
        <Ionicons name="layers-outline" size={18} color={palette.amber} style={{ marginTop: 1 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: theme.primary }}>Display Over Other Apps</Text>
          <Text style={{ fontSize: 11.5, color: theme.muted, marginTop: 2, lineHeight: 17 }}>Allows CallNexa to show sync status during calls.{"\n"}Go to <Text style={{ fontWeight: "700", color: palette.amber }}>Settings → Apps → CallNexa → Display over other apps</Text> and enable it.</Text>
          <Pressable onPress={() => Linking.openSettings()} style={{ marginTop: 8, backgroundColor: palette.amber + "22", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, alignSelf: "flex-start" }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: palette.amber }}>Open Settings →</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={request} disabled={requesting || success}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          {requesting ? <ActivityIndicator color="#fff" size="small" /> : <><Ionicons name="shield-checkmark" size={18} color="#fff" /><Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Grant All Permissions</Text></>}
        </LinearGradient>
      </Pressable>
      {success && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.78)", borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 99 }}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: "center" }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: palette.emerald, alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <Ionicons name="checkmark" size={44} color="#fff" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#fff" }}>All Permissions Granted!</Text>
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 8, textAlign: "center", lineHeight: 20 }}>Call logs will sync automatically.{"\n"}Recordings and contacts are accessible.</Text>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ── Step: SIM Detection ───────────────────────────────────────────────────────
function SimDetectStep({ onDone }) {
  const { theme } = useTheme();
  const [sims, setSims] = useState([]);
  const [selected, setSelected] = useState(0);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    readSimInfo().then((s) => { setSims(s); setDetecting(false); }).catch(() => setDetecting(false));
  }, []);

  const display = sims.length
    ? sims
    : [{ slot: 0, carrierName: null, phoneNumber: null }, { slot: 1, carrierName: null, phoneNumber: null }];

  // Label helper
  function simLabel(s) {
    if (s.carrierName && s.phoneNumber) return `${s.carrierName} · ${s.phoneNumber}`;
    if (s.carrierName) return s.carrierName;
    if (s.phoneNumber) return s.phoneNumber;
    return `SIM ${s.slot + 1}`;
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: palette.teal + "1a", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Ionicons name="phone-portrait-outline" size={30} color={palette.teal} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: "800", color: theme.primary }}>SIM Detection</Text>
        <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginTop: 6, lineHeight: 19 }}>Select which SIM to use for call tracking.{"\n"}Calls from this SIM will sync to the dashboard.</Text>
      </View>
      {detecting ? (
        <View style={{ alignItems: "center", padding: 20 }}>
          <ActivityIndicator color={palette.teal} size="large" />
          <Text style={{ color: theme.muted, marginTop: 10 }}>Detecting SIM cards...</Text>
        </View>
      ) : display.map((s, i) => {
        const on = selected === i;
        return (
          <Pressable key={i} onPress={() => setSelected(i)} style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: on ? palette.teal : theme.border, backgroundColor: on ? palette.teal + "12" : theme.bg }}>
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: on ? palette.teal + "22" : theme.surface, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="phone-portrait-outline" size={22} color={on ? palette.teal : theme.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "700", color: on ? palette.teal : theme.primary }}>{simLabel(s)}</Text>
              <Text style={{ fontSize: 12.5, color: theme.muted, marginTop: 2 }}>{s.phoneNumber ? s.phoneNumber : s.carrierName ? "Number not shared by carrier" : "Grant Phone State permission"}</Text>
            </View>
            <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={22} color={on ? palette.teal : theme.dim} />
          </Pressable>
        );
      })}
      <Pressable onPress={() => onDone({ sim: display[selected] })}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Use This SIM</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Step: SIM Verify (OTP) ────────────────────────────────────────────────────
function SimVerifyStep({ simData, onDone }) {
  const { theme } = useTheme();
  const [phone, setPhone] = useState(simData?.phoneNumber?.replace("+91","").replace(/\D/g,"") || "");
  const [otp, setOtp] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");

  async function sendOtp() {
    const num = phone.trim();
    if (!num || num.length < 10) { setError("Enter a valid 10-digit number"); return; }
    setSending(true); setError("");
    try {
      const { sendOtp: firebaseSend } = await import("../src/firebase").catch(() => ({ sendOtp: null }));
      if (firebaseSend) {
        const confirmation = await firebaseSend(`+91${num}`, "otp-btn");
        global._otpConfirmation = confirmation;
      }
      setSent(true);
    } catch (e) { setError(e.message || "Failed to send OTP."); }
    finally { setSending(false); }
  }

  async function verifyOtp() {
    if (otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    setVerifying(true); setError("");
    try {
      if (global._otpConfirmation) await global._otpConfirmation.confirm(otp);
      onDone({});
    } catch { setError("Invalid OTP. Try again."); }
    finally { setVerifying(false); }
  }

  const inp = { backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13, paddingVertical: 13, fontSize: 14, color: theme.primary };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ alignItems: "center", marginBottom: 4 }}>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: palette.violet + "1a", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <Ionicons name="keypad-outline" size={30} color={palette.violet} />
        </View>
        <Text style={{ fontSize: 17, fontWeight: "800", color: theme.primary }}>Verify Your Number</Text>
        <Text style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginTop: 6, lineHeight: 19 }}>We'll send an OTP to confirm your SIM.{"\n"}This links your calls to your account.</Text>
      </View>
      {error ? <View style={{ backgroundColor: palette.red + "15", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8 }}><Ionicons name="alert-circle-outline" size={15} color={palette.red} /><Text style={{ fontSize: 12.5, color: palette.red, flex: 1 }}>{error}</Text></View> : null}
      {!sent ? (
        <>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>PHONE NUMBER</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: theme.bg, borderRadius: 11, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 13 }}>
              <Text style={{ fontSize: 14, color: theme.muted, paddingVertical: 13, paddingRight: 8 }}>+91</Text>
              <TextInput value={phone} onChangeText={(t) => { setPhone(t.replace(/\D/g,"")); setError(""); }} placeholder="98765 43210" placeholderTextColor={theme.dim} keyboardType="phone-pad" maxLength={10} style={{ flex: 1, fontSize: 16, fontWeight: "600", color: theme.primary, paddingVertical: 13 }} />
            </View>
          </View>
          <Pressable nativeID="otp-btn" onPress={sendOtp} disabled={sending}>
            <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>Send OTP</Text>}
            </LinearGradient>
          </Pressable>
        </>
      ) : (
        <>
          <View style={{ backgroundColor: palette.emerald + "15", borderRadius: 10, padding: 10, flexDirection: "row", gap: 8 }}>
            <Ionicons name="checkmark-circle-outline" size={16} color={palette.emerald} />
            <Text style={{ fontSize: 13, color: palette.emerald }}>OTP sent to +91 {phone}</Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: "600", color: theme.muted }}>ENTER OTP</Text>
            <TextInput value={otp} onChangeText={(t) => { setOtp(t.replace(/\D/g,"")); setError(""); }} placeholder="• • • • • •" placeholderTextColor={theme.dim} keyboardType="number-pad" maxLength={6} style={{ ...inp, fontSize: 28, fontWeight: "800", letterSpacing: 14, textAlign: "center" }} />
          </View>
          <Pressable onPress={verifyOtp} disabled={verifying || otp.length !== 6}>
            <LinearGradient colors={otp.length === 6 ? gradientBrand : [theme.border, theme.border]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
              {verifying ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: otp.length === 6 ? "#fff" : theme.muted, fontSize: 15, fontWeight: "700" }}>Verify & Continue</Text>}
            </LinearGradient>
          </Pressable>
          <Pressable onPress={() => { setSent(false); setOtp(""); setError(""); }} style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 12.5, color: theme.muted }}>← Change number</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ── Step: Done ────────────────────────────────────────────────────────────────
function DoneStep({ onDone }) {
  const { theme } = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }).start();
  }, []);

  return (
    <View style={{ alignItems: "center", paddingVertical: 12, gap: 16 }}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <LinearGradient colors={gradientBrand} style={{ width: 84, height: 84, borderRadius: 26, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="checkmark-circle-outline" size={46} color="#fff" />
        </LinearGradient>
      </Animated.View>
      <Text style={{ fontSize: 22, fontWeight: "800", color: theme.primary, textAlign: "center" }}>You're All Set! 🎉</Text>
      <Text style={{ fontSize: 14, color: theme.muted, textAlign: "center", lineHeight: 22 }}>Your account is connected to your organization.{"\n"}Call logs sync automatically every time you open the app.</Text>
      <View style={{ width: "100%", gap: 10, marginTop: 4 }}>
        {[
          { icon: "sync-circle-outline",   color: palette.teal,   text: "Auto-sync call logs on every open" },
          { icon: "mic-circle-outline",    color: palette.violet, text: "Recordings uploaded to dashboard" },
          { icon: "people-circle-outline", color: palette.cyan,   text: "Contacts matched automatically" },
          { icon: "bar-chart-outline",     color: palette.amber,  text: "Analytics visible to your manager" },
        ].map((item) => (
          <View key={item.text} style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: theme.bg, borderRadius: 12, padding: 12 }}>
            <Ionicons name={item.icon} size={22} color={item.color} />
            <Text style={{ fontSize: 13, color: theme.secondary, flex: 1 }}>{item.text}</Text>
          </View>
        ))}
      </View>
      <Pressable onPress={() => onDone({})} style={{ width: "100%", marginTop: 4 }}>
        <LinearGradient colors={gradientBrand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 54, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Go to Dashboard</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

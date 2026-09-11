import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { ThemeProvider, useTheme } from "../src/theme";
import { AuthProvider, useAuth } from "../src/AuthContext";

// ── Notification tap handler ──────────────────────────────────────────────────
function NotificationHandler() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      const screen = data.screen;

      if (screen === "call_detail" && (data.clientEventId || data.callId)) {
        router.push({
          pathname: "/call-detail",
          params: {
            clientEventId: data.clientEventId || "",
            callId:        data.callId        || "",
          },
        });
      } else if (screen === "sync_health") {
        router.push("/(tabs)/settings");
      } else {
        router.push("/(tabs)/logs");
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate() {
  const { isAuthed, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "login";
    const inOnboarding = segments[0] === "onboarding";
    if (!isAuthed && !inAuth && !inOnboarding) {
      router.replace("/login");
    } else if (isAuthed && inAuth) {
      router.replace("/(tabs)");
    }
  }, [isAuthed, ready, segments]);

  return null;
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function Shell() {
  const { theme, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <AuthGate />
      <NotificationHandler />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: "modal" }} />
        <Stack.Screen name="call-detail" options={{ presentation: "card" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

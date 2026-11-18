import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { ThemeProvider, useTheme, useThemedColors } from "../src/theme";
import { AuthProvider, useAuth } from "../src/AuthContext";
import { RoleProvider, useRole } from "../src/RoleContext";
import { setupNotificationChannels } from "../src/notificationManager";
import PostCallCoordinator from "../src/PostCallCoordinator";

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
        router.push("/(employee)/settings");
      } else {
        router.push("/(employee)/logs");
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate() {
  const { isAuthed, ready, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth     = segments[0] === "login" || segments[0] === "login-selector" || segments[0] === "intro";
    const inOnboarding = segments[0] === "onboarding";
    const inAdmin    = segments[0] === "(admin)";
    const inEmployee = segments[0] === "(employee)";
    const role    = (user?.role || "").toUpperCase();
    const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN" || role === "SUPERADMIN";
    const isEmployee = role === "EMPLOYEE";

    if (!isAuthed && !inAuth && !inOnboarding) {
      router.replace("/intro");
    } else if (isAuthed && inAuth) {
      // Fresh login redirect
      if (isAdmin) router.replace("/(admin)/dashboard");
      else router.replace("/(employee)");
    } else if (isAuthed && !inOnboarding) {
      // Already inside app — enforce correct group
      if (isAdmin && inEmployee) router.replace("/(admin)/dashboard");
      if (isEmployee && inAdmin) router.replace("/(employee)");
    }
  }, [isAuthed, ready, segments, user]);

  return null;
}

// ── Shell ─────────────────────────────────────────────────────────────────────
function Shell() {
  const { isDark } = useTheme();
  useEffect(() => {
    setupNotificationChannels();
  }, []);
  
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AuthGate />
      <NotificationHandler />
      <PostCallCoordinator />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FFFFFF" } }}>
        <Stack.Screen name="intro" options={{ animationEnabled: false }} />
        <Stack.Screen name="login-selector" options={{ animationEnabled: true }} />
        <Stack.Screen name="login" />
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
        <Stack.Screen name="(employee)" options={{ headerShown: false }} />
        <Stack.Screen name="company-web" options={{ headerShown: false }} />
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
          <RoleProvider>
            <Shell />
          </RoleProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

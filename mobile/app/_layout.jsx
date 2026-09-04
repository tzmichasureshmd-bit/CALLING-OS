import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "../src/theme";
import { AuthProvider, useAuth } from "../src/AuthContext";

function AuthGate() {
  const { isAuthed, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "login";
    const inOnboarding = segments[0] === "onboarding";
    if (!isAuthed && !inAuth) {
      router.replace("/login");
    } else if (isAuthed && inAuth) {
      router.replace("/(tabs)");
    }
  }, [isAuthed, ready, segments]);

  return null;
}

function Shell() {
  const { theme, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ presentation: "modal" }} />
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

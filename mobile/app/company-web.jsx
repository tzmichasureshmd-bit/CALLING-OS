import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";
import { useAuth } from "../src/AuthContext";

const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL || "https://callingos.tzmicha.com").replace(/\/$/, "");

export default function CompanyWebScreen() {
  const { user, tokenSnapshot } = useAuth();
  const accessToken = tokenSnapshot?.callos_token;
  const refreshToken = tokenSnapshot?.callos_refresh_token;
  const injected = useMemo(() => `
    (function () {
      localStorage.setItem('callos_token', ${JSON.stringify(accessToken || "")});
      localStorage.setItem('callos_refresh_token', ${JSON.stringify(refreshToken || "")});
      localStorage.setItem('callos_user', ${JSON.stringify(user || null)});
      true;
    })();
  `, [accessToken, refreshToken, user]);

  if (!accessToken) return <View style={styles.loading}><ActivityIndicator size="large" color="#84cc16" /></View>;

  return <SafeAreaView style={styles.container}><StatusBar style="dark" /><WebView source={{ uri: `${WEB_APP_URL}/dashboard` }} injectedJavaScriptBeforeContentLoaded={injected} injectedJavaScript={injected} javaScriptEnabled domStorageEnabled sharedCookiesEnabled startInLoadingState renderLoading={() => <View style={styles.loading}><ActivityIndicator size="large" color="#84cc16" /></View>} /></SafeAreaView>;
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: "#fff" }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" } });

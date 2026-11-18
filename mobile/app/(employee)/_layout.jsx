import { View } from "react-native";
import { Tabs } from "expo-router";
import { useAutoSync } from "../../src/syncService";
import EmployeeDock from "../../src/EmployeeDock";
import PostCallPopup from "../../src/PostCallPopup";

export default function EmployeeLayout() {
  useAutoSync(true);
  return (
    <View style={{ flex: 1 }}>
      <Tabs tabBar={(props) => <EmployeeDock {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="index"                options={{ title: "Home" }} />
        <Tabs.Screen name="logs"                 options={{ title: "Logs" }} />
        <Tabs.Screen name="follow-ups"           options={{ title: "Follow-ups" }} />
        <Tabs.Screen name="settings"             options={{ title: "Settings" }} />
        <Tabs.Screen name="leads"                options={{ href: null }} />
        <Tabs.Screen name="opportunities"        options={{ href: null }} />
        <Tabs.Screen name="opportunities-closed" options={{ href: null }} />
        <Tabs.Screen name="customers"            options={{ href: null }} />
        <Tabs.Screen name="insights"             options={{ href: null }} />
        <Tabs.Screen name="sync-status"          options={{ href: null }} />
        <Tabs.Screen name="reports"              options={{ href: null }} />
      </Tabs>
      <PostCallPopup />
    </View>
  );
}

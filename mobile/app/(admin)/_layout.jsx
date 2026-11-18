import { Tabs } from "expo-router";
import { useAutoSync } from "../../src/syncService";
import AdminDock from "../../src/AdminDock";

// This layout is ONLY reached when role=ADMIN — AuthGate guarantees it
export default function AdminLayout() {
  useAutoSync(false);
  return (
    <Tabs tabBar={(props) => <AdminDock {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard"     options={{ title: "Dashboard" }} />
      <Tabs.Screen name="employees"     options={{ title: "Employees" }} />
      <Tabs.Screen name="calls"         options={{ title: "Calls" }} />
      <Tabs.Screen name="settings"      options={{ title: "Settings" }} />
      <Tabs.Screen name="analytics"     options={{ href: null }} />
      <Tabs.Screen name="leads"         options={{ href: null }} />
      <Tabs.Screen name="opportunities" options={{ href: null }} />
      <Tabs.Screen name="customers"     options={{ href: null }} />
      <Tabs.Screen name="reports"       options={{ href: null }} />
      <Tabs.Screen name="follow-ups"    options={{ href: null }} />
      <Tabs.Screen name="device-health"  options={{ href: null }} />
    </Tabs>
  );
}

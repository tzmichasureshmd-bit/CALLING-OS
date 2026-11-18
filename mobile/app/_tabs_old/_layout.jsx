import { Tabs } from "expo-router";
import Dock from "../../src/Dock.jsx";
import { useAutoSync } from "../../src/syncService";
import { useRole } from "../../src/RoleContext";

const HIDDEN = { href: null };

export default function TabsLayout() {
  const { appMode, isAdmin } = useRole();
  useAutoSync(appMode !== "admin");

  // Force a completely separate Tabs tree per role using key
  // This prevents expo-router from reusing cached employee routes for admin
  if (appMode === "admin" && isAdmin) {
    return (
      <Tabs
        key="admin-tabs"
        tabBar={(props) => <Dock {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {/* ── 4 visible admin tabs ── */}
        <Tabs.Screen name="admin-dashboard"          options={{ title: "Dashboard", tabBarLabel: "Dashboard" }} />
        <Tabs.Screen name="admin-employees"          options={{ title: "Employees", tabBarLabel: "Employees" }} />
        <Tabs.Screen name="admin-calls"              options={{ title: "Calls",     tabBarLabel: "Calls" }} />
        <Tabs.Screen name="admin-settings"           options={{ title: "Settings",  tabBarLabel: "Settings" }} />
        {/* ── hidden admin sub-screens ── */}
        <Tabs.Screen name="admin-analytics"          options={HIDDEN} />
        <Tabs.Screen name="admin-leads"              options={HIDDEN} />
        <Tabs.Screen name="admin-opportunities"      options={HIDDEN} />
        <Tabs.Screen name="admin-customers"          options={HIDDEN} />
        <Tabs.Screen name="admin-reports"            options={HIDDEN} />
        {/* ── hide ALL employee screens ── */}
        <Tabs.Screen name="index"                    options={HIDDEN} />
        <Tabs.Screen name="logs"                     options={HIDDEN} />
        <Tabs.Screen name="insights"                 options={HIDDEN} />
        <Tabs.Screen name="settings"                 options={HIDDEN} />
        <Tabs.Screen name="leads"                    options={HIDDEN} />
        <Tabs.Screen name="follow-ups"               options={HIDDEN} />
        <Tabs.Screen name="opportunities"            options={HIDDEN} />
        <Tabs.Screen name="opportunities-closed"     options={HIDDEN} />
        <Tabs.Screen name="customers"                options={HIDDEN} />
      </Tabs>
    );
  }

  return (
    <Tabs
      key="employee-tabs"
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      {/* ── 4 visible employee tabs ── */}
      <Tabs.Screen name="index"                options={{ title: "Home",     tabBarLabel: "Home" }} />
      <Tabs.Screen name="logs"                 options={{ title: "Logs",     tabBarLabel: "Logs" }} />
      <Tabs.Screen name="leads"                options={{ title: "Leads",    tabBarLabel: "Leads" }} />
      <Tabs.Screen name="settings"             options={{ title: "Settings", tabBarLabel: "Settings" }} />
      {/* ── hidden employee sub-screens ── */}
      <Tabs.Screen name="follow-ups"           options={HIDDEN} />
      <Tabs.Screen name="opportunities"        options={HIDDEN} />
      <Tabs.Screen name="opportunities-closed" options={HIDDEN} />
      <Tabs.Screen name="customers"            options={HIDDEN} />
      <Tabs.Screen name="insights"             options={HIDDEN} />
      {/* ── hide ALL admin screens ── */}
      <Tabs.Screen name="admin-dashboard"      options={HIDDEN} />
      <Tabs.Screen name="admin-employees"      options={HIDDEN} />
      <Tabs.Screen name="admin-calls"          options={HIDDEN} />
      <Tabs.Screen name="admin-settings"       options={HIDDEN} />
      <Tabs.Screen name="admin-analytics"      options={HIDDEN} />
      <Tabs.Screen name="admin-leads"          options={HIDDEN} />
      <Tabs.Screen name="admin-opportunities"  options={HIDDEN} />
      <Tabs.Screen name="admin-customers"      options={HIDDEN} />
      <Tabs.Screen name="admin-reports"        options={HIDDEN} />
    </Tabs>
  );
}

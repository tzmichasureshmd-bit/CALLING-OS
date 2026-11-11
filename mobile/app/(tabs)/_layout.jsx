import { Tabs } from "expo-router";
import Dock from "../../src/Dock.jsx";
import { useAutoSync } from "../../src/syncService";
import { useRole } from "../../src/RoleContext";

export default function TabsLayout() {
  useAutoSync();
  const { appMode, isAdmin } = useRole();

  // Admin tabs: dashboard, employees, calls, settings
  if (appMode === "admin" && isAdmin) {
    return (
      <Tabs
        tabBar={(props) => <Dock {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen 
          name="admin-dashboard" 
          options={{ 
            title: "Dashboard",
            tabBarLabel: "Dashboard",
          }} 
        />
        <Tabs.Screen 
          name="admin-employees" 
          options={{ 
            title: "Employees",
            tabBarLabel: "Employees",
          }} 
        />
        <Tabs.Screen 
          name="admin-calls" 
          options={{ 
            title: "Calls",
            tabBarLabel: "Calls",
          }} 
        />
        <Tabs.Screen 
          name="settings" 
          options={{ 
            title: "Settings",
            tabBarLabel: "Settings",
          }} 
        />
      </Tabs>
    );
  }

  // Employee tabs: calls, logs, insights, settings
  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: "Calls",
          tabBarLabel: "Calls",
        }} 
      />
      <Tabs.Screen 
        name="logs" 
        options={{ 
          title: "Logs",
          tabBarLabel: "Logs",
        }} 
      />
      <Tabs.Screen 
        name="insights" 
        options={{ 
          title: "Insights",
          tabBarLabel: "Insights",
        }} 
      />
      <Tabs.Screen 
        name="settings" 
        options={{ 
          title: "Settings",
          tabBarLabel: "Settings",
        }} 
      />
    </Tabs>
  );
}

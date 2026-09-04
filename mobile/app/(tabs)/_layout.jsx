import { Tabs } from "expo-router";
import Dock from "../../src/Dock.jsx";
import { useAutoSync } from "../../src/syncService";

export default function TabsLayout() {
  useAutoSync();
  return (
    <Tabs
      tabBar={(props) => <Dock {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="logs" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { api } from "../../src/api";

export default function AdminCalls() {
  const [calls, setCall] = useState([]);
  const [filteredCalls, setFilteredCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState("all");

  const colors = adminTheme;

  useEffect(() => {
    fetchCalls();
  }, []);

  useEffect(() => {
    filterCalls();
  }, [filterType, calls]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const response = await api.getCalls();
      setCall(response?.data || response || []);
    } catch (err) {
      console.error("Failed to fetch calls:", err);
      Alert.alert("Error", "Failed to load calls");
      setCall([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCalls();
    setRefreshing(false);
  };

  const filterCalls = () => {
    if (filterType === "all") {
      setFilteredCalls(calls);
    } else {
      setFilteredCalls(calls.filter((c) => c.call_type === filterType));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md }]}>
        <Text style={[TYPE.h2, { color: colors.primary }]}>All Calls</Text>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { paddingHorizontal: SPACE.lg, marginBottom: SPACE.lg }]}>
        {["all", "incoming", "outgoing", "missed"].map((type) => (
          <Pressable
            key={type}
            onPress={() => setFilterType(type)}
            style={[
              styles.filterTab,
              {
                backgroundColor: filterType === type ? colors.accent : colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
          >
            <Text
              style={[
                TYPE.caption,
                { color: filterType === type ? colors.white : colors.secondary },
              ]}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Calls List */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filteredCalls.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="phone-off" size={48} color={colors.muted} />
          <Text style={[TYPE.body, { color: colors.muted, marginTop: SPACE.md }]}>No calls found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCalls}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CallCard call={item} colors={colors} />
          )}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg }}
          ItemSeparatorComponent={() => <View style={{ height: SPACE.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Call Card Component
// ════════════════════════════════════════════════════════════════════════════
function CallCard({ call, colors }) {
  const getCallIcon = (type) => {
    switch (type) {
      case "incoming":
        return "call-received";
      case "outgoing":
        return "call-made";
      case "missed":
        return "call-missed";
      default:
        return "call";
    }
  };

  const getCallColor = (type) => {
    switch (type) {
      case "incoming":
        return colors.success;
      case "outgoing":
        return colors.accent;
      case "missed":
        return colors.danger;
      default:
        return colors.muted;
    }
  };

  const duration = Math.floor((call.duration_seconds || 0) / 60);
  const durationText = `${duration}m`;

  return (
    <Pressable
      style={[
        styles.callCard,
        {
          backgroundColor: colors.white,
          borderColor: colors.border,
          borderWidth: 1,
        },
      ]}
    >
      <View
        style={[
          styles.callIcon,
          { backgroundColor: getCallColor(call.call_type), opacity: 0.2 },
        ]}
      >
        <MaterialCommunityIcons name={getCallIcon(call.call_type)} size={20} color={getCallColor(call.call_type)} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, { color: colors.primary }]}>{call.employee_name || "Unknown"}</Text>
        <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>
          {call.phone_number}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[TYPE.title, { color: colors.primary }]}>{durationText}</Text>
        <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>
          {new Date(call.start_time).toLocaleDateString()}
        </Text>
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Styles
// ════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  filterTab: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    flex: 1,
    marginHorizontal: SPACE.xs,
    alignItems: "center",
  },
  callCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    marginVertical: SPACE.sm,
  },
  callIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE.md,
  },
});

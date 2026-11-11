import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, FlatList, Pressable, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator, Modal, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme, adminTheme, TYPE, SPACE, RADIUS } from "../../src/theme";
import { useAuth } from "../../src/AuthContext";
import { api } from "../../src/api";

export default function AdminEmployees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailsVisible, setDetailsVisible] = useState(false);

  const colors = adminTheme;

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    filterEmployees();
  }, [searchText, employees]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.get("/employees");
      setEmployees(response.data || []);
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      Alert.alert("Error", "Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEmployees();
    setRefreshing(false);
  };

  const filterEmployees = () => {
    if (!searchText.trim()) {
      setFilteredEmployees(employees);
      return;
    }
    const filtered = employees.filter((emp) =>
      emp.name?.toLowerCase().includes(searchText.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchText.toLowerCase())
    );
    setFilteredEmployees(filtered);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md }]}>
        <Text style={[TYPE.h2, { color: colors.primary }]}>Employees</Text>
        <Pressable style={[styles.addBtn, { backgroundColor: colors.accent }]}>
          <Ionicons name="add" size={20} color={colors.white} />
        </Pressable>
      </View>

      {/* Search */}
      <View style={[styles.searchBar, { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          placeholder="Search employees..."
          placeholderTextColor={colors.muted}
          value={searchText}
          onChangeText={setSearchText}
          style={[styles.searchInput, { color: colors.primary }]}
        />
      </View>

      {/* Employees List */}
      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : filteredEmployees.length === 0 ? (
        <View style={styles.centerContent}>
          <MaterialCommunityIcons name="briefcase-off" size={48} color={colors.muted} />
          <Text style={[TYPE.body, { color: colors.muted, marginTop: SPACE.md }]}>No employees found</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EmployeeCard
              employee={item}
              onPress={() => {
                setSelectedEmployee(item);
                setDetailsVisible(true);
              }}
              colors={colors}
            />
          )}
          scrollEnabled={false}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg }}
          ItemSeparatorComponent={() => <View style={{ height: SPACE.sm }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}

      {/* Employee Details Modal */}
      <EmployeeDetailsModal
        visible={detailsVisible}
        employee={selectedEmployee}
        onClose={() => setDetailsVisible(false)}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Employee Card Component
// ════════════════════════════════════════════════════════════════════════════
function EmployeeCard({ employee, onPress, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.employeeCard,
        {
          backgroundColor: colors.white,
          borderColor: colors.border,
          borderWidth: 1,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.accent, opacity: 0.2 }]}>
        <Text style={[TYPE.title, { color: colors.accent }]}>
          {employee.name?.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[TYPE.body, { color: colors.primary }]}>{employee.name}</Text>
        <Text style={[TYPE.caption, { color: colors.muted, marginTop: SPACE.xs }]}>{employee.email}</Text>
        <Text style={[TYPE.caption, { color: colors.muted }]}>{employee.phone || "No phone"}</Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: employee.status === "active" ? colors.successSoft : colors.dangerSoft,
          },
        ]}
      >
        <Text style={[TYPE.caption, { color: employee.status === "active" ? colors.success : colors.danger }]}>
          {employee.status === "active" ? "Active" : "Inactive"}
        </Text>
      </View>
    </Pressable>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Employee Details Modal
// ════════════════════════════════════════════════════════════════════════════
function EmployeeDetailsModal({ visible, employee, onClose, colors }) {
  if (!employee) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <SafeAreaView style={[styles.modal, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <Pressable onPress={onClose}>
            <Ionicons name="chevron-back" size={24} color={colors.accent} />
          </Pressable>
          <Text style={[TYPE.h3, { color: colors.primary }]}>{employee.name}</Text>
          <Pressable>
            <Ionicons name="ellipsis-vertical" size={24} color={colors.muted} />
          </Pressable>
        </View>

        {/* Details */}
        <ScrollView style={{ flex: 1, padding: SPACE.lg }}>
          {/* Avatar */}
          <View style={[styles.largeAvatar, { backgroundColor: colors.accent, opacity: 0.15 }]}>
            <Text style={[TYPE.display, { color: colors.accent }]}>
              {employee.name?.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Info Section */}
          <View style={[styles.infoSection, { marginTop: SPACE.xl }]}>
            <Text style={[TYPE.h3, { color: colors.primary, marginBottom: SPACE.lg }]}>Information</Text>

            <DetailRow label="Name" value={employee.name} colors={colors} />
            <DetailRow label="Email" value={employee.email} colors={colors} />
            <DetailRow label="Phone" value={employee.phone || "Not set"} colors={colors} />
            <DetailRow label="Employee Code" value={employee.employee_code || "N/A"} colors={colors} />
            <DetailRow label="Status" value={employee.status} colors={colors} />
            <DetailRow label="Joined" value={employee.joining_date || "N/A"} colors={colors} />
          </View>

          {/* Actions */}
          <View style={[styles.actionSection, { marginTop: SPACE.xxl }]}>
            <Pressable
              style={[styles.actionBtnLarge, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="pencil" size={18} color={colors.white} />
              <Text style={[TYPE.body, { color: colors.white, marginLeft: SPACE.sm }]}>Edit Employee</Text>
            </Pressable>
            <Pressable
              style={[styles.actionBtnLarge, { backgroundColor: colors.dangerSoft, marginTop: SPACE.md }]}
            >
              <Ionicons name="trash" size={18} color={colors.danger} />
              <Text style={[TYPE.body, { color: colors.danger, marginLeft: SPACE.sm }]}>Deactivate</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Detail Row Component
// ════════════════════════════════════════════════════════════════════════════
function DetailRow({ label, value, colors }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Text style={[TYPE.caption, { color: colors.muted }]}>{label}</Text>
      <Text style={[TYPE.body, { color: colors.primary, marginTop: SPACE.xs }]}>{value}</Text>
    </View>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: SPACE.md,
    fontSize: 14,
  },
  employeeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    marginVertical: SPACE.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    alignItems: "center",
    marginRight: SPACE.md,
  },
  statusBadge: {
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.md,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
  },
  largeAvatar: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.full,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
  },
  infoSection: {
    padding: SPACE.lg,
  },
  detailRow: {
    paddingVertical: SPACE.md,
  },
  actionSection: {
    paddingHorizontal: SPACE.lg,
  },
  actionBtnLarge: {
    flexDirection: "row",
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

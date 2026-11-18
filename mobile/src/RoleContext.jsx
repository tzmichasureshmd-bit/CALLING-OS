import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";

/**
 * RoleContext — Manages app-wide user role (EMPLOYEE vs ADMIN)
 * Provides role-based theme switching and UI rendering
 */

const RoleContext = createContext(null);

export function RoleProvider({ children }) {
  const auth = useAuth();
  const [appMode, setAppMode] = useState("employee"); // "employee" or "admin"

  // Sync app mode with user role on login
  useEffect(() => {
    if (!auth?.user) return;
    
    const userRole = auth.user.role?.toUpperCase();
    if (userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "SUPER_ADMIN") {
      setAppMode("admin");
    } else {
      setAppMode("employee");
    }
  }, [auth?.user]);

  // Allow manual switching if admin
  const switchMode = useCallback((mode) => {
    if (["ADMIN", "SUPERADMIN", "SUPER_ADMIN"].includes(auth?.user?.role?.toUpperCase())) {
      setAppMode(mode === "admin" ? "admin" : "employee");
    }
  }, [auth?.user]);

  const value = {
    appMode,                    // "employee" or "admin"
    switchMode,
    isAdmin: ["ADMIN", "SUPERADMIN", "SUPER_ADMIN"].includes(auth?.user?.role?.toUpperCase()),
    isSuperAdmin: ["SUPERADMIN", "SUPER_ADMIN"].includes(auth?.user?.role?.toUpperCase()),
    isEmployee: auth?.user?.role?.toUpperCase() === "EMPLOYEE",
    user: auth?.user,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    return {
      appMode: "employee",
      switchMode: () => {},
      isAdmin: false,
      isSuperAdmin: false,
      isEmployee: true,
      user: null,
    };
  }
  return ctx;
}

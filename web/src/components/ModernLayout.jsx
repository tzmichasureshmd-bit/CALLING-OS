import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Phone, Users, Target,
  TrendingUp, FileBarChart, Settings, Smartphone, LogOut, CreditCard,
  CalendarCheck, Plug, Menu, X, Sun, Moon, Bell,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";

// Navigation items
const NAV_ITEMS = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/call-logs", icon: Phone, label: "Calls" },
  { to: "/leads", icon: Target, label: "Leads" },
  { to: "/opportunities", icon: TrendingUp, label: "Opportunities" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/manage/employees", icon: Users, label: "Team" },
  { to: "/follow-ups", icon: CalendarCheck, label: "Follow-ups" },
  { to: "/device-health", icon: Smartphone, label: "Devices" },
  { to: "/integrations", icon: Plug, label: "Integrations" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
  { to: "/subscription", icon: CreditCard, label: "Billing" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

const ADMIN_NAV = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/call-logs", icon: Phone, label: "Calls" },
  { to: "/manage/employees", icon: Users, label: "Employees" },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/leads", icon: Target, label: "Leads" },
  { to: "/opportunities", icon: TrendingUp, label: "Opportunities" },
  { to: "/device-health", icon: Smartphone, label: "Device Health" },
  { to: "/integrations", icon: Plug, label: "Integrations" },
  { to: "/follow-ups", icon: CalendarCheck, label: "Follow-ups" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
  { to: "/subscription", icon: CreditCard, label: "Subscription" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

// ── Sidebar Component ──────────────────────────────────────────────────────
function ModernSidebar({ expanded, onToggle, userRole }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const items = userRole === "ADMIN" ? ADMIN_NAV : NAV_ITEMS;
  const initials = user?.organization_name?.slice(0, 2).toUpperCase() || "CA";

  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <aside
      style={{
        width: expanded ? 260 : 80,
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        transition: "width 0.3s ease",
        zIndex: 40,
        overflowY: "auto",
      }}
    >
      {/* Logo & Brand Header */}
      <div
        style={{
          padding: "16px 14px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "var(--grad-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 14,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        {expanded && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "var(--text-primary)",
                fontFamily: "Space Grotesk",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              CallNexa
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--accent)",
                fontWeight: 700,
              }}
            >
              {userRole?.toUpperCase() || "ORG"}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav
        style={{
          flex: 1,
          padding: "12px 8px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: expanded ? "10px 12px" : "12px",
              borderRadius: 12,
              textDecoration: "none",
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              background: isActive ? "var(--accent-soft)" : "transparent",
              transition: "all 0.2s",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            })}
          >
            <item.icon size={18} style={{ flexShrink: 0 }} />
            {expanded && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer Actions */}
      <div
        style={{
          padding: "12px 8px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={toggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: expanded ? "flex-start" : "center",
            gap: 12,
            padding: expanded ? "10px 12px" : "12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--bg-hover)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          {theme === "light" ? (
            <Moon size={18} />
          ) : (
            <Sun size={18} />
          )}
          {expanded && <span>{theme === "light" ? "Dark" : "Light"}</span>}
        </button>

        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: expanded ? "flex-start" : "center",
            gap: 12,
            padding: expanded ? "10px 12px" : "12px",
            borderRadius: 12,
            border: "1px solid var(--danger-soft)",
            background: "var(--danger-soft)",
            color: "var(--danger)",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          <LogOut size={18} />
          {expanded && <span>Logout</span>}
        </button>
      </div>

      {/* Profile Footer */}
      {expanded && (
        <div
          style={{
            padding: "12px",
            fontSize: 11,
            color: "var(--text-dim)",
            textAlign: "center",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.email}
          </div>
        </div>
      )}
    </aside>
  );
}

// ── Top Navigation Bar ──────────────────────────────────────────────────────
function ModernTopbar({ expanded, onSidebarToggle, currentPage }) {
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        height: 62,
        position: "sticky",
        top: 0,
        zIndex: 30,
        marginLeft: expanded ? 260 : 80,
        transition: "margin-left 0.3s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          onClick={onSidebarToggle}
          style={{
            display: "none",
            width: 36,
            height: 36,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-hover)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
          }}
          className="mobile-toggle"
        >
          <Menu size={18} />
        </button>
        <h1
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
            fontFamily: "Space Grotesk",
          }}
        >
          {currentPage}
        </h1>
      </div>

      {/* Right Side Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Search bar */}
        <input
          type="text"
          placeholder="Search..."
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: 13,
            width: 200,
            outline: "none",
            transition: "all 0.2s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--accent)";
            e.target.style.background = "var(--bg)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border)";
            e.target.style.background = "var(--bg-input)";
          }}
        />

        {/* Notifications */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--bg-hover)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "all 0.2s",
            }}
          >
            <Bell size={18} />
            <div
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--danger)",
              }}
            />
          </button>

          {notifOpen && (
            <div
              style={{
                position: "absolute",
                top: 44,
                right: 0,
                width: 280,
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "var(--bg-card)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
                padding: 0,
                zIndex: 100,
              }}
            >
              <div style={{ padding: 12, borderBottom: "1px solid var(--border)" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  Notifications
                </div>
              </div>
              <div style={{ padding: 12, fontSize: 12, color: "var(--text-dim)" }}>
                No new notifications
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            paddingLeft: 12,
            borderLeft: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {user?.email?.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
            {user?.email}
          </div>
        </div>
      </div>
    </header>
  );
}

// ── Main Layout Wrapper ────────────────────────────────────────────────────
export function ModernLayoutWrapper({ children, currentPage = "Dashboard", userRole = "ADMIN" }) {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 35,
            display: "none",
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <ModernSidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded(!sidebarExpanded)}
        userRole={userRole}
      />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          marginLeft: sidebarExpanded ? 260 : 80,
          display: "flex",
          flexDirection: "column",
          transition: "margin-left 0.3s ease",
          minWidth: 0,
        }}
      >
        {/* Top Bar */}
        <ModernTopbar
          expanded={sidebarExpanded}
          onSidebarToggle={() => setSidebarExpanded(!sidebarExpanded)}
          currentPage={currentPage}
        />

        {/* Page Content */}
        <main
          style={{
            flex: 1,
            padding: "24px",
            overflowY: "auto",
            background: "var(--bg)",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default ModernLayoutWrapper;

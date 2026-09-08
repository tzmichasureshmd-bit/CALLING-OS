import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Phone, Users, Target,
  TrendingUp, FileBarChart, Settings, Smartphone, LogOut, CreditCard,
} from "lucide-react";
import { Logo } from "./ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/call-logs", icon: Phone, label: "Calls" },
  { to: "/manage/employees", icon: Users, label: "Employees" },
  { to: "/leads", icon: Target, label: "Leads" },
  { to: "/opportunities", icon: TrendingUp, label: "Opportunities" },
  { to: "/device-health", icon: Smartphone, label: "Device Health" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
  { to: "/subscription", icon: CreditCard, label: "Subscription" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function NavItem({ to, icon: Icon, label, end, expanded }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `nova-nav-item${isActive ? " active" : ""}`}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "0 14px", height: 44, borderRadius: 12,
        textDecoration: "none", whiteSpace: "nowrap",
        overflow: "hidden", flexShrink: 0,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <Icon size={20} style={{ flexShrink: 0 }} />
      <span style={{
        fontSize: 13.5, fontWeight: 600,
        opacity: expanded ? 1 : 0,
        width: expanded ? "auto" : 0,
        transition: "opacity 0.2s ease, width 0.2s ease",
        overflow: "hidden",
      }}>{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const initials = user?.organization_name?.slice(0, 2).toUpperCase() || "CA";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const sidebarWidth = expanded ? 220 : 72;

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 55 }}
        />
      )}
      <aside
        className={`nova-rail ${open ? "open" : ""}`}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          background: "var(--rail)",
          borderRight: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          height: "100vh", position: "sticky", top: 0, zIndex: 56,
          padding: "16px 14px",
          transition: "width 0.22s ease",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22, paddingLeft: 2, overflow: "hidden" }}>
          <Logo size={22} showText={false} />
          <span style={{
            fontSize: 15, fontWeight: 800, fontFamily: "Space Grotesk",
            background: "var(--grad-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            opacity: expanded ? 1 : 0, whiteSpace: "nowrap",
            transition: "opacity 0.2s ease",
          }}>CallNexa</span>
        </div>

        {/* Nav — manager pages only, no super admin link here */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV.map((n) => <NavItem key={n.to} {...n} expanded={expanded} />)}
        </nav>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 2px", overflow: "hidden" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--grad-brand)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12.5, fontWeight: 700, fontFamily: "Space Grotesk", flexShrink: 0,
            }}>
              {initials}
            </div>
            <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.2s", whiteSpace: "nowrap", overflow: "hidden" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                {user?.organization_name || "Organization"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>
                {user?.email || ""}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "0 14px", height: 40, borderRadius: 12,
              border: "none", background: "transparent",
              color: "var(--text-muted)", cursor: "pointer",
              whiteSpace: "nowrap", overflow: "hidden",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger-soft)"; e.currentTarget.style.color = "var(--danger)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >
            <LogOut size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, opacity: expanded ? 1 : 0, width: expanded ? "auto" : 0, transition: "opacity 0.2s, width 0.2s", overflow: "hidden" }}>
              Sign out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

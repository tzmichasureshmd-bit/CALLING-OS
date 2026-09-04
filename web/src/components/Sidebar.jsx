import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, BarChart3, Phone, Users, Target,
  TrendingUp, FileBarChart, Settings, Smartphone, LogOut, ShieldCheck,
} from "lucide-react";
import { Logo } from "./ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useNavigate } from "react-router-dom";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/analytics", icon: BarChart3, label: "Analytics" },
  { to: "/call-logs", icon: Phone, label: "Calls" },
  { to: "/manage/employees", icon: Users, label: "Employees" },
  { to: "/leads", icon: Target, label: "Leads" },
  { to: "/opportunities", icon: TrendingUp, label: "Opportunities" },
  { to: "/device-health", icon: Smartphone, label: "Device Health" },
  { to: "/reports", icon: FileBarChart, label: "Reports" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function RailItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} className="nova-rail-item" style={({ isActive }) => ({
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 44,
      height: 44,
      borderRadius: 12,
      color: isActive ? "#fff" : "var(--text-muted)",
      background: isActive ? "var(--grad-brand)" : "transparent",
      textDecoration: "none",
      transition: "background 0.15s ease, color 0.15s ease",
      boxShadow: isActive ? "var(--glow)" : "none",
    })}>
      <Icon size={20} />
      <span className="nova-rail-tip">{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.organization_name?.slice(0, 2).toUpperCase() || "CA";

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 55 }} />}
      <aside className={`nova-rail ${open ? "open" : ""}`} style={{
        width: 72, flexShrink: 0, background: "var(--rail)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", alignItems: "center",
        height: "100vh", position: "sticky", top: 0, zIndex: 56,
        padding: "16px 0",
      }}>
        <div style={{ marginBottom: 22 }}>
          <Logo size={22} showText={false} />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          {user?.role === "SUPER_ADMIN" && <RailItem to="/superadmin" icon={ShieldCheck} label="Super Admin" />}
          {NAV.map((n) => <RailItem key={n.to} {...n} />)}
        </nav>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 12 }}>
          <div title={user?.email} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, fontFamily: "Space Grotesk" }}>
            {initials}
          </div>
          <button onClick={handleLogout} title="Sign out" className="nova-rail-item" style={{ width: 44, height: 40, borderRadius: 12, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <LogOut size={18} />
            <span className="nova-rail-tip">Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}

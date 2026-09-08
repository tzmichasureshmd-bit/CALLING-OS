import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogOut, Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function SuperAdminSidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/admin");
  }

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "var(--rail)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0,
      padding: "20px 16px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "var(--grad-brand)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ShieldCheck size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>
            Super Admin
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>CallNexa Platform</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px", borderRadius: 10,
          background: "var(--accent-soft)", color: "var(--accent)",
          fontSize: 13.5, fontWeight: 600,
        }}>
          <Building2 size={18} />
          All Organizations
        </div>
      </nav>

      {/* User info + logout */}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user?.email}</div>
          <div style={{ marginTop: 2, color: "var(--accent)", fontWeight: 700, fontSize: 11 }}>SUPER ADMIN</div>
        </div>
        <button onClick={handleLogout} style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "9px 12px", borderRadius: 10,
          border: "1px solid var(--border)", background: "transparent",
          color: "var(--danger)", cursor: "pointer", fontSize: 13, fontWeight: 600,
        }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </aside>
  );
}

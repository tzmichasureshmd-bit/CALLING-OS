import { Building2, User, Palette, Bell, Shield, Sun, Moon } from "lucide-react";
import { PageContainer, Card, CardHeader, Button, Badge, LoadingState, ErrorState } from "../components/ui.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer",
      background: on ? "var(--accent)" : "var(--border-strong)",
      position: "relative", transition: "background 0.2s",
    }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s", boxShadow: "var(--shadow-sm)",
      }} />
    </button>
  );
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { loading, error, data, reload } = useResource(() => dataSource.getOrganization());

  if (loading) return <PageContainer><Card><LoadingState message="Loading settings..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load settings" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const org = data || {};
  const initials = (user?.name || user?.email || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="callos-grid-2">
        <Card>
          <CardHeader icon={Building2} title="Organization" subtitle="Company account details" />
          <Row label="Company Name" value={org.name || "—"} />
          <Row label="Company Code" value={<Badge tone="accent">{org.companyCode || org.company_code || "—"}</Badge>} />
          <Row label="Admin" value={org.admin?.name || user?.name || "—"} />
          <Row label="Admin Email" value={org.admin?.email || user?.email || "—"} />
        </Card>

        <Card>
          <CardHeader icon={Palette} title="Appearance" subtitle="Theme preferences" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {theme === "light" ? <Sun size={18} color="var(--warning)" /> : <Moon size={18} color="var(--accent)" />}
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Dark mode</span>
            </div>
            <Toggle on={theme === "dark"} onClick={toggleTheme} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bell size={18} color="var(--text-muted)" />
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Email notifications</span>
            </div>
            <Toggle on onClick={() => {}} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={User} title="Profile" subtitle="Your account" />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{user?.name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{user?.email || "—"}</div>
            </div>
          </div>
          <Button variant="outline">Edit Profile</Button>
        </Card>

        <Card>
          <CardHeader icon={Shield} title="Security" subtitle="Account protection" />
          <Row label="Two-factor authentication" value={<Badge tone="warning">Off</Badge>} />
          <Row label="Password" value="Last changed 20 days ago" />
          <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
            <Button variant="outline">Change Password</Button>
            <Button variant="soft">Enable 2FA</Button>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
}

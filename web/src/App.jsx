import { useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import { RouteFallback } from "./components/ui.jsx";
import { LayoutDashboard, Phone, Users, BarChart3, Settings, ShieldCheck, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "./context/ThemeContext.jsx";

const Login        = lazy(() => import("./pages/Login.jsx"));
const AdminLogin   = lazy(() => import("./pages/AdminLogin.jsx"));
const SuperAdmin   = lazy(() => import("./pages/SuperAdmin.jsx"));
const Dashboard    = lazy(() => import("./pages/Dashboard.jsx"));
const Analytics    = lazy(() => import("./pages/Analytics.jsx"));
const Employees    = lazy(() => import("./pages/Employees.jsx"));
const ExcludedNumbers    = lazy(() => import("./pages/ExcludedNumbers.jsx"));
const CallLogs     = lazy(() => import("./pages/CallLogs.jsx"));
const Leads        = lazy(() => import("./pages/Leads.jsx"));
const Opportunities      = lazy(() => import("./pages/Opportunities.jsx"));
const DeviceHealth = lazy(() => import("./pages/DeviceHealth.jsx"));
const Transcribe   = lazy(() => import("./pages/Transcribe.jsx"));
const OpportunitiesClosed = lazy(() => import("./pages/OpportunitiesClosed.jsx"));
const Reports      = lazy(() => import("./pages/Reports.jsx"));
const Subscription = lazy(() => import("./pages/Subscription.jsx"));
const Invoices     = lazy(() => import("./pages/Invoices.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));

const ORG_TITLES = {
  "/": "Dashboard", "/analytics": "Analytics", "/call-logs": "Calls",
  "/manage/employees": "Employees", "/manage/excluded": "Excluded Numbers",
  "/leads": "Leads", "/opportunities": "Opportunities",
  "/device-health": "Device Health", "/transcribe": "Transcribe",
  "/opportunities-closed": "Closed Deals", "/reports": "Reports",
  "/subscription": "Subscription", "/invoices": "Invoices", "/settings": "Settings",
};

// ── Super Admin top bar ───────────────────────────────────────────────────────
function SuperAdminTopbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  async function handleLogout() { await logout(); window.location.href = "/admin"; }
  return (
    <header className="nova-glass" style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ShieldCheck size={17} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Super Admin</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>CallNexa Platform</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{user?.email}</div>
          <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 11 }}>SUPER ADMIN</div>
        </div>
        <button onClick={toggleTheme} style={iconBtn}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button onClick={handleLogout} style={{ ...iconBtn, color: "var(--danger)", borderColor: "var(--border)" }}><LogOut size={17} /></button>
      </div>
    </header>
  );
}

const iconBtn = { width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

// ── Super Admin shell (no sidebar) ───────────────────────────────────────────
function SuperAdminShell() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <SuperAdminTopbar />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/superadmin" element={<SuperAdmin />} />
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}

// ── Org Manager shell (full dashboard) ───────────────────────────────────────
function OrgShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const title = ORG_TITLES[location.pathname] || "CallNexa";
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar title={title} onMenu={() => setMenuOpen((o) => !o)} />
        <main style={{ flex: 1 }}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/manage/employees" element={<Employees />} />
              <Route path="/manage/excluded" element={<ExcludedNumbers />} />
              <Route path="/call-logs" element={<CallLogs />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/device-health" element={<DeviceHealth />} />
              <Route path="/transcribe" element={<Transcribe />} />
              <Route path="/opportunities-closed" element={<OpportunitiesClosed />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <nav className="nova-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}><LayoutDashboard /><span>Dashboard</span></NavLink>
        <NavLink to="/call-logs" className={({ isActive }) => isActive ? "active" : ""}><Phone /><span>Calls</span></NavLink>
        <NavLink to="/manage/employees" className={({ isActive }) => isActive ? "active" : ""}><Users /><span>Team</span></NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""}><BarChart3 /><span>Analytics</span></NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}><Settings /><span>Settings</span></NavLink>
      </nav>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthed, user } = useAuth();

  // Not logged in — show login pages only
  if (!isAuthed) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // SUPER_ADMIN → superadmin shell only
  if (user?.role === "SUPER_ADMIN") return <SuperAdminShell />;

  // ADMIN / EMPLOYEE → org manager shell
  return <OrgShell />;
}

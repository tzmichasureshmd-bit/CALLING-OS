import { useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import { ModernLayoutWrapper } from "./components/ModernLayout.jsx";
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
const Integrations  = lazy(() => import("./pages/Integrations.jsx"));
const OpportunitiesClosed = lazy(() => import("./pages/OpportunitiesClosed.jsx"));
const Reports      = lazy(() => import("./pages/Reports.jsx"));
const Subscription = lazy(() => import("./pages/Subscription.jsx"));
const Invoices     = lazy(() => import("./pages/Invoices.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));
const Transcribe   = lazy(() => import("./pages/Transcribe.jsx"));
const FollowUps    = lazy(() => import("./pages/FollowUps.jsx"));
const LandingPage  = lazy(() => import("./pages/LandingPage.jsx"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage.jsx"));
const PricingPage  = lazy(() => import("./pages/PricingPage.jsx"));

const ORG_TITLES = {
  "/dashboard": "Dashboard", "/analytics": "Analytics", "/call-logs": "Calls",
  "/manage/employees": "Employees", "/manage/excluded": "Excluded Numbers",
  "/leads": "Leads", "/opportunities": "Opportunities",
  "/integrations": "Integrations",
  "/opportunities-closed": "Closed Deals", "/reports": "Reports",
  "/subscription": "Subscription", "/invoices": "Invoices", "/settings": "Settings",
  "/follow-ups": "Follow-ups",
};

function SuperAdminTopbar({ onMenu, title }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  async function handleLogout() { await logout(); window.location.href = "/admin"; }
  return (
    <header className="nova-glass" style={{ height: 62, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", position: "sticky", top: 0, zIndex: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onMenu} style={{ ...iconBtn, display: "none" }} className="mobile-only"><Users size={18} /></button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldCheck size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{title}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>CallNexa Platform</div>
          </div>
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

function SuperAdminSidebar({ open, onClose }) {
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  async function handleLogout() {
    await logout();
    window.location.href = "/admin";
  }
  
  const NAV = [
    { to: "/superadmin", label: "Super Admin Panel", icon: ShieldCheck, end: true },
    { to: "/dashboard", label: "Organizations Dashboard", icon: LayoutDashboard },
    { to: "/call-logs", label: "All Calls", icon: Phone },
    { to: "/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/manage/employees", label: "All Employees", icon: Users },
    { to: "/leads", label: "All Leads", icon: Users },
    { to: "/opportunities", label: "All Opportunities", icon: BarChart3 },
    { to: "/transcribe", label: "Transcripts", icon: Phone },
    { to: "/device-health", label: "Devices", icon: Settings },
    { to: "/integrations", label: "Integrations", icon: Settings },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/settings", label: "Settings", icon: Settings },
  ];
  
  return (
    <>
      {open && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 49, display: "block" }} className="mobile-only" />}
      <aside style={{
        width: 260, background: "var(--bg-card)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", position: "fixed", height: "100vh",
        left: open ? 0 : -260, transition: "left 0.3s", zIndex: 50,
      }} className="sidebar">
        {/* Header */}
        <div style={{ padding: "20px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>CallNexa</div>
              <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700 }}>SUPER ADMIN</div>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <nav style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
          {NAV.map(item => (
            <NavLink 
              key={item.to} 
              to={item.to} 
              end={item.end}
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
            >
              <item.icon size={18} /> {item.label}
            </NavLink>
          ))}
        </nav>
        
        {/* Footer */}
        <div style={{ padding: 16, borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>
            {user?.email}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={toggleTheme} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button onClick={handleLogout} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--danger)" }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

const iconBtn = { width: 38, height: 38, borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

function SuperAdminShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  
  // SuperAdmin can access all organization pages + special superadmin panel
  const SUPER_TITLES = {
    "/superadmin": "Super Admin",
    "/dashboard": "All Organizations Dashboard",
    "/analytics": "Cross-Org Analytics", 
    "/call-logs": "All Calls",
    "/manage/employees": "All Employees",
    "/manage/excluded": "Excluded Numbers",
    "/leads": "All Leads",
    "/opportunities": "All Opportunities",
    "/integrations": "Integrations",
    "/transcribe": "All Transcripts",
    "/device-health": "All Devices",
    "/reports": "Platform Reports",
    "/settings": "Platform Settings",
  };
  
  const title = SUPER_TITLES[location.pathname] || "Super Admin";
  
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <SuperAdminSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <SuperAdminTopbar onMenu={() => setMenuOpen((o) => !o)} title={title} />
        <main style={{ flex: 1 }}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/superadmin" element={<SuperAdmin />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/call-logs" element={<CallLogs />} />
              <Route path="/manage/employees" element={<Employees />} />
              <Route path="/manage/excluded" element={<ExcludedNumbers />} />
              <Route path="/leads" element={<Leads />} />
              <Route path="/opportunities" element={<Opportunities />} />
              <Route path="/device-health" element={<DeviceHealth />} />
              <Route path="/transcribe" element={<Transcribe />} />
              <Route path="/integrations" element={<Integrations />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/superadmin" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      {/* SuperAdmin Bottom Nav */}
      <nav className="nova-bottom-nav">
        <NavLink to="/superadmin" end className={({ isActive }) => isActive ? "active" : ""}><ShieldCheck /><span>Super Admin</span></NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""}><LayoutDashboard /><span>Dashboard</span></NavLink>
        <NavLink to="/call-logs" className={({ isActive }) => isActive ? "active" : ""}><Phone /><span>Calls</span></NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""}><BarChart3 /><span>Analytics</span></NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}><Settings /><span>Settings</span></NavLink>
      </nav>
    </div>
  );
}

function OrgShell() {
  const location = useLocation();
  const ORG_TITLES = {
    "/dashboard": "Dashboard", "/analytics": "Analytics", "/call-logs": "Calls",
    "/manage/employees": "Team", "/manage/excluded": "Excluded Numbers",
    "/leads": "Leads", "/opportunities": "Opportunities",
    "/integrations": "Integrations",
    "/opportunities-closed": "Closed Deals", "/reports": "Reports",
    "/subscription": "Billing", "/invoices": "Invoices", "/settings": "Settings",
    "/follow-ups": "Follow-ups", "/device-health": "Device Health", "/transcribe": "Transcripts",
  };
  
  const currentPage = ORG_TITLES[location.pathname] || "Dashboard";

  return (
    <ModernLayoutWrapper currentPage={currentPage} userRole="ADMIN">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/manage/employees" element={<Employees />} />
          <Route path="/manage/excluded" element={<ExcludedNumbers />} />
          <Route path="/call-logs" element={<CallLogs />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/device-health" element={<DeviceHealth />} />
          <Route path="/transcribe" element={<Transcribe />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/opportunities-closed" element={<OpportunitiesClosed />} />
          <Route path="/follow-ups" element={<FollowUps />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ModernLayoutWrapper>
  );
}

export default function App() {
  const { isAuthed, user } = useAuth();
  const location = useLocation();

  // Marketing pages remain public even when an organization session is active.
  if (["/landing", "/features", "/pricing"].includes(location.pathname)) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Routes>
      </Suspense>
    );
  }

  if (!isAuthed) {
    return (
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (user?.role === "SUPER_ADMIN") return <SuperAdminShell />;
  if (user?.role === "EMPLOYEE") return <EmployeeShell />;
  return <OrgShell />;
}

// ── Employee Shell (Limited Dashboard) ────────────────────────────────────────
function EmployeeShell() {
  const location = useLocation();
  const EMPLOYEE_TITLES = {
    "/dashboard": "My Dashboard",
    "/call-logs": "My Calls",
    "/leads": "My Leads",
    "/opportunities": "My Opportunities",
    "/settings": "Settings",
  };

  const currentPage = EMPLOYEE_TITLES[location.pathname] || "Dashboard";

  return (
    <ModernLayoutWrapper currentPage={currentPage} userRole="EMPLOYEE">
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/call-logs" element={<CallLogs />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Block all other routes */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ModernLayoutWrapper>
  );
}

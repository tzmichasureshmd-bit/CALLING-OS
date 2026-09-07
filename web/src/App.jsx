import { useState, lazy, Suspense } from "react";
import { Routes, Route, useLocation, Navigate, NavLink } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import { RouteFallback } from "./components/ui.jsx";
import { LayoutDashboard, Phone, Users, BarChart3, Settings } from "lucide-react";

const Login = lazy(() => import("./pages/Login.jsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.jsx"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const Analytics = lazy(() => import("./pages/Analytics.jsx"));
const Employees = lazy(() => import("./pages/Employees.jsx"));
const ExcludedNumbers = lazy(() => import("./pages/ExcludedNumbers.jsx"));
const CallLogs = lazy(() => import("./pages/CallLogs.jsx"));
const Leads = lazy(() => import("./pages/Leads.jsx"));
const Opportunities = lazy(() => import("./pages/Opportunities.jsx"));
const DeviceHealth = lazy(() => import("./pages/DeviceHealth.jsx"));
const Transcribe = lazy(() => import("./pages/Transcribe.jsx"));
const OpportunitiesClosed = lazy(() => import("./pages/OpportunitiesClosed.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Subscription = lazy(() => import("./pages/Subscription.jsx"));
const Invoices = lazy(() => import("./pages/Invoices.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));

const TITLES = {
  "/superadmin": "Super Admin",
  "/": "Command Center",
  "/analytics": "Analytics",
  "/call-logs": "Call Intelligence",
  "/manage/employees": "Team Operations",
  "/manage/excluded": "Excluded Numbers",
  "/leads": "Leads",
  "/opportunities": "Opportunities",
  "/device-health": "Device Health",
  "/transcribe": "Transcribe",
  "/opportunities-closed": "Closed Opportunities",
  "/reports": "Reports",
  "/subscription": "Subscription",
  "/invoices": "Invoices",
  "/settings": "Settings",
};

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { isAuthed, user } = useAuth();
  const title = TITLES[location.pathname] || "CallNexa";

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

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Topbar title={title} onMenu={() => setMenuOpen((o) => !o)} />
        <main style={{ flex: 1 }}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              {user?.role === "SUPER_ADMIN" && <Route path="/superadmin" element={<SuperAdmin />} />}
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
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="nova-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? "active" : ""}>
          <LayoutDashboard /><span>Dashboard</span>
        </NavLink>
        <NavLink to="/call-logs" className={({ isActive }) => isActive ? "active" : ""}>
          <Phone /><span>Calls</span>
        </NavLink>
        <NavLink to="/manage/employees" className={({ isActive }) => isActive ? "active" : ""}>
          <Users /><span>Team</span>
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => isActive ? "active" : ""}>
          <BarChart3 /><span>Analytics</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}>
          <Settings /><span>Settings</span>
        </NavLink>
      </nav>
    </div>
  );
}

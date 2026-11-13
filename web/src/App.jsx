import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  BarChart3,
  Ban,
  CalendarCheck,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  Phone,
  Plug,
  ReceiptText,
  Settings,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "./context/AuthContext.jsx";
import { RouteFallback } from "./components/ui.jsx";
import PremiumLayout from "./components/PremiumLayout.jsx";

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
const Integrations = lazy(() => import("./pages/Integrations.jsx"));
const OpportunitiesClosed = lazy(() => import("./pages/OpportunitiesClosed.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));
const Subscription = lazy(() => import("./pages/Subscription.jsx"));
const Invoices = lazy(() => import("./pages/Invoices.jsx"));
const SettingsPage = lazy(() => import("./pages/Settings.jsx"));
const Transcribe = lazy(() => import("./pages/Transcribe.jsx"));
const FollowUps = lazy(() => import("./pages/FollowUps.jsx"));
const LandingPage = lazy(() => import("./pages/LandingPage.jsx"));
const FeaturesPage = lazy(() => import("./pages/FeaturesPage.jsx"));
const PricingPage = lazy(() => import("./pages/PricingPage.jsx"));

const ICONS = {
  dashboard: LayoutDashboard,
  calls: Phone,
  team: Users,
  analytics: BarChart3,
  leads: Target,
  opportunities: TrendingUp,
  devices: Smartphone,
  excluded: Ban,
  integrations: Plug,
  followups: CalendarCheck,
  reports: FileBarChart,
  billing: CreditCard,
  invoices: ReceiptText,
  settings: Settings,
  admin: ShieldCheck,
};

const ORG_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: ICONS.dashboard, end: true },
  { to: "/call-logs", label: "Calls", icon: ICONS.calls },
  { to: "/manage/employees", label: "Employees", icon: ICONS.team },
  { to: "/analytics", label: "Analytics", icon: ICONS.analytics },
  { to: "/leads", label: "Leads", icon: ICONS.leads },
  { to: "/opportunities", label: "Opportunities", icon: ICONS.opportunities },
  { to: "/opportunities-closed", label: "Closed Deals", icon: ICONS.opportunities },
  { to: "/device-health", label: "Device Health", icon: ICONS.devices },
  { to: "/manage/excluded", label: "Excluded Numbers", icon: ICONS.excluded },
  { to: "/integrations", label: "Integrations", icon: ICONS.integrations },
  { to: "/follow-ups", label: "Follow-ups", icon: ICONS.followups },
  { to: "/reports", label: "Reports", icon: ICONS.reports },
  { to: "/subscription", label: "Subscription", icon: ICONS.billing },
  { to: "/invoices", label: "Invoices", icon: ICONS.invoices },
  { to: "/settings", label: "Settings", icon: ICONS.settings },
];

const EMPLOYEE_NAV = [
  { to: "/dashboard", label: "My Dashboard", icon: ICONS.dashboard, end: true },
  { to: "/call-logs", label: "My Calls", icon: ICONS.calls },
  { to: "/leads", label: "My Leads", icon: ICONS.leads },
  { to: "/opportunities", label: "My Opportunities", icon: ICONS.opportunities },
  { to: "/settings", label: "Settings", icon: ICONS.settings },
];

const SUPER_ADMIN_NAV = [
  { to: "/superadmin", label: "Super Admin", icon: ICONS.admin, end: true },
  { to: "/dashboard", label: "Organizations", icon: ICONS.dashboard },
  { to: "/call-logs", label: "All Calls", icon: ICONS.calls },
  { to: "/manage/employees", label: "All Employees", icon: ICONS.team },
  { to: "/analytics", label: "Analytics", icon: ICONS.analytics },
  { to: "/leads", label: "All Leads", icon: ICONS.leads },
  { to: "/opportunities", label: "All Opportunities", icon: ICONS.opportunities },
  { to: "/opportunities-closed", label: "Closed Deals", icon: ICONS.opportunities },
  { to: "/device-health", label: "All Devices", icon: ICONS.devices },
  { to: "/manage/excluded", label: "Excluded Numbers", icon: ICONS.excluded },
  { to: "/integrations", label: "Integrations", icon: ICONS.integrations },
  { to: "/transcribe", label: "Transcripts", icon: Phone },
  { to: "/reports", label: "Reports", icon: ICONS.reports },
  { to: "/settings", label: "Settings", icon: ICONS.settings },
];

const TITLES = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/superadmin": "Super Admin",
  "/call-logs": "Calls",
  "/analytics": "Analytics",
  "/manage/employees": "Employees",
  "/manage/excluded": "Excluded Numbers",
  "/leads": "Leads",
  "/opportunities": "Opportunities",
  "/opportunities-closed": "Closed Deals",
  "/device-health": "Device Health",
  "/transcribe": "Transcripts",
  "/integrations": "Integrations",
  "/follow-ups": "Follow-ups",
  "/reports": "Reports",
  "/subscription": "Subscription",
  "/invoices": "Invoices",
  "/settings": "Settings",
};

function AuthenticatedShell({ children, navItems, roleLabel }) {
  const location = useLocation();
  const pageTitle = TITLES[location.pathname] || "Dashboard";

  return (
    <PremiumLayout
      currentPage={pageTitle}
      navItems={navItems}
      roleLabel={roleLabel}
      showPageHeading={location.pathname === "/dashboard" || location.pathname === "/superadmin"}
    >
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </PremiumLayout>
  );
}

function OrganizationShell() {
  return (
    <AuthenticatedShell navItems={ORG_NAV} roleLabel="Organization">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/manage/employees" element={<Employees />} />
        <Route path="/manage/excluded" element={<ExcludedNumbers />} />
        <Route path="/call-logs" element={<CallLogs />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/opportunities-closed" element={<OpportunitiesClosed />} />
        <Route path="/device-health" element={<DeviceHealth />} />
        <Route path="/transcribe" element={<Transcribe />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/follow-ups" element={<FollowUps />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/subscription" element={<Subscription />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthenticatedShell>
  );
}

function EmployeeShell() {
  return (
    <AuthenticatedShell navItems={EMPLOYEE_NAV} roleLabel="Employee">
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/call-logs" element={<CallLogs />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthenticatedShell>
  );
}

function SuperAdminShell() {
  return (
    <AuthenticatedShell navItems={SUPER_ADMIN_NAV} roleLabel="Super Admin">
      <Routes>
        <Route path="/superadmin" element={<SuperAdmin />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/call-logs" element={<CallLogs />} />
        <Route path="/manage/employees" element={<Employees />} />
        <Route path="/manage/excluded" element={<ExcludedNumbers />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/opportunities" element={<Opportunities />} />
        <Route path="/opportunities-closed" element={<OpportunitiesClosed />} />
        <Route path="/device-health" element={<DeviceHealth />} />
        <Route path="/transcribe" element={<Transcribe />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    </AuthenticatedShell>
  );
}

export default function App() {
  const { isAuthed, user } = useAuth();
  const location = useLocation();

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
  return <OrganizationShell />;
}

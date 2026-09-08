import { useState, useEffect } from "react";
import { Building2, Users, Phone, Smartphone, Microchip, Activity, ScrollText, HeartPulse, Package, Search } from "lucide-react";
import { PageContainer, Card } from "../components/ui.jsx";
import { superApi } from "./superadmin/api.js";
import OrgsTab         from "./superadmin/OrgsTab.jsx";
import EmployeesTab    from "./superadmin/EmployeesTab.jsx";
import CallsTab        from "./superadmin/CallsTab.jsx";
import DevicesTab      from "./superadmin/DevicesTab.jsx";
import SimsTab         from "./superadmin/SimsTab.jsx";
import SyncHealthTab   from "./superadmin/SyncHealthTab.jsx";
import AuditLogsTab    from "./superadmin/AuditLogsTab.jsx";
import SystemHealthTab from "./superadmin/SystemHealthTab.jsx";
import AppVersionsTab  from "./superadmin/AppVersionsTab.jsx";
import GlobalSearchTab from "./superadmin/GlobalSearchTab.jsx";

const KPI_TABS = [
  { key: "orgs",      label: "Organizations", icon: Building2,  color: "var(--accent)",   stat: "total_organizations" },
  { key: "employees", label: "Employees",     icon: Users,      color: "var(--success)",  stat: "total_employees"     },
  { key: "calls",     label: "Total Calls",   icon: Phone,      color: "var(--violet)",   stat: "total_calls"         },
  { key: "devices",   label: "Devices",       icon: Smartphone, color: "var(--warning)",  stat: "total_devices"       },
];

const ALL_TABS = [
  { key: "orgs",          label: "Organizations", icon: Building2  },
  { key: "employees",     label: "Employees",     icon: Users      },
  { key: "calls",         label: "Calls",         icon: Phone      },
  { key: "devices",       label: "Devices",       icon: Smartphone },
  { key: "sims",          label: "SIM Mgmt",      icon: Microchip  },
  { key: "sync-health",   label: "Sync Health",   icon: Activity   },
  { key: "audit-logs",    label: "Audit Logs",    icon: ScrollText },
  { key: "system-health", label: "System Health", icon: HeartPulse },
  { key: "app-versions",  label: "App Versions",  icon: Package    },
  { key: "search",        label: "Global Search", icon: Search     },
];

export default function SuperAdmin() {
  const [tab, setTab]     = useState("orgs");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    superApi.stats().then(setStats).catch(() => {});
  }, []);

  const statVal = (key) => stats?.[key] ?? "—";

  return (
    <PageContainer>
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 24 }}>
        {KPI_TABS.map((t) => (
          <Card key={t.key} onClick={() => setTab(t.key)} style={{
            cursor: "pointer",
            border: tab === t.key ? `2px solid ${t.color}` : "1px solid var(--border)",
            transition: "border 0.15s, transform 0.15s",
            transform: tab === t.key ? "translateY(-2px)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: t.color + "22", color: t.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <t.icon size={20} />
              </div>
              <div>
                <div style={{ fontFamily: "Space Grotesk", fontSize: 28, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{statVal(t.stat)}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{t.label}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 20, borderBottom: "1px solid var(--border)", overflowX: "auto", paddingBottom: 0 }}>
        {ALL_TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer",
            fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
            color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1, transition: "color 0.15s",
          }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "orgs"          && <OrgsTab />}
      {tab === "employees"     && <EmployeesTab />}
      {tab === "calls"         && <CallsTab />}
      {tab === "devices"       && <DevicesTab />}
      {tab === "sims"          && <SimsTab />}
      {tab === "sync-health"   && <SyncHealthTab />}
      {tab === "audit-logs"    && <AuditLogsTab />}
      {tab === "system-health" && <SystemHealthTab />}
      {tab === "app-versions"  && <AppVersionsTab />}
      {tab === "search"        && <GlobalSearchTab />}
    </PageContainer>
  );
}

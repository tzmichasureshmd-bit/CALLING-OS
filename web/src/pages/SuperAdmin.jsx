import { useState } from "react";
import { Building2, Users, Phone, Smartphone, ChevronRight, ArrowLeft, CheckCircle2, XCircle, Search } from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, ErrorState, SkeletonRows } from "../components/ui.jsx";
import { useResource } from "../api/useResource.js";
import client from "../api/client.js";

// ── API helpers ───────────────────────────────────────────────────────────────
const superApi = {
  stats: () => client.get("/superadmin/stats").then((r) => r.data),
  orgs: (q) => client.get("/superadmin/organizations", { params: { q, page_size: 100 } }).then((r) => r.data),
  orgDetail: (id) => client.get(`/superadmin/organizations/${id}`).then((r) => r.data),
  toggleStatus: (id) => client.patch(`/superadmin/organizations/${id}/status`).then((r) => r.data),
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDur(s) {
  if (!s) return "0s";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [query, setQuery] = useState("");

  if (selectedOrg) return <OrgDetail orgId={selectedOrg} onBack={() => setSelectedOrg(null)} />;

  return (
    <PageContainer>
      <StatsRow />
      <OrgList query={query} setQuery={setQuery} onSelect={setSelectedOrg} />
    </PageContainer>
  );
}

// ── Platform stats ────────────────────────────────────────────────────────────
function StatsRow() {
  const { data, loading } = useResource(() => superApi.stats());
  const stats = data || {};
  const items = [
    { label: "Organizations", value: stats.total_organizations ?? "—", icon: Building2, color: "var(--accent)" },
    { label: "Employees", value: stats.total_employees ?? "—", icon: Users, color: "var(--success)" },
    { label: "Total Calls", value: stats.total_calls ?? "—", icon: Phone, color: "var(--violet)" },
    { label: "Devices", value: stats.total_devices ?? "—", icon: Smartphone, color: "var(--warning)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 }}>
      {items.map((s) => (
        <Card key={s.label}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: s.color + "22", color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={19} />
            </div>
            <div>
              <div style={{ fontFamily: "Space Grotesk", fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>
                {loading ? "…" : s.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Org list ──────────────────────────────────────────────────────────────────
function OrgList({ query, setQuery, onSelect }) {
  const { data, loading, error, reload } = useResource(() => superApi.orgs(query || undefined), [query]);
  const [toggling, setToggling] = useState(null);

  async function handleToggle(e, id) {
    e.stopPropagation();
    setToggling(id);
    await superApi.toggleStatus(id).catch(() => {});
    setToggling(null);
    reload();
  }

  return (
    <Card padding={0}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>All Organizations</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Every company registered on CallNexa</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", width: 220 }}>
          <Search size={14} color="var(--text-dim)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search organizations…"
            style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
        </div>
      </div>

      {loading && <div style={{ padding: 20 }}><SkeletonRows rows={5} cols={6} /></div>}
      {error && <ErrorState title="Failed to load" message={error.message} onRetry={reload} />}
      {!loading && !error && (
        <div className="nova-scroll-x">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Organization", "Code", "Email", "Employees", "Calls", "Devices", "Created", "Status", ""].map((h) => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((org) => (
                <tr key={org.id} onClick={() => onSelect(org.id)}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--text-primary)" }}>{org.name}</td>
                  <td style={{ padding: "13px 16px" }}><span style={{ fontFamily: "Space Grotesk", fontSize: 12, background: "var(--bg-hover)", padding: "3px 8px", borderRadius: 6, color: "var(--accent)" }}>{org.code}</span></td>
                  <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{org.email || "—"}</td>
                  <td style={{ padding: "13px 16px", color: "var(--text-secondary)", fontWeight: 600 }}>{org.employees}</td>
                  <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{org.calls}</td>
                  <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{org.devices}</td>
                  <td style={{ padding: "13px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(org.created_at)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <Badge tone={org.status === "active" ? "success" : "danger"} dot>{org.status}</Badge>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={(e) => handleToggle(e, org.id)} disabled={toggling === org.id}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: org.status === "active" ? "var(--danger)" : "var(--success)", cursor: "pointer" }}>
                        {toggling === org.id ? "…" : org.status === "active" ? "Suspend" : "Activate"}
                      </button>
                      <ChevronRight size={16} color="var(--text-dim)" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(data?.items || []).length === 0 && !loading && (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>No organizations found</div>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Org detail drill-down ─────────────────────────────────────────────────────
function OrgDetail({ orgId, onBack }) {
  const { data, loading, error, reload } = useResource(() => superApi.orgDetail(orgId));
  const [tab, setTab] = useState("employees");

  if (loading) return <PageContainer><Card><SkeletonRows rows={6} cols={4} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Failed to load" message={error.message} onRetry={reload} /></Card></PageContainer>;

  const { organization: org, employees, calls, devices } = data;

  return (
    <PageContainer>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", color: "var(--accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back to all organizations
      </button>

      {/* Org header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, fontFamily: "Space Grotesk" }}>
            {org.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{org.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{org.email} · {org.phone || "—"}</div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Stat label="Employees" value={employees.length} />
            <Stat label="Calls" value={calls.length} />
            <Stat label="Devices" value={devices.length} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: "Space Grotesk", fontSize: 12, background: "var(--bg-hover)", padding: "4px 10px", borderRadius: 8, color: "var(--accent)", fontWeight: 700 }}>{org.code}</span>
              <span style={{ fontSize: 11, color: "var(--text-dim)" }}>Company Code</span>
            </div>
            <Badge tone={org.status === "active" ? "success" : "danger"} dot>{org.status}</Badge>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {["employees", "calls", "devices"].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 18px", borderRadius: 10, border: "1px solid " + (tab === t ? "transparent" : "var(--border)"),
            background: tab === t ? "var(--grad-brand)" : "transparent",
            color: tab === t ? "#fff" : "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
          }}>{t} ({tab === "employees" ? employees.length : tab === "calls" ? calls.length : devices.length})</button>
        ))}
      </div>

      {tab === "employees" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Name", "Email", "Phone", "Code", "Status", "Joined"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{e.email || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--accent)" }}>{e.phone || "—"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{e.employee_code}</td>
                  <td style={{ padding: "12px 16px" }}><Badge tone={e.status === "active" ? "success" : "neutral"} dot>{e.status}</Badge></td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{fmtDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "calls" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Contact", "Phone", "Type", "Duration", "Date"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{c.contact || "Unknown"}</td>
                  <td style={{ padding: "12px 16px", color: "var(--accent)" }}>{c.phone}</td>
                  <td style={{ padding: "12px 16px" }}><Badge tone={c.type === "incoming" ? "teal" : c.type === "outgoing" ? "violet" : "danger"}>{c.type}</Badge></td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{fmtDur(c.duration)}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(c.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "devices" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Model", "Status", "Battery", "Last Seen"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{d.model || "Unknown"}</td>
                  <td style={{ padding: "12px 16px" }}><Badge tone={d.is_online ? "success" : "danger"} dot>{d.is_online ? "Online" : "Offline"}</Badge></td>
                  <td style={{ padding: "12px 16px", color: "var(--text-secondary)" }}>{d.battery ?? "—"}%</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmtDate(d.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </PageContainer>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: "Space Grotesk", fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };

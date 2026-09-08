import { useState } from "react";
import { Building2, Users, Phone, Smartphone, ChevronRight, ArrowLeft, Search, Mail, PhoneCall, Calendar } from "lucide-react";
import { Card, Badge } from "../../components/ui.jsx";
import { ORGS, DETAILS, fmtDate, fmtDur, TH, TD } from "./mockData.js";

function Avatar({ name, size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 800, fontFamily: "Space Grotesk", flexShrink: 0 }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StatPill({ label, value, icon: Icon, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "var(--bg-hover)", borderRadius: 12, border: "1px solid var(--border)" }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: color + "22", color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontFamily: "Space Grotesk", fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Org detail ────────────────────────────────────────────────────────────────
function OrgDetail({ org, detail, onBack }) {
  const [tab, setTab] = useState("employees");
  const { employees, calls, devices } = detail;

  const TABS = [
    { key: "employees", label: "Employees", count: employees.length, icon: Users },
    { key: "calls",     label: "Calls",     count: calls.length,     icon: Phone },
    { key: "devices",   label: "Devices",   count: devices.length,   icon: Smartphone },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "var(--accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={16} /> Back to Organizations
      </button>

      {/* Org header */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <Avatar name={org.name} size={56} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <div style={{ fontFamily: "Space Grotesk", fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{org.name}</div>
              <Badge tone={org.status === "active" ? "success" : "danger"} dot>{org.status}</Badge>
              <span style={{ fontFamily: "Space Grotesk", fontSize: 12, background: "var(--accent-soft)", padding: "3px 10px", borderRadius: 7, color: "var(--accent)", fontWeight: 700 }}>{org.code}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 13, color: "var(--text-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={13} />{org.email}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><PhoneCall size={13} />{org.phone}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={13} />Joined {fmtDate(org.created_at)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatPill label="Employees" value={employees.length} icon={Users}      color="var(--success)" />
            <StatPill label="Calls"     value={calls.length}     icon={Phone}      color="var(--violet)" />
            <StatPill label="Devices"   value={devices.length}   icon={Smartphone} color="var(--warning)" />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
            border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
            color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
            marginBottom: -1, transition: "color 0.15s",
          }}>
            <t.icon size={15} />{t.label}
            <span style={{ fontSize: 11, fontWeight: 700, background: tab === t.key ? "var(--accent-soft)" : "var(--bg-hover)", color: tab === t.key ? "var(--accent)" : "var(--text-dim)", padding: "1px 7px", borderRadius: 20 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "employees" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Employee", "Email", "Phone", "Code", "Status", "Joined"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {e.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</span>
                    </div>
                  </td>
                  <td style={TD({ color: "var(--text-muted)" })}>{e.email}</td>
                  <td style={TD({ color: "var(--accent)" })}>{e.phone}</td>
                  <td style={TD()}><span style={{ fontFamily: "Space Grotesk", fontSize: 11.5, background: "var(--bg-hover)", padding: "2px 8px", borderRadius: 6, color: "var(--text-secondary)", fontWeight: 600 }}>{e.code}</span></td>
                  <td style={TD()}><Badge tone={e.status === "active" ? "success" : "neutral"} dot>{e.status}</Badge></td>
                  <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(e.joined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "calls" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Contact", "Phone", "Type", "Duration", "Date"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={TD({ fontWeight: 600, color: "var(--text-primary)" })}>{c.contact}</td>
                  <td style={TD({ color: "var(--accent)" })}>{c.phone}</td>
                  <td style={TD()}><Badge tone={c.type === "incoming" ? "teal" : c.type === "outgoing" ? "violet" : "danger"}>{c.type}</Badge></td>
                  <td style={TD({ color: "var(--text-secondary)", fontFamily: "Space Grotesk" })}>{fmtDur(c.duration)}</td>
                  <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(c.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "devices" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Device Model", "Status", "Battery", "Last Seen"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bg-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Smartphone size={15} color="var(--text-muted)" />
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.model}</span>
                    </div>
                  </td>
                  <td style={TD()}><Badge tone={d.online ? "success" : "danger"} dot>{d.online ? "Online" : "Offline"}</Badge></td>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 80, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${d.battery}%`, borderRadius: 4, background: d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)" }} />
                      </div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)" }}>{d.battery}%</span>
                    </div>
                  </td>
                  <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(d.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ── Organizations list ────────────────────────────────────────────────────────
export default function OrganizationsTab({ orgs, onToggle }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  if (selected) {
    const org = orgs.find((o) => o.id === selected);
    return <OrgDetail org={org} detail={DETAILS[selected]} onBack={() => setSelected(null)} />;
  }

  const filtered = orgs.filter((o) =>
    !query || o.name.toLowerCase().includes(query.toLowerCase()) || o.code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Card padding={0}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>All Organizations</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{orgs.length} companies on CallNexa</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", width: 230 }}>
          <Search size={14} color="var(--text-dim)" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or code…"
            style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
        </div>
      </div>
      <div className="nova-scroll-x">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>{["Organization", "Code", "Email", "Employees", "Calls", "Devices", "Joined", "Status", "Actions"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((org) => (
              <tr key={org.id} onClick={() => setSelected(org.id)} style={{ cursor: "pointer" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                <td style={TD()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={org.name} size={34} />
                    <div>
                      <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13.5 }}>{org.name}</div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{org.phone}</div>
                    </div>
                  </div>
                </td>
                <td style={TD()}><span style={{ fontFamily: "Space Grotesk", fontSize: 12, background: "var(--accent-soft)", padding: "3px 9px", borderRadius: 6, color: "var(--accent)", fontWeight: 700 }}>{org.code}</span></td>
                <td style={TD({ color: "var(--text-muted)" })}>{org.email}</td>
                <td style={TD({ fontWeight: 700, color: "var(--text-primary)", textAlign: "center" })}>{org.employees}</td>
                <td style={TD({ color: "var(--text-secondary)", textAlign: "center" })}>{org.calls}</td>
                <td style={TD({ color: "var(--text-secondary)", textAlign: "center" })}>{org.devices}</td>
                <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(org.created_at)}</td>
                <td style={TD()}><Badge tone={org.status === "active" ? "success" : "danger"} dot>{org.status}</Badge></td>
                <td style={TD()}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); onToggle(org.id); }}
                      style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: org.status === "active" ? "var(--danger)" : "var(--success)", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {org.status === "active" ? "Suspend" : "Activate"}
                    </button>
                    <ChevronRight size={15} color="var(--text-dim)" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No organizations found.</div>}
      </div>
    </Card>
  );
}

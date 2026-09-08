import { useState, useEffect, useCallback } from "react";
import { Building2, ChevronRight, Search, ArrowLeft, Mail, PhoneCall, Calendar, Users, Phone, Smartphone, Plus, RefreshCw, Trash2, KeyRound } from "lucide-react";
import { Card, Badge, ErrorState, SkeletonRows } from "../../components/ui.jsx";
import { superApi, fmtDate, fmtDur, TH, TD } from "./api.js";

function Avatar({ name = "?", size = 36 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 800, fontFamily: "Space Grotesk", flexShrink: 0 }}>
      {(name || "?").slice(0, 2).toUpperCase()}
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

// ── Org Detail ────────────────────────────────────────────────────────────────
function OrgDetail({ orgId, onBack }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [tab, setTab]       = useState("employees");
  const [resetting, setResetting] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    superApi.orgDetail(orgId)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e?.message || "Failed to load"); setLoading(false); });
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Card><SkeletonRows rows={6} cols={4} /></Card>;
  if (error)   return <Card><ErrorState title="Failed to load" message={error} onRetry={load} /></Card>;

  const { organization: org, employees = [], calls = [], devices = [], stats } = data;

  const TABS = [
    { key: "employees", label: "Employees", count: stats?.employees ?? employees.length, icon: Users },
    { key: "calls",     label: "Calls",     count: stats?.calls     ?? calls.length,     icon: Phone },
    { key: "devices",   label: "Devices",   count: stats?.devices   ?? devices.length,   icon: Smartphone },
  ];

  async function handleReset(e) {
    e.preventDefault();
    if (!newPwd.trim()) return;
    setResetting(true);
    await superApi.resetPass(orgId, newPwd).catch(() => {});
    setResetting(false); setNewPwd(""); setShowPwd(false);
  }

  return (
    <div>
      <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "transparent", border: "none", color: "var(--accent)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 20, padding: 0 }}>
        <ArrowLeft size={16} /> Back to Organizations
      </button>

      {/* Header */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
          <Avatar name={org.name} size={56} />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
              <div style={{ fontFamily: "Space Grotesk", fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>{org.name}</div>
              <Badge tone={org.status === "active" ? "success" : "danger"} dot>{org.status}</Badge>
              <span style={{ fontFamily: "Space Grotesk", fontSize: 12, background: "var(--accent-soft)", padding: "3px 10px", borderRadius: 7, color: "var(--accent)", fontWeight: 700 }}>{org.code}</span>
              {org.plan && <Badge tone="info">{org.plan}</Badge>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, fontSize: 13, color: "var(--text-muted)" }}>
              {org.email && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Mail size={13} />{org.email}</span>}
              {org.phone && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><PhoneCall size={13} />{org.phone}</span>}
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Calendar size={13} />Joined {fmtDate(org.created_at)}</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatPill label="Employees" value={stats?.employees ?? employees.length} icon={Users}      color="var(--success)" />
            <StatPill label="Calls"     value={stats?.calls     ?? calls.length}     icon={Phone}      color="var(--violet)" />
            <StatPill label="Devices"   value={stats?.devices   ?? devices.length}   icon={Smartphone} color="var(--warning)" />
          </div>
        </div>

        {/* Reset password inline */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <KeyRound size={14} color="var(--text-muted)" />
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 600 }}>Reset Admin Password:</span>
          <form onSubmit={handleReset} style={{ display: "flex", gap: 8 }}>
            <input type={showPwd ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="New password…"
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 12.5, outline: "none", width: 160 }} />
            <button type="button" onClick={() => setShowPwd((s) => !s)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>
              {showPwd ? "Hide" : "Show"}
            </button>
            <button type="submit" disabled={resetting || !newPwd.trim()} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {resetting ? "Saving…" : "Reset"}
            </button>
          </form>
        </div>
      </Card>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            display: "flex", alignItems: "center", gap: 7, padding: "10px 18px",
            border: "none", background: "transparent", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
            color: tab === t.key ? "var(--accent)" : "var(--text-muted)",
            borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1,
          }}>
            <t.icon size={15} />
            {t.label}
            <span style={{ fontSize: 11, fontWeight: 700, background: tab === t.key ? "var(--accent-soft)" : "var(--bg-hover)", color: tab === t.key ? "var(--accent)" : "var(--text-dim)", padding: "1px 7px", borderRadius: 20 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {tab === "employees" && (
        <Card padding={0}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Employee", "Email", "Phone", "Code", "Status", "Joined"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {employees.length === 0 && <tr><td colSpan={6} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>No employees</td></tr>}
              {employees.map((e) => (
                <tr key={e.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                        {(e.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{e.name || "—"}</span>
                    </div>
                  </td>
                  <td style={TD({ color: "var(--text-muted)" })}>{e.email || "—"}</td>
                  <td style={TD({ color: "var(--accent)" })}>{e.phone || "—"}</td>
                  <td style={TD()}><span style={{ fontFamily: "Space Grotesk", fontSize: 11.5, background: "var(--bg-hover)", padding: "2px 8px", borderRadius: 6, color: "var(--text-secondary)", fontWeight: 600 }}>{e.employee_code || "—"}</span></td>
                  <td style={TD()}><Badge tone={e.status === "active" ? "success" : "neutral"} dot>{e.status}</Badge></td>
                  <td style={TD({ color: "var(--text-muted)" })}>{fmtDate(e.created_at)}</td>
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
              {calls.length === 0 && <tr><td colSpan={5} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>No calls</td></tr>}
              {calls.map((c) => (
                <tr key={c.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={TD({ fontWeight: 600, color: "var(--text-primary)" })}>{c.contact || "Unknown"}</td>
                  <td style={TD({ color: "var(--accent)" })}>{c.phone || "—"}</td>
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
            <thead><tr>{["Device", "Status", "Battery", "Last Seen"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr></thead>
            <tbody>
              {devices.length === 0 && <tr><td colSpan={4} style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)" }}>No devices</td></tr>}
              {devices.map((d) => (
                <tr key={d.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: "var(--bg-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Smartphone size={15} color="var(--text-muted)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.model || "Unknown"}</div>
                        {d.manufacturer && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{d.manufacturer}{d.android_version ? ` · Android ${d.android_version}` : ""}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={TD()}><Badge tone={d.is_online ? "success" : "danger"} dot>{d.is_online ? "Online" : "Offline"}</Badge></td>
                  <td style={TD()}>
                    {d.battery != null ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${d.battery}%`, borderRadius: 4, background: d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)" }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)" }}>{d.battery}%</span>
                      </div>
                    ) : "—"}
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

// ── Org List ──────────────────────────────────────────────────────────────────
export default function OrgsTab() {
  const [selected, setSelected] = useState(null);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [query, setQuery]       = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm]         = useState({ name: "", email: "", phone: "", admin_password: "Admin@123" });
  const [creating, setCreating] = useState(false);
  const [actionErr, setActionErr] = useState("");

  const load = useCallback((q) => {
    setLoading(true); setError(null);
    superApi.orgs({ q: q || undefined, page_size: 100 })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e?.message || "Failed to load"); setLoading(false); });
  }, []);

  useEffect(() => { load(query); }, [query, load]);

  async function handleToggle(e, id) {
    e.stopPropagation();
    setActionErr("");
    try {
      await superApi.toggle(id);
      load(query);
    } catch (err) {
      setActionErr(err?.response?.data?.detail || err.message || "Toggle failed");
    }
  }

  async function handleDelete(e, id, name) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? This will permanently delete all employees, calls, devices and data. Cannot be undone.`)) return;
    setActionErr("");
    try {
      await superApi.deleteOrg(id);
      load(query);
    } catch (err) {
      setActionErr(err?.response?.data?.detail || err.message || "Delete failed");
    }
  }

  async function handleCreate(ev) {
    ev.preventDefault();
    if (!form.name || !form.email) return;
    setCreating(true);
    await superApi.createOrg(form).catch(() => {});
    setCreating(false); setShowCreate(false); setForm({ name: "", email: "", phone: "", admin_password: "Admin@123" });
    load(query);
  }

  if (selected) return <OrgDetail orgId={selected} onBack={() => setSelected(null)} />;

  const items = data?.items || [];

  return (
    <Card padding={0}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>All Organizations</div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{data?.total ?? "—"} companies on CallNexa</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", width: 220 }}>
            <Search size={14} color="var(--text-dim)" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or code…"
              style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
          </div>
          <button onClick={() => load(query)} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setShowCreate((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <Plus size={14} /> New Org
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", background: "var(--bg-hover)" }}>
          {[{ key: "name", ph: "Company name *" }, { key: "email", ph: "Admin email *" }, { key: "phone", ph: "Phone" }, { key: "admin_password", ph: "Admin password" }].map((f) => (
            <input key={f.key} value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
              style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", width: 180 }} />
          ))}
          <button type="submit" disabled={creating} style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {creating ? "Creating…" : "Create"}
          </button>
          <button type="button" onClick={() => setShowCreate(false)} style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        </form>
      )}

      {actionErr && (
        <div style={{ margin: "12px 20px", padding: "10px 16px", borderRadius: 10, background: "var(--danger-soft, #dc262622)", border: "1px solid var(--danger)", color: "var(--danger)", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>⚠ {actionErr}</span>
          <button onClick={() => setActionErr("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {loading && <div style={{ padding: 20 }}><SkeletonRows rows={5} cols={7} /></div>}
      {error   && <ErrorState title="Failed to load organizations" message={error} onRetry={() => load(query)} />}

      {!loading && !error && (
        <div className="nova-scroll-x">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>{["Organization", "Code", "Email", "Employees", "Calls", "Devices", "Plan", "Joined", "Status", "Actions"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.map((org) => (
                <tr key={org.id} onClick={() => setSelected(org.id)} style={{ cursor: "pointer" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={org.name} size={34} />
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13.5 }}>{org.name}</div>
                        {org.phone && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{org.phone}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={TD()}><span style={{ fontFamily: "Space Grotesk", fontSize: 12, background: "var(--accent-soft)", padding: "3px 9px", borderRadius: 6, color: "var(--accent)", fontWeight: 700 }}>{org.code}</span></td>
                  <td style={TD({ color: "var(--text-muted)" })}>{org.email || org.admin_email || "—"}</td>
                  <td style={TD({ fontWeight: 700, color: "var(--text-primary)", textAlign: "center" })}>{org.employees}</td>
                  <td style={TD({ color: "var(--text-secondary)", textAlign: "center" })}>{org.calls}</td>
                  <td style={TD({ color: "var(--text-secondary)", textAlign: "center" })}>{org.devices}</td>
                  <td style={TD()}>{org.plan ? <Badge tone="info">{org.plan}</Badge> : <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
                  <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(org.created_at)}</td>
                  <td style={TD()}><Badge tone={org.status === "active" ? "success" : "danger"} dot>{org.status}</Badge></td>
                  <td style={TD()}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={(e) => handleToggle(e, org.id)} style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: org.status === "active" ? "var(--danger)" : "var(--success)", cursor: "pointer", whiteSpace: "nowrap" }}>
                        {org.status === "active" ? "Suspend" : "Activate"}
                      </button>
                      <button onClick={(e) => handleDelete(e, org.id, org.name)} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--border)", background: "transparent", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight size={15} color="var(--text-dim)" />
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={10} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>No organizations found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

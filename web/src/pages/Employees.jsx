import { useEffect, useMemo, useState } from "react";
import {
  Activity, BarChart3, BatteryMedium, CalendarDays, CheckCircle2,
  ChevronRight, Clock3, FileSpreadsheet, LayoutDashboard, Mail,
  PhoneCall, PhoneMissed, RefreshCw, Shield, Smartphone, TrendingUp,
  UserCheck, UserPlus, Users, X, Trash2,
} from "lucide-react";
import {
  PageContainer, Card, Button, SearchInput, Badge, EmptyState,
  LoadingState, ErrorState, CountUp,
} from "../components/ui.jsx";
import { formatDateTime, formatDuration, formatTalkTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { analyticsApi, employeesApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "This week" },
  { key: "30d", label: "This month" },
];

const STEPS = [
  { icon: Shield, label: "App Permissions", desc: "Allow the required permissions so the app can track calls and sync analytics." },
  { icon: UserCheck, label: "Sign Up", desc: "Register the employee profile and connect with your team code." },
  { icon: Smartphone, label: "SIM Selection", desc: "Select the SIM used for business calls." },
  { icon: CheckCircle2, label: "SIM Verification", desc: "Verify the selected number to activate sync." },
  { icon: LayoutDashboard, label: "Dashboard", desc: "Open the dashboard to view live call activity." },
];

function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function AddEmployeeModal({ onClose, onAdded }) {
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (key) => (event) => setF((current) => ({ ...current, [key]: event.target.value }));

  async function submit() {
    if (!f.name.trim() || !f.email.trim()) { setErr("Name and email are required"); return; }
    setSaving(true); setErr("");
    try {
      await employeesApi.create({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null });
      onAdded(); onClose();
    } catch (error) {
      setErr(error?.message || "Failed to add employee");
    } finally { setSaving(false); }
  }

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <div className="app-dialog-panel" style={{ position: "relative", width: 420, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 750, color: "var(--text-primary)" }}>Register employee</div>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 30, height: 30, borderRadius: 9 }}><X size={15} /></button>
        </div>
        {[{ label: "FULL NAME", key: "name", placeholder: "Rahul Sharma", type: "text" }, { label: "EMAIL", key: "email", placeholder: "rahul@company.com", type: "email" }, { label: "PHONE (OPTIONAL)", key: "phone", placeholder: "+91 98765 43210", type: "tel" }].map((field) => (
          <label key={field.key} style={{ display: "block", marginBottom: 14, color: "var(--text-muted)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>
            {field.label}
            <input type={field.type} placeholder={field.placeholder} value={f[field.key]} onChange={set(field.key)} style={{ display: "block", width: "100%", marginTop: 6, padding: "10px 13px", boxSizing: "border-box" }} />
          </label>
        ))}
        {err && <div style={{ padding: 10, marginBottom: 12, borderRadius: 9, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Button icon={UserPlus} onClick={submit} disabled={saving}>{saving ? "Adding…" : "Register"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function exportEmployeesCSV(employees) {
  const rows = [["Name", "Email", "Mobile", "Status", "Calls", "Connected %", "Registered"]];
  employees.forEach((e) => rows.push([e.name, e.email, e.mobile, e.status, e.calls, `${e.connectedPct}%`, fmtDate(e.registeredDate)]));
  const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click();
  URL.revokeObjectURL(url);
}

function RangeTabs({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, padding: 4, borderRadius: 12, background: "var(--surface-muted)" }}>
      {RANGES.map((range) => (
        <button key={range.key} type="button" onClick={() => onChange(range.key)} style={{ padding: "7px 12px", border: 0, borderRadius: 9, background: value === range.key ? "var(--primary-dark-app)" : "transparent", color: value === range.key ? "#fff" : "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
          {range.label}
        </button>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail, tone = "green" }) {
  const backgrounds = { green: "var(--pastel-green)", yellow: "var(--pastel-yellow)", blue: "var(--pastel-blue)", pink: "var(--pastel-pink)" };
  return (
    <div style={{ padding: 16, borderRadius: "var(--radius-xl-app)", background: backgrounds[tone], border: "1px solid var(--border-soft-app)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ color: "var(--text-secondary-app)", fontSize: 11, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
        <Icon size={18} color="var(--primary-dark-app)" />
      </div>
      <div style={{ color: "var(--text-primary-app)", fontSize: 26, fontWeight: 750 }}>{value}</div>
      <div style={{ marginTop: 4, color: "var(--text-secondary-app)", fontSize: 11 }}>{detail}</div>
    </div>
  );
}

function EmployeeDetail({ employee, range, onClose }) {
  const [detailRange, setDetailRange] = useState(range);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    setDetailRange(range);
  }, [range]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    Promise.all([
      analyticsApi.employee(employee.id, { range: detailRange }),
      dataSource.getCalls({ employee_id: employee.id, page_size: 20 }),
    ]).then(([profile, callData]) => {
      if (!active) return;
      setOverview(profile);
      setCalls(callData.items || []);
    }).catch((err) => {
      if (active) setError(err?.message || "Unable to load employee details");
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [employee.id, detailRange]);

  const kpis = overview?.kpis || {};
  const profile = overview?.employee || employee;
  const devices = overview?.devices || [];

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <aside className="app-drawer-panel" style={{ position: "relative", width: "min(680px, 96vw)", height: "100%", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
            <div style={{ width: 50, height: 50, borderRadius: 16, display: "grid", placeItems: "center", background: "var(--primary-dark-app)", color: "#fff", fontWeight: 800, fontSize: 16 }}>{profile.name?.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <div>
              <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 21 }}>{profile.name}</h2>
              <div style={{ marginTop: 4, color: "var(--text-muted)", fontSize: 12 }}>{profile.email || "—"} · {profile.phone || "No phone"}</div>
              <div style={{ marginTop: 7, display: "flex", gap: 7 }}><Badge tone={profile.status === "active" ? "success" : "neutral"} dot>{profile.status || "unknown"}</Badge><Badge tone="neutral">Joined {fmtDate(profile.created_at || employee.registeredDate)}</Badge></div>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close employee details" style={{ border: 0, background: "var(--bg-hover)", color: "var(--text-muted)", width: 32, height: 32, borderRadius: 10, cursor: "pointer" }}><X size={16} /></button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div><div style={{ color: "var(--text-primary)", fontWeight: 750, fontSize: 15 }}>Performance overview</div><div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3 }}>Real call activity for this employee</div></div>
          <RangeTabs value={detailRange} onChange={setDetailRange} />
        </div>

        {loading ? <LoadingState message="Loading employee analytics…" /> : error ? <ErrorState title="Couldn't load profile" message={error} /> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 18 }}>
              <MetricCard icon={PhoneCall} label="Total calls" value={kpis.total_calls ?? 0} detail={`${kpis.incoming ?? 0} incoming · ${kpis.outgoing ?? 0} outgoing`} tone="blue" />
              <MetricCard icon={Activity} label="Connected" value={`${kpis.connected_pct ?? 0}%`} detail={`${kpis.connected ?? 0} conversations`} tone="green" />
              <MetricCard icon={Clock3} label="Talk time" value={formatTalkTime(kpis.talk_time_seconds ?? 0)} detail={`Average ${formatDuration(kpis.avg_duration_seconds ?? 0)}`} tone="yellow" />
              <MetricCard icon={PhoneMissed} label="Missed calls" value={kpis.missed ?? 0} detail={`${kpis.rejected ?? 0} rejected`} tone="pink" />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ color: "var(--text-primary)", fontWeight: 750, fontSize: 15, marginBottom: 10 }}>Devices and SIM status</div>
              {devices.length === 0 ? <EmptyState icon={Smartphone} title="No device registered" message="This employee has not connected a device yet." /> : devices.map((device) => (
                <div key={device.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 13, marginBottom: 8, borderRadius: 14, background: "var(--surface-muted)", border: "1px solid var(--border-soft-app)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Smartphone size={18} color="var(--accent)" /><div><div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{device.manufacturer || "Device"} {device.model || "Unknown"}</div><div style={{ marginTop: 3, fontSize: 11, color: "var(--text-muted)" }}>Android {device.android_version || "—"} · App {device.app_version || "—"}</div></div></div>
                  <div style={{ textAlign: "right", fontSize: 11, color: "var(--text-muted)" }}><Badge tone={device.is_online ? "success" : "danger"} dot>{device.is_online ? "Online" : "Offline"}</Badge><div style={{ marginTop: 5 }}><BatteryMedium size={13} /> {device.battery_level ?? "—"}%</div></div>
                </div>
              ))}
            </div>

            <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><div style={{ color: "var(--text-primary)", fontWeight: 750, fontSize: 15 }}>Recent calls</div><span style={{ color: "var(--text-muted)", fontSize: 11 }}>{calls.length} loaded</span></div>
              {calls.length === 0 ? <EmptyState icon={PhoneCall} title="No calls in this period" /> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Date", "Contact", "Type", "Duration", "Status"].map((head) => <th key={head} style={{ padding: "9px 8px", textAlign: "left" }}>{head}</th>)}</tr></thead><tbody>{calls.slice(0, 12).map((call) => <tr key={call.id}><td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{formatDateTime(call.date)}</td><td style={{ padding: "10px 8px", fontWeight: 650 }}>{call.contact}</td><td style={{ padding: "10px 8px" }}><Badge tone={call.type === "missed" ? "danger" : "success"}>{call.type}</Badge></td><td style={{ padding: "10px 8px" }}>{formatDuration(call.durationSeconds)}</td><td style={{ padding: "10px 8px" }}>{call.callStatus || "—"}</td></tr>)}</tbody></table></div>}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function OnboardingGuide({ show, activeStep, setActiveStep, onClose }) {
  if (!show) return null;
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Mobile onboarding</h3><Button variant="ghost" icon={X} onClick={onClose}>Close guide</Button></div>
      <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: 28, maxWidth: 640 }}>{STEPS.map((step, index) => { const active = index === activeStep, done = index < activeStep; return <div key={step.label} onClick={() => setActiveStep(index)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, zIndex: 1 }}><div style={{ width: 40, height: 40, borderRadius: "50%", background: active || done ? "var(--accent)" : "var(--bg-hover)", color: active || done ? "#fff" : "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}><step.icon size={18} /></div><span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text-muted)", textAlign: "center" }}>{step.label}</span></div>; })}<div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 2, background: "var(--border)", zIndex: 0 }} /></div>
      <div style={{ padding: 22, borderRadius: 16, background: "var(--pastel-green)", maxWidth: 450 }}><h4 style={{ margin: "0 0 8px", color: "var(--text-primary)" }}>{STEPS[activeStep].label}</h4><p style={{ margin: "0 0 18px", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.5 }}>{STEPS[activeStep].desc}</p><Button onClick={() => setActiveStep((step) => Math.min(step + 1, STEPS.length - 1))}>{activeStep === STEPS.length - 1 ? "Finish" : "Next step"}</Button></div>
    </Card>
  );
}

export default function Employees() {
  const [query, setQuery] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showTrashed, setShowTrashed] = useState(false);
  const [teamRange, setTeamRange] = useState("7d");
  const [teamData, setTeamData] = useState(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [updatingEmployee, setUpdatingEmployee] = useState(null);
  const [detailRange, setDetailRange] = useState("7d");
  const { loading, error, data, reload } = useResource(() => dataSource.getEmployees({ status: showTrashed ? "trashed" : undefined, page_size: 100 }), [showTrashed]);

  async function changeEmployeeStatus(employee) {
    const nextStatus = employee.status === "active" ? "trashed" : "active";
    setUpdatingEmployee(employee.id);
    try { await employeesApi.update(employee.id, { status: nextStatus }); await reload(); }
    catch (err) { window.alert(err?.message || "Unable to update employee status"); }
    finally { setUpdatingEmployee(null); }
  }

  useEffect(() => {
    let active = true;
    setTeamLoading(true); setTeamError("");
    analyticsApi.team({ range: teamRange }).then((result) => active && setTeamData(result)).catch((err) => active && setTeamError(err?.message || "Unable to load team analytics")).finally(() => active && setTeamLoading(false));
    return () => { active = false; };
  }, [teamRange]);

  if (loading) return <PageContainer><Card><LoadingState message="Loading employees..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load employees" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const employees = data.items || [];
  const filtered = employees.filter((employee) => [employee.name, employee.email, employee.mobile].join(" ").toLowerCase().includes(query.toLowerCase()));
  const leaderboard = teamData?.leaderboard || [];
  const leaderboardById = new Map(leaderboard.map((employee) => [employee.id, employee]));
  const activeEmployees = employees.filter((employee) => employee.status === "active").length;

  return (
    <PageContainer>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
        <div><h1 style={{ margin: 0, color: "var(--text-primary)", fontSize: 30 }}>Team overview</h1><p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Review every employee's calls, activity, devices, and performance.</p></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><RangeTabs value={teamRange} onChange={setTeamRange} /><Button icon={UserPlus} onClick={() => setShowAdd(true)}>Register employee</Button></div>
      </div>

      {teamError && <Card style={{ marginBottom: 16 }}><ErrorState title="Couldn't load team analytics" message={teamError} /></Card>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 18 }}>
        <MetricCard icon={PhoneCall} label="Team calls" value={<CountUp value={teamData?.kpis?.total_calls || 0} />} detail={teamLoading ? "Loading…" : "All assigned employees"} tone="blue" />
        <MetricCard icon={Activity} label="Connected" value={`${teamData?.kpis?.connected_pct || 0}%`} detail={`${teamData?.kpis?.connected || 0} connected`} tone="green" />
        <MetricCard icon={Clock3} label="Talk time" value={formatTalkTime(teamData?.kpis?.talk_time_seconds || 0)} detail="Across the selected period" tone="yellow" />
        <MetricCard icon={Users} label="Active employees" value={activeEmployees} detail={`${employees.length} profiles loaded`} tone="pink" />
      </div>

      <Card style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}><div><div style={{ color: "var(--text-primary)", fontWeight: 750, fontSize: 16 }}>Team performance</div><div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 3 }}>Click an employee to open their complete profile.</div></div><Badge tone="success" dot>{teamRange === "today" ? "Today" : teamRange === "7d" ? "This week" : "This month"}</Badge></div>
        {leaderboard.length === 0 ? <EmptyState icon={BarChart3} title="No employee activity yet" message="Performance appears after calls are synced from employee devices." /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>{leaderboard.slice(0, 6).map((stat) => <button key={stat.id} type="button" onClick={() => { setSelectedEmployee(employees.find((employee) => employee.id === stat.id) || { id: stat.id, name: stat.name }); setDetailRange(teamRange); }} style={{ textAlign: "left", padding: 14, borderRadius: 16, border: "1px solid var(--border-soft-app)", background: "var(--pastel-green)", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "var(--text-primary)", fontSize: 13 }}>{stat.name}</strong><ChevronRight size={16} color="var(--text-muted)" /></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 13 }}><span><b style={{ display: "block", color: "var(--text-primary)" }}>{stat.calls}</b><small style={{ color: "var(--text-muted)" }}>Calls</small></span><span><b style={{ display: "block", color: "var(--success)" }}>{stat.connected_pct}%</b><small style={{ color: "var(--text-muted)" }}>Connected</small></span><span><b style={{ display: "block", color: "var(--text-primary)" }}>{formatTalkTime(stat.talk_time_seconds)}</b><small style={{ color: "var(--text-muted)" }}>Talk</small></span></div></button>)}</div>}
      </Card>

      <Card padding={0} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--pastel-blue)", borderRadius: "22px 22px 0 0", flexWrap: "wrap", gap: 10 }}><span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Manage your employee roster</span><div style={{ display: "flex", gap: 10 }}><Button variant="outline" icon={FileSpreadsheet} onClick={() => exportEmployeesCSV(filtered)}>Export CSV</Button><Button variant="ghost" icon={Trash2} onClick={() => { setShowTrashed((value) => !value); reload(); }}>{showTrashed ? "Show active" : "Show trashed"}</Button><SearchInput value={query} onChange={setQuery} placeholder="Search employees..." /></div></div>
        <div className="nova-scroll-x">{filtered.length === 0 ? <EmptyState icon={Users} title="No employees found" message="Register an employee to start monitoring calls." /> : <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr>{["Name", "Email", "Mobile", "Registered", "Last activity", "Status"].map((head) => <th key={head} style={{ textAlign: "left", padding: "12px 16px" }}>{head}</th>)}</tr></thead><tbody>{filtered.map((employee) => { const stat = leaderboardById.get(employee.id); return <tr key={employee.id} onClick={() => { setSelectedEmployee(employee); setDetailRange(teamRange); }} style={{ borderBottom: "1px solid var(--border-soft-app)", cursor: "pointer" }}><td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--text-primary)" }}>{employee.name}</td><td style={{ padding: "13px 16px" }}>{employee.email}</td><td style={{ padding: "13px 16px" }}>{employee.mobile}</td><td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>{fmtDate(employee.registeredDate)}</td><td style={{ padding: "13px 16px", whiteSpace: "nowrap" }}>{formatDateTime(employee.lastCallTime)}</td><td style={{ padding: "13px 16px" }} onClick={(event) => event.stopPropagation()}><Badge tone={employee.status === "active" ? "success" : "neutral"} dot>{employee.status || "unknown"}</Badge>{stat && <span style={{ display: "block", marginTop: 4, color: "var(--text-muted)", fontSize: 11 }}>{stat.calls} calls · {stat.connected_pct}% connected</span>}<button type="button" disabled={updatingEmployee === employee.id} onClick={() => changeEmployeeStatus(employee)} style={{ display: "block", marginTop: 6, border: 0, background: "none", padding: 0, color: employee.status === "active" ? "var(--danger)" : "var(--success)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>{updatingEmployee === employee.id ? "Saving…" : employee.status === "active" ? "Deactivate" : "Restore"}</button></td></tr>; })}</tbody></table>}</div><div style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid var(--border-soft-app)" }}>{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</div>
      </Card>

      <OnboardingGuide show={showGuide} activeStep={activeStep} setActiveStep={setActiveStep} onClose={() => setShowGuide(false)} />
      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} onAdded={reload} />}
      {selectedEmployee && <EmployeeDetail employee={selectedEmployee} range={detailRange} onClose={() => setSelectedEmployee(null)} />}
    </PageContainer>
  );
}

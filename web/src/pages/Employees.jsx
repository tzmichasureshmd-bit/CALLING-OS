import { useState } from "react";
import {
  UserPlus, FileSpreadsheet, Users, Shield, UserCheck,
  Smartphone, CheckCircle2, LayoutDashboard, X, Trash2,
} from "lucide-react";
import { PageContainer, Card, Button, SearchInput, Badge, EmptyState, LoadingState, ErrorState } from "../components/ui.jsx";
import { formatDateTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { employeesApi } from "../api/resources.js";

const STEPS = [
  { icon: Shield,        label: "App Permissions", desc: "Allow the required permissions so the app can track calls and sync your analytics." },
  { icon: UserCheck,     label: "Sign Up",          desc: "Register the employee profile and connect with your team code." },
  { icon: Smartphone,    label: "SIM Selection",    desc: "Select the SIM used for business calls." },
  { icon: CheckCircle2,  label: "SIM Verification", desc: "Verify the selected number to activate sync." },
  { icon: LayoutDashboard, label: "Dashboard",      desc: "Open the dashboard to view live call activity." },
];

function AddEmployeeModal({ onClose, onAdded }) {
  const [f, setF] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.name.trim() || !f.email.trim()) { setErr("Name and email are required"); return; }
    setSaving(true); setErr("");
    try {
      await employeesApi.create({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim() || null });
      onAdded(); onClose();
    } catch (e) { setErr(e?.message || "Failed to add employee"); }
    finally { setSaving(false); }
  }

  const inp = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 6 };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: 420, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Register Employee</div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>
        {[{label:"FULL NAME",k:"name",ph:"Rahul Sharma",type:"text"},{label:"EMAIL",k:"email",ph:"rahul@company.com",type:"email"},{label:"PHONE (optional)",k:"phone",ph:"+91 98765 43210",type:"tel"}].map((field) => (
          <div key={field.k} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>{field.label}</label>
            <input style={inp} type={field.type} placeholder={field.ph} value={f[field.k]} onChange={set(field.k)} />
          </div>
        ))}
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 12 }}>{err}</div>}
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
  employees.forEach((e) => rows.push([e.name, e.email, e.mobile, e.status, e.calls, `${e.connectedPct}%`, new Date(e.registeredDate).toLocaleDateString("en-IN")]));
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `employees-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function Employees() {
  const [query, setQuery] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [showAdd, setShowAdd] = useState(false);
  const [showTrashed, setShowTrashed] = useState(false);
  const { loading, error, data, reload } = useResource(() => dataSource.getEmployees({ status: showTrashed ? "trashed" : undefined }), [showTrashed]);

  if (loading) return <PageContainer><Card><LoadingState message="Loading employees..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load employees" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const EMPLOYEES = data.items || [];
  const filtered = EMPLOYEES.filter((e) =>
    [e.name, e.email, e.mobile].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 20 }}>
        {EMPLOYEES.map((e) => (
          <Card key={e.id} hover>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, fontFamily: "Space Grotesk" }}>
                {e.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.device} · {e.sim}</div>
              </div>
              <Badge tone={e.status === "active" ? "success" : "neutral"} dot>{e.status === "active" ? "Online" : "Offline"}</Badge>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {[{ l: "Calls", v: e.calls }, { l: "Connected", v: `${e.connectedPct}%` }, { l: "Talk", v: e.workingHours?.slice(3) || "—" }].map((s) => (
                <div key={s.l} style={{ background: "var(--bg-hover)", borderRadius: 10, padding: "9px", textAlign: "center" }}>
                  <div style={{ fontFamily: "Space Grotesk", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{s.v}</div>
                  <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{s.l}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card padding={0} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", background: "var(--grad-brand-soft)", borderRadius: "16px 16px 0 0", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Add more telecallers to your team</span>
          <Button icon={UserPlus} onClick={() => setShowAdd(true)}>Register Employee</Button>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", flexWrap: "wrap", gap: 12 }}>
          <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportEmployeesCSV(filtered)}>Excel Export</Button>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Search employees..." />
            <Button variant="ghost" icon={Trash2} onClick={() => { setShowTrashed((s) => !s); reload(); }}>
              {showTrashed ? "Show Active" : "Show Trashed"}
            </Button>
          </div>
        </div>

        <div className="nova-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={Users} title="No employees found" message="Register an employee to start monitoring their calls." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Name", "Email Address", "Mobile Number", "Registered Date", "Working Hours", "Non-Working Hours", "Last Call Time"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--text-primary)" }}>{e.name}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{e.email}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{e.mobile}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{new Date(e.registeredDate).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "13px 16px", color: "var(--success)", fontWeight: 600 }}>{e.workingHours}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{e.nonWorkingHours}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDateTime(e.lastCallTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid var(--border)" }}>
          {filtered.length} employee{filtered.length !== 1 ? "s" : ""}
        </div>
      </Card>

      {showGuide && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
            <h3 style={{ margin: 0, fontFamily: "Space Grotesk", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Mobile Onboarding Instructions</h3>
            <Button variant="ghost" icon={X} onClick={() => setShowGuide(false)}>Close Guide</Button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", position: "relative", marginBottom: 28, maxWidth: 640 }}>
            {STEPS.map((s, i) => {
              const done = i < activeStep, active = i === activeStep;
              return (
                <div key={s.label} onClick={() => setActiveStep(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", flex: 1, zIndex: 1 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: active || done ? "var(--accent)" : "var(--bg-hover)", color: active || done ? "#fff" : "var(--text-dim)", display: "flex", alignItems: "center", justifyContent: "center", border: active ? "3px solid var(--accent-soft)" : "none" }}>
                    <s.icon size={18} />
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text-muted)", textAlign: "center" }}>{s.label}</span>
                </div>
              );
            })}
            <div style={{ position: "absolute", top: 20, left: 20, right: 20, height: 2, background: "var(--border)", zIndex: 0 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "center" }} className="nova-grid-2">
            <div style={{ background: "var(--bg-hover)", borderRadius: 14, padding: 24, maxWidth: 420 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                {(() => { const I = STEPS[activeStep].icon; return <I size={22} />; })()}
              </div>
              <h4 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{STEPS[activeStep].label}</h4>
              <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{STEPS[activeStep].desc}</p>
              <Button onClick={() => setActiveStep((s) => Math.min(s + 1, STEPS.length - 1))}>
                {activeStep === STEPS.length - 1 ? "Finish" : "Next Step →"}
              </Button>
            </div>
            <div style={{ justifySelf: "center", width: 240, height: 420, borderRadius: 30, background: "var(--bg-elevated)", border: "8px solid var(--text-primary)", boxShadow: "var(--shadow-lg)", padding: 18, position: "relative" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20, marginTop: 8 }}>{STEPS[activeStep].label}</div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 20 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {(() => { const I = STEPS[activeStep].icon; return <I size={22} />; })()}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>CallNexa</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", marginBottom: 10 }}>Allowed</div>
              {["Call logs", "Contacts", "Files and media", "Phone"].map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <CheckCircle2 size={15} color="var(--success)" />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{p}</div>
                    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Accessed in past 24 hours</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {showAdd && <AddEmployeeModal onClose={() => setShowAdd(false)} onAdded={reload} />}
    </PageContainer>
  );
}

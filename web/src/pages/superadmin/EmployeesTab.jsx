import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Power, KeyRound, LogOut } from "lucide-react";
import { Card, Badge, ErrorState, SkeletonRows } from "../../components/ui.jsx";
import { superApi, fmtDate, TH, TD } from "./api.js";

function ActionBtn({ icon: Icon, label, color, onClick, disabled }) {
  return (
    <button
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "4px 8px", borderRadius: 7, border: "1px solid var(--border)",
        background: "var(--bg-hover)", cursor: disabled ? "not-allowed" : "pointer",
        color: disabled ? "var(--text-dim)" : color || "var(--text-muted)",
        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600,
      }}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

export default function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [query, setQuery]         = useState("");
  const [busy, setBusy]           = useState({});   // { [empId]: true }
  const [resetModal, setResetModal] = useState(null); // { id, name }
  const [newPwd, setNewPwd]       = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const orgsData = await superApi.orgs({ page_size: 100 });
      const all = [];
      await Promise.all(
        (orgsData.items || []).map(async (org) => {
          const detail = await superApi.orgDetail(org.id).catch(() => null);
          if (detail?.employees) {
            detail.employees.forEach((e) => all.push({ ...e, org_name: org.name, org_code: org.code }));
          }
        })
      );
      setEmployees(all);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id, fn) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      await fn();
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || e.message || "Action failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const handleResetPwd = async () => {
    if (!newPwd.trim()) return;
    await act(resetModal.id, () => superApi.resetEmpPass(resetModal.id, newPwd));
    setResetModal(null); setNewPwd("");
  };

  const filtered = employees.filter((e) =>
    !query ||
    (e.name || "").toLowerCase().includes(query.toLowerCase()) ||
    (e.email || "").toLowerCase().includes(query.toLowerCase()) ||
    (e.org_name || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>All Employees</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{employees.length} employees across all organizations</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", width: 230 }}>
              <Search size={14} color="var(--text-dim)" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees…"
                style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
            </div>
            <button onClick={load} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading && <div style={{ padding: 20 }}><SkeletonRows rows={6} cols={7} /></div>}
        {error   && <ErrorState title="Failed to load employees" message={error} onRetry={load} />}

        {!loading && !error && (
          <div className="nova-scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Employee", "Organization", "Email", "Phone", "Code", "Status", "Joined", "Actions"].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                    <td style={TD()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {(e.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{e.name || "—"}</span>
                      </div>
                    </td>
                    <td style={TD()}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{e.org_name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "Space Grotesk" }}>{e.org_code}</div>
                    </td>
                    <td style={TD({ color: "var(--text-muted)" })}>{e.email || "—"}</td>
                    <td style={TD({ color: "var(--accent)" })}>{e.phone || "—"}</td>
                    <td style={TD()}><span style={{ fontFamily: "Space Grotesk", fontSize: 11.5, background: "var(--bg-hover)", padding: "2px 8px", borderRadius: 6, color: "var(--text-secondary)", fontWeight: 600 }}>{e.employee_code || "—"}</span></td>
                    <td style={TD()}><Badge tone={e.status === "active" ? "success" : "neutral"} dot>{e.status}</Badge></td>
                    <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(e.created_at)}</td>
                    <td style={TD()}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "nowrap" }}>
                        <ActionBtn
                          icon={Power}
                          label={e.status === "active" ? "Deactivate" : "Activate"}
                          color={e.status === "active" ? "var(--danger)" : "var(--success)"}
                          disabled={!!busy[e.id]}
                          onClick={() => act(e.id, () => superApi.toggleEmployee(e.id))}
                        />
                        <ActionBtn
                          icon={KeyRound}
                          label="Reset Pwd"
                          color="var(--warning)"
                          disabled={!!busy[e.id]}
                          onClick={() => { setResetModal({ id: e.id, name: e.name }); setNewPwd(""); }}
                        />
                        <ActionBtn
                          icon={LogOut}
                          label="Force Logout"
                          color="var(--violet)"
                          disabled={!!busy[e.id]}
                          onClick={() => act(e.id, () => superApi.forceLogout(e.id))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={8} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>No employees found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Reset password modal */}
      {resetModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 28, width: 360, border: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6, color: "var(--text-primary)" }}>Reset Password</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 18 }}>Set new password for <strong>{resetModal.name}</strong></div>
            <input
              type="password"
              placeholder="New password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleResetPwd()}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-hover)", color: "var(--text-primary)", fontSize: 14, boxSizing: "border-box", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setResetModal(null)} style={{ padding: "8px 18px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}>Cancel</button>
              <button onClick={handleResetPwd} style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: "var(--accent)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

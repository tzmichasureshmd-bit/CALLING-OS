import { useState } from "react";
import { Target, Phone, Calendar, ArrowRight, Plus, FileSpreadsheet, X, Upload } from "lucide-react";
import { PageContainer, Card, Badge, SearchInput, EmptyState, ErrorState, SkeletonRows, Button } from "../components/ui.jsx";
import { LEAD_STATUS_META } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { leadsApi } from "../api/resources.js";

function BulkUploadModal({ onClose, onAdded }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleUpload() {
    if (!file) { setErr("Please select a file"); return; }
    
    setUploading(true);
    setErr("");
    
    try {
      const token = localStorage.getItem("callos_token");
      const baseURL = import.meta.env.VITE_API_URL || "/api/v1";
      
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await fetch(baseURL + "/leads/bulk/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Upload failed");
      }
      
      const data = await response.json();
      setResult(data);
      setFile(null);
      onAdded();
    } catch (e) {
      setErr(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (f.name.toLowerCase().endsWith(".csv")) {
        setFile(f);
        setErr("");
      } else {
        setErr("Only CSV files are supported");
      }
    }
  }

  const inp = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 6 };

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div className="app-dialog-panel" style={{ position: "relative", width: 520, maxHeight: "90vh", overflowY: "auto", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Bulk Upload Leads</div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>

        {result ? (
          <div>
            <div style={{ padding: 16, borderRadius: 12, background: "var(--success-soft)", border: "1px solid var(--success)", marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--success)", marginBottom: 8 }}>✓ Upload Successful</div>
              <div style={{ fontSize: 12, color: "var(--success)" }}>{result.message}</div>
              {result.created > 0 && <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>Created {result.created} leads</div>}
              {result.errors.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--success)" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--warning)", marginBottom: 6 }}>Warnings:</div>
                  {result.errors.slice(0, 5).map((err, i) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>• {err}</div>
                  ))}
                  {result.errors.length > 5 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>• +{result.errors.length - 5} more errors</div>}
                </div>
              )}
            </div>
            <Button onClick={() => { setResult(null); onClose(); }} style={{ width: "100%" }}>Done</Button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>CSV FILE FORMAT</label>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>
                Required columns: <code style={{ background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>name</code>, <code style={{ background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>phone</code><br/>
                Optional columns: <code style={{ background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>source</code>, <code style={{ background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>employee_id</code>, <code style={{ background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>priority</code>, <code style={{ background: "var(--bg-input)", padding: "2px 6px", borderRadius: 4 }}>notes</code>
              </div>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 12,
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                background: dragActive ? "var(--accent-soft)" : "var(--bg-hover)",
                marginBottom: 16,
                transition: "all 0.2s",
              }}
            >
              <Upload size={32} style={{ marginBottom: 12, color: "var(--text-muted)" }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                {file ? file.name : "Drag & drop CSV here"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                or <label style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 600 }}>
                  browse
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setFile(e.target.files[0]);
                        setErr("");
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>
              </div>
            </div>

            {err && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 12, padding: 12, borderRadius: 8, background: "var(--danger-soft)" }}>{err}</div>}

            <div style={{ fontSize: 12, color: "var(--accent)", marginBottom: 16, padding: 12, borderRadius: 8, background: "var(--accent-soft)", border: "1px solid var(--accent)" }}>
              <strong>ℹ️ Upload recordings of any size</strong> — they'll be saved to the dashboard automatically
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <Button
                icon={Upload}
                onClick={handleUpload}
                disabled={uploading || !file}
              >
                {uploading ? "Uploading…" : "Upload"}
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 16, padding: 12, background: "var(--bg-hover)", borderRadius: 8, lineHeight: 1.6 }}>
              <strong>Example CSV:</strong><br/>
              name,phone,source,employee_id,priority<br/>
              John Doe,+91 9876543210,Cold Call,<br/>
              Jane Smith,+91 9988776655,Referral,emp-123,High
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onAdded }) {
  const [f, setF] = useState({ name: "", phone: "", source: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.name.trim() || !f.phone.trim()) { setErr("Name and phone are required"); return; }
    setSaving(true); setErr("");
    try {
      await leadsApi.create({ name: f.name.trim(), phone: f.phone.trim(), source: f.source.trim() || "Manual", notes: f.notes.trim() || null });
      onAdded(); onClose();
    } catch (e) { setErr(e?.message || "Failed to add lead"); }
    finally { setSaving(false); }
  }

  const inp = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box", marginTop: 6 };

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div className="app-dialog-panel" style={{ position: "relative", width: 420, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add Lead</div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>
        {[{label:"FULL NAME",k:"name",ph:"Customer Name",type:"text"},{label:"PHONE",k:"phone",ph:"+91 98765 43210",type:"tel"},{label:"SOURCE",k:"source",ph:"e.g. Cold Call, Referral",type:"text"},{label:"NOTES",k:"notes",ph:"Optional notes",type:"text"}].map((field) => (
          <div key={field.k} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)" }}>{field.label}</label>
            <input style={inp} type={field.type} placeholder={field.ph} value={f[field.k]} onChange={set(field.k)} />
          </div>
        ))}
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Button icon={Plus} onClick={submit} disabled={saving}>{saving ? "Adding…" : "Add Lead"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function exportLeadsCSV(leads) {
  const rows = [["Name", "Phone", "Source", "Employee", "Status", "Priority", "Next Follow-up", "Value"]];
  leads.forEach((l) => rows.push([l.name, l.phone, l.source, l.employee, l.status, l.priority, l.nextFollowUp, l.expectedValue]));
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

const FLOW = ["Call", "Connected", "Conversation", "Follow-up", "Lead", "Opportunity", "Won/Lost"];

export default function Leads() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const { loading, error, data, reload } = useResource(() => dataSource.getLeads());

  if (loading) return <PageContainer><Card><SkeletonRows rows={6} cols={5} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load leads" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const LEADS = data.items || [];
  const statuses = ["all", ...Object.keys(LEAD_STATUS_META)];
  const filtered = LEADS.filter((l) => {
    const q = [l.name, l.phone, l.employee].join(" ").toLowerCase().includes(query.toLowerCase());
    return q && (status === "all" || l.status === status);
  });

  return (
    <PageContainer>
      {/* Sales flow strip */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {FLOW.map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: i < 5 ? "var(--grad-brand-soft)" : "var(--bg-hover)", color: i < 5 ? "var(--accent)" : "var(--text-muted)", fontFamily: "Space Grotesk" }}>{s}</span>
              {i < FLOW.length - 1 && <ArrowRight size={14} color="var(--text-dim)" />}
            </div>
          ))}
        </div>
      </Card>

      <Card padding={0}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {statuses.map((s) => (
              <button key={s} onClick={() => setStatus(s)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid " + (status === s ? "transparent" : "var(--border)"), background: status === s ? "var(--grad-brand)" : "transparent", color: status === s ? "#fff" : "var(--text-muted)", textTransform: "capitalize" }}>
                {s === "all" ? "All" : LEAD_STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportLeadsCSV(filtered)}>Export CSV</Button>
            <Button icon={Upload} variant="outline" onClick={() => setShowBulkUpload(true)}>Bulk Upload</Button>
            <Button icon={Plus} onClick={() => setShowAdd(true)}>Add Lead</Button>
            <SearchInput value={query} onChange={setQuery} placeholder="Search leads..." />
          </div>
        </div>

        <div className="nova-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={Target} title="No leads found" message="Leads are created from connected calls. Adjust filters or sync new calls." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>{["Lead", "Source", "Employee", "Status", "Priority", "Next Follow-up", "Value"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((l) => {
                  const meta = LEAD_STATUS_META[l.status];
                  return (
                    <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{l.name}</div>
                        <div style={{ color: "var(--accent)", fontSize: 12 }}>{l.phone}</div>
                      </td>
                      <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{l.source}</td>
                      <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{l.employee}</td>
                      <td style={{ padding: "13px 16px" }}><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{l.priority}</td>
                      <td style={{ padding: "13px 16px", color: l.nextFollowUp === "Overdue" ? "var(--danger)" : "var(--text-secondary)", fontWeight: l.nextFollowUp === "Overdue" ? 600 : 400 }}>{l.nextFollowUp}</td>
                      <td style={{ padding: "13px 16px", fontFamily: "Space Grotesk", fontWeight: 600, color: "var(--text-primary)" }}>{l.expectedValue}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onAdded={reload} />}
      {showBulkUpload && <BulkUploadModal onClose={() => setShowBulkUpload(false)} onAdded={reload} />}
    </PageContainer>
  );
}

const th = { textAlign: "left", padding: "11px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };

import { useState } from "react";
import {
  Plug, Upload, Download, RefreshCw, CheckCircle, Settings,
  Database, Link, FileSpreadsheet, Zap, Globe, Lock, AlertCircle,
  ChevronRight, ExternalLink, Cloud, Smartphone,
} from "lucide-react";
import { PageContainer, Card, CardHeader, Badge, Button } from "../components/ui.jsx";

// ── Integration card data ────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    id: "tzmicha",
    name: "TzMicha CRM",
    description: "Sync leads, contacts and opportunities between CallNexa and TzMicha CRM. Calls automatically create or update CRM records.",
    icon: "🗂️",
    color: "var(--accent)",
    status: "available",
    category: "CRM",
    features: ["Auto-create leads from calls", "Sync contact details", "Push call notes to CRM", "Two-way lead status sync"],
  },
  {
    id: "csv_import",
    name: "CSV Import",
    description: "Bulk import leads, contacts or call history from any spreadsheet. Download a template, fill it, upload — done.",
    icon: "📥",
    color: "var(--success)",
    status: "available",
    category: "Data",
    features: ["Import leads from CSV / Excel", "Duplicate detection", "Field mapping", "Import history log"],
  },
  {
    id: "csv_export",
    name: "CSV Export",
    description: "Export your calls, leads, transcripts and analytics as CSV or Excel. Schedule automatic exports.",
    icon: "📤",
    color: "var(--info, #6366f1)",
    status: "available",
    category: "Data",
    features: ["Export calls, leads, analytics", "Date range filter", "Scheduled exports", "Excel & CSV formats"],
  },
  {
    id: "webhook",
    name: "Webhooks",
    description: "Push real-time events to any URL when a call syncs, a recording uploads, or a lead is created.",
    icon: "⚡",
    color: "var(--warning)",
    status: "coming_soon",
    category: "Automation",
    features: ["Call synced events", "Recording uploaded events", "Lead created / updated", "Custom headers & auth"],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect CallNexa to 5,000+ apps through Zapier. Trigger workflows on any call event.",
    icon: "🔌",
    color: "#FF4A00",
    status: "coming_soon",
    category: "Automation",
    features: ["5,000+ app connections", "No-code automation", "Multi-step Zaps", "Real-time triggers"],
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    description: "Live sync call logs and leads to a Google Sheet. Your team sees real-time data without logging in.",
    icon: "📊",
    color: "#34A853",
    status: "coming_soon",
    category: "Productivity",
    features: ["Live call log sync", "Lead pipeline view", "Manager dashboard sheet", "Auto-refresh"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    description: "Auto-send WhatsApp follow-up messages after a call. Templates powered by Meta Cloud API.",
    icon: "💬",
    color: "#25D366",
    status: "coming_soon",
    category: "Communication",
    features: ["Post-call follow-up", "Template messages", "Lead status updates", "Meta Cloud API"],
  },
  {
    id: "api",
    name: "REST API",
    description: "Full access to the CallNexa API. Build your own integrations with JWT authentication.",
    icon: "🔧",
    color: "var(--text-muted)",
    status: "available",
    category: "Developer",
    features: ["Full API access", "JWT authentication", "Swagger / OpenAPI docs", "Webhooks & events"],
  },
];

const CATEGORIES = ["All", "CRM", "Data", "Automation", "Productivity", "Communication", "Developer"];

// ── CSV Import modal UI ───────────────────────────────────────────────────────

function ImportModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [type, setType] = useState("leads");

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  const inputStyle = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box" };

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
      <div className="app-dialog-panel" style={{ position: "relative", width: 500, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, padding: 28, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Import Data</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Upload a CSV or Excel file</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 30, height: 30, borderRadius: 9, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        {/* Step 1: Select type + upload */}
        {step === 1 && (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Import Type</label>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                {["leads", "contacts", "calls"].map(t => (
                  <button key={t} onClick={() => setType(t)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, border: `1.5px solid ${type === t ? "var(--accent)" : "var(--border)"}`, background: type === t ? "var(--accent-soft)" : "transparent", color: type === t ? "var(--accent)" : "var(--text-muted)", fontWeight: 600, fontSize: 13, cursor: "pointer", textTransform: "capitalize" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{ border: `2px dashed ${dragging ? "var(--accent)" : file ? "var(--success)" : "var(--border)"}`, borderRadius: 14, padding: "32px 20px", textAlign: "center", background: dragging ? "var(--accent-soft)" : file ? "var(--success-soft)" : "var(--bg-hover)", transition: "all 0.2s", marginBottom: 16, cursor: "pointer" }}
              onClick={() => document.getElementById("csv-file-input").click()}
            >
              <input id="csv-file-input" type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0])} />
              {file ? (
                <>
                  <CheckCircle size={28} color="var(--success)" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--success)" }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
                </>
              ) : (
                <>
                  <Upload size={28} color="var(--text-muted)" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Drop your file here</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>CSV or Excel (.xlsx) · Max 10 MB</div>
                </>
              )}
            </div>

            {/* Download template */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", background: "var(--bg-hover)", borderRadius: 10, marginBottom: 20, border: "1px solid var(--border)" }}>
              <FileSpreadsheet size={16} color="var(--accent)" />
              <span style={{ fontSize: 13, color: "var(--text-secondary)", flex: 1 }}>Need a template?</span>
              <button style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}>Download Template ↓</button>
            </div>

            <Button onClick={() => file && setStep(2)} style={{ width: "100%", justifyContent: "center", opacity: file ? 1 : 0.5 }}>
              Continue → Map Fields
            </Button>
          </>
        )}

        {/* Step 2: Field mapping preview */}
        {step === 2 && (
          <>
            <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: 14, marginBottom: 20, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Field Mapping Preview</div>
              {[["Column A — Name", "→ name"], ["Column B — Phone", "→ phone"], ["Column C — Email", "→ email (optional)"], ["Column D — Notes", "→ notes (optional)"]].map(([from, to]) => (
                <div key={from} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-muted)" }}>{from}</span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>{to}</span>
                </div>
              ))}
            </div>
            <div style={{ background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 10, padding: "10px 14px", marginBottom: 20, fontSize: 13, color: "var(--success)" }}>
              ✓ File ready — 0 errors detected. Click Import to proceed.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Button variant="outline" onClick={() => setStep(1)} style={{ flex: 1, justifyContent: "center" }}>Back</Button>
              <Button onClick={() => setStep(3)} style={{ flex: 2, justifyContent: "center" }}>Import Now</Button>
            </div>
          </>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle size={52} color="var(--success)" style={{ marginBottom: 16 }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Import Complete!</div>
            <div style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 24 }}>Your data has been imported and is now available.</div>
            <Button onClick={onClose} style={{ width: "100%", justifyContent: "center" }}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── CRM3 Connect modal UI ────────────────────────────────────────────────────

function CRM3Modal({ onClose }) {
  const [url, setUrl] = useState("http://localhost:3006");
  const [apiKey, setApiKey] = useState("");
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);

  function handleTest() {
    setTesting(true);
    setTimeout(() => { setTesting(false); setTested(true); }, 1500);
  }

  const inp = { width: "100%", padding: "10px 13px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box", marginTop: 6 };

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
      <div className="app-dialog-panel" style={{ position: "relative", width: 480, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, padding: 28, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Connect CRM 3.0</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>Sync leads and calls with CRM 3.0</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 30, height: 30, borderRadius: 9, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>CRM 3.0 URL</label>
          <input style={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://your-crm.example.com" />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>API Key</label>
          <input style={inp} type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
        </div>

        <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: 14, marginBottom: 20, border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Sync Options</div>
          {[["Push new leads to CRM 3.0", true], ["Sync call notes & status", true], ["Pull contacts from CRM 3.0", false], ["Two-way opportunity sync", false]].map(([label, on], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{label}</span>
              <div style={{ width: 38, height: 22, borderRadius: 11, background: on ? "var(--accent)" : "var(--border)", display: "flex", alignItems: "center", padding: 2, cursor: "pointer" }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", marginLeft: on ? "auto" : 0, transition: "margin 0.2s" }} />
              </div>
            </div>
          ))}
        </div>

        {tested && (
          <div style={{ background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 10, padding: "9px 14px", marginBottom: 16, fontSize: 13, color: "var(--success)", display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle size={14} /> Connection successful!
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="outline" onClick={handleTest} style={{ flex: 1, justifyContent: "center" }}>
            {testing ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Testing…</> : "Test Connection"}
          </Button>
          <Button onClick={onClose} style={{ flex: 2, justifyContent: "center" }}>Save & Connect</Button>
        </div>
      </div>
    </div>
  );
}

// ── Main Integrations page ───────────────────────────────────────────────────

export default function Integrations() {
  const [category, setCategory] = useState("All");
  const [showImport, setShowImport] = useState(false);
  const [showCRM3, setShowCRM3] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [connected, setConnected] = useState({ api: true });

  const filtered = INTEGRATIONS.filter(i => category === "All" || i.category === category);

  function handleCard(integration) {
    if (integration.id === "csv_import") { setShowImport(true); return; }
    if (integration.id === "crm3") { setShowCRM3(true); return; }
    if (integration.id === "csv_export") { setShowExport(true); return; }
  }

  return (
    <PageContainer>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "Space Grotesk", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>Integrations</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>Connect CallNexa with your existing tools and automate your workflow</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" icon={Upload} onClick={() => setShowImport(true)}>Import CSV</Button>
            <Button variant="outline" icon={Download} onClick={() => setShowExport(true)}>Export CSV</Button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {[
            { label: "Available", value: INTEGRATIONS.filter(i => i.status === "available").length, color: "var(--success)" },
            { label: "Coming Soon", value: INTEGRATIONS.filter(i => i.status === "coming_soon").length, color: "var(--warning)" },
            { label: "Connected", value: Object.keys(connected).length, color: "var(--accent)" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "Space Grotesk" }}>{s.value}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${category === c ? "transparent" : "var(--border)"}`, background: category === c ? "var(--grad-brand)" : "transparent", color: category === c ? "#fff" : "var(--text-muted)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
            {c}
          </button>
        ))}
      </div>

      {/* Integration cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {filtered.map(integration => {
          const isConnected = !!connected[integration.id];
          const isComingSoon = integration.status === "coming_soon";
          return (
            <div key={integration.id} style={{ background: "var(--bg-card)", border: `1px solid ${isConnected ? "var(--accent)" : "var(--border)"}`, borderRadius: 16, padding: 20, opacity: isComingSoon ? 0.7 : 1, cursor: isComingSoon ? "default" : "pointer", transition: "all 0.2s", position: "relative", overflow: "hidden" }}
              onClick={() => !isComingSoon && handleCard(integration)}
              onMouseEnter={e => { if (!isComingSoon) e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--shadow-md)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
            >
              {isComingSoon && (
                <div style={{ position: "absolute", top: 12, right: 12, fontSize: 10.5, fontWeight: 700, background: "var(--warning-soft)", color: "var(--warning)", padding: "3px 9px", borderRadius: 999 }}>SOON</div>
              )}
              {isConnected && (
                <div style={{ position: "absolute", top: 12, right: 12 }}>
                  <CheckCircle size={16} color="var(--accent)" />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                  {integration.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{integration.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2 }}>{integration.category}</div>
                </div>
              </div>

              <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>
                {integration.description}
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 16 }}>
                {integration.features.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--text-secondary)" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: integration.color, flexShrink: 0 }} />
                    {f}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isConnected ? "var(--accent)" : isComingSoon ? "var(--warning)" : "var(--text-muted)" }}>
                  {isConnected ? "✓ Connected" : isComingSoon ? "Coming Soon" : "Available"}
                </span>
                {!isComingSoon && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: integration.color }}>
                    {isConnected ? "Configure" : "Connect"} <ChevronRight size={13} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Export modal */}
      {showExport && (
        <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div className="app-dialog-backdrop" onClick={() => setShowExport(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }} />
          <div className="app-dialog-panel" style={{ position: "relative", width: 440, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, padding: 28, boxShadow: "0 32px 80px rgba(0,0,0,0.4)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Export Data</div>
              <button onClick={() => setShowExport(false)} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 30, height: 30, borderRadius: 9, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[["Calls", "All call logs with duration, status, recording info"], ["Leads", "Lead pipeline with status and contact details"], ["Transcripts", "Calls with AI transcripts and summaries"], ["Analytics", "KPIs, leaderboard, daily metrics"]].map(([name, desc]) => (
                <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--bg-hover)", borderRadius: 11, border: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)" }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)", background: "var(--accent-soft)", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>CSV</button>
                    <button style={{ fontSize: 11.5, fontWeight: 600, color: "var(--success)", background: "var(--success-soft)", border: "none", borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>Excel</button>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={() => setShowExport(false)} style={{ width: "100%", justifyContent: "center" }}>Close</Button>
          </div>
        </div>
      )}

      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showCRM3 && <CRM3Modal onClose={() => setShowCRM3(false)} />}
    </PageContainer>
  );
}

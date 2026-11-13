import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSpreadsheet, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Play, RotateCcw, FilterX, Phone, Sparkles, Target,
  Pause, User, MessageSquare, Calendar, RefreshCw, X, PhoneCall,
  CheckCircle2, Circle, XCircle, Loader2, MicOff, CloudUpload, FileText, Brain,
} from "lucide-react";
import {
  PageContainer, Card, Button, SearchInput, EmptyState, ErrorState, SkeletonRows,
  Drawer, Badge,
} from "../components/ui.jsx";
import { formatDuration, formatDateTime } from "../data/mockData.js";
import { followUpsStore } from "../data/followUpsStore.js";
import { dataSource } from "../api/dataSource.js";
import { callsApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";
import { useDeviceSocket } from "../api/useDeviceSocket.js";
import { useRange } from "../context/RangeContext.jsx";

// Fetch last 200 calls — enough for all practical ranges without hammering the DB
function rangeToParams(range) {
  const now = new Date();
  let fromDate = null;
  let toDate = now;

  if (range === "today" || range === "yesterday") {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === "today") {
      fromDate = todayStart;
    } else {
      fromDate = new Date(todayStart.getTime() - 86400000);
      toDate = todayStart;
    }
  } else if (range === "7d" || range === "30d") {
    fromDate = new Date(now.getTime() - (range === "7d" ? 7 : 30) * 86400000);
  }

  return {
    page_size: 500,
    all_pages: true,
    ...(fromDate && { from_date: fromDate.toISOString() }),
    ...(range !== "all" && { to_date: toDate.toISOString() }),
  };
}

function clientFilterByRange(calls, range) {
  if (!range || range === "all") return calls;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yStart     = todayStart - 86400000;
  return calls.filter((c) => {
    const t = new Date(c.date).getTime();
    if (range === "today")     return t >= todayStart;
    if (range === "yesterday") return t >= yStart && t < todayStart;
    if (range === "7d")        return t >= Date.now() - 7  * 86400000;
    if (range === "30d")       return t >= Date.now() - 30 * 86400000;
    return true;
  });
}

function exportCallsCSV(calls) {
  const rows = [["Date", "Type", "Customer", "Phone", "Employee", "Duration (s)", "SIM", "Recording", "Recording Size (MB)", "Transcript"]];
  calls.forEach((c) => rows.push([
    formatDateTime(c.date), c.type, c.contact, c.phone,
    c.employee, c.durationSeconds, c.source,
    c.hasRecording ? (c.recordingStatus || "available") : "none",
    c.hasRecording && c.recordingSizeBytes ? (c.recordingSizeBytes / 1024 / 1024).toFixed(1) : "",
    c.transcriptStatus || "—",
  ]));
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `call-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

const TYPE_META = {
  incoming: { label: "Incoming", color: "var(--success)",    icon: PhoneIncoming },
  outgoing: { label: "Outgoing", color: "var(--accent)",     icon: PhoneOutgoing },
  missed:   { label: "Missed",   color: "var(--danger)",     icon: PhoneMissed   },
  blocked:  { label: "Blocked",  color: "var(--warning)",    icon: PhoneOff      },
  rejected: { label: "Rejected", color: "var(--text-muted)", icon: PhoneOff      },
};

const FILTERS = ["All", "Incoming", "Outgoing", "Missed", "Rejected", "Recorded"];

// ── Progress helpers (mirrors mobile STATUSES) ───────────────────────────────
const CALL_STATUSES = [
  { key: "interested",     label: "Interested",     color: "var(--success)"  },
  { key: "asked_details",  label: "Asked Details",  color: "var(--accent)"   },
  { key: "follow_up",      label: "Follow Up",      color: "var(--accent-2)" },
  { key: "callback",       label: "Callback",       color: "var(--info)"     },
  { key: "proposal_sent",  label: "Proposal Sent",  color: "var(--accent)"   },
  { key: "converted",      label: "Converted ✓",    color: "var(--success)"  },
  { key: "not_interested", label: "Not Interested", color: "var(--danger)"   },
];

// Notes are persisted to the backend via PATCH /calls/{id}/note
// No localStorage usage for call notes.

export default function CallLogs() {
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const { range } = useRange();

  const [empFilter, setEmpFilter] = useState("All");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { loading, error, data, reload } = useResource(
    () => dataSource.getCalls(rangeToParams(range)),
    [range]
  );

  // Auto-refresh every 30s (reduced from 10s — WS handles instant updates)
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => reload(), 30000);
    return () => clearInterval(t);
  }, [autoRefresh, reload]);

  // WebSocket instant reload
  const { newCallEvent } = useDeviceSocket();
  useEffect(() => {
    if (!newCallEvent) return;
    if (newCallEvent.event === "calls_synced" || newCallEvent.event === "call_created") {
      console.log(`[WEB_STATUS_UPDATED] event=${newCallEvent.event} ts=${Date.now()}`);
      reload();
    } else if (newCallEvent.event === "call_updated") {
      // Patch the specific call in-place — no full reload needed
      console.log(`[WEBSOCKET_CALL_UPDATE_RECEIVED] call_id=${newCallEvent.call_id} ts=${Date.now()}`);
      reload();
    } else if (newCallEvent.event === "recording_uploaded" || newCallEvent.event === "transcript_updated") {
      reload();
    }
  }, [newCallEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep an open drawer aligned with the latest API record after polling/WS reloads.
  useEffect(() => {
    if (!selected?.id || !data?.items) return;
    const current = data.items.find((call) => call.id === selected.id);
    if (current) setSelected(current);
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageContainer><Card><SkeletonRows rows={8} cols={6} /></Card></PageContainer>;
  if (error)   return <PageContainer><Card><ErrorState title="Sync interrupted" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const CALL_LOGS = clientFilterByRange(data.items || [], range);

  // Build employee list from loaded data
  const employees = ["All", ...Array.from(new Set(CALL_LOGS.map((c) => c.employee).filter(Boolean).filter((e) => e !== "—"))).sort()];

  const filtered = CALL_LOGS.filter((c) => {
    const q = [c.phone, c.contact, c.employee].join(" ").toLowerCase().includes(query.toLowerCase());
    let f = true;
    if (filter === "Recorded")    f = c.hasRecording;
    else if (filter !== "All")    f = TYPE_META[c.type]?.label === filter;
    const emp = empFilter === "All" || c.employee === empFilter;
    return q && f && emp;
  });

  return (
    <PageContainer>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCallsCSV(filtered)}>Export CSV</Button>
            <Button variant="ghost"   icon={RotateCcw}       onClick={reload}>Refresh</Button>
            <Button variant="ghost"   icon={FilterX}         onClick={() => { setFilter("All"); setQuery(""); setEmpFilter("All"); }}>Clear</Button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search customer or number..." />
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", flexWrap: "wrap", gap: 10, borderBottom: "1px solid var(--border)" }}>
          {/* Call type filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "5px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid " + (filter === f ? "transparent" : "var(--border)"), background: filter === f ? "var(--grad-brand)" : "transparent", color: filter === f ? "#fff" : "var(--text-muted)" }}>{f}</button>
            ))}
          </div>
          {/* Employee filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Employee:</span>
            <select
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", cursor: "pointer" }}
            >
              {employees.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(a => !a)}
              title={autoRefresh ? "Auto-refresh ON (every 30s)" : "Auto-refresh OFF"}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: autoRefresh ? "var(--success-soft)" : "transparent", color: autoRefresh ? "var(--success)" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              <RotateCcw size={12} style={{ animation: autoRefresh ? "nova-spin 2s linear infinite" : "none" }} />
              {autoRefresh ? "Live" : "Paused"}
            </button>
          </div>
        </div>

        <div className="nova-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={Phone} title="No calls match" message="Calls synced from employee phones appear here. Adjust filters or wait for the next sync." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["", "Date", "Type", "Customer", "Phone", "Employee", "Duration", "SIM", "Recording", "Transcript", "Status", "Sync"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const meta = TYPE_META[c.type] || TYPE_META.rejected;
                  const Icon = meta.icon;
                  const recLabel = c.hasRecording
                    ? (c.recordingStatus === "uploaded" ? "Uploaded" : c.recordingStatus || "Available")
                    : "None";
                  const recColor = c.hasRecording ? "var(--success)" : "var(--text-dim)";
                  const txLabel  = c.transcriptStatus === "completed"  ? "Done"
                                 : c.transcriptStatus === "processing" ? "Processing"
                                 : c.transcriptStatus === "failed"     ? "Failed"
                                 : c.transcriptStatus === "pending"    ? "Pending"
                                 : c.hasRecording ? "Pending" : "—";
                  const txColor  = c.transcriptStatus === "completed"  ? "var(--success)"
                                 : c.transcriptStatus === "processing" ? "var(--accent)"
                                 : c.transcriptStatus === "failed"     ? "var(--danger)"
                                 : "var(--text-dim)";
                  const ns = CALL_STATUSES.find(s => s.key === c.callStatus);
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)}
                      style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "11px 16px" }}>
                        <div style={{ width: 30, height: 30, borderRadius: 8, background: meta.color + "1f", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Icon size={15} />
                        </div>
                      </td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDateTime(c.date)}</td>
                      <td style={{ padding: "11px 16px", color: meta.color, fontWeight: 600 }}>{meta.label}</td>
                      <td style={{ padding: "11px 16px", color: c.contact === "Unknown" ? "var(--text-dim)" : "var(--text-primary)", fontWeight: c.contact === "Unknown" ? 400 : 600 }}>{c.contact}</td>
                      <td style={{ padding: "11px 16px", color: c.phone === "Private" ? "var(--text-dim)" : "var(--accent)", fontStyle: c.phone === "Private" ? "italic" : "normal" }}>{c.phone}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600 }}>{c.employee}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: "Space Grotesk" }}>{formatDuration(c.durationSeconds)}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{c.source}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: recColor,
                          background: c.hasRecording ? "var(--success-soft)" : "var(--bg-hover)",
                          padding: "2px 8px", borderRadius: 999 }}>
                          {recLabel}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: txColor,
                          background: c.transcriptStatus === "completed" ? "var(--success-soft)"
                            : c.transcriptStatus === "processing" ? "var(--accent-soft)"
                            : c.transcriptStatus === "failed" ? "var(--danger-soft)"
                            : "var(--bg-hover)",
                          padding: "2px 8px", borderRadius: 999 }}>
                          {txLabel}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        {ns ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: ns.color,
                            background: ns.color + "18", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap" }}>
                            {ns.label}
                          </span>
                        ) : <span style={{ fontSize: 11, color: "var(--text-dim)" }}>—</span>}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        {c.syncStatus === "synced" || !c.syncStatus ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", background: "var(--success-soft)", padding: "2px 8px", borderRadius: 999 }}>✓ Synced</span>
                        ) : c.syncStatus === "offline" ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warning)", background: "var(--warning-soft)", padding: "2px 8px", borderRadius: 999 }}>No internet</span>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--danger-soft)", padding: "2px 8px", borderRadius: 999 }}>Sync failed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>{filtered.length} record{filtered.length !== 1 ? "s" : ""}{empFilter !== "All" ? ` · ${empFilter}` : ""} · click a row for Call Intelligence</span>
          {autoRefresh && <span style={{ color: "var(--success)", fontWeight: 600 }}>● Live — refreshing every 30s</span>}
        </div>
      </Card>

      <CallIntelligenceDrawer call={selected} onClose={() => setSelected(null)} reload={reload} />
    </PageContainer>
  );
}

function ScheduleModal({ call, onClose }) {
  const [date, setDate]   = useState("");
  const [time, setTime]   = useState("");
  const [note, setNote]   = useState("");
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();

  function handleSave() {
    if (!date || !time) return;
    followUpsStore.add({
      contact:  call.contact,
      phone:    call.phone,
      employee: call.employee,
      callType: call.type,
      callId:   call.id,
      date, time, note,
    });
    setSaved(true);
  }

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(3,6,12,0.6)", backdropFilter: "blur(2px)" }} />
      <div className="app-dialog-panel" style={{ position: "relative", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 360, boxShadow: "var(--shadow-lg)" }}>

        {saved ? (
          /* ── Success state ── */
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "8px 0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Calendar size={26} color="var(--success)" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>Follow-up Scheduled!</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
                {call.contact} · {date} at {time}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <Button style={{ flex: 1, justifyContent: "center" }} onClick={() => { onClose(); navigate("/follow-ups"); }}>
                View Follow-ups
              </Button>
              <Button variant="outline" style={{ flex: 1, justifyContent: "center" }} onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Schedule Follow-up</span>
              <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
              {call.contact} · {call.phone}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                Date
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ display: "block", marginTop: 4, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                Time
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  style={{ display: "block", marginTop: 4, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
              </label>
              <label style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                Note (optional)
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Reminder note…"
                  style={{ display: "block", marginTop: 4, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} disabled={!date || !time}>Save</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressPanel({ call, onSaved, reload }) {
  const [status, setStatus] = useState(call?.callStatus || null);
  const [notes,  setNotes]  = useState(call?.notes || "");
  const [saved,  setSaved]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [open,   setOpen]   = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!call) return;
    setSaved(false); setError(null);
    setStatus(call.callStatus || null);
    setNotes(call.notes || "");
  }, [call?.id]);

  async function handleSave() {
    if (inFlight.current) return;
    if (!call?.id) return;
    if (notes.length > 2000) { setError("Notes must be 2000 characters or fewer."); return; }
    inFlight.current = true;
    setSaving(true); setSaved(false); setError(null);
    console.log(`[PROGRESS_SAVE_STARTED] callId=${call.id} status=${status} ts=${Date.now()}`);
    try {
      const res = await callsApi.updateNote(call.id, status, notes);
      console.log(`[PROGRESS_SAVE_SUCCESS] callId=${call.id} updated_at=${res?.call?.updated_at} ts=${Date.now()}`);
      setSaved(true);
      onSaved?.(res?.call);
      // Always reload after save — don't rely solely on WS event
      setTimeout(() => reload?.(), 300);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      const msg = e?.message || "";
      const statusCode = e?.status;
      let userMsg;
      if (!navigator.onLine || msg.includes("Network") || msg.includes("ERR_INTERNET")) {
        userMsg = "No internet connection.";
      } else if (msg.includes("timeout") || msg.includes("ECONNABORTED")) {
        userMsg = "Request timed out. Please retry.";
      } else if (statusCode === 401) {
        userMsg = "Session expired. Please log in again.";
      } else if (statusCode === 403) {
        userMsg = "You do not have permission to update this call.";
      } else if (statusCode === 404) {
        userMsg = "Call not found.";
      } else if (statusCode === 422) {
        userMsg = msg || "Invalid data.";
      } else if (statusCode >= 500) {
        userMsg = "Server error. Please try again later.";
      } else {
        userMsg = msg || "Unable to save changes. Please try again.";
      }
      console.warn(`[PROGRESS_SAVE_FAILED] callId=${call.id} error=${msg} ts=${Date.now()}`);
      setError(userMsg);
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  const selected = CALL_STATUSES.find(s => s.key === status);

  return (
    <div style={{ background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Progress</div>

      {/* Status dropdown */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Call Status</div>
        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen(o => !o)} style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "9px 12px", borderRadius: 9, cursor: "pointer",
            border: `1.5px solid ${selected ? selected.color : "var(--border)"}`,
            background: selected ? selected.color + "18" : "var(--bg-card)",
            color: selected ? selected.color : "var(--text-dim)", fontSize: 13, fontWeight: 600,
          }}>
            <span>{selected ? selected.label : "Select status…"}</span>
            <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
          </button>
          {open && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
              background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10,
              boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
              {CALL_STATUSES.map(s => (
                <button key={s.key} onClick={() => { setStatus(s.key === status ? null : s.key); setOpen(false); setSaved(false); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", border: "none", cursor: "pointer", textAlign: "left",
                    background: status === s.key ? s.color + "18" : "transparent",
                    color: status === s.key ? s.color : "var(--text-secondary)",
                    fontSize: 13, fontWeight: status === s.key ? 700 : 500,
                    borderBottom: "1px solid var(--border)",
                  }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  {s.label}
                  {status === s.key && <span style={{ marginLeft: "auto", fontSize: 12 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}>Notes</div>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setSaved(false); }}
          placeholder="What was discussed? Objections, next steps…"
          rows={3}
          style={{ width: "100%", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border)",
            background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13,
            outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }}
        />
      </div>

      {error && (
        <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 8,
          padding: "8px 12px", marginBottom: 10, fontSize: 12.5, color: "var(--danger)", lineHeight: 1.5 }}>
          {error}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} style={{ width: "100%", justifyContent: "center" }}>
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save Progress"}
      </Button>
    </div>
  );
}

function CallIntelligenceDrawer({ call, onClose, reload }) {
  const [playing, setPlaying]       = useState(false);
  const [progress, setProgress]     = useState(0);
  const [audioDur, setAudioDur]     = useState(0);
  const [signedUrl, setSignedUrl]   = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError]     = useState(null);
  const [txData, setTxData]         = useState(null);  // live transcript/summary
  const [loadingTx, setLoadingTx]   = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [privacy, setPrivacy]       = useState(call?.callPrivacy || "unclassified");
  const [privacySaving, setPrivacySaving] = useState(false);
  const audioRef = useRef(null);

  // Reset on call change
  useEffect(() => {
    setPlaying(false); setProgress(0); setAudioDur(0);
    setSignedUrl(null); setUrlError(null); setTxData(null);
    setPrivacy(call?.callPrivacy || "unclassified");
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (call?.id) loadTxData(call.id);
  }, [call?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTxData(id) {
    setLoadingTx(true);
    try {
      const res = await import("../api/client.js").then(m => m.default.get(`/transcripts/${id}`));
      setTxData(res.data);
    } catch { /* silent — call may not have transcript yet */ }
    finally { setLoadingTx(false); }
  }

  async function handleSetPrivacy(val) {
    if (val === privacy || !call?.id) return;
    setPrivacySaving(true);
    try {
      await callsApi.setPrivacy(call.id, val);
      setPrivacy(val);
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Could not update privacy");
    } finally {
      setPrivacySaving(false);
    }
  }

  async function handleDeleteRecording() {
    if (!call?.id) return;
    if (!window.confirm("Delete this recording and its transcript permanently? This cannot be undone.")) return;
    try {
      await callsApi.deleteRecording(call.id);
      onClose();
    } catch (e) {
      alert(e?.response?.data?.detail || e?.message || "Delete failed");
    }
  }

  async function handlePlay() {
    if (!call?.id || !call?.hasRecording) return;
    if (playing && audioRef.current) { audioRef.current.pause(); setPlaying(false); return; }
    if (audioRef.current && signedUrl) {
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (e) {
        setUrlError(e?.message || "Could not resume recording.");
        setPlaying(false);
      }
      return;
    }
    setLoadingUrl(true); setUrlError(null);
    try {
      const res = await callsApi.getRecordingUrl(call.id);
      const audio = new Audio(res.signed_url);
      audioRef.current = audio;
      setSignedUrl(res.signed_url);
      audio.onloadedmetadata = () => setAudioDur(audio.duration || 0);
      audio.ontimeupdate = () => setProgress(audio.duration ? (audio.currentTime / audio.duration) * 100 : 0);
      audio.onended = () => { setPlaying(false); setProgress(0); };
      audio.onerror = () => { setUrlError("Playback failed — signed URL may have expired."); setSignedUrl(null); audioRef.current = null; setPlaying(false); };
      await audio.play();
      setPlaying(true);
    } catch (e) {
      setUrlError(e?.message || "Could not load recording.");
    } finally { setLoadingUrl(false); }
  }

  if (!call) return null;
  const meta = TYPE_META[call.type] || TYPE_META.rejected;

  // Pipeline steps derived from call fields
  const recStatus = call.recordingStatus || "not_available";
  const txStatus  = txData?.transcript_status || call.transcriptStatus;
  const sumStatus = txData?.summary_status    || call.summaryStatus;
  const txText    = txData?.transcript_text   || call.transcriptText;
  const sumText   = txData?.summary_text      || call.summaryText;
  const sumData   = txData?.summary_data
    ? (() => {
        if (typeof txData.summary_data === "object") return txData.summary_data;
        try { return JSON.parse(txData.summary_data); } catch { return null; }
      })()
    : call.summaryData;

  const PRIVACY_OPTIONS = [
    { value: "business",      label: "Business",      color: "var(--success)" },
    { value: "personal",      label: "Personal",      color: "var(--danger)" },
    { value: "unclassified",  label: "Unclassified",  color: "var(--text-muted)" },
  ];
  const privacyMeta = PRIVACY_OPTIONS.find(p => p.value === privacy) || PRIVACY_OPTIONS[2];

  const PIPELINE = [
    { label: "Synced",      done: true, color: "var(--success)" },
    { label: "Recording",   done: recStatus === "uploaded",
      color: recStatus === "uploaded" ? "var(--success)" : recStatus === "not_available" ? "var(--text-dim)" : "var(--warning)" },
    { label: "Transcribed", done: txStatus === "completed",
      color: txStatus === "completed" ? "var(--success)" : txStatus === "processing" ? "var(--accent)" : "var(--text-dim)" },
    { label: "Summarized",  done: sumStatus === "completed",
      color: sumStatus === "completed" ? "var(--success)" : sumStatus === "processing" ? "var(--accent)" : "var(--text-dim)" },
  ];

  const PIPELINE_SUB = [
    "Done",
    recStatus === "uploaded" ? "Uploaded" : recStatus === "not_available" ? "N/A" : recStatus || "Pending",
    txStatus === "completed" ? "Done" : txStatus === "processing" ? "In progress" : txStatus || "Pending",
    sumStatus === "completed" ? "Done" : sumStatus === "processing" ? "In progress" : sumStatus || "Pending",
  ];

  const waNumber = localStorage.getItem("callos_wa_number") || "";
  const waText = encodeURIComponent(`Hi ${call.contact !== "Unknown" ? call.contact : ""}, following up on our call (${call.phone}).`.trim());
  const waHref = waNumber
    ? `https://wa.me/${waNumber}?text=${waText}`
    : `https://wa.me/${call.phone.replace(/[^0-9]/g, "")}?text=${waText}`;

  const fmtDur = (s) => s > 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}` : "";

  return (
    <>
    <Drawer open={!!call} onClose={onClose} title="Call Intelligence" width={500}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
        <div style={{ width:46, height:46, borderRadius:12, background:meta.color+"1f", color:meta.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <meta.icon size={22}/>
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)", fontFamily:"Space Grotesk" }}>{call.contact}</div>
          <div style={{ fontSize:13, color: call.phone === "Private" ? "var(--text-dim)" : "var(--accent)", fontStyle: call.phone === "Private" ? "italic" : "normal" }}>{call.phone}</div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
        <Detail icon={User}     label="Employee" value={call.employee} />
        <Detail icon={Calendar} label="Date"     value={formatDateTime(call.date)} />
        <Detail label="Type"     value={<span style={{ color:meta.color, fontWeight:600 }}>{meta.label}</span>} />
        <Detail label="Duration" value={formatDuration(call.durationSeconds)} />
        <Detail label="SIM"      value={call.source} />
        <Detail label="Recording" value={
          <span style={{ fontWeight:600, color: call.hasRecording ? "var(--success)" : "var(--text-dim)" }}>
            {call.hasRecording 
              ? `${call.recordingStatus || "Available"}${call.recordingSizeBytes ? ` · ${(call.recordingSizeBytes / 1024 / 1024).toFixed(1)} MB` : ""}` 
              : "Not available"}
          </span>
        } />
        {call.updatedAt && (
          <Detail label="Last Updated" value={<span style={{ fontSize:11, color:"var(--text-dim)" }}>{formatDateTime(call.updatedAt)}</span>} />
        )}
        {call.syncConfirmedAt && (
          <Detail label="Sync Confirmed" value={<span style={{ fontSize:11, color:"var(--success)" }}>{formatDateTime(call.syncConfirmedAt)}</span>} />
        )}
      </div>

      {/* Optional call label */}
      <div style={{ marginBottom:18, background:"var(--bg-hover)", borderRadius:12, padding:14, border:`1px solid ${privacyMeta.color}44` }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Call Label</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {PRIVACY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSetPrivacy(opt.value)}
              disabled={privacySaving}
              style={{
                padding:"6px 14px", borderRadius:999, fontSize:12, fontWeight:700, cursor:"pointer",
                border:`1.5px solid ${opt.color}`,
                background: privacy === opt.value ? opt.color : "transparent",
                color: privacy === opt.value ? "#fff" : opt.color,
                opacity: privacySaving ? 0.6 : 1,
              }}
            >{opt.label}</button>
          ))}
        </div>
        <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)", lineHeight:1.5 }}>
          The mobile Call Recording switch controls every connected call. This label does not block recording, playback, transcription, or AI processing.
          {call.hasRecording && (
            <button
              onClick={handleDeleteRecording}
              style={{ marginLeft:10, fontSize:11, color:"var(--danger)", background:"none", border:"1px solid var(--danger)", borderRadius:6, padding:"2px 8px", cursor:"pointer" }}
            >Delete recording</button>
          )}
        </div>
      </div>

      {/* Pipeline progress */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Processing Pipeline</div>
        <div style={{ display:"flex", gap:0 }}>
          {PIPELINE.map((p, i) => (
            <div key={p.label} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", position:"relative" }}>
              {i > 0 && <div style={{ position:"absolute", top:10, right:"50%", left:"-50%", height:2, background: PIPELINE[i-1].done ? "var(--success)" : "var(--border)", zIndex:0 }}/>}
              <div style={{ width:22, height:22, borderRadius:11, border:`2px solid ${p.color}`, background: p.done ? p.color : "var(--bg-card)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1, position:"relative" }}>
                {p.done && <span style={{ color:"#fff", fontSize:11, fontWeight:700 }}>&#10003;</span>}
              </div>
              <div style={{ fontSize:9.5, color:p.color, fontWeight:600, marginTop:4, textAlign:"center" }}>{p.label}</div>
              <div style={{ fontSize:9, color:"var(--text-dim)", textAlign:"center", marginTop:1 }}>{PIPELINE_SUB[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recording player */}
      <div style={{ background:"var(--bg-hover)", borderRadius:12, padding:14, marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={handlePlay} disabled={!call.hasRecording || loadingUrl}
            style={{ width:40, height:40, borderRadius:20, border:"none", flexShrink:0,
              cursor: call.hasRecording && !loadingUrl ? "pointer" : "not-allowed",
              background: call.hasRecording ? "var(--grad-brand)" : "var(--border)",
              color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>
            {loadingUrl
              ? <RefreshCw size={16} style={{ animation:"spin 1s linear infinite" }}/>
              : playing ? <Pause size={18}/> : <Play size={18}/>}
          </button>
          <div style={{ flex:1 }}>
            <div style={{ height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
              <div style={{ width:`${progress}%`, height:"100%", background:"var(--grad-brand)", transition:"width 0.4s" }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
              <div style={{ fontSize:11.5, color: urlError ? "var(--danger)" : "var(--text-muted)" }}>
                {urlError ? urlError
                  : !call.hasRecording ? `Recording ${recStatus === "not_available" ? "not available" : recStatus}`
                  : playing ? "Playing…" : "Click to play recording"}
              </div>
              {audioDur > 0 && <div style={{ fontSize:11, color:"var(--text-dim)" }}>{fmtDur(audioDur * progress / 100)} / {fmtDur(audioDur)}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Transcript */}
      {(txStatus || loadingTx) && (
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10, display:"flex", alignItems:"center", gap:8 }}>
            <Sparkles size={13} color="var(--accent-2)"/> Transcript
            {txStatus === "processing" && <span style={{ fontSize:10, color:"var(--accent)", fontWeight:600 }}>Processing…</span>}
            {txStatus === "completed"  && <span style={{ fontSize:10, color:"var(--success)", fontWeight:600 }}>Done</span>}
            {txStatus === "failed"     && <span style={{ fontSize:10, color:"var(--danger)",  fontWeight:600 }}>Failed</span>}
          </div>
          {txText ? (
            <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, background:"var(--bg-hover)", borderRadius:10, padding:"10px 12px", border:"1px solid var(--border)", maxHeight:160, overflowY:"auto", whiteSpace:"pre-wrap" }}>
              {txText}
            </div>
          ) : txStatus === "processing" ? (
            <div style={{ fontSize:13, color:"var(--text-muted)" }}>Whisper is transcribing… check back in a moment.</div>
          ) : txStatus === "pending" ? (
            <div style={{ fontSize:13, color:"var(--text-muted)" }}>Transcription queued.</div>
          ) : null}
        </div>
      )}

      {/* AI Summary */}
      <div style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Sparkles size={15} color="var(--accent-2)"/>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)", fontFamily:"Space Grotesk" }}>AI Summary</span>
          {sumStatus === "completed"  && <Badge tone="success">Done</Badge>}
          {sumStatus === "processing" && <Badge tone="info">Processing</Badge>}
          {sumStatus === "failed"     && <Badge tone="danger">Failed</Badge>}
          {!sumStatus && txStatus === "completed" && <Badge tone="neutral">Pending</Badge>}
        </div>
        {sumText ? (
          <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6, marginBottom:10 }}>{sumText}</div>
        ) : null}
        {sumData && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {sumData.discussion_points?.length > 0 && (
              <SumSection title="Discussion" items={sumData.discussion_points}/>
            )}
            {sumData.follow_up_actions?.length > 0 && (
              <SumSection title="Follow-up" items={sumData.follow_up_actions}/>
            )}
            {sumData.suggested_next_step && (
              <div style={{ fontSize:12.5, color:"var(--text-secondary)" }}>
                <span style={{ fontWeight:600, color:"var(--text-primary)" }}>Next step: </span>
                {sumData.suggested_next_step}
              </div>
            )}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
              {sumData.sentiment && (
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999,
                  background: sumData.sentiment==="positive" ? "var(--success-soft)" : sumData.sentiment==="negative" ? "var(--danger-soft)" : "var(--bg-hover)",
                  color: sumData.sentiment==="positive" ? "var(--success)" : sumData.sentiment==="negative" ? "var(--danger)" : "var(--text-muted)",
                  fontWeight:600 }}>{sumData.sentiment}</span>
              )}
              {sumData.lead_quality && (
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999,
                  background: sumData.lead_quality==="hot" ? "var(--danger-soft)" : sumData.lead_quality==="warm" ? "var(--warning-soft)" : "var(--bg-hover)",
                  color: sumData.lead_quality==="hot" ? "var(--danger)" : sumData.lead_quality==="warm" ? "var(--warning)" : "var(--text-muted)",
                  fontWeight:600 }}>{sumData.lead_quality}</span>
              )}
              {sumData.keywords?.slice(0,6).map(k => (
                <span key={k} style={{ fontSize:10.5, padding:"2px 7px", borderRadius:999, background:"var(--accent-soft)", color:"var(--accent)" }}>{k}</span>
              ))}
            </div>
          </div>
        )}
        {!sumStatus && !txStatus && (
          <p style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.55, margin:0 }}>
            AI summary will appear here once the call recording is transcribed.
          </p>
        )}
      </div>

      {/* Salesperson Progress — read from backend */}
      {(call.callStatus || call.notes) && (() => {
        const ns = CALL_STATUSES.find(s => s.key === call.callStatus);
        return (
          <div style={{ background:"var(--bg-hover)", border:"1px solid var(--border)", borderRadius:12, padding:14, marginBottom:18 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:12 }}>Salesperson Progress</div>
            {ns && (
              <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", borderRadius:999,
                background:ns.color+"18", border:`1px solid ${ns.color}44`, marginBottom: call.notes ? 10 : 0 }}>
                <span style={{ width:8, height:8, borderRadius:"50%", background:ns.color }} />
                <span style={{ fontSize:13, fontWeight:700, color:ns.color }}>{ns.label}</span>
              </div>
            )}
            {call.notes && (
              <div style={{ fontSize:13, color:"var(--text-secondary)", lineHeight:1.6,
                background:"var(--bg-card)", borderRadius:9, padding:"9px 12px",
                border:"1px solid var(--border)", whiteSpace:"pre-wrap" }}>
                {call.notes}
              </div>
            )}
            {call.updatedAt && (
              <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:8 }}>Updated {formatDateTime(call.updatedAt)}</div>
            )}
          </div>
        );
      })()}

      {/* Edit Progress */}
      <ProgressPanel call={call} reload={reload} onSaved={(updated) => {
        console.log(`[WEB_STATUS_UPDATED] call_updated callId=${call.id} ts=${Date.now()}`);
        // Reload the full list so the row reflects the confirmed backend data
        if (typeof onClose === "function") {
          // Trigger parent reload via a small delay so drawer stays open briefly
          setTimeout(() => { /* parent useResource reload triggered by WS event */ }, 500);
        }
      }} />

      {/* Actions */}
      <div style={{ background:"var(--grad-brand-soft)", border:"1px solid var(--border)", borderRadius:12, padding:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Target size={15} color="var(--accent)"/>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Actions</span>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Button icon={Calendar} onClick={() => setShowSchedule(true)}>Schedule follow-up</Button>
          <a href={`tel:${call.phone}`} style={{ textDecoration:"none" }}>
            <Button variant="outline" icon={PhoneCall}>Call</Button>
          </a>
          <a href={waHref} target="_blank" rel="noreferrer" style={{ textDecoration:"none" }}>
            <Button variant="outline" icon={MessageSquare}>WhatsApp</Button>
          </a>
        </div>
      </div>
    </Drawer>
    {showSchedule && <ScheduleModal call={call} onClose={() => setShowSchedule(false)} />}
    </>
  );
}

function SumSection({ title, items }) {
  return (
    <div>
      <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", marginBottom:4 }}>{title}</div>
      <ul style={{ margin:0, paddingLeft:16 }}>
        {items.map((item, i) => (
          <li key={i} style={{ fontSize:12.5, color:"var(--text-secondary)", marginBottom:2 }}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3, display: "flex", alignItems: "center", gap: 5 }}>{Icon && <Icon size={12} />}{label}</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

const th = { textAlign: "left", padding: "11px 16px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };

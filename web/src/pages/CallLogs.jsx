import { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Play, RotateCcw, FilterX, Phone, Sparkles, Target,
  Pause, User, MessageSquare, Calendar, RefreshCw,
} from "lucide-react";
import {
  PageContainer, Card, Button, SearchInput, EmptyState, ErrorState, SkeletonRows,
  Drawer, Badge,
} from "../components/ui.jsx";
import { formatDuration, formatDateTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { callsApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";
import { useDeviceSocket } from "../api/useDeviceSocket.js";
import { useRange } from "../context/RangeContext.jsx";

function rangeToParams(range) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  if (range === "today")     return { from_date: startOfToday, page_size: 500 };
  if (range === "yesterday") {
    const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    return { from_date: yStart, to_date: startOfToday, page_size: 500 };
  }
  if (range === "7d")  return { from_date: new Date(Date.now() - 7  * 86400000).toISOString(), page_size: 500 };
  if (range === "30d") return { from_date: new Date(Date.now() - 30 * 86400000).toISOString(), page_size: 500 };
  return { page_size: 500 };
}

function exportCallsCSV(calls) {
  const rows = [["Date", "Type", "Customer", "Phone", "Employee", "Duration (s)", "SIM", "Device", "Recording"]];
  calls.forEach((c) => rows.push([
    formatDateTime(c.date), c.type, c.contact, c.phone,
    c.employee, c.durationSeconds, c.source, c.device,
    c.recordingUrl ? "Yes" : "No",
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

const FILTERS = ["All", "Incoming", "Outgoing", "Missed", "Blocked", "Recorded"];

export default function CallLogs() {
  const [query, setQuery]   = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const { range } = useRange();

  const { loading, error, data, reload } = useResource(
    () => dataSource.getCalls(rangeToParams(range)),
    [range]
  );

  // Auto-refresh when WebSocket signals new calls synced
  const { newCallEvent } = useDeviceSocket();
  useEffect(() => {
    if (newCallEvent?.event === "calls_synced") reload();
  }, [newCallEvent]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <PageContainer><Card><SkeletonRows rows={8} cols={6} /></Card></PageContainer>;
  if (error)   return <PageContainer><Card><ErrorState title="Sync interrupted" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const CALL_LOGS = data.items || [];
  const filtered = CALL_LOGS.filter((c) => {
    const q = [c.phone, c.contact, c.employee].join(" ").toLowerCase().includes(query.toLowerCase());
    let f = true;
    if (filter === "Recorded")    f = c.hasRecording;
    else if (filter !== "All")    f = TYPE_META[c.type]?.label === filter;
    return q && f;
  });

  return (
    <PageContainer>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" icon={FileSpreadsheet} onClick={() => exportCallsCSV(filtered)}>Export CSV</Button>
            <Button variant="ghost"   icon={RotateCcw}       onClick={reload}>Refresh</Button>
            <Button variant="ghost"   icon={FilterX}         onClick={() => { setFilter("All"); setQuery(""); }}>Clear</Button>
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search customer or number..." />
        </div>

        <div style={{ display: "flex", gap: 8, padding: "12px 18px", flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid " + (filter === f ? "transparent" : "var(--border)"), background: filter === f ? "var(--grad-brand)" : "transparent", color: filter === f ? "#fff" : "var(--text-muted)" }}>{f}</button>
          ))}
        </div>

        <div className="nova-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={Phone} title="No calls match" message="Calls synced from employee phones appear here. Adjust filters or wait for the next sync." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead><tr>{["", "Date", "Type", "Customer", "Phone", "Employee", "Duration", "SIM", "Device", "Rec"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((c) => {
                  const meta = TYPE_META[c.type] || TYPE_META.rejected;
                  const Icon = meta.icon;
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <td style={{ padding: "11px 16px" }}><div style={{ width: 30, height: 30, borderRadius: 8, background: meta.color + "1f", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={15} /></div></td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{formatDateTime(c.date)}</td>
                      <td style={{ padding: "11px 16px", color: meta.color, fontWeight: 600 }}>{meta.label}</td>
                      <td style={{ padding: "11px 16px", color: c.contact === "Unknown" ? "var(--text-dim)" : "var(--text-primary)", fontWeight: c.contact === "Unknown" ? 400 : 600 }}>{c.contact}</td>
                      <td style={{ padding: "11px 16px", color: "var(--accent)" }}>{c.phone}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontWeight: 600 }}>{c.employee}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-secondary)", fontFamily: "Space Grotesk" }}>{formatDuration(c.durationSeconds)}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{c.source}</td>
                      <td style={{ padding: "11px 16px", color: "var(--text-muted)" }}>{c.device}</td>
                      <td style={{ padding: "11px 16px" }}>
                        {c.hasRecording
                          ? <Play size={15} color="var(--accent)" />
                          : <span style={{ color: "var(--text-dim)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: "10px 16px", fontSize: 12, color: "var(--text-dim)", borderTop: "1px solid var(--border)" }}>{filtered.length} records · click a row for Call Intelligence</div>
      </Card>

      <CallIntelligenceDrawer call={selected} onClose={() => setSelected(null)} />
    </PageContainer>
  );
}

function CallIntelligenceDrawer({ call, onClose }) {
  const [playing, setPlaying]       = useState(false);
  const [progress, setProgress]     = useState(0);
  const [audioDur, setAudioDur]     = useState(0);
  const [signedUrl, setSignedUrl]   = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [urlError, setUrlError]     = useState(null);
  const [txData, setTxData]         = useState(null);  // live transcript/summary
  const [loadingTx, setLoadingTx]   = useState(false);
  const audioRef = useRef(null);

  // Reset on call change
  useEffect(() => {
    setPlaying(false); setProgress(0); setAudioDur(0);
    setSignedUrl(null); setUrlError(null); setTxData(null);
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

  async function handlePlay() {
    if (!call?.id || !call?.hasRecording) return;
    if (playing && audioRef.current) { audioRef.current.pause(); setPlaying(false); return; }
    if (audioRef.current && signedUrl) { audioRef.current.play(); setPlaying(true); return; }
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
    ? (() => { try { return JSON.parse(txData.summary_data); } catch { return null; } })()
    : call.summaryData;

  const PIPELINE = [
    { label: "Synced",      done: true,                                    color: "var(--success)" },
    { label: "Recording",   done: recStatus === "uploaded",                color: recStatus === "uploaded" ? "var(--success)" : recStatus === "not_available" ? "var(--text-dim)" : "var(--warning)" },
    { label: "Transcribed", done: txStatus === "completed",                color: txStatus === "completed" ? "var(--success)" : txStatus === "processing" ? "var(--accent)" : "var(--text-dim)" },
    { label: "Summarized",  done: sumStatus === "completed",               color: sumStatus === "completed" ? "var(--success)" : sumStatus === "processing" ? "var(--accent)" : "var(--text-dim)" },
  ];

  const fmtDur = (s) => s > 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}` : "";

  return (
    <Drawer open={!!call} onClose={onClose} title="Call Intelligence" width={500}>

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
        <div style={{ width:46, height:46, borderRadius:12, background:meta.color+"1f", color:meta.color, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <meta.icon size={22}/>
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:"var(--text-primary)", fontFamily:"Space Grotesk" }}>{call.contact}</div>
          <div style={{ fontSize:13, color:"var(--accent)" }}>{call.phone}</div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:18 }}>
        <Detail icon={User}     label="Employee" value={call.employee} />
        <Detail icon={Calendar} label="Date"     value={formatDateTime(call.date)} />
        <Detail label="Type"     value={<span style={{ color:meta.color, fontWeight:600 }}>{meta.label}</span>} />
        <Detail label="Duration" value={formatDuration(call.durationSeconds)} />
        <Detail label="SIM"      value={call.source} />
        <Detail label="Device"   value={call.device} />
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

      {/* Next action */}
      <div style={{ background:"var(--grad-brand-soft)", border:"1px solid var(--border)", borderRadius:12, padding:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
          <Target size={15} color="var(--accent)"/>
          <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>Actions</span>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <Button icon={Calendar}>Schedule follow-up</Button>
          <Button variant="outline" icon={MessageSquare}>WhatsApp</Button>
        </div>
      </div>
    </Drawer>
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

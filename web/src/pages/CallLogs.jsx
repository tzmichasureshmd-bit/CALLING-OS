import { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneOff,
  Play, RotateCcw, FilterX, Phone, Sparkles, Target, TrendingUp,
  Pause, User, MessageSquare, Calendar,
} from "lucide-react";
import {
  PageContainer, Card, Button, SearchInput, EmptyState, ErrorState, SkeletonRows,
  Drawer, Badge,
} from "../components/ui.jsx";
import { formatDuration, formatDateTime } from "../data/mockData.js";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";

const TYPE_META = {
  incoming: { label: "Incoming", color: "var(--success)", icon: PhoneIncoming },
  outgoing: { label: "Outgoing", color: "var(--accent)", icon: PhoneOutgoing },
  missed: { label: "Missed", color: "var(--danger)", icon: PhoneMissed },
  blocked: { label: "Blocked", color: "var(--warning)", icon: PhoneOff },
  rejected: { label: "Rejected", color: "var(--text-muted)", icon: PhoneOff },
};

const FILTERS = ["All", "Incoming", "Outgoing", "Missed", "Blocked", "Recorded"];

export default function CallLogs() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const { loading, error, data, reload } = useResource(() => dataSource.getCalls());

  if (loading) return <PageContainer><Card><SkeletonRows rows={8} cols={6} /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Sync interrupted" message={error.message} hint="Last successful sync: 12:41 PM" code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const CALL_LOGS = data.items || [];
  const filtered = CALL_LOGS.filter((c) => {
    const q = [c.phone, c.contact, c.employee].join(" ").toLowerCase().includes(query.toLowerCase());
    let f = true;
    if (filter === "Recorded") f = !!c.recordingUrl;
    else if (filter !== "All") f = TYPE_META[c.type]?.label === filter;
    return q && f;
  });

  return (
    <PageContainer>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" icon={FileSpreadsheet}>Export</Button>
            <Button variant="ghost" icon={RotateCcw}>Reset</Button>
            <Button variant="ghost" icon={FilterX} onClick={() => { setFilter("All"); setQuery(""); }}>Clear</Button>
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
                      <td style={{ padding: "11px 16px" }}>{c.recordingUrl ? <Play size={15} color="var(--accent)" /> : <span style={{ color: "var(--text-dim)" }}>—</span>}</td>
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
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  }, [call?.id]);

  function togglePlay() {
    if (!call?.recordingUrl) return;
    if (!audioRef.current) audioRef.current = new Audio(call.recordingUrl);
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
      audioRef.current.ontimeupdate = () => {
        const pct = audioRef.current.duration
          ? (audioRef.current.currentTime / audioRef.current.duration) * 100
          : 0;
        setProgress(pct);
      };
      audioRef.current.onended = () => { setPlaying(false); setProgress(0); };
    }
    setPlaying((p) => !p);
  }

  if (!call) return null;
  const meta = TYPE_META[call.type] || TYPE_META.rejected;

  return (
    <Drawer open={!!call} onClose={onClose} title="Call Intelligence" width={480}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: meta.color + "1f", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center" }}><meta.icon size={22} /></div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{call.contact}</div>
          <div style={{ fontSize: 13, color: "var(--accent)" }}>{call.phone}</div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <Detail icon={User} label="Employee" value={call.employee} />
        <Detail icon={Calendar} label="Date" value={formatDateTime(call.date)} />
        <Detail label="Type" value={<span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>} />
        <Detail label="Duration" value={formatDuration(call.durationSeconds)} />
        <Detail label="SIM" value={call.source} />
        <Detail label="Device" value={call.device} />
      </div>

      {/* Recording player */}
      <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: 14, marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={togglePlay} disabled={!call.recordingUrl} style={{ width: 40, height: 40, borderRadius: 20, border: "none", cursor: call.recordingUrl ? "pointer" : "not-allowed", background: call.recordingUrl ? "var(--grad-brand)" : "var(--border)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${progress}%`, height: "100%", background: "var(--grad-brand)", transition: "width 0.4s" }} /></div>
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 6 }}>{call.recordingUrl ? (playing ? "Playing…" : "Recording available · click to play") : "No recording for this call"}</div>
        </div>
      </div>

      {/* AI summary — requires backend transcript endpoint */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Sparkles size={15} color="var(--accent-2)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>AI Summary</span>
          <Badge tone="violet">Coming soon</Badge>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55, margin: 0 }}>AI transcription and call scoring will appear here once the recording is processed by the backend.</p>
      </div>

      {/* Next action */}
      <div style={{ background: "var(--grad-brand-soft)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Target size={15} color="var(--accent)" /><span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>Next Best Action</span></div>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Button icon={Calendar}>Schedule follow-up</Button>
          <Button variant="outline" icon={MessageSquare}>WhatsApp</Button>
        </div>
      </div>
    </Drawer>
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

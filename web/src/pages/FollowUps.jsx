import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, CheckCircle, Clock, Edit2, FileText, Phone, User, X, Check, ListFilter } from "lucide-react";
import { PageContainer, Card, Button, Badge, EmptyState, ErrorState, LoadingState } from "../components/ui.jsx";
import { followUpsApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";

const VIEW_MODES = ["day", "week", "month"];
const STATUS_FILTERS = ["all", "pending", "completed"];

function toInputDate(value) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
function toInputTime(value) { return value ? new Date(value).toISOString().slice(11, 16) : "10:00"; }
function dateKey(value) { const date = value instanceof Date ? value : new Date(value); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function startOfDay(value) { const date = new Date(value); return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
function startOfWeek(value) { const date = startOfDay(value); date.setDate(date.getDate() - date.getDay()); return date; }
function isCompleted(item) { return item.status === "completed"; }
function isPending(item) { return item.status !== "completed" && item.status !== "cancelled"; }
function isOverdue(item) { return isPending(item) && new Date(item.due_at) < new Date(); }
function formatDue(value) { return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
function timeLabel(value) { return new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }); }
function monthDays(month) { const first = new Date(month.getFullYear(), month.getMonth(), 1); const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(); const days = Array.from({ length: total }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)); const leading = Array.from({ length: first.getDay() }, () => null); const trailing = Array.from({ length: (7 - ((leading.length + days.length) % 7)) % 7 }, () => null); return [...leading, ...days, ...trailing]; }
function weekDays(anchor) { const start = startOfWeek(anchor); return Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; }); }
function displayRange(anchor, view) { if (view === "day") return anchor.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); if (view === "week") { const days = weekDays(anchor); return `${days[0].toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${days[6].toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`; } return anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }

const labelStyle = { display: "block", marginBottom: 12, color: "var(--text-muted)", fontSize: 10.5, fontWeight: 750, letterSpacing: "0.06em" };
const inputStyle = { display: "block", width: "100%", marginTop: 5, boxSizing: "border-box", padding: "9px 11px" };

function EditDrawer({ item, onSave, onClose }) {
  const [title, setTitle] = useState(item.title || "Follow-up");
  const [date, setDate] = useState(toInputDate(item.due_at));
  const [time, setTime] = useState(toInputTime(item.due_at));
  const [description, setDescription] = useState(item.description || "");
  const [saving, setSaving] = useState(false);

  async function save(event) {
    event.preventDefault();
    if (!title.trim() || !date || !time) return;
    setSaving(true);
    try { await onSave(item.id, { title: title.trim(), description, due_at: new Date(`${date}T${time}`).toISOString() }); onClose(); }
    finally { setSaving(false); }
  }

  return <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 350, display: "flex", justifyContent: "flex-end" }}><div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} /><form onSubmit={save} className="app-drawer-panel" style={{ position: "relative", width: "min(430px, 94vw)", height: "100%", overflowY: "auto", padding: 26, borderRadius: "22px 0 0 22px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}><div><div style={{ color: "var(--accent)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Calendar event</div><h2 style={{ margin: "5px 0 0", color: "var(--text-primary)", fontSize: 20 }}>Edit follow-up</h2></div><button type="button" onClick={onClose} aria-label="Close" style={{ border: 0, background: "var(--bg-hover)", color: "var(--text-muted)", width: 32, height: 32, borderRadius: 10, cursor: "pointer" }}><X size={16} /></button></div><label style={labelStyle}>TITLE<input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} /></label><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><label style={labelStyle}>DATE<input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={inputStyle} /></label><label style={labelStyle}>TIME<input type="time" value={time} onChange={(event) => setTime(event.target.value)} style={inputStyle} /></label></div><label style={labelStyle}>DESCRIPTION<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} style={inputStyle} /></label><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !title.trim() || !date || !time}>{saving ? "Saving…" : "Save changes"}</Button></div></form></div>;
}

function FollowUpDrawer({ item, onClose, onEdit, onComplete, busy }) {
  const completed = isCompleted(item);
  return <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }}><div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} /><aside className="app-drawer-panel" style={{ position: "relative", width: "min(440px, 94vw)", height: "100%", overflowY: "auto", padding: 26, borderRadius: "22px 0 0 22px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><div><div style={{ color: "var(--accent)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em" }}>Follow-up details</div><h2 style={{ margin: "6px 0 0", color: "var(--text-primary)", fontSize: 21 }}>{item.title}</h2></div><button onClick={onClose} aria-label="Close" style={{ border: 0, background: "var(--bg-hover)", color: "var(--text-muted)", width: 32, height: 32, borderRadius: 10, cursor: "pointer" }}><X size={16} /></button></div><div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 16 }}><Badge tone={completed ? "success" : isOverdue(item) ? "danger" : "accent"} dot>{completed ? "Completed" : isOverdue(item) ? "Overdue" : "Pending"}</Badge><Badge tone="neutral">{item.follow_up_type || "call"}</Badge></div><div style={{ display: "grid", gap: 10, marginTop: 20 }}><Info icon={Clock} label="Scheduled" value={formatDue(item.due_at)} /><Info icon={User} label="Assigned employee" value={item.employee_name || "Organization follow-up"} />{item.call_id && <Info icon={Phone} label="Linked call" value={item.call_id} />}{item.customer && <Info icon={User} label="Customer" value={`${item.customer.name} · ${item.customer.phone}`} />}</div>{item.description && <div style={{ marginTop: 20, padding: 14, borderRadius: 13, background: "var(--surface-muted)", color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.6 }}><div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-muted)", fontSize: 11, fontWeight: 800, textTransform: "uppercase", marginBottom: 7 }}><FileText size={14} /> Notes</div>{item.description}</div>}<div style={{ display: "flex", gap: 8, marginTop: 24 }}>{!completed && <Button icon={Check} onClick={() => onComplete(item.id)} disabled={busy === item.id}>{busy === item.id ? "Completing…" : "Complete"}</Button>}<Button variant="outline" icon={Edit2} onClick={() => onEdit(item)} disabled={completed}>Edit</Button></div></aside></div>;
}

function Info({ icon: Icon, label, value }) { return <div style={{ display: "flex", alignItems: "center", gap: 11, padding: 12, borderRadius: 12, background: "var(--surface-muted)" }}><Icon size={16} color="var(--accent)" /><div><div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 4, color: "var(--text-primary)", fontSize: 13, fontWeight: 650 }}>{value}</div></div></div>; }

function FollowUpSidePanel({ nextFollow, pending, completed, onSelect }) {
  const compact = (item, tone) => <button key={item.id} onClick={() => onSelect(item)} style={{ width: "100%", padding: "9px 10px", border: 0, borderLeft: `3px solid ${tone}`, borderRadius: 9, background: "var(--surface-muted)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left" }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{item.title}</strong><span style={{ display: "block", marginTop: 4, color: "var(--text-muted)", fontSize: 10.5 }}>{formatDue(item.due_at)}</span></button>;
  return <aside style={{ display: "grid", gap: 12, minWidth: 0 }}>
    <Card style={{ background: "var(--pastel-yellow)", border: "1px solid var(--border-soft-app)" }}><div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em" }}>Next follow-up</div>{nextFollow ? <button onClick={() => onSelect(nextFollow)} style={{ display: "block", width: "100%", marginTop: 9, padding: 0, border: 0, background: "transparent", textAlign: "left", cursor: "pointer" }}><strong style={{ display: "block", color: "var(--text-primary)", fontSize: 13 }}>{nextFollow.title}</strong><span style={{ display: "block", marginTop: 5, color: "var(--text-secondary)", fontSize: 11.5 }}>{formatDue(nextFollow.due_at)}</span></button> : <div style={{ marginTop: 9, color: "var(--text-muted)", fontSize: 12 }}>No pending follow-ups.</div>}</Card>
    <Card><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><strong style={{ color: "var(--text-primary)", fontSize: 14 }}>Pending</strong><Badge tone="warning">{pending.length}</Badge></div><div style={{ display: "grid", gap: 7, maxHeight: 260, overflowY: "auto" }}>{pending.length ? pending.map((item) => compact(item, isOverdue(item) ? "var(--danger)" : "var(--accent)")) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No pending follow-ups.</span>}</div></Card>
    <Card><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><strong style={{ color: "var(--text-primary)", fontSize: 14 }}>Completed</strong><Badge tone="success">{completed.length}</Badge></div><div style={{ display: "grid", gap: 7, maxHeight: 260, overflowY: "auto" }}>{completed.length ? completed.slice(0, 30).map((item) => compact(item, "var(--success)")) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>No completed follow-ups.</span>}</div></Card>
  </aside>;
}

export default function FollowUps() {
  const { loading, error, data, reload } = useResource(() => followUpsApi.list());
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);
  const [view, setView] = useState("month");
  const [statusFilter, setStatusFilter] = useState("all");
  const [anchor, setAnchor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const items = data?.items || [];
  const pending = useMemo(() => items.filter(isPending), [items]);
  const completed = useMemo(() => items.filter(isCompleted), [items]);
  const overdue = pending.filter(isOverdue);
  const nextFollow = pending.slice().sort((a, b) => new Date(a.due_at) - new Date(b.due_at))[0];
  const visibleItems = useMemo(() => statusFilter === "pending" ? pending : statusFilter === "completed" ? completed : items, [statusFilter, pending, completed, items]);
  const grouped = useMemo(() => visibleItems.reduce((result, item) => { const key = dateKey(item.due_at); (result[key] ||= []).push(item); return result; }, {}), [visibleItems]);
  const days = useMemo(() => view === "day" ? [new Date(anchor)] : view === "week" ? weekDays(anchor) : monthDays(anchor), [anchor, view]);
  const columns = view === "day" ? 1 : 7;

  async function complete(id) {
    setBusy(id);
    try { await followUpsApi.complete(id); setSelected(null); await reload(); } finally { setBusy(null); }
  }
  async function update(id, patch) {
    setBusy(id);
    try { await followUpsApi.update(id, patch); setEditing(null); setSelected(null); await reload(); } finally { setBusy(null); }
  }
  function move(amount) { setAnchor((current) => view === "month" ? new Date(current.getFullYear(), current.getMonth() + amount, 1) : new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount * (view === "week" ? 7 : 1))); }
  function goToday() { setAnchor(new Date()); }

  if (loading) return <PageContainer><Card><LoadingState message="Loading follow-ups..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load follow-ups" message={error.message} onRetry={reload} /></Card></PageContainer>;

  return <PageContainer><div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}><div><div style={{ display: "flex", alignItems: "center", gap: 9 }}><Calendar size={22} color="var(--accent)" /><h1 style={{ margin: 0, color: "var(--text-primary)", fontSize: 30 }}>Follow-up Calendar</h1></div><p style={{ margin: "7px 0 0", color: "var(--text-muted)", fontSize: 13 }}>Day, week, and month views for every scheduled follow-up.</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><Badge tone="warning" dot>{overdue.length} overdue</Badge><Badge tone="success">{pending.length} pending</Badge><Badge tone="neutral">{completed.length} completed</Badge></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 320px)", gap: 16, alignItems: "start" }}><Card padding={0}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Button variant="ghost" icon={ChevronLeft} onClick={() => move(-1)} aria-label="Previous period" /><Button variant="ghost" icon={ChevronRight} onClick={() => move(1)} aria-label="Next period" /><Button variant="outline" onClick={goToday}>Today</Button><strong style={{ marginLeft: 8, color: "var(--text-primary)", fontSize: 15 }}>{displayRange(anchor, view)}</strong></div><div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}><ListFilter size={15} color="var(--text-muted)" />{STATUS_FILTERS.map((filter) => <button key={filter} onClick={() => setStatusFilter(filter)} style={{ border: "1px solid var(--border)", borderRadius: 999, padding: "6px 10px", background: statusFilter === filter ? "var(--primary-dark-app)" : "transparent", color: statusFilter === filter ? "#fff" : "var(--text-muted)", cursor: "pointer", fontSize: 11.5, fontWeight: 700, textTransform: "capitalize" }}>{filter}</button>)}<div style={{ display: "flex", gap: 3, padding: 3, borderRadius: 9, background: "var(--surface-muted)" }}>{VIEW_MODES.map((mode) => <button key={mode} onClick={() => setView(mode)} style={{ border: 0, borderRadius: 7, padding: "6px 9px", background: view === mode ? "var(--bg-card)" : "transparent", color: view === mode ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer", fontSize: 11.5, fontWeight: 750, textTransform: "capitalize" }}>{mode}</button>)}</div></div></div>
      {visibleItems.length === 0 ? <EmptyState icon={Calendar} title={`No ${statusFilter === "all" ? "scheduled" : statusFilter} follow-ups`} message="Schedule a follow-up from Call Logs to place it on this calendar." /> : <div style={{ overflowX: "auto" }}><div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(${view === "day" ? "0" : "150px"}, 1fr))`, gridTemplateRows: view === "month" ? `repeat(${Math.ceil(days.length / 7)}, minmax(0, 1fr))` : "minmax(0, 1fr)", height: view === "month" ? "clamp(420px, calc(100vh - 300px), 620px)" : "clamp(360px, calc(100vh - 300px), 620px)", minWidth: view === "day" ? "100%" : 760, borderLeft: "1px solid var(--border)" }}>{days.map((day, index) => { if (!day) return <div key={`empty-${index}`} style={{ minHeight: 0, height: "100%", borderRight: "1px solid var(--border)", background: "var(--surface-muted)" }} />; const key = dateKey(day); const dayItems = grouped[key] || []; const today = key === dateKey(new Date()); return <div key={key} style={{ minHeight: 0, height: "100%", overflow: "hidden", borderRight: "1px solid var(--border)", background: today ? "var(--pastel-blue)" : "var(--surface-primary)" }}><div style={{ padding: 10, borderBottom: "1px solid var(--border)", textAlign: "center" }}><div style={{ color: "var(--text-muted)", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" }}>{day.toLocaleDateString("en-IN", { weekday: "short" })}</div><div style={{ marginTop: 4, color: today ? "var(--primary-dark-app)" : "var(--text-primary)", fontSize: 20, fontWeight: 800 }}>{day.getDate()}</div></div><div style={{ display: "grid", gap: 6, padding: 8 }}>{dayItems.slice(0, view === "day" ? 12 : 3).map((item) => <button key={item.id} onClick={() => setSelected(item)} style={{ padding: 9, border: 0, borderLeft: `3px solid ${isCompleted(item) ? "var(--success)" : isOverdue(item) ? "var(--danger)" : "var(--accent)"}`, borderRadius: 9, background: isCompleted(item) ? "var(--success-soft)" : isOverdue(item) ? "var(--danger-soft)" : "var(--accent-soft)", color: "var(--text-primary)", cursor: "pointer", textAlign: "left", opacity: isCompleted(item) ? .72 : 1 }}><strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11.5 }}>{item.title}</strong><span style={{ display: "block", marginTop: 4, color: "var(--text-muted)", fontSize: 10.5 }}>{timeLabel(item.due_at)}</span></button>)}</div></div>; })}</div></div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "11px 16px", borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 11 }}><span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginRight: 5 }} />Pending</span><span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--danger)", marginRight: 5 }} />Overdue</span><span><i style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--success)", marginRight: 5 }} />Completed</span><span>Click any event to open details.</span></div></Card><FollowUpSidePanel nextFollow={nextFollow} pending={pending} completed={completed} onSelect={setSelected} /></div>
    {selected && <FollowUpDrawer item={selected} onClose={() => setSelected(null)} onEdit={(item) => { setSelected(null); setEditing(item); }} onComplete={complete} busy={busy} />}
    {editing && <EditDrawer item={editing} onSave={update} onClose={() => setEditing(null)} />}
  </div></PageContainer>;
}

import { useState, useEffect } from "react";
import { Calendar, Edit2, Trash2, Phone, Clock, User, FileText, CheckCircle } from "lucide-react";
import { PageContainer, Card, Button, EmptyState } from "../components/ui.jsx";
import { followUpsStore } from "../data/followUpsStore.js";
import { X } from "lucide-react";

function EditModal({ item, onSave, onClose }) {
  const [date, setDate] = useState(item.date);
  const [time, setTime] = useState(item.time);
  const [note, setNote] = useState(item.note || "");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(3,6,12,0.6)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 16, padding: 24, width: 360, boxShadow: "var(--shadow-lg)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontFamily: "Space Grotesk", fontWeight: 700, fontSize: 15, color: "var(--text-primary)" }}>Edit Follow-up</span>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16 }}>
          {item.contact} · {item.phone}
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
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
              style={{ display: "block", marginTop: 4, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box" }} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ date, time, note })} disabled={!date || !time}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

function fmt(date, time) {
  if (!date) return "—";
  const d = new Date(`${date}T${time || "00:00"}`);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function isPast(date, time) {
  return new Date(`${date}T${time || "00:00"}`) < new Date();
}

export default function FollowUps() {
  const [items, setItems]     = useState([]);
  const [editing, setEditing] = useState(null);

  function refresh() { setItems(followUpsStore.getAll()); }
  useEffect(refresh, []);

  function handleDelete(id) {
    followUpsStore.remove(id);
    refresh();
  }

  function handleSave(id, patch) {
    followUpsStore.update(id, patch);
    setEditing(null);
    refresh();
  }

  return (
    <PageContainer>
      <Card padding={0}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--grad-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              <Calendar size={17} />
            </div>
            <div>
              <div style={{ fontFamily: "Space Grotesk", fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Follow-ups</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{items.length} scheduled</div>
            </div>
          </div>
        </div>

        {/* List */}
        {items.length === 0 ? (
          <EmptyState icon={Calendar} title="No follow-ups yet" message="Schedule a follow-up from any call in Call Logs → Call Intelligence → Actions." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {items.map((item, idx) => {
              const past = isPast(item.date, item.time);
              return (
                <div key={item.id} style={{
                  display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 20px",
                  borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none",
                  background: past ? "var(--bg-hover)" : "transparent",
                  opacity: past ? 0.7 : 1,
                }}>
                  {/* Icon */}
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: past ? "var(--bg-hover)" : "var(--accent-soft)", color: past ? "var(--text-dim)" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {past ? <CheckCircle size={18} /> : <Calendar size={18} />}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{item.contact}</span>
                      {past && <span style={{ fontSize: 10.5, fontWeight: 700, padding: "1px 7px", borderRadius: 999, background: "var(--bg-hover)", color: "var(--text-dim)" }}>Past</span>}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12.5, color: "var(--text-muted)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} />{item.phone}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}><User size={12} />{item.employee}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5, color: past ? "var(--text-dim)" : "var(--accent)", fontWeight: 600 }}><Clock size={12} />{fmt(item.date, item.time)}</span>
                    </div>
                    {item.note && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 6, fontSize: 12.5, color: "var(--text-secondary)", background: "var(--bg-hover)", borderRadius: 8, padding: "6px 10px" }}>
                        <FileText size={12} style={{ marginTop: 2, flexShrink: 0 }} />{item.note}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 5 }}>
                      Scheduled {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} · Call type: {item.callType}
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => setEditing(item)} title="Edit"
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} title="Delete"
                      style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--danger)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {editing && (
        <EditModal
          item={editing}
          onSave={(patch) => handleSave(editing.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </PageContainer>
  );
}

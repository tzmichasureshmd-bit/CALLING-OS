import { useState } from "react";
import { Plus, PhoneOff, Trash2, X } from "lucide-react";
import { PageContainer, Card, Button, SearchInput, EmptyState, LoadingState, ErrorState } from "../components/ui.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { excludedApi } from "../api/resources.js";

function AddModal({ onClose, onAdded }) {
  const [number, setNumber] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!number.trim()) { setErr("Phone number is required"); return; }
    setSaving(true); setErr("");
    try {
      await excludedApi.create({ number: number.trim(), reason: reason.trim() || null });
      onAdded();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Failed to add number");
    } finally { setSaving(false); }
  }

  const inp = {
    width: "100%", padding: "10px 13px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: 400, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 18, padding: 24, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Add Excluded Number</div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>PHONE NUMBER</label>
          <input style={inp} placeholder="+91 98765 43210" value={number} onChange={(e) => setNumber(e.target.value)} autoFocus />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>REASON (optional)</label>
          <input style={inp} placeholder="e.g. Internal line, spam" value={reason} onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
        </div>
        {err && <div style={{ fontSize: 12.5, color: "var(--danger)", marginBottom: 12 }}>{err}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={submit} disabled={saving}>{saving ? "Adding…" : "Add Number"}</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function ExcludedNumbers() {
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { loading, error, data, reload } = useResource(() => dataSource.getExcludedNumbers());

  async function handleDelete(id) {
    setDeleting(id);
    try { await excludedApi.remove(id); reload(); }
    catch { /* silent */ }
    finally { setDeleting(null); }
  }

  if (loading) return <PageContainer><Card><LoadingState message="Loading..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load excluded numbers" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const filtered = (data.items || []).filter((n) =>
    [n.number, n.reason].join(" ").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <PageContainer>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", flexWrap: "wrap", gap: 12, borderBottom: "1px solid var(--border)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Excluded Phone Numbers</h3>
            <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Numbers ignored during call tracking and analytics.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SearchInput value={query} onChange={setQuery} placeholder="Search numbers..." />
            <Button icon={Plus} onClick={() => setShowAdd(true)}>Add Number</Button>
          </div>
        </div>

        <div className="callos-scroll-x">
          {filtered.length === 0 ? (
            <EmptyState icon={PhoneOff} title="No excluded numbers" message="Add a number to exclude it from tracking and reports." />
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Phone Number", "Reason", "Added By", "Date", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "12px 16px", fontSize: 11.5, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((n) => (
                  <tr key={n.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--accent)" }}>{n.number}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-secondary)" }}>{n.reason}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{n.addedBy}</td>
                    <td style={{ padding: "13px 16px", color: "var(--text-muted)" }}>{new Date(n.date).toLocaleDateString("en-IN")}</td>
                    <td style={{ padding: "13px 16px", textAlign: "right" }}>
                      <button
                        title="Remove"
                        disabled={deleting === n.id}
                        onClick={() => handleDelete(n.id)}
                        style={{ border: "none", background: "transparent", color: deleting === n.id ? "var(--text-dim)" : "var(--danger)", cursor: "pointer" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} onAdded={reload} />}
    </PageContainer>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, Mail, Phone, Plus, Search, UserRound, X } from "lucide-react";
import { PageContainer, Card, Button, Badge, EmptyState, ErrorState, LoadingState, SearchInput } from "../components/ui.jsx";
import { customersApi } from "../api/resources.js";
import { useResource } from "../api/useResource.js";

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function initials(name) {
  return String(name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function CustomerDrawer({ customerId, onClose, onEdit }) {
  const [customer, setCustomer] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    Promise.all([customersApi.get(customerId), customersApi.timeline(customerId, { limit: 200 })])
      .then(([profile, events]) => {
        if (!active) return;
        setCustomer(profile); setTimeline(events.items || []);
      })
      .catch((err) => active && setError(err?.message || "Unable to load customer profile"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customerId]);

  return (
    <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", justifyContent: "flex-end" }}>
      <div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} />
      <aside className="app-drawer-panel" style={{ position: "relative", width: "min(680px, 96vw)", height: "100%", overflowY: "auto", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>{customer && <div style={{ width: 48, height: 48, borderRadius: 15, display: "grid", placeItems: "center", background: "var(--primary-dark-app)", color: "#fff", fontWeight: 800 }}>{initials(customer.name)}</div>}<div><h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: 21 }}>{customer?.name || "Customer profile"}</h2>{customer && <div style={{ marginTop: 5, color: "var(--text-muted)", fontSize: 12 }}>{customer.phone} · {customer.company || "No company"}</div>}</div></div>
          <div style={{ display: "flex", gap: 7 }}>{customer && <Button variant="outline" onClick={() => onEdit(customer)}>Edit</Button>}<button onClick={onClose} aria-label="Close" style={{ border: 0, background: "var(--bg-hover)", color: "var(--text-muted)", width: 32, height: 32, borderRadius: 10, cursor: "pointer" }}><X size={16} /></button></div>
        </div>
        {loading ? <LoadingState message="Loading customer profile..." /> : error ? <ErrorState title="Couldn't load customer" message={error} /> : customer && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
            {[{ icon: Phone, label: "Phone", value: customer.phone }, { icon: Mail, label: "Email", value: customer.email || "—" }, { icon: Building2, label: "Company", value: customer.company || "—" }, { icon: UserRound, label: "Assigned", value: customer.employee_name || "Unassigned" }].map(({ icon: Icon, label, value }) => <div key={label} style={{ padding: 13, borderRadius: 14, background: "var(--pastel-green)", border: "1px solid var(--border-soft-app)" }}><div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-muted)", fontSize: 10, fontWeight: 750, textTransform: "uppercase" }}><Icon size={13} />{label}</div><div style={{ marginTop: 7, color: "var(--text-primary)", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div></div>)}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}><Badge tone="success" dot>{customer.status || "new"}</Badge><Badge tone="neutral">Created {formatDate(customer.created_at)}</Badge>{customer.next_follow_up && <Badge tone="warning">Next {formatDate(customer.next_follow_up)}</Badge>}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}><div><h3 style={{ margin: 0, color: "var(--text-primary)", fontSize: 16 }}>Activity timeline</h3><p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: 11 }}>Calls, outcomes, leads, opportunities, and follow-ups.</p></div><CalendarDays size={18} color="var(--accent)" /></div>
          {timeline.length === 0 ? <EmptyState icon={CalendarDays} title="No activity yet" message="The customer timeline will appear after synced calls and CRM actions." /> : <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{timeline.map((event) => <div key={event.id} style={{ display: "flex", gap: 10, padding: 12, borderRadius: 13, background: "var(--surface-muted)", border: "1px solid var(--border-soft-app)" }}><div style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--success)", marginTop: 5, flexShrink: 0 }} /><div style={{ minWidth: 0, flex: 1 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}><strong style={{ color: "var(--text-primary)", fontSize: 12.5 }}>{event.event_type.replaceAll("_", " ")}</strong><span style={{ color: "var(--text-muted)", fontSize: 10 }}>{formatDate(event.event_at)}</span></div><div style={{ marginTop: 4, color: "var(--text-secondary)", fontSize: 12 }}>{event.description || "Activity recorded"}</div>{event.employee_name && <div style={{ marginTop: 5, color: "var(--text-subtle-app)", fontSize: 10.5 }}>By {event.employee_name}</div>}</div></div>)}</div>}
        </>}
      </aside>
    </div>
  );
}

function AddCustomerModal({ onClose, onAdded, customer = null }) {
  const [fields, setFields] = useState({ name: customer?.name || "", phone: customer?.phone || "", email: customer?.email || "", company: customer?.company || "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (key) => (event) => setFields((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setSaving(true); setError("");
    try { if (customer) await customersApi.update(customer.id, fields); else await customersApi.create(fields); onAdded(); onClose(); } catch (err) { setError(err?.message || (customer ? "Unable to update customer" : "Unable to create customer")); } finally { setSaving(false); }
  }
  return <div className="app-dialog-overlay" style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}><div className="app-dialog-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0 }} /><div className="app-dialog-panel" style={{ position: "relative", width: 440, padding: 24 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}><h2 style={{ margin: 0, fontSize: 17, color: "var(--text-primary)" }}>{customer ? "Edit customer" : "Add customer"}</h2><button onClick={onClose} style={{ border: 0, background: "var(--bg-hover)", width: 30, height: 30, borderRadius: 9, cursor: "pointer" }}><X size={15} /></button></div><form onSubmit={submit} style={{ display: "grid", gap: 12 }}>{[{ key: "name", label: "Name", required: true }, { key: "phone", label: "Phone", required: true }, { key: "email", label: "Email" }, { key: "company", label: "Company" }].map((field) => <label key={field.key} style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: 700 }}>{field.label}<input required={field.required} value={fields[field.key]} onChange={set(field.key)} style={{ display: "block", width: "100%", marginTop: 5, padding: "10px 12px", boxSizing: "border-box" }} /></label>)}{error && <div style={{ padding: 9, borderRadius: 8, background: "var(--danger-soft)", color: "var(--danger)", fontSize: 12 }}>{error}</div>}<div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><Button variant="outline" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : customer ? "Save changes" : "Add customer"}</Button></div></form></div></div>;
}

export default function Customers() {
  const { loading, error, data, reload } = useResource(() => customersApi.list({ limit: 500 }));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const customers = data?.items || [];
  const filtered = useMemo(() => customers.filter((customer) => [customer.name, customer.phone, customer.email, customer.company].join(" ").toLowerCase().includes(query.toLowerCase())), [customers, query]);
  if (loading) return <PageContainer><Card><LoadingState message="Loading customers..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load customers" message={error.message} onRetry={reload} /></Card></PageContainer>;
  return <PageContainer><div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}><div><h1 style={{ margin: 0, color: "var(--text-primary)", fontSize: 30 }}>Customers</h1><p style={{ margin: "6px 0 0", color: "var(--text-muted)", fontSize: 13 }}>One profile and timeline for every customer conversation.</p></div><div style={{ display: "flex", gap: 9 }}><SearchInput value={query} onChange={setQuery} placeholder="Search customers..." /><Button icon={Plus} onClick={() => setAdding(true)}>Add customer</Button></div></div><Card padding={0}>{filtered.length === 0 ? <EmptyState icon={UserRound} title="No customers found" message="Customers appear after synced calls or manual creation." /> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, padding: 16 }}>{filtered.map((customer) => <button key={customer.id} type="button" onClick={() => setSelected(customer.id)} style={{ textAlign: "left", padding: 15, borderRadius: 16, border: "1px solid var(--border-soft-app)", background: "var(--pastel-green)", cursor: "pointer" }}><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--primary-dark-app)", color: "#fff", fontWeight: 750 }}>{initials(customer.name)}</div><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", color: "var(--text-primary)", fontSize: 13 }}>{customer.name}</strong><span style={{ display: "block", marginTop: 3, color: "var(--text-muted)", fontSize: 11 }}>{customer.phone}</span></div><Badge tone="neutral">{customer.status || "new"}</Badge></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 13, color: "var(--text-secondary)", fontSize: 11 }}><span>{customer.company || "No company"}</span><span>Last {customer.last_contact_at ? formatDate(customer.last_contact_at) : "—"}</span></div></button>)}</div>}</Card>{selected && <CustomerDrawer customerId={selected} onClose={() => setSelected(null)} onEdit={(customer) => { setEditing(customer); setSelected(null); }} />}{adding && <AddCustomerModal onClose={() => setAdding(false)} onAdded={reload} />}{editing && <AddCustomerModal customer={editing} onClose={() => setEditing(null)} onAdded={reload} />}</PageContainer>;
}

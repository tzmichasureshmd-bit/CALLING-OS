import { useState, useRef } from "react";
import { Search, Building2, Users, Smartphone } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { superApi } from "./api.js";

const TYPE_META = {
  organization: { icon: Building2, color: "var(--accent)",   label: "Org"    },
  employee:     { icon: Users,     color: "var(--success)",  label: "Employee" },
  device:       { icon: Smartphone,color: "var(--warning)",  label: "Device"  },
};

export default function GlobalSearchTab() {
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const search = (q) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    superApi.search(q).then(setResults).catch(() => setResults(null)).finally(() => setLoading(false));
  };

  const onChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => search(q), 350);
  };

  const all = results
    ? [
        ...results.organizations.map((o) => ({ ...o, type: "organization" })),
        ...results.employees.map((e)     => ({ ...e, type: "employee"     })),
        ...results.devices.map((d)       => ({ ...d, type: "device"       })),
      ]
    : [];

  return (
    <Card>
      <div style={{ position: "relative", marginBottom: 20 }}>
        <Search size={16} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          autoFocus
          value={query}
          onChange={onChange}
          placeholder="Search orgs, employees, devices by name / code / email…"
          style={{
            width: "100%", padding: "12px 16px 12px 42px", borderRadius: 12,
            border: "1px solid var(--border)", background: "var(--bg-hover)",
            color: "var(--text-primary)", fontSize: 15, boxSizing: "border-box",
          }}
        />
      </div>

      {loading && <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>Searching…</div>}

      {!loading && results && all.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>No results for "{query}"</div>
      )}

      {!loading && all.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            {results.total} result{results.total !== 1 ? "s" : ""}
          </div>
          {all.map((item) => {
            const meta = TYPE_META[item.type];
            const Icon = meta.icon;
            return (
              <div key={`${item.type}-${item.id}`} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 16px", borderRadius: 10,
                background: "var(--bg-hover)", border: "1px solid var(--border)",
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: meta.color + "22", color: meta.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name || item.model || item.id}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {item.email || item.code || item.org_id || ""}
                  </div>
                </div>
                <span style={{ padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                  background: meta.color + "22", color: meta.color }}>
                  {meta.label}
                </span>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10,
                  background: item.status === "active" || item.is_online ? "var(--success-soft, #16a34a22)" : "var(--bg-hover)",
                  color: item.status === "active" || item.is_online ? "var(--success)" : "var(--text-dim)" }}>
                  {item.status || (item.is_online ? "online" : "offline")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!query && !results && (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-dim)" }}>
          <Search size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>Type at least 2 characters to search</div>
        </div>
      )}
    </Card>
  );
}

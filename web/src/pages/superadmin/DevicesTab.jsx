import { useState, useEffect, useCallback } from "react";
import { Search, RefreshCw, Smartphone, X, ChevronRight } from "lucide-react";
import { Card, Badge, ErrorState, SkeletonRows } from "../../components/ui.jsx";
import { superApi, fmtDate, fmtDur, TH, TD } from "./api.js";

function DeviceDetail({ deviceId, orgName, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superApi.deviceDetail(deviceId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [deviceId]);

  const d = data?.device;
  const perms = d?.permissions || {};

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "flex-start", justifyContent: "flex-end", zIndex: 1000 }}>
      <div style={{ width: 480, height: "100vh", background: "var(--bg-card)", borderLeft: "1px solid var(--border)", overflowY: "auto", padding: 28, boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <Smartphone size={20} color="var(--accent)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>{loading ? "Loading…" : `${d?.manufacturer || ""} ${d?.model || ""}`.trim() || "Device"}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{orgName}</div>
          </div>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
        </div>

        {loading && <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>Loading…</div>}

        {!loading && d && (
          <>
            {/* Status row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                ["Status",    d.is_online ? "Online" : "Offline", d.is_online ? "var(--success)" : "var(--danger)"],
                ["Battery",   d.battery != null ? `${d.battery}%` : "—", d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)"],
                ["Network",   d.network_type || "—", "var(--accent)"],
                ["Android",   d.android_version || "—", "var(--text-primary)"],
                ["App Ver",   d.app_version || "—", "var(--text-primary)"],
                ["Last Seen", fmtDate(d.last_seen), "var(--text-muted)"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: "var(--bg-hover)", borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>

            {/* Employee */}
            {data.employee && (
              <div style={{ marginBottom: 20, padding: "12px 16px", background: "var(--bg-hover)", borderRadius: 10 }}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>ASSIGNED EMPLOYEE</div>
                <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{data.employee.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{data.employee.email}</div>
              </div>
            )}

            {/* Permissions */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Permissions</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(perms).length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>No permission data</span>
                ) : Object.entries(perms).map(([k, v]) => (
                  <span key={k} style={{ padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 700,
                    background: v ? "var(--success-soft, #16a34a22)" : "var(--danger-soft, #dc262622)",
                    color: v ? "var(--success)" : "var(--danger)" }}>
                    {k}: {v ? "✓" : "✗"}
                  </span>
                ))}
              </div>
            </div>

            {/* SIMs */}
            {data.sims?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>SIM Cards</div>
                {data.sims.map((s) => (
                  <div key={s.id} style={{ padding: "10px 14px", background: "var(--bg-hover)", borderRadius: 10, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>SIM {s.slot} — {s.carrier || "Unknown"}</span>
                      <span style={{ fontSize: 11, color: s.is_active ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>{s.is_active ? "Active" : "Inactive"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                      {s.phone_number || "No number"} · {s.network_type || "—"} · Sub: {s.subscription_id || "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recent calls */}
            {data.recent_calls?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recent Calls ({data.recent_calls.length})</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr><th style={TH}>Phone</th><th style={TH}>Type</th><th style={TH}>Duration</th><th style={TH}>Date</th></tr></thead>
                  <tbody>
                    {data.recent_calls.map((c) => (
                      <tr key={c.id}>
                        <td style={TD({ fontSize: 12, fontFamily: "monospace" })}>{c.phone || "—"}</td>
                        <td style={TD({ fontSize: 12 })}>{c.type || "—"}</td>
                        <td style={TD({ fontSize: 12 })}>{fmtDur(c.duration)}</td>
                        <td style={TD({ fontSize: 11, color: "var(--text-muted)" })}>{fmtDate(c.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function DevicesTab() {
  const [devices, setDevices]   = useState([]);
  const [orgs, setOrgs]         = useState({});
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [query, setQuery]       = useState("");
  const [filter, setFilter]     = useState("all");
  const [selected, setSelected] = useState(null); // { id, orgName }

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [devData, orgsData] = await Promise.all([
        superApi.devices(),
        superApi.orgs({ page_size: 100 }),
      ]);
      const orgMap = {};
      (orgsData.items || []).forEach((o) => { orgMap[o.id] = o.name; });
      setOrgs(orgMap);
      setDevices(devData.items || []);
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = devices.filter((d) => {
    const matchQ = !query || (d.model || "").toLowerCase().includes(query.toLowerCase()) || (orgs[d.org_id] || "").toLowerCase().includes(query.toLowerCase());
    const matchF = filter === "all" || (filter === "online" ? d.is_online : !d.is_online);
    return matchQ && matchF;
  });

  const online  = devices.filter((d) => d.is_online).length;
  const offline = devices.filter((d) => !d.is_online).length;

  return (
    <>
      <Card padding={0}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>All Devices</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
              {devices.length} devices — <span style={{ color: "var(--success)", fontWeight: 600 }}>{online} online</span> · <span style={{ color: "var(--danger)", fontWeight: 600 }}>{offline} offline</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {[{ key: "all", label: `All (${devices.length})` }, { key: "online", label: `Online (${online})` }, { key: "offline", label: `Offline (${offline})` }].map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid " + (filter === f.key ? "transparent" : "var(--border)"), background: filter === f.key ? "var(--grad-brand)" : "transparent", color: filter === f.key ? "#fff" : "var(--text-muted)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {f.label}
              </button>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", width: 190 }}>
              <Search size={14} color="var(--text-dim)" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search devices…"
                style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
            </div>
            <button onClick={load} style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading && <div style={{ padding: 20 }}><SkeletonRows rows={5} cols={6} /></div>}
        {error   && <ErrorState title="Failed to load devices" message={error} onRetry={load} />}

        {!loading && !error && (
          <div className="nova-scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>{["Device", "Organization", "Status", "Battery", "App Ver", "Last Seen", ""].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.id} onMouseEnter={(ev) => ev.currentTarget.style.background = "var(--bg-hover)"} onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
                    <td style={TD()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--bg-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Smartphone size={15} color="var(--text-muted)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{d.model || "Unknown"}</div>
                          {(d.manufacturer || d.android_version) && (
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                              {[d.manufacturer, d.android_version ? `Android ${d.android_version}` : null].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={TD()}>
                      <span style={{ fontSize: 12, background: "var(--bg-hover)", padding: "3px 9px", borderRadius: 6, color: "var(--text-secondary)", fontWeight: 600 }}>
                        {orgs[d.org_id] || "—"}
                      </span>
                    </td>
                    <td style={TD()}><Badge tone={d.is_online ? "success" : "danger"} dot>{d.is_online ? "Online" : "Offline"}</Badge></td>
                    <td style={TD()}>
                      {d.battery != null ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 60, height: 6, borderRadius: 4, background: "var(--border)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${d.battery}%`, borderRadius: 4, background: d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)" }} />
                          </div>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: d.battery > 50 ? "var(--success)" : d.battery > 20 ? "var(--warning)" : "var(--danger)" }}>{d.battery}%</span>
                        </div>
                      ) : "—"}
                    </td>
                    <td style={TD({ fontFamily: "monospace", fontSize: 12 })}>{d.app_version || "—"}</td>
                    <td style={TD({ color: "var(--text-muted)", whiteSpace: "nowrap" })}>{fmtDate(d.last_seen)}</td>
                    <td style={TD()}>
                      <button onClick={() => setSelected({ id: d.id, orgName: orgs[d.org_id] || "—" })}
                        style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg-hover)", cursor: "pointer", color: "var(--accent)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                        Details <ChevronRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>No devices found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <DeviceDetail deviceId={selected.id} orgName={selected.orgName} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

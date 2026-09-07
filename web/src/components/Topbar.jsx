import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sun, Moon, Bell, ChevronDown, Menu, Copy, Check,
  Plus, CheckCircle2, X, Loader, Trash2, ArrowLeftRight,
  PhoneMissed, Mic, AlertTriangle, AlertCircle, Info,
} from "lucide-react";
import { fetchNotifications, markRead, markAllRead } from "../api/notifications.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useRange } from "../context/RangeContext.jsx";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/resources.js";
import { setAccessToken } from "../api/client.js";

const RANGES = ["Today", "Yesterday", "7 Days", "30 Days"];

// ── helpers ───────────────────────────────────────────────────────────────────
function getSavedOrgs() {
  try { return JSON.parse(localStorage.getItem("callos_orgs") || "[]"); } catch { return []; }
}
function saveOrgs(orgs) { localStorage.setItem("callos_orgs", JSON.stringify(orgs)); }

function OrgAvatar({ name, size = 40, active = false }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "var(--grad-brand)", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, fontFamily: "Space Grotesk",
      flexShrink: 0,
      boxShadow: active ? "0 0 0 2.5px var(--bg-card), 0 0 0 4px var(--accent)" : "none",
      transition: "box-shadow 0.15s",
    }}>
      {initials}
    </div>
  );
}

// ── Account Switcher Modal (Instagram-style) ──────────────────────────────────
function AccountSwitcherModal({ user, onClose }) {
  const [orgs, setOrgs] = useState(getSavedOrgs);
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState("login"); // "login" | "register"
  const [switching, setSwitching] = useState(null);
  const [form, setForm] = useState({ company_name: "", name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef();

  const currentOrgId = user?.organization_id;

  // Ensure current org is always in list
  useEffect(() => {
    if (!user?.organization_id) return;
    const existing = getSavedOrgs();
    if (!existing.find((o) => o.id === user.organization_id)) {
      const updated = [...existing, {
        id: user.organization_id,
        name: user.organization_name || "Organization",
        code: user.organization_code || "",
        access_token: localStorage.getItem("callos_token") || "",
        refresh_token: "",
        email: user.email || "",
      }];
      saveOrgs(updated);
      setOrgs(updated);
    }
  }, [user?.organization_id]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const handleSwitch = (org) => {
    if (org.id === currentOrgId) { onClose(); return; }
    if (!org.access_token) { return; }
    setSwitching(org.id);
    const prevToken = localStorage.getItem("callos_token");
    setAccessToken(org.access_token);
    localStorage.setItem("callos_token", org.access_token);
    authApi.me()
      .then((me) => { localStorage.setItem("callos_user", JSON.stringify(me)); window.location.reload(); })
      .catch(() => {
        setAccessToken(prevToken);
        localStorage.setItem("callos_token", prevToken);
        setSwitching(null);
      });
  };

  const handleRemove = (e, orgId) => {
    e.stopPropagation();
    if (orgId === currentOrgId) return;
    const updated = orgs.filter((o) => o.id !== orgId);
    saveOrgs(updated);
    setOrgs(updated);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.email.trim())    { setError("Email is required"); return; }
    if (!form.password.trim()) { setError("Password is required"); return; }
    if (addMode === "register" && !form.company_name.trim()) { setError("Company name is required"); return; }
    setSaving(true); setError("");
    const prevToken = localStorage.getItem("callos_token");
    try {
      let res;
      if (addMode === "register") {
        res = await authApi.register({
          name: form.name || form.company_name,
          company_name: form.company_name,
          email: form.email,
          password: form.password,
        });
      } else {
        res = await authApi.login({ email: form.email, password: form.password });
      }
      setAccessToken(res.access_token);
      const me = await authApi.me();
      setAccessToken(prevToken);
      const newOrg = {
        id: me.organization_id || res.organization_id,
        name: me.organization_name || form.company_name || form.email,
        code: me.organization_code || "",
        access_token: res.access_token,
        refresh_token: res.refresh_token || "",
        email: me.email || form.email,
      };
      if (!newOrg.id) { setError("Could not retrieve organization. Try again."); setAccessToken(prevToken); setSaving(false); return; }
      const updated = [...orgs.filter((o) => o.id !== newOrg.id), newOrg];
      saveOrgs(updated); setOrgs(updated);
      setShowAdd(false); setForm({ company_name: "", name: "", email: "", password: "" });
    } catch (err) {
      setAccessToken(prevToken);
      setError(err?.message || (addMode === "register" ? "Failed to create organization" : "Invalid email or password"));
    } finally { setSaving(false); }
  };

  const inputStyle = { padding: "8px 11px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(3px)" }} />

      {/* Panel — positioned below topbar left */}
      <div ref={ref} style={{
        position: "absolute", top: 70, left: 22,
        width: 340, background: "var(--bg-elevated)",
        border: "1px solid var(--border)", borderRadius: 18,
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        overflow: "hidden", animation: "nova-slide-in-down 0.18s ease",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ArrowLeftRight size={15} color="var(--accent)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Switch Organization</span>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        {/* Org list */}
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {orgs.map((org) => {
            const active = org.id === currentOrgId;
            const isSwitch = switching === org.id;
            return (
              <div
                key={org.id}
                onClick={() => !isSwitch && handleSwitch(org)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 18px", cursor: isSwitch ? "wait" : "pointer",
                  background: active ? "var(--accent-soft)" : "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--bg-hover)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = active ? "var(--accent-soft)" : "transparent"; }}
              >
                <OrgAvatar name={org.name} size={44} active={active} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {org.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: active ? "var(--accent)" : "var(--text-dim)", fontFamily: "Space Grotesk", marginTop: 1 }}>
                    {org.code || org.email || "—"}
                  </div>
                  {active && (
                    <div style={{ fontSize: 11, color: "var(--success)", fontWeight: 600, marginTop: 2 }}>● Active</div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {isSwitch
                    ? <Loader size={16} color="var(--accent)" style={{ animation: "nova-spin 0.8s linear infinite" }} />
                    : active
                      ? <CheckCircle2 size={18} color="var(--accent)" />
                      : (
                        <button
                          onClick={(e) => handleRemove(e, org.id)}
                          title="Remove account"
                          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-dim)", padding: 4, borderRadius: 6, display: "flex", alignItems: "center" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--danger)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                        >
                          <Trash2 size={14} />
                        </button>
                      )
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* Add org section */}
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {!showAdd ? (
            <button
              onClick={() => { setShowAdd(true); setAddMode("login"); setError(""); }}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", border: "none", background: "transparent", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: "2px dashed var(--border-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Plus size={18} color="var(--accent)" />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--accent)" }}>Add Organization</div>
                <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>Login or register another account</div>
              </div>
            </button>
          ) : (
            <div style={{ padding: "14px 18px" }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Add Organization</span>
                <button type="button" onClick={() => { setShowAdd(false); setError(""); setForm({ company_name: "", name: "", email: "", password: "" }); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", background: "var(--bg-hover)", borderRadius: 9, padding: 3, marginBottom: 12 }}>
                {[{ id: "login", label: "Login to existing" }, { id: "register", label: "Create new" }].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setAddMode(t.id); setError(""); }}
                    style={{ flex: 1, padding: "6px 8px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, background: addMode === t.id ? "var(--bg-elevated)" : "transparent", color: addMode === t.id ? "var(--accent)" : "var(--text-muted)", boxShadow: addMode === t.id ? "var(--shadow-sm)" : "none", transition: "all 0.15s" }}
                  >{t.label}</button>
                ))}
              </div>

              {/* Form */}
              <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {addMode === "register" && (
                  <>
                    <input placeholder="Company name *" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} style={inputStyle} />
                    <input placeholder="Your name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
                  </>
                )}
                <input type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} />
                <input type="password" placeholder="Password *" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={inputStyle} />
                {error && <div style={{ fontSize: 12, color: "var(--danger)" }}>{error}</div>}
                <button type="submit" disabled={saving} style={{ padding: "9px 14px", borderRadius: 9, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  {saving
                    ? <><Loader size={13} style={{ animation: "nova-spin 0.8s linear infinite" }} /> {addMode === "login" ? "Signing in..." : "Creating..."}</>
                    : addMode === "login" ? "Sign In & Add" : "Create & Switch"
                  }
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Topbar ────────────────────────────────────────────────────────────────────
export default function Topbar({ title, onMenu }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { range, setRange: setGlobalRange, RANGE_MAP } = useRange();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const notifRef = useRef();

  // Map display label → API range key
  const DISPLAY_RANGES = ["Today", "Yesterday", "7 Days", "30 Days"];
  const currentLabel = Object.entries(RANGE_MAP).find(([, v]) => v === range)?.[0] || "Today";

  function handleRangeClick(label) {
    setGlobalRange(RANGE_MAP[label] || "today");
  }

  const loadNotifs = useCallback(async () => {
    setNotifsLoading(true);
    try { setNotifs(await fetchNotifications()); }
    catch { /* silent */ }
    finally { setNotifsLoading(false); }
  }, []);

  // Load on mount + poll every 60s
  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 30000);  // 30s — catches device permission changes quickly
    return () => clearInterval(t);
  }, [loadNotifs]);

  // Close on outside click
  useEffect(() => {
    if (!showNotifs) return;
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false); };
    setTimeout(() => document.addEventListener("mousedown", h), 0);
    return () => document.removeEventListener("mousedown", h);
  }, [showNotifs]);

  const unread = notifs.filter((n) => !n.read).length;

  function handleMarkAllRead() {
    markAllRead(notifs);
    setNotifs((ns) => ns.map((n) => ({ ...n, read: true })));
  }

  function handleNotifClick(n) {
    markRead([n.id]);
    setNotifs((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x));
    if (n.to) { setShowNotifs(false); navigate(n.to); }
  }

  function notifIcon(type) {
    if (type === "missed")    return { Icon: PhoneMissed,   color: "var(--red)" };
    if (type === "recording") return { Icon: Mic,           color: "var(--accent)" };
    if (type === "alert")     return { Icon: AlertCircle,   color: "var(--red)" };
    if (type === "warning")   return { Icon: AlertTriangle, color: "var(--amber)" };
    return                           { Icon: Info,          color: "var(--text-muted)" };
  }

  const companyCode = user?.organization_code || user?.company_code || "";
  const orgName = user?.organization_name || "Organization";

  const copyCode = () => {
    if (companyCode) navigator.clipboard?.writeText(companyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <header className="nova-glass" style={{
        height: 62, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 22px", position: "sticky", top: 0, zIndex: 40, gap: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button onClick={onMenu} className="nova-menu-btn" style={{ display: "none", border: "none", background: "transparent", color: "var(--text-secondary)", cursor: "pointer" }}><Menu size={22} /></button>
          <h1 style={{ margin: 0, fontFamily: "Space Grotesk", fontSize: 17, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h1>

          {/* Org switcher trigger */}
          <button
            onClick={() => setShowSwitcher((s) => !s)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: showSwitcher ? "var(--accent-soft)" : "var(--bg-hover)",
              border: `1px solid ${showSwitcher ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 10, padding: "5px 10px 5px 6px", cursor: "pointer",
              color: "var(--text-secondary)", transition: "all 0.15s",
            }}
          >
            <OrgAvatar name={orgName} size={24} />
            <span style={{ fontSize: 12.5, fontWeight: 600, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
              {orgName}
            </span>
            <ChevronDown size={13} color="var(--text-dim)" style={{ transform: showSwitcher ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Date filter */}
          <div className="nova-cmd-hide" style={{ display: "flex", background: "var(--bg-hover)", border: "1px solid var(--border)", borderRadius: 10, padding: 3 }}>
            {DISPLAY_RANGES.map((r) => (
              <button key={r} onClick={() => handleRangeClick(r)} style={{
                padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600,
                background: r === currentLabel ? "var(--bg-elevated)" : "transparent",
                color: r === currentLabel ? "var(--accent)" : "var(--text-muted)",
                boxShadow: r === currentLabel ? "var(--shadow-sm)" : "none",
              }}>{r}</button>
            ))}
          </div>

          {/* Search */}
          <div className="nova-cmd-hide" style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 10, padding: "7px 11px", width: 190 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search..." style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
          </div>

          {/* Live */}
          <div className="nova-cmd-hide" style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 11px", background: "var(--success-soft)", borderRadius: 10 }}>
            <span className="nova-live-dot" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--success)" }}>Live</span>
          </div>

          {/* Connect code */}
          {companyCode && (
            <button onClick={copyCode} className="nova-cmd-hide" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--grad-brand-soft)", color: "var(--accent)", border: "1px solid var(--border)", padding: "6px 11px", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Space Grotesk" }}>
              {companyCode}{copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
          )}

          <button onClick={toggleTheme} style={iconBtn}>{theme === "light" ? <Moon size={17} /> : <Sun size={17} />}</button>

          <div style={{ position: "relative" }} ref={notifRef}>
            <button onClick={() => setShowNotifs((s) => !s)} style={{ ...iconBtn, position: "relative", background: showNotifs ? "var(--accent-soft)" : "var(--bg-card)", borderColor: showNotifs ? "var(--accent)" : "var(--border)" }}>
              <Bell size={17} />
              {unread > 0 && <span style={{ position: "absolute", top: 7, right: 8, width: 7, height: 7, borderRadius: "50%", background: "var(--red)" }} />}
            </button>

            {showNotifs && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                width: 330, background: "var(--bg-elevated)",
                border: "1px solid var(--border)", borderRadius: 16,
                boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
                zIndex: 200, overflow: "hidden",
                animation: "nova-slide-in-down 0.18s ease",
              }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Bell size={14} color="var(--accent)" />
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>Notifications</span>
                    {unread > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "var(--red)", color: "#fff", borderRadius: 20, padding: "1px 7px" }}>{unread}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {unread > 0 && <button onClick={handleMarkAllRead} style={{ fontSize: 11.5, fontWeight: 600, color: "var(--accent)", border: "none", background: "transparent", cursor: "pointer" }}>Mark all read</button>}
                    <button onClick={loadNotifs} title="Refresh" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-dim)", display: "flex", alignItems: "center" }}>
                      {notifsLoading ? <Loader size={13} style={{ animation: "nova-spin 0.8s linear infinite" }} /> : <span style={{ fontSize: 13 }}>↻</span>}
                    </button>
                  </div>
                </div>

                {/* List */}
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {notifsLoading && notifs.length === 0 ? (
                    <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      <Loader size={18} style={{ animation: "nova-spin 0.8s linear infinite" }} />
                    </div>
                  ) : notifs.length === 0 ? (
                    <div style={{ padding: "28px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No notifications</div>
                  ) : notifs.map((n) => {
                    const { Icon, color } = notifIcon(n.type);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: 12,
                          padding: "12px 16px", cursor: n.to ? "pointer" : "default",
                          background: n.read ? "transparent" : "var(--accent-soft)",
                          borderBottom: "1px solid var(--border)",
                          transition: "background 0.12s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = n.read ? "transparent" : "var(--accent-soft)")}
                      >
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <Icon size={16} color={color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{n.sub}</div>
                          {n.actionLabel && (
                            <div style={{ marginTop: 5 }}>
                              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--accent)", background: "var(--accent-soft)", padding: "2px 8px", borderRadius: 6 }}>
                                {n.actionLabel} →
                              </span>
                            </div>
                          )}
                        </div>
                        {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flexShrink: 0, marginTop: 6 }} />}
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                  <button onClick={() => { setShowNotifs(false); navigate("/call-logs"); }} style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)", border: "none", background: "transparent", cursor: "pointer" }}>View all call logs →</button>
                </div>
              </div>
            )}
          </div>


        </div>
      </header>

      {showSwitcher && <AccountSwitcherModal user={user} onClose={() => setShowSwitcher(false)} />}
    </>
  );
}

const iconBtn = {
  width: 38, height: 38, borderRadius: 10,
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text-secondary)", cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

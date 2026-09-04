import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Inbox, X } from "lucide-react";

/* ============================================================
   CallNexa — Component Library
   ============================================================ */

// ---- Logo: CallNexa wordmark with gradient mark ----
export function Logo({ size = 24, showText = true, collapsed = false }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: 9,
          background: "var(--grad-brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "var(--glow)",
        }}
      >
        <svg width={size - 4} height={size - 4} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M3 12h3l2-6 4 12 3-8 2 4h4" />
        </svg>
      </div>
      {showText && !collapsed && (
        <span style={{ fontFamily: "Space Grotesk", fontSize: size * 0.72, fontWeight: 700, letterSpacing: "0.04em", color: "var(--text-primary)" }}>
          Call<span style={{ background: "var(--grad-brand)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Nexa</span>
        </span>
      )}
    </div>
  );
}

export function Card({ children, style, className = "", padding = 20, hover = false, ...rest }) {
  const [h, setH] = useState(false);
  return (
    <div
      className={`nova-card ${className}`}
      style={{
        padding,
        transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease",
        ...(hover && h ? { transform: "translateY(-2px)", boxShadow: "var(--shadow-md)", borderColor: "var(--border-strong)" } : {}),
        ...style,
      }}
      onMouseEnter={() => hover && setH(true)}
      onMouseLeave={() => hover && setH(false)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ icon: Icon, title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
      <div style={{ display: "flex", gap: 11, alignItems: "center" }}>
        {Icon && (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--grad-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
            <Icon size={17} />
          </div>
        )}
        <div>
          <h3 style={{ margin: 0, fontFamily: "Space Grotesk", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
          {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral", dot = false, style }) {
  const tones = {
    neutral: { bg: "var(--bg-hover)", fg: "var(--text-muted)", bd: "var(--border)" },
    teal: { bg: "var(--accent-soft)", fg: "var(--accent)", bd: "transparent" },
    violet: { bg: "rgba(139,92,246,0.14)", fg: "var(--accent-2)", bd: "transparent" },
    success: { bg: "var(--success-soft)", fg: "var(--success)", bd: "transparent" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)", bd: "transparent" },
    warning: { bg: "var(--warning-soft)", fg: "var(--warning)", bd: "transparent" },
    info: { bg: "var(--info-soft)", fg: "var(--info)", bd: "transparent" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: t.bg, color: t.fg, border: `1px solid ${t.bd}`, whiteSpace: "nowrap", ...style }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: t.fg }} />}
      {children}
    </span>
  );
}

export function Button({ children, variant = "primary", icon: Icon, style, ...rest }) {
  const [h, setH] = useState(false);
  const variants = {
    primary: { bg: "var(--grad-brand)", fg: "#fff", bd: "transparent" },
    solid: { bg: "var(--accent)", fg: "#04211d", bd: "transparent" },
    soft: { bg: "var(--accent-soft)", fg: "var(--accent)", bd: "transparent" },
    outline: { bg: "transparent", fg: "var(--text-secondary)", bd: "var(--border-strong)" },
    ghost: { bg: "transparent", fg: "var(--text-muted)", bd: "transparent" },
    danger: { bg: "var(--danger-soft)", fg: "var(--danger)", bd: "transparent" },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "8px 14px", borderRadius: "var(--radius-btn)",
        fontSize: 13, fontWeight: 600, cursor: "pointer",
        background: v.bg, color: v.fg, border: `1px solid ${v.bd}`,
        transition: "filter 0.15s ease, transform 0.1s ease",
        filter: h ? "brightness(1.06)" : "none",
        ...style,
      }}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      {...rest}
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search...", style }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: "var(--radius-btn)", padding: "7px 12px", minWidth: 200, ...style }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ border: "none", outline: "none", background: "transparent", color: "var(--text-primary)", fontSize: 13, width: "100%" }} />
    </div>
  );
}

// ---- Count-up KPI number ----
export function CountUp({ value, duration = 700, format = (n) => n }) {
  const [n, setN] = useState(0);
  const ref = useRef();
  useEffect(() => {
    const target = Number(value) || 0;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setN(target); return; }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [value, duration]);
  return <>{format(n)}</>;
}

export function KpiCard({ icon: Icon, label, value, sub, tone = "teal", numeric = false, delta }) {
  const toneColor = { teal: "var(--accent)", violet: "var(--accent-2)", cyan: "var(--cyan)", success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)", info: "var(--info)" }[tone] || "var(--accent)";
  return (
    <Card hover style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: toneColor, opacity: 0.8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--grad-brand-soft)", color: toneColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} />
        </div>
      </div>
      <div style={{ fontFamily: "Space Grotesk", fontSize: 30, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
        {numeric ? <CountUp value={value} /> : value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {sub && <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{sub}</span>}
        {delta != null && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: delta >= 0 ? "var(--success)" : "var(--danger)" }}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </Card>
  );
}

// ---- Skeletons ----
export function Skeleton({ width = "100%", height = 14, radius = 8, style }) {
  return <div className="nova-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <Card>
      <Skeleton width={120} height={12} style={{ marginBottom: 14 }} />
      <Skeleton width="60%" height={26} style={{ marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} style={{ marginBottom: 10, width: `${90 - i * 12}%` }} />
      ))}
    </Card>
  );
}

export function SkeletonRows({ rows = 6, cols = 5 }) {
  return (
    <div style={{ padding: 8 }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "flex", gap: 16, padding: "12px 8px" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={12} style={{ flex: c === 0 ? 1.4 : 1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---- States ----
export function EmptyState({ icon: Icon = Inbox, title = "Nothing here yet", message, action }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "46px 20px", textAlign: "center", color: "var(--text-muted)" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--grad-brand-soft)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, color: "var(--accent)" }}>
        <Icon size={26} />
      </div>
      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-secondary)", fontFamily: "Space Grotesk" }}>{title}</p>
      {message && <p style={{ margin: "6px 0 0", fontSize: 13, maxWidth: 340 }}>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Action needed", message, code, hint, onRetry }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "46px 20px", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: "var(--danger-soft)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
        <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
      </div>
      <p style={{ margin: 0, fontWeight: 600, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>{title}</p>
      {message && <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>{message}</p>}
      {hint && <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-dim)" }}>{hint}</p>}
      {code && <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-dim)", fontFamily: "monospace" }}>{code}</p>}
      {onRetry && <div style={{ marginTop: 16 }}><Button variant="soft" onClick={onRetry}>Retry</Button></div>}
    </div>
  );
}

// Back-compat spinner-style loader (prefer Skeleton/SkeletonRows for new pages)
export function LoadingState({ message = "Loading..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "44px 20px", color: "var(--text-muted)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTopColor: "var(--accent)", animation: "nova-spin 0.8s linear infinite", marginBottom: 14 }} />
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>{message}</p>
    </div>
  );
}

export function RouteFallback() {
  return (
    <div style={{ padding: "22px 26px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={1} />)}
      </div>
      <Card><SkeletonRows rows={6} cols={5} /></Card>
    </div>
  );
}

// ---- Right-side Drawer (Call Intelligence, etc.) ----
export function Drawer({ open, onClose, title, width = 460, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose?.();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div className="nova-fade" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(3,6,12,0.55)", backdropFilter: "blur(2px)" }} />
      <div style={{ position: "absolute", top: 0, right: 0, height: "100%", width, maxWidth: "94vw", background: "var(--bg-elevated)", borderLeft: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", animation: "nova-slide-in-right 0.22s ease", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <h3 style={{ margin: 0, fontFamily: "Space Grotesk", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{title}</h3>
          <button onClick={onClose} aria-label="Close" style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={16} /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

// ---- Chart tooltip (theme-aware) ----
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", boxShadow: "var(--shadow-md)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5, fontFamily: "Space Grotesk" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: 3, background: p.color }} />
          {p.name}: <b style={{ color: "var(--text-primary)" }}>{p.value}</b>
        </div>
      ))}
    </div>
  );
}

export function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  const btn = (dis) => ({ padding: "6px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-secondary)", cursor: dis ? "not-allowed" : "pointer", opacity: dis ? 0.5 : 1, fontSize: 13 });
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 16px" }}>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} style={btn(page <= 1)}>Prev</button>
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} style={btn(page >= totalPages)}>Next</button>
    </div>
  );
}

export function PageContainer({ children }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ padding: "22px 26px 44px" }}>
      {children}
    </motion.div>
  );
}

// Section title with optional gradient underline
export function SectionTitle({ children, icon: Icon }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
      {Icon && <Icon size={18} color="var(--accent)" />}
      <h2 style={{ margin: 0, fontFamily: "Space Grotesk", fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{children}</h2>
    </div>
  );
}

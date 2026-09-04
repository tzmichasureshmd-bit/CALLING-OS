import { createContext, useContext, useCallback, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext({ toast: () => {} });

const TONES = {
  success: { icon: CheckCircle2, color: "var(--success)", bg: "var(--success-soft)" },
  error: { icon: AlertCircle, color: "var(--danger)", bg: "var(--danger-soft)" },
  info: { icon: Info, color: "var(--info)", bg: "var(--info-soft)" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback((message, tone = "info", duration = 3000) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div style={{ position: "fixed", bottom: 20, right: 20, display: "flex", flexDirection: "column", gap: 10, zIndex: 9999 }}>
        {toasts.map((t) => {
          const meta = TONES[t.tone] || TONES.info;
          const Icon = meta.icon;
          return (
            <div key={t.id} className="callos-fade" style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${meta.color}`,
              borderRadius: 10, padding: "12px 14px", minWidth: 260, maxWidth: 360,
              boxShadow: "var(--shadow-lg)",
            }}>
              <div style={{ color: meta.color, display: "flex" }}><Icon size={18} /></div>
              <span style={{ flex: 1, fontSize: 13, color: "var(--text-primary)" }}>{t.message}</span>
              <button onClick={() => remove(t.id)} style={{ border: "none", background: "transparent", color: "var(--text-dim)", cursor: "pointer", display: "flex" }}><X size={15} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

import { Link } from "react-router-dom";
import { LogIn, ShieldCheck, UserPlus } from "lucide-react";
import "../styles/auth-reference.css";

export default function AuthReferenceShell({
  children,
  wide = false,
  admin = false,
  title,
  subtitle,
  mode,
  onModeChange,
  error,
  footer,
}) {
  return (
    <main className="auth-reference">
      <Link className="auth-reference__brand" to={admin ? "/admin" : "/login"} aria-label="CallNexa home">
        <img src="/logo.png" alt="CallNexa" onError={(event) => { event.currentTarget.style.display = "none"; }} />
        <span className="auth-reference__brand-name">CallNexa</span>
      </Link>

      <section className={`auth-reference__card${wide ? " auth-reference__card--wide" : ""}`}>
        <div className="auth-reference__hero">
          <div className="auth-reference__hero-icon" aria-hidden="true">
            {admin ? <ShieldCheck size={23} strokeWidth={1.8} /> : mode === "register" ? <UserPlus size={23} strokeWidth={1.8} /> : <LogIn size={23} strokeWidth={1.8} />}
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {onModeChange && (
          <div className="auth-reference__mode-switch" role="tablist" aria-label="Authentication mode">
            <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => onModeChange("login")} role="tab" aria-selected={mode === "login"}>
              Sign In
            </button>
            <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => onModeChange("register")} role="tab" aria-selected={mode === "register"}>
              Create Account
            </button>
          </div>
        )}

        {error && <div className="auth-reference__error" role="alert">{error}</div>}
        {children}
        {footer}
      </section>
    </main>
  );
}

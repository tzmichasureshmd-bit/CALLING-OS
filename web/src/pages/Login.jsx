import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { sendOtp } from "../lib/firebase.js";

const TEAM_SIZES = ["1-5", "6-10", "11-25", "26-50", "51-100", "100+"];
const INDUSTRIES = ["IT & Software", "Sales & Marketing", "Real Estate", "Finance", "Healthcare", "Education", "Retail", "Other"];

export default function Login() {
  const [mode, setMode] = useState("login"); // login | register
  const [error, setError] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: mode === "register" ? 480 : 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--grad-brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <img src="/callos.svg" style={{ width: 24, height: 24 }} alt="CallNexa" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>CallNexa</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Sales Call Monitoring Platform</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "var(--bg-hover)", borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {["login", "register"].map((m) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
              flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer",
              fontSize: 13.5, fontWeight: 700,
              background: mode === m ? "var(--bg-card)" : "transparent",
              color: mode === m ? "var(--accent)" : "var(--text-muted)",
              boxShadow: mode === m ? "var(--shadow-sm)" : "none",
            }}>
              {m === "login" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: 28 }}>
          {error && (
            <div style={{ background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--danger)", marginBottom: 16 }}>
              {error}
            </div>
          )}
          {mode === "login"
            ? <LoginPanel setError={setError} />
            : <RegisterPanel setError={setError} />
          }
        </div>

      </div>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginPanel({ setError }) {
  const [tab, setTab] = useState("Email");
  const { login, loginWithGoogle, loginWithOtp } = useAuth();
  const navigate = useNavigate();
  const TABS = ["Email", "Phone OTP", "Google"];

  return (
    <>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Welcome back</h2>
      <div style={{ display: "flex", background: "var(--bg-hover)", borderRadius: 10, padding: 3, marginBottom: 22 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setError(""); }} style={{
            flex: 1, padding: "7px 4px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 600,
            background: tab === t ? "var(--bg-card)" : "transparent",
            color: tab === t ? "var(--accent)" : "var(--text-muted)",
          }}>{t}</button>
        ))}
      </div>
      {tab === "Email"     && <EmailForm    login={login}           navigate={navigate} setError={setError} />}
      {tab === "Phone OTP" && <OtpForm      loginWithOtp={loginWithOtp} navigate={navigate} setError={setError} />}
      {tab === "Google"    && <GoogleForm   loginWithGoogle={loginWithGoogle} navigate={navigate} setError={setError} />}
    </>
  );
}

// ── REGISTER ──────────────────────────────────────────────────────────────────
function RegisterPanel({ setError }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState({
    name: "", company_name: "", email: "", phone: "",
    team_size: "", industry: "", password: "", confirm: "",
  });

  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (f.password !== f.confirm) return setError("Passwords do not match");
    if (f.password.length < 8) return setError("Password must be at least 8 characters");
    setLoading(true);
    try {
      await register({ name: f.name, company_name: f.company_name, email: f.email, phone: f.phone, team_size: f.team_size, industry: f.industry, password: f.password });
      navigate("/");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Create your organization</h2>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 20 }}>Set up CallNexa for your company. You'll get a unique company code to share with your team.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Name</label>
            <input value={f.name} onChange={set("name")} placeholder="Your full name" required style={inp} />
          </div>
          <div>
            <label style={lbl}>Company Name</label>
            <input value={f.company_name} onChange={set("company_name")} placeholder="Acme Corp" required style={inp} />
          </div>
        </div>
        <div>
          <label style={lbl}>Email Address</label>
          <input type="email" value={f.email} onChange={set("email")} placeholder="admin@company.com" required style={inp} />
        </div>
        <div>
          <label style={lbl}>Contact Number</label>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ ...inp, width: 70, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🇮🇳 +91</div>
            <input value={f.phone} onChange={set("phone")} placeholder="98765 43210" style={{ ...inp, flex: 1 }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={lbl}>Team Size</label>
            <select value={f.team_size} onChange={set("team_size")} style={inp}>
              <option value="">Select team size</option>
              {TEAM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Industry</label>
            <select value={f.industry} onChange={set("industry")} style={inp}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label style={lbl}>Password</label>
          <input type="password" value={f.password} onChange={set("password")} placeholder="Min 8 chars, uppercase, number & special" required style={inp} />
          <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Must be at least 8 characters with uppercase, lowercase, number & special char.</p>
        </div>
        <div>
          <label style={lbl}>Confirm Password</label>
          <input type="password" value={f.confirm} onChange={set("confirm")} placeholder="Confirm password" required style={inp} />
        </div>
        <button type="submit" disabled={loading} style={btnPrimary}>
          {loading ? "Creating account…" : "Create Account & Get Company Code"}
        </button>
      </form>
    </>
  );
}

// ── Email ─────────────────────────────────────────────────────────────────────
function EmailForm({ login, navigate, setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    try { await login(email, password); navigate("/"); }
    catch (err) { setError(err.message || "Invalid email or password"); }
    finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" required style={inp} /></div>
      <div><label style={lbl}>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={inp} /></div>
      <button type="submit" disabled={loading} style={btnPrimary}>{loading ? "Signing in…" : "Sign In"}</button>
    </form>
  );
}

// ── OTP ───────────────────────────────────────────────────────────────────────
function OtpForm({ loginWithOtp, navigate, setError }) {
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  async function handleSend(e) {
    e.preventDefault(); setError(""); setSending(true);
    try { setConfirmation(await sendOtp(phone, "otp-send-btn")); }
    catch (err) { setError(err.message || "Failed to send OTP"); }
    finally { setSending(false); }
  }
  async function handleVerify(e) {
    e.preventDefault(); setError(""); setVerifying(true);
    try { await loginWithOtp(confirmation, otp); navigate("/"); }
    catch (err) { setError(err.message || "Invalid OTP"); }
    finally { setVerifying(false); }
  }
  return !confirmation ? (
    <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><label style={lbl}>Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" required style={inp} /><p style={{ fontSize: 11.5, color: "var(--text-dim)", marginTop: 4 }}>Include country code e.g. +91</p></div>
      <button id="otp-send-btn" type="submit" disabled={sending} style={btnPrimary}>{sending ? "Sending…" : "Send OTP"}</button>
    </form>
  ) : (
    <form onSubmit={handleVerify} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ background: "var(--success-soft)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "var(--success)" }}>OTP sent to {phone}</div>
      <div><label style={lbl}>Enter OTP</label><input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" maxLength={6} required style={{ ...inp, letterSpacing: 8, fontSize: 20, textAlign: "center" }} /></div>
      <button type="submit" disabled={verifying} style={btnPrimary}>{verifying ? "Verifying…" : "Verify & Sign In"}</button>
      <button type="button" onClick={() => setConfirmation(null)} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: 13, cursor: "pointer" }}>← Change number</button>
    </form>
  );
}

// ── Google ────────────────────────────────────────────────────────────────────
function GoogleForm({ loginWithGoogle, navigate, setError }) {
  const [loading, setLoading] = useState(false);
  async function handleGoogle() {
    setError(""); setLoading(true);
    try { await loginWithGoogle(); navigate("/"); }
    catch (err) { setError(err.message || "Google sign-in failed"); }
    finally { setLoading(false); }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", margin: 0 }}>Sign in with your Google account linked to this organization.</p>
      <button onClick={handleGoogle} disabled={loading} style={btnGoogle}>
        {loading ? "Signing in…" : (<><svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Continue with Google</>)}
      </button>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 };
const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box" };
const btnPrimary = { width: "100%", padding: "12px", borderRadius: 11, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const btnGoogle = { width: "100%", padding: "11px", borderRadius: 11, border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 };

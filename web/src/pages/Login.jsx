import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const TEAM_SIZES = ["1-5", "6-10", "11-25", "26-50", "51-100", "100+"];
const INDUSTRIES = ["IT & Software", "Sales & Marketing", "Real Estate", "Finance", "Healthcare", "Education", "Retail", "Other"];

export default function Login() {
  const [mode, setMode] = useState("login"); // login | register
  const [error, setError] = useState("");

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: mode === "register" ? 700 : 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <img src="/logo.png" alt="CallNexa" style={{ width: 44, height: 44, borderRadius: 12, objectFit: "contain" }} />
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

        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, padding: mode === "register" ? 36 : 28 }}>
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
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <>
      <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", marginBottom: 18 }}>Welcome back</h2>
      <EmailForm login={login} navigate={navigate} setError={setError} />
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
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>Create your organization</h2>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 5, marginBottom: 0 }}>Set up CallNexa for your company — you'll get a unique company code to share with your team.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Section 1 — Personal Info */}
        <div style={sectionWrap}>
          <div style={sectionHead}>
            <span style={sectionTitle}>Personal Info</span>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Full Name</label>
              <input value={f.name} onChange={set("name")} placeholder="John Doe" required style={inp} />
            </div>
            <div>
              <label style={lbl}>Email Address</label>
              <input type="email" value={f.email} onChange={set("email")} placeholder="admin@company.com" required style={inp} />
            </div>
          </div>
        </div>

        <div style={sep} />

        {/* Section 2 — Company Info */}
        <div style={sectionWrap}>
          <div style={sectionHead}>
            <span style={sectionTitle}>Company Info</span>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Company Name</label>
              <input value={f.company_name} onChange={set("company_name")} placeholder="Acme Corp" required style={inp} />
            </div>
            <div>
              <label style={lbl}>Contact Number</label>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ ...inp, width: 68, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5 }}>+91</div>
                <input value={f.phone} onChange={set("phone")} placeholder="98765 43210" style={{ ...inp, flex: 1 }} />
              </div>
            </div>
          </div>
          <div style={{ ...grid2, marginTop: 14 }}>
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
        </div>

        <div style={sep} />

        {/* Section 3 — Security */}
        <div style={sectionWrap}>
          <div style={sectionHead}>
            <span style={sectionTitle}>Security</span>
          </div>
          <div style={grid2}>
            <div>
              <label style={lbl}>Password</label>
              <input type="password" value={f.password} onChange={set("password")} placeholder="Min 8 characters" required style={inp} />
              <p style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 4 }}>Uppercase, lowercase, number & special char.</p>
            </div>
            <div>
              <label style={lbl}>Confirm Password</label>
              <input type="password" value={f.confirm} onChange={set("confirm")} placeholder="Repeat password" required style={inp} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ ...btnPrimary, marginTop: 8 }}>
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

const sectionWrap = { paddingTop: 20, paddingBottom: 20 };
const sectionHead = { display: "flex", alignItems: "center", gap: 8, marginBottom: 16 };
const sectionTitle = { fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" };
const sep = { height: 1, background: "var(--border)", margin: "0 0" };
const grid2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 };
const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 };
const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box" };
const btnPrimary = { width: "100%", padding: "12px", borderRadius: 11, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" };

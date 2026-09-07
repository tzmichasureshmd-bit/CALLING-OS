import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const { login }               = useAuth();
  const navigate                = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const user = await login(email, password);
      if (user?.role === "SUPER_ADMIN") {
        navigate("/superadmin");
      } else if (user?.role === "ADMIN") {
        navigate("/");
      } else {
        setError("Access denied. This portal is for admins only.");
      }
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: "var(--grad-brand)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <ShieldCheck size={30} color="#fff" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>
            Admin Portal
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            CallNexa · Restricted Access
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 18, padding: 28,
        }}>
          {error && (
            <div style={{
              background: "var(--danger-soft)", border: "1px solid var(--danger)",
              borderRadius: 8, padding: "10px 12px", fontSize: 13,
              color: "var(--danger)", marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>Email</label>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                required style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <input
                type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required style={inp}
              />
            </div>
            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? "Signing in…" : "Sign In to Admin"}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: "12px 14px", background: "var(--bg-hover)", borderRadius: 10 }}>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--text-secondary)" }}>Super Admin</strong> — sees all organizations<br />
              <strong style={{ color: "var(--text-secondary)" }}>Admin</strong> — manages their organization
            </div>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/login" style={{ fontSize: 12.5, color: "var(--text-muted)", textDecoration: "none" }}>
            ← Back to employee login
          </a>
        </div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 5 };
const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text-primary)", fontSize: 13.5, outline: "none", boxSizing: "border-box" };
const btnPrimary = { width: "100%", padding: "12px", borderRadius: 11, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" };

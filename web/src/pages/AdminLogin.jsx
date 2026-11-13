import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import AuthReferenceShell from "../components/AuthReferenceShell.jsx";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, logout } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (user?.role === "SUPER_ADMIN") {
        navigate("/superadmin");
      } else if (user?.role === "ADMIN") {
        navigate("/");
      } else {
        await logout();
        setError("Access denied. This portal is for admins only.");
      }
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthReferenceShell
      admin
      title="Admin sign in"
      subtitle="Manage your organization, team, and sales intelligence securely."
      error={error}
      footer={
        <>
          <div className="auth-reference__admin-note">
            <strong>Super Admin</strong> sees all organizations.<br />
            <strong>Admin</strong> manages one organization.
          </div>
          <p className="auth-reference__hint"><Link to="/login">← Back to regular sign in</Link></p>
        </>
      }
    >
      <form className="auth-reference__form" onSubmit={handleSubmit}>
        <div className="auth-reference__field">
          <label htmlFor="admin-email">Email</label>
          <div className="auth-reference__input-wrap">
            <Mail size={15} aria-hidden="true" />
            <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@company.com" autoComplete="email" required />
          </div>
        </div>
        <div className="auth-reference__field">
          <label htmlFor="admin-password">Password</label>
          <div className="auth-reference__input-wrap">
            <LockKeyhole size={15} aria-hidden="true" />
            <input id="admin-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required />
            <button type="button" className="auth-reference__input-action" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>
        <button className="auth-reference__submit" type="submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign In to Admin"}
          <ShieldCheck size={15} />
        </button>
      </form>
    </AuthReferenceShell>
  );
}

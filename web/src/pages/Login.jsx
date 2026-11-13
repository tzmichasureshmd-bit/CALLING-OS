import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness,
  Building2,
  Check,
  Eye,
  EyeOff,
  Mail,
  Phone,
  UserRound,
  UsersRound,
  LockKeyhole,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import AuthReferenceShell from "../components/AuthReferenceShell.jsx";

const TEAM_SIZES = ["1-5", "6-10", "11-25", "26-50", "51-100", "100+"];
const INDUSTRIES = ["IT & Software", "Sales & Marketing", "Real Estate", "Finance", "Healthcare", "Education", "Retail", "Other"];

export default function Login() {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
  }

  return (
    <AuthReferenceShell
      wide={mode === "register"}
      mode={mode}
      onModeChange={changeMode}
      title={mode === "login" ? "Sign in with email" : "Create your workspace"}
      subtitle={mode === "login" ? "Bring your calls, data, and team together in one place." : "Set up CallNexa for your organization and invite your team."}
      error={error}
      footer={
        <p className="auth-reference__hint">
          {mode === "login" ? (
            <>Need an admin account? <Link to="/admin">Open admin sign in</Link></>
          ) : (
            <>Already have an account? <button type="button" className="auth-reference__inline-button" onClick={() => changeMode("login")}>Sign in</button></>
          )}
        </p>
      }
    >
      {mode === "login" ? <SignInForm setError={setError} /> : <RegisterForm setError={setError} />}
    </AuthReferenceShell>
  );
}

function SignInForm({ setError }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-reference__form" onSubmit={handleSubmit}>
      <AuthField icon={Mail} label="Email">
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="your@email.com" autoComplete="email" required />
      </AuthField>
      <AuthField icon={LockKeyhole} label="Password">
        <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" autoComplete="current-password" required />
        <button type="button" className="auth-reference__input-action" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </AuthField>
      <button type="button" className="auth-reference__forgot" onClick={() => setError("Please contact your administrator to reset your password.")}>Forgot password?</button>
      <button className="auth-reference__submit" type="submit" disabled={loading}>
        {loading ? "Signing in…" : "Get Started"}
      </button>
    </form>
  );
}

function RegisterForm({ setError }) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fields, setFields] = useState({
    name: "", company_name: "", email: "", phone: "",
    team_size: "", industry: "", password: "", confirm: "",
  });

  function update(key) {
    return (event) => setFields((current) => ({ ...current, [key]: event.target.value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (fields.password !== fields.confirm) {
      setError("Passwords do not match");
      return;
    }
    if (fields.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: fields.name,
        company_name: fields.company_name,
        email: fields.email.trim(),
        phone: fields.phone,
        team_size: fields.team_size,
        industry: fields.industry,
        password: fields.password,
      });
      navigate("/");
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-reference__form" onSubmit={handleSubmit}>
      <div className="auth-reference__register-grid">
        <AuthField icon={UserRound} label="Full name">
          <input value={fields.name} onChange={update("name")} placeholder="John Doe" autoComplete="name" required />
        </AuthField>
        <AuthField icon={Building2} label="Company name">
          <input value={fields.company_name} onChange={update("company_name")} placeholder="Acme Corp" autoComplete="organization" required />
        </AuthField>
        <AuthField icon={Mail} label="Work email">
          <input type="email" value={fields.email} onChange={update("email")} placeholder="admin@company.com" autoComplete="email" required />
        </AuthField>
        <AuthField icon={Phone} label="Contact number">
          <input value={fields.phone} onChange={update("phone")} placeholder="98765 43210" autoComplete="tel" />
        </AuthField>
        <AuthField icon={UsersRound} label="Team size">
          <select value={fields.team_size} onChange={update("team_size")}>
            <option value="">Select team size</option>
            {TEAM_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </AuthField>
        <AuthField icon={BriefcaseBusiness} label="Industry">
          <select value={fields.industry} onChange={update("industry")}>
            <option value="">Select industry</option>
            {INDUSTRIES.map((industry) => <option key={industry} value={industry}>{industry}</option>)}
          </select>
        </AuthField>
        <AuthField icon={LockKeyhole} label="Password">
          <input type={showPassword ? "text" : "password"} value={fields.password} onChange={update("password")} placeholder="Minimum 8 characters" autoComplete="new-password" required />
          <button type="button" className="auth-reference__input-action" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </AuthField>
        <AuthField icon={LockKeyhole} label="Confirm password">
          <input type={showConfirm ? "text" : "password"} value={fields.confirm} onChange={update("confirm")} placeholder="Repeat password" autoComplete="new-password" required />
          <button type="button" className="auth-reference__input-action" onClick={() => setShowConfirm((visible) => !visible)} aria-label={showConfirm ? "Hide confirmation" : "Show confirmation"}>
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </AuthField>
      </div>
      <button className="auth-reference__submit" type="submit" disabled={loading}>
        {loading ? "Creating account…" : "Create Account"}
        {!loading && <Check size={15} />}
      </button>
    </form>
  );
}

function AuthField({ icon: Icon, label, children }) {
  return (
    <div className="auth-reference__field">
      <label>{label}</label>
      <div className="auth-reference__input-wrap">
        <Icon size={15} aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

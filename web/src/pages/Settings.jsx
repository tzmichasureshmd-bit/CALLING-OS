import { useState } from "react";
import { Building2, User, Palette, Bell, Shield, Sun, Moon, X, Copy, Check, Loader } from "lucide-react";
import { PageContainer, Card, CardHeader, Button, Badge, LoadingState, ErrorState } from "../components/ui.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { dataSource } from "../api/dataSource.js";
import { useResource } from "../api/useResource.js";
import { twoFaApi } from "../api/resources.js";

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)", fontSize: 13.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 44, height: 24, borderRadius: 999, border: "none", cursor: "pointer", background: on ? "var(--accent)" : "var(--border-strong)", position: "relative", transition: "background 0.2s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "var(--shadow-sm)" }} />
    </button>
  );
}

// ── 2FA Modal ─────────────────────────────────────────────────────────────────
function TwoFAModal({ user, onClose, onSuccess }) {
  const isEnabled = user?.totp_enabled;
  // steps: "intro" | "qr" | "verify" | "done" | "disable"
  const [step, setStep] = useState(isEnabled ? "disable" : "intro");
  const [qrData, setQrData]   = useState(null);
  const [secret, setSecret]   = useState("");
  const [code, setCode]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  async function handleSetup() {
    setLoading(true); setError("");
    try {
      const res = await twoFaApi.setup();
      setQrData(res.qr);
      setSecret(res.secret);
      setStep("qr");
    } catch (e) { setError(e.message || "Failed to generate QR code"); }
    finally { setLoading(false); }
  }

  async function handleVerify() {
    if (code.length !== 6) { setError("Enter the 6-digit code from Google Authenticator"); return; }
    setLoading(true); setError("");
    try {
      await twoFaApi.verify(code);
      setStep("done");
      onSuccess(true);
    } catch (e) { setError(e.message || "Invalid code. Try again."); }
    finally { setLoading(false); }
  }

  async function handleDisable() {
    if (code.length !== 6) { setError("Enter the 6-digit code to confirm"); return; }
    setLoading(true); setError("");
    try {
      await twoFaApi.disable(code);
      onSuccess(false);
      onClose();
    } catch (e) { setError(e.message || "Invalid code."); }
    finally { setLoading(false); }
  }

  function copySecret() {
    navigator.clipboard?.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputStyle = {
    width: "100%", padding: "10px 14px", borderRadius: 10,
    border: "1px solid var(--border)", background: "var(--bg-input)",
    color: "var(--text-primary)", fontSize: 22, fontWeight: 700,
    letterSpacing: 8, textAlign: "center", outline: "none",
    fontFamily: "Space Grotesk", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: 420, background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", overflow: "hidden", animation: "nova-scale-in 0.18s ease" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Shield size={17} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>
                {isEnabled ? "Disable 2FA" : "Enable 2FA"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Google Authenticator</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "var(--bg-hover)", color: "var(--text-muted)", cursor: "pointer", width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "20px" }}>

          {/* STEP: intro */}
          {step === "intro" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Two-factor authentication adds an extra layer of security. After enabling, you'll need your password <strong>and</strong> a 6-digit code from Google Authenticator to sign in.
              </p>
              <div style={{ background: "var(--bg-hover)", borderRadius: 12, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {["Install Google Authenticator on your phone", "Scan the QR code we generate", "Enter the 6-digit code to confirm"].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--grad-brand)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s}</span>
                  </div>
                ))}
              </div>
              {error && <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-soft)", padding: "8px 12px", borderRadius: 8 }}>{error}</div>}
              <button onClick={handleSetup} disabled={loading} style={{ padding: "11px", borderRadius: 11, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? <Loader size={15} style={{ animation: "nova-spin 0.8s linear infinite" }} /> : null}
                {loading ? "Generating..." : "Get Started →"}
              </button>
            </div>
          )}

          {/* STEP: qr */}
          {step === "qr" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
                Open <strong>Google Authenticator</strong> → tap <strong>+</strong> → <strong>Scan QR code</strong>
              </p>
              {qrData && (
                <div style={{ padding: 12, background: "#fff", borderRadius: 14, boxShadow: "var(--shadow-md)" }}>
                  <img src={qrData} alt="2FA QR Code" style={{ width: 200, height: 200, display: "block" }} />
                </div>
              )}
              <div style={{ width: "100%", background: "var(--bg-hover)", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>Can't scan? Enter this key manually:</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk", letterSpacing: 1 }}>{secret}</div>
                </div>
                <button onClick={copySecret} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--accent)", flexShrink: 0 }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
              <button onClick={() => { setStep("verify"); setError(""); }} style={{ width: "100%", padding: "11px", borderRadius: 11, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                I've scanned it →
              </button>
            </div>
          )}

          {/* STEP: verify */}
          {step === "verify" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.6 }}>
                Enter the <strong>6-digit code</strong> shown in Google Authenticator to confirm setup.
              </p>
              <input
                style={inputStyle}
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                autoFocus
              />
              {error && <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-soft)", padding: "8px 12px", borderRadius: 8, textAlign: "center" }}>{error}</div>}
              <button onClick={handleVerify} disabled={loading || code.length !== 6} style={{ padding: "11px", borderRadius: 11, border: "none", background: code.length === 6 ? "var(--grad-brand)" : "var(--border)", color: code.length === 6 ? "#fff" : "var(--text-muted)", fontSize: 14, fontWeight: 700, cursor: code.length === 6 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
                {loading ? <Loader size={15} style={{ animation: "nova-spin 0.8s linear infinite" }} /> : null}
                {loading ? "Verifying..." : "Verify & Enable"}
              </button>
              <button onClick={() => setStep("qr")} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12.5, cursor: "pointer", textAlign: "center" }}>← Back to QR code</button>
            </div>
          )}

          {/* STEP: done */}
          {step === "done" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0" }}>
              <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--success-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Shield size={28} color="var(--success)" />
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "Space Grotesk" }}>2FA Enabled!</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6, lineHeight: 1.6 }}>Your account is now protected with Google Authenticator. You'll need your code every time you sign in.</div>
              </div>
              <button onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 11, border: "none", background: "var(--grad-brand)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Done</button>
            </div>
          )}

          {/* STEP: disable */}
          {step === "disable" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Enter the current 6-digit code from <strong>Google Authenticator</strong> to disable 2FA.
              </p>
              <input
                style={inputStyle}
                placeholder="000000"
                maxLength={6}
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "")); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleDisable()}
                autoFocus
              />
              {error && <div style={{ fontSize: 12.5, color: "var(--danger)", background: "var(--danger-soft)", padding: "8px 12px", borderRadius: 8, textAlign: "center" }}>{error}</div>}
              <button onClick={handleDisable} disabled={loading || code.length !== 6} style={{ padding: "11px", borderRadius: 11, border: "none", background: code.length === 6 ? "var(--danger)" : "var(--border)", color: code.length === 6 ? "#fff" : "var(--text-muted)", fontSize: 14, fontWeight: 700, cursor: code.length === 6 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
                {loading ? <Loader size={15} style={{ animation: "nova-spin 0.8s linear infinite" }} /> : null}
                {loading ? "Disabling..." : "Disable 2FA"}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Settings Page ─────────────────────────────────────────────────────────────
export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const { user, setUser } = useAuth();
  const { loading, error, data, reload } = useResource(() => dataSource.getOrganization());
  const [show2FA, setShow2FA] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(!!user?.totp_enabled);

  if (loading) return <PageContainer><Card><LoadingState message="Loading settings..." /></Card></PageContainer>;
  if (error) return <PageContainer><Card><ErrorState title="Couldn't load settings" message={error.message} code={error.error_code} onRetry={reload} /></Card></PageContainer>;

  const org = data || {};
  const initials = (user?.name || user?.email || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  function handle2FASuccess(enabled) {
    setTotpEnabled(enabled);
    if (setUser) setUser((u) => ({ ...u, totp_enabled: enabled }));
  }

  return (
    <PageContainer>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="callos-grid-2">
        <Card>
          <CardHeader icon={Building2} title="Organization" subtitle="Company account details" />
          <Row label="Company Name" value={org.name || "—"} />
          <Row label="Company Code" value={<Badge tone="accent">{org.companyCode || org.company_code || "—"}</Badge>} />
          <Row label="Admin" value={org.admin?.name || user?.name || "—"} />
          <Row label="Admin Email" value={org.admin?.email || user?.email || "—"} />
        </Card>

        <Card>
          <CardHeader icon={Palette} title="Appearance" subtitle="Theme preferences" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {theme === "light" ? <Sun size={18} color="var(--warning)" /> : <Moon size={18} color="var(--accent)" />}
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Dark mode</span>
            </div>
            <Toggle on={theme === "dark"} onClick={toggleTheme} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Bell size={18} color="var(--text-muted)" />
              <span style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>Email notifications</span>
            </div>
            <Toggle on onClick={() => {}} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={User} title="Profile" subtitle="Your account" />
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800 }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{user?.name || "—"}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{user?.email || "—"}</div>
            </div>
          </div>
          <Button variant="outline">Edit Profile</Button>
        </Card>

        <Card>
          <CardHeader icon={Shield} title="Security" subtitle="Account protection" />
          <Row
            label="Two-factor authentication"
            value={<Badge tone={totpEnabled ? "success" : "warning"}>{totpEnabled ? "Enabled" : "Off"}</Badge>}
          />
          <Row label="Password" value="Last changed 20 days ago" />

          {/* 2FA detail block */}
          <div style={{ marginTop: 14, padding: "14px", background: "var(--bg-hover)", borderRadius: 12, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <img src="https://www.gstatic.com/images/branding/product/2x/authenticator_48dp.png" alt="Google Authenticator" style={{ width: 28, height: 28, borderRadius: 6 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>Google Authenticator</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {totpEnabled ? "Active — your account is protected" : "Scan a QR code to link your authenticator app"}
                </div>
              </div>
            </div>
            {!totpEnabled && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>
                Install <strong style={{ color: "var(--text-secondary)" }}>Google Authenticator</strong> from the{" "}
                <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Play Store</a>{" "}or{" "}
                <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>App Store</a>, then click Enable below.
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="outline">Change Password</Button>
            <Button variant={totpEnabled ? "danger" : "soft"} onClick={() => setShow2FA(true)}>
              {totpEnabled ? "Disable 2FA" : "Enable 2FA"}
            </Button>
          </div>
        </Card>
      </div>

      {show2FA && (
        <TwoFAModal
          user={{ ...user, totp_enabled: totpEnabled }}
          onClose={() => setShow2FA(false)}
          onSuccess={handle2FASuccess}
        />
      )}
    </PageContainer>
  );
}

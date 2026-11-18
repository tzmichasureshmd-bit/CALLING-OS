import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const sections = [
  {
    icon: "👋",
    title: "Welcome — We Keep It Simple",
    content: `At CallNexa, we believe privacy policies should be easy to understand — not a wall of legal text. This policy explains exactly what data we collect, why we collect it, and how we protect it. We built CallNexa for sales teams, and we take your trust seriously.

Last updated: November 2026 · Applies to: CallNexa Android App & Web Dashboard (callnexa.in)`
  },
  {
    icon: "📋",
    title: "Who We Are",
    content: `CallNexa is a sales call monitoring platform developed by Tzmicha IT Solutions. We help businesses track, analyse, and improve their sales team's call activity.

Contact us anytime at: privacy@callnexa.in`
  },
  {
    icon: "📱",
    title: "What Data We Collect",
    subsections: [
      {
        label: "Account Information",
        text: "When you register, we collect your name, email address, and password (stored securely as a hash — we never see your actual password). For organisations, we also collect a company name and generate a unique company code."
      },
      {
        label: "Call Logs",
        text: "The CallNexa Android app reads your device's call history — including phone numbers, call direction (incoming/outgoing/missed), call duration, date and time, and the SIM slot used. This is the core feature of the app. Call data is uploaded to our servers so your manager can view team-wide analytics."
      },
      {
        label: "Call Recordings",
        text: "If you enable call recording, the app captures audio from your calls and uploads the recording file to secure cloud storage (Supabase). Recordings are only accessible to authorised users within your organisation. You can disable recording at any time in Settings."
      },
      {
        label: "SIM & Device Information",
        text: "We collect SIM card details (carrier name, slot number, subscription ID) to correctly attribute calls to the right SIM. We also collect basic device information (model, OS version, device ID) for device health monitoring."
      },
      {
        label: "Location",
        text: "We request location permission to detect your network and SIM information more accurately. We do not track your real-time GPS location or store location history."
      },
      {
        label: "Push Notification Tokens",
        text: "We collect your device's FCM (Firebase Cloud Messaging) token to send you notifications about call syncs, recording uploads, and transcription completions. You can disable notifications in your device settings."
      },
      {
        label: "AI Transcription Data",
        text: "If transcription is enabled, call recordings are sent to OpenAI's API for speech-to-text processing. OpenAI processes the audio and returns a text transcript. We do not use your recordings to train AI models."
      }
    ]
  },
  {
    icon: "🎯",
    title: "Why We Collect This Data",
    content: `We only collect data that is necessary to provide the CallNexa service:

• Call logs → to show managers their team's call activity and analytics
• Recordings → to provide AI-powered call summaries and transcripts
• Device & SIM info → to correctly sync calls and monitor device health
• Account info → to authenticate users and manage organisations
• Push tokens → to notify you of important sync and upload events

We do not sell your data. We do not use your data for advertising.`
  },
  {
    icon: "🔒",
    title: "How We Protect Your Data",
    content: `Security is built into every layer of CallNexa:

• All data is transmitted over HTTPS (TLS encryption)
• Passwords are hashed using bcrypt — never stored in plain text
• Authentication uses JWT tokens with short expiry windows
• Call recordings are stored in private Supabase cloud storage buckets
• Access to recordings requires a valid authentication token
• Our backend runs on a secured VPS with restricted access
• Database connections use SSL encryption`
  },
  {
    icon: "🤝",
    title: "Who We Share Data With",
    subsections: [
      {
        label: "Supabase",
        text: "We use Supabase (PostgreSQL) as our database and file storage provider. Your call data, account information, and recordings are stored on Supabase infrastructure. Supabase is SOC 2 compliant."
      },
      {
        label: "OpenAI",
        text: "If transcription is enabled, call recordings are sent to OpenAI for processing. OpenAI's data usage policies apply. We do not share personally identifiable information beyond what is necessary for transcription."
      },
      {
        label: "Firebase (Google)",
        text: "We use Firebase for push notifications and optional Google Sign-In. Firebase may collect device identifiers as part of its notification service."
      },
      {
        label: "No Other Third Parties",
        text: "We do not share your data with advertisers, data brokers, or any other third parties. We do not sell your data under any circumstances."
      }
    ]
  },
  {
    icon: "⏱️",
    title: "How Long We Keep Your Data",
    content: `• Account data: retained while your account is active
• Call logs: retained while your organisation subscription is active
• Call recordings: retained for up to 90 days by default (configurable by your organisation admin)
• Transcripts: retained alongside call records
• Device tokens: updated on each login, removed on logout

When an organisation account is deleted, all associated data including call logs, recordings, and employee accounts is permanently deleted within 30 days.`
  },
  {
    icon: "✅",
    title: "Your Rights & Choices",
    content: `You have the right to:

• Access the data we hold about you — contact privacy@callnexa.in
• Request correction of inaccurate data
• Request deletion of your account and all associated data
• Disable call recording at any time in the app Settings
• Disable push notifications in your device Settings
• Export your call data (contact your organisation admin)

To delete your account, go to Settings → Sign Out, then email privacy@callnexa.in with your request. We will process deletion within 30 days.`
  },
  {
    icon: "👶",
    title: "Children's Privacy",
    content: `CallNexa is a professional business tool intended for adults (18+). We do not knowingly collect data from anyone under 18 years of age. If you believe a minor has created an account, please contact us at privacy@callnexa.in and we will delete the account immediately.`
  },
  {
    icon: "🌍",
    title: "International Users",
    content: `CallNexa is operated from India. If you are accessing CallNexa from outside India, your data may be transferred to and processed in India or other countries where our service providers operate (including the United States for Supabase and OpenAI). By using CallNexa, you consent to this transfer.`
  },
  {
    icon: "🔄",
    title: "Changes to This Policy",
    content: `We may update this privacy policy from time to time. When we make significant changes, we will notify you through the app or by email. The "Last updated" date at the top of this page will always reflect the most recent version. Continued use of CallNexa after changes means you accept the updated policy.`
  },
  {
    icon: "📬",
    title: "Contact Us",
    content: `Have a question about your privacy? We're here to help.

Email: privacy@callnexa.in
Website: https://callnexa.in
Company: Tzmicha IT Solutions

We aim to respond to all privacy enquiries within 5 business days.`
  }
];

export default function PrivacyPolicy() {
  return (
    <main style={{ minHeight: "100vh", background: "#07191c", color: "#eaf2ec", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Nav */}
      <nav style={{ borderBottom: "1px solid rgba(220,240,232,.1)", padding: "18px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 900, margin: "0 auto" }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ddbd2", textDecoration: "none", fontSize: 14 }}>
          <ArrowLeft size={16} /> Back to CallNexa
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#9ddbd2", fontSize: 13 }}>
          <ShieldCheck size={16} />
          Privacy Policy
        </div>
      </nav>

      <div style={{ maxWidth: 780, margin: "0 auto", padding: "48px 32px 80px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "rgba(157,219,210,.12)", border: "1px solid rgba(157,219,210,.25)", marginBottom: 20 }}>
            <ShieldCheck size={28} color="#9ddbd2" />
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: -1, margin: "0 0 12px", color: "#f1f6f2" }}>
            Privacy Policy
          </h1>
          <p style={{ color: "rgba(220,240,232,.55)", fontSize: 15, margin: 0 }}>
            CallNexa · Tzmicha IT Solutions · Last updated November 2026
          </p>
        </div>

        {/* Intro banner */}
        <div style={{ background: "rgba(157,219,210,.08)", border: "1px solid rgba(157,219,210,.2)", borderRadius: 14, padding: "20px 24px", marginBottom: 40, display: "flex", gap: 14, alignItems: "flex-start" }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <p style={{ margin: 0, color: "rgba(220,240,232,.8)", fontSize: 14, lineHeight: 1.7 }}>
            We wrote this policy in plain English so you can actually understand it. No legal jargon, no hidden surprises. If you have any questions, email us at <a href="mailto:privacy@callnexa.in" style={{ color: "#9ddbd2" }}>privacy@callnexa.in</a>.
          </p>
        </div>

        {/* Sections */}
        {sections.map((section, i) => (
          <div key={i} style={{ marginBottom: 40, borderBottom: "1px solid rgba(220,240,232,.08)", paddingBottom: 40 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#f1f6f2", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span>{section.icon}</span>
              {section.title}
            </h2>

            {section.content && (
              <p style={{ color: "rgba(220,240,232,.7)", fontSize: 14, lineHeight: 1.85, margin: 0, whiteSpace: "pre-line" }}>
                {section.content}
              </p>
            )}

            {section.subsections && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 4 }}>
                {section.subsections.map((sub, j) => (
                  <div key={j} style={{ background: "rgba(255,255,255,.03)", borderRadius: 10, padding: "16px 18px", borderLeft: "3px solid rgba(157,219,210,.35)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#9ddbd2", letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>
                      {sub.label}
                    </div>
                    <p style={{ margin: 0, color: "rgba(220,240,232,.7)", fontSize: 14, lineHeight: 1.8 }}>
                      {sub.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Footer */}
        <div style={{ textAlign: "center", paddingTop: 16 }}>
          <p style={{ color: "rgba(220,240,232,.35)", fontSize: 12 }}>
            © {new Date().getFullYear()} CallNexa · Tzmicha IT Solutions · <a href="mailto:privacy@callnexa.in" style={{ color: "#9ddbd2", textDecoration: "none" }}>privacy@callnexa.in</a>
          </p>
          <Link to="/" style={{ color: "#9ddbd2", fontSize: 13, textDecoration: "none" }}>← Back to callnexa.in</Link>
        </div>
      </div>
    </main>
  );
}

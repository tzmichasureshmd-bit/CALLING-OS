import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader, HowItWorks, Showcase, Analytics, FinalCta, Footer } from "./LandingPage.jsx";
import { AudioLines, BarChart3, PhoneCall, ShieldCheck, Sparkles, TrendingUp, Users, Zap, Clock, ArrowUpRight } from "lucide-react";

const ALL = [
  { Icon: PhoneCall, tag: "Core", title: "Call Log Sync", desc: "Inbound, outbound, missed, and rejected calls sync automatically from every employee device to the dashboard." },
  { Icon: Sparkles, tag: "AI", title: "AI Call Summaries", desc: "Every call gets an AI-generated summary with key discussion points, customer intent, and recommended follow-up actions." },
  { Icon: BarChart3, tag: "Analytics", title: "Analytics Dashboard", desc: "Visual KPIs, call volume charts, team leaderboards, and performance trends in one command centre." },
  { Icon: TrendingUp, tag: "Sales", title: "Pipeline Tracking", desc: "Connect call activity to sales opportunities and track how conversations move deals through the pipeline." },
  { Icon: Users, tag: "Management", title: "Team Management", desc: "Add employees, assign roles, manage company codes, and monitor individual performance from the web dashboard." },
  { Icon: ShieldCheck, tag: "Security", title: "Secure Recordings", desc: "Call recordings are encrypted in transit and at rest. Role-based access ensures only authorised users can listen." },
  { Icon: Clock, tag: "Analytics", title: "Duration Insights", desc: "Identify optimal call lengths and patterns. Understand which durations correlate with successful outcomes." },
  { Icon: Zap, tag: "Core", title: "Real-time Sync", desc: "Data flows from employee phones to the manager dashboard with minimal delay, keeping insights current." },
  { Icon: AudioLines, tag: "AI", title: "Conversation Context", desc: "Bring call activity and conversation context together so managers always have the full picture." },
];

function FeatureGrid() {
  return (
    <section className="co-section" style={{ paddingTop: 0 }}>
      <div className="co-container">
        <div className="co-feat-pg-grid">
          {ALL.map(({ Icon, tag, title, desc }, i) => (
            <motion.article
              key={title}
              className="co-feature-card"
              style={{ position: "relative" }}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.1 }}
              transition={{ duration: 0.55, delay: i * 0.07 }}
            >
              <span className="co-feature-icon"><Icon size={21} /></span>
              <span className="co-feat-tag">{tag}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
              <span className="co-feature-line" />
            </motion.article>
          ))}
        </div>
      </div>
      <style>{`
        .co-feat-pg-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
        .co-feat-tag { position:absolute; top:20px; right:20px; font-size:10px; font-weight:700; letter-spacing:.6px; color:var(--co-teal); background:rgba(123,217,208,.12); padding:3px 9px; border-radius:20px; }
        @media(max-width:900px){ .co-feat-pg-grid{ grid-template-columns:1fr 1fr !important; } }
        @media(max-width:560px){ .co-feat-pg-grid{ grid-template-columns:1fr !important; } }
      `}</style>
    </section>
  );
}

export default function FeaturesPage() {
  return (
    <main className="co-site">
      <PageHeader active="Features" kicker="ALL FEATURES" title={<>Everything your<br/><em>sales team needs.</>} sub="One platform to monitor, analyse, and improve every sales conversation." />
      <FeatureGrid />
      <HowItWorks />
      <Showcase />
      <Analytics />
      <section className="co-section co-features-cta">
        <div className="co-container" style={{ textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="co-eyebrow co-dark-eyebrow" style={{ justifyContent: "center" }}><span /> READY TO START</div>
            <h2 style={{ marginTop: 12 }}>See it in action.<br /><em>Start today.</em></h2>
            <p style={{ maxWidth: 420, margin: "16px auto 32px", color: "var(--co-muted)" }}>
              Get your team set up with CALL OS and start turning every call into a clear insight.
            </p>
            <Link to="/login" className="co-button-dark">
              Get Started <ArrowUpRight size={16} />
            </Link>
          </motion.div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

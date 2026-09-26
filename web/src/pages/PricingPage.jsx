import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader, Footer } from "./LandingPage.jsx";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";

const PLANS = [
  {
    kicker: "STARTER",
    name: "Get started free.",
    desc: "For small teams exploring CALL OS.",
    price: "Free",
    features: [
      "Up to 3 employees",
      "Call log sync",
      "Basic dashboard",
      "7-day call history",
      "Email support",
    ],
    cta: "Get Started",
    dark: false,
  },
  {
    kicker: "GROWTH",
    name: "Scale with your team.",
    desc: "For growing sales teams that need more.",
    price: "Contact Us",
    features: [
      "Unlimited employees",
      "AI call summaries",
      "Full analytics suite",
      "Call recordings and transcripts",
      "Opportunities pipeline",
      "Priority support",
    ],
    cta: "Contact Sales",
    dark: true,
  },
  {
    kicker: "ENTERPRISE",
    name: "Built around you.",
    desc: "For large organisations with custom needs.",
    price: "Custom",
    features: [
      "Everything in Growth",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise deployment",
      "Custom reporting",
    ],
    cta: "Talk to Us",
    dark: false,
  },
];

const FAQS = [
  { q: "How does CALL OS capture call data?", a: "The CALL OS mobile app reads the device call log and syncs data to the dashboard. Employees install the app, enter the company code, and grant the required permissions." },
  { q: "Does it work on all Android devices?", a: "Yes. The mobile app supports Android devices running Android 8 and above." },
  { q: "Is call recording stored securely?", a: "All recordings are encrypted in transit and at rest. Access is controlled by role-based permissions within your organisation." },
  { q: "Can managers see all employee calls?", a: "Yes. The web dashboard gives managers a complete view of all employee call activity, analytics, and AI summaries." },
  { q: "What is the company connect code?", a: "Each organisation gets a unique connect code. Employees enter this code in the mobile app to link their device to the company dashboard." },
];

function PlanCard({ plan, i }) {
  return (
    <motion.div
      className={plan.dark ? "co-plan-card-dark" : "co-plan-card-light"}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.55, delay: i * 0.1 }}
    >
      {plan.dark && <div className="co-plan-popular">MOST POPULAR</div>}
      <div className="co-plan-kicker">{plan.kicker}</div>
      <h3 className="co-plan-name">{plan.name}</h3>
      <p className="co-plan-desc">{plan.desc}</p>
      <div className="co-plan-price">{plan.price}</div>
      <ul className="co-plan-features">
        {plan.features.map((f) => (
          <li key={f}><Check size={14} /><span>{f}</span></li>
        ))}
      </ul>
      <Link to="/login" className={plan.dark ? "co-button-light co-plan-btn" : "co-button-dark co-plan-btn"}>
        {plan.cta} <ArrowUpRight size={15} />
      </Link>
    </motion.div>
  );
}

function FAQItem({ q, a, open, onClick }) {
  return (
    <button className={`co-faq-item ${open ? "is-open" : ""}`} onClick={onClick} aria-expanded={open}>
      <span className="co-faq-q">{q}<ChevronDown size={17} /></span>
      {open && <span className="co-faq-a">{a}</span>}
    </button>
  );
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="co-site">
      <PageHeader active="Pricing" kicker="PRICING" title={<>Clear value.<br/><em>Made for your team.</em></>} sub="Start free and scale as your team grows. Talk with us to find the right CALL OS setup." />

      {/* Plans */}
      <section className="co-section co-pricing-page">
        <div className="co-container">
          <div className="co-plans-grid">
            {PLANS.map((plan, i) => <PlanCard key={plan.kicker} plan={plan} i={i} />)}
          </div>
        </div>
      </section>

      {/* Compare */}
      <section className="co-section co-compare">
        <div className="co-container">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ marginBottom: 40 }}>
            <div className="co-eyebrow co-dark-eyebrow"><span /> COMPARE PLANS</div>
            <h2 style={{ marginTop: 12 }}>What is included<br /><em>in each plan.</em></h2>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }} className="co-compare-table">
            <div className="co-compare-head">
              <div>Feature</div>
              <div>Starter</div>
              <div>Growth</div>
              <div>Enterprise</div>
            </div>
            {[
              ["Call log sync", true, true, true],
              ["Basic dashboard", true, true, true],
              ["AI call summaries", false, true, true],
              ["Full analytics", false, true, true],
              ["Call recordings", false, true, true],
              ["Unlimited employees", false, true, true],
              ["Custom integrations", false, false, true],
              ["Dedicated support", false, false, true],
            ].map(([feat, s, g, e]) => (
              <div key={feat} className="co-compare-row">
                <div>{feat}</div>
                <div>{s ? <Check size={16} className="co-check-yes" /> : <span className="co-check-no">—</span>}</div>
                <div>{g ? <Check size={16} className="co-check-yes" /> : <span className="co-check-no">—</span>}</div>
                <div>{e ? <Check size={16} className="co-check-yes" /> : <span className="co-check-no">—</span>}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="co-section co-faq">
        <div className="co-container co-faq-grid">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <div className="co-eyebrow co-dark-eyebrow"><span /> GOOD TO KNOW</div>
            <h2 style={{ marginTop: 12 }}>A few things,<br /><em>made clear.</em></h2>
            <p style={{ marginTop: 16, color: "var(--co-muted)" }}>Have another question? Our team can help you find an answer.</p>
          </motion.div>
          <div className="co-faq-list">
            {FAQS.map((faq, i) => (
              <FAQItem key={faq.q} q={faq.q} a={faq.a} open={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="co-final">
        <div className="co-container co-final-inner">
          <div className="co-eyebrow"><span /> THE NEXT CONVERSATION STARTS HERE</div>
          <h2>Hear more.<br /><em>Move forward.</em></h2>
          <p>Bring a little more clarity to every call.</p>
          <Link to="/login" className="co-button-light">Get Started <ArrowUpRight size={16} /></Link>
        </div>
      </section>

      <Footer />

      <style>{`
        .co-plans-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; align-items:start; }
        @media(max-width:900px){ .co-plans-grid{ grid-template-columns:1fr !important; max-width:480px; } }

        .co-plan-card-light, .co-plan-card-dark {
          border-radius:20px; padding:36px 28px; position:relative; display:flex; flex-direction:column; gap:0;
        }
        .co-plan-card-light { background:var(--co-surface,#fff); border:1.5px solid var(--co-border,#e5e7e6); }
        .co-plan-card-dark { background:var(--co-night,#07191c); border:1.5px solid rgba(123,217,208,.25); }

        .co-plan-popular { position:absolute; top:-13px; left:50%; transform:translateX(-50%); background:var(--co-teal,#7bd9d0); color:var(--co-night,#07191c); font-size:10px; font-weight:800; padding:4px 16px; border-radius:20px; letter-spacing:.6px; white-space:nowrap; }
        .co-plan-kicker { font-size:11px; font-weight:800; letter-spacing:.8px; color:var(--co-teal,#7bd9d0); margin-bottom:10px; }
        .co-plan-name { font-size:22px; font-weight:800; margin:0 0 8px; color:inherit; }
        .co-plan-card-light .co-plan-name { color:var(--co-ink,#101b1d); }
        .co-plan-card-dark .co-plan-name { color:#fff; }
        .co-plan-desc { font-size:13px; color:var(--co-muted,#657170); margin:0 0 20px; }
        .co-plan-card-dark .co-plan-desc { color:rgba(255,255,255,.5); }
        .co-plan-price { font-size:40px; font-weight:800; letter-spacing:-1.5px; margin-bottom:24px; }
        .co-plan-card-light .co-plan-price { color:var(--co-ink,#101b1d); }
        .co-plan-card-dark .co-plan-price { color:#fff; }
        .co-plan-features { list-style:none; padding:0; margin:0 0 28px; display:flex; flex-direction:column; gap:11px; }
        .co-plan-features li { display:flex; align-items:center; gap:10px; font-size:14px; }
        .co-plan-card-light .co-plan-features li { color:var(--co-ink,#101b1d); }
        .co-plan-card-dark .co-plan-features li { color:rgba(255,255,255,.75); }
        .co-plan-features li svg { color:var(--co-teal,#7bd9d0); flex-shrink:0; }
        .co-plan-btn { display:flex; align-items:center; justify-content:center; gap:6px; margin-top:auto; }

        .co-compare-table { border:1.5px solid var(--co-border,#e5e7e6); border-radius:16px; overflow:hidden; }
        .co-compare-head, .co-compare-row { display:grid; grid-template-columns:2fr 1fr 1fr 1fr; }
        .co-compare-head { background:var(--co-night,#07191c); color:#fff; font-size:12px; font-weight:700; letter-spacing:.5px; }
        .co-compare-head > div, .co-compare-row > div { padding:14px 20px; }
        .co-compare-row { border-top:1px solid var(--co-border,#e5e7e6); font-size:14px; color:var(--co-ink,#101b1d); }
        .co-compare-row:nth-child(even) { background:rgba(123,217,208,.04); }
        .co-compare-row > div:not(:first-child) { display:flex; align-items:center; justify-content:center; }
        .co-check-yes { color:var(--co-teal,#7bd9d0); }
        .co-check-no { color:var(--co-muted,#657170); font-size:16px; }
        @media(max-width:600px){ .co-compare-head > div:nth-child(n+3), .co-compare-row > div:nth-child(n+3){ display:none; } .co-compare-head, .co-compare-row{ grid-template-columns:2fr 1fr 1fr; } }
      `}</style>
    </main>
  );
}

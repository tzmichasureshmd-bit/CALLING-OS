import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { PageHeader, Footer } from "./LandingPage.jsx";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";

const PRICING_TABLE = [
  { users: "5 Members", validity: "1 Year", regular: "₹17,500", offer: "60% off", diwali: "₹6,999 + GST*" },
  { users: "10 Members", validity: "1 Year", regular: "₹25,000", offer: "60% off", diwali: "₹9,999 + GST" },
  { users: "15 Members", validity: "1 Year", regular: "₹42,500", offer: "60% off", diwali: "₹16,999 + GST" },
  { users: "20 Members", validity: "1 Year", regular: "₹50,000", offer: "Special offer", diwali: "₹19,999 + GST" },
];

const PLANS = [
  {
    kicker: "STARTER",
    name: "5-10 Members",
    desc: "Perfect for small sales teams getting started.",
    price: "₹6,999 - ₹9,999",
    period: "per year + GST",
    features: [
      "Desktop + Mobile App",
      "Call log sync & recordings",
      "AI call summaries",
      "Basic analytics dashboard",
      "1 Year validity",
      "60% Diwali discount",
    ],
    cta: "Get Started",
    dark: false,
  },
  {
    kicker: "GROWTH",
    name: "15-20 Members",
    desc: "For growing teams that need full analytics.",
    price: "₹16,999 - ₹19,999",
    period: "per year + GST",
    features: [
      "Everything in Starter",
      "Full analytics suite",
      "Opportunities pipeline",
      "Call transcripts",
      "Priority support",
      "Special Diwali pricing",
    ],
    cta: "Contact Sales",
    dark: true,
  },
  {
    kicker: "ENTERPRISE",
    name: "50+ Members",
    desc: "Custom solutions for large organizations.",
    price: "Custom Pricing",
    period: "talk to us",
    features: [
      "Everything in Growth",
      "Custom integrations",
      "Dedicated account manager",
      "SLA guarantee",
      "On-premise deployment",
      "White-label options",
    ],
    cta: "Talk to Us",
    dark: false,
  },
];

const FAQS = [
  { q: "How does CallNexa capture call data?", a: "The CallNexa mobile app reads the device call log and syncs data to the dashboard. Employees install the app, enter the company code, and grant the required permissions." },
  { q: "Does it work on all Android devices?", a: "Yes. The mobile app supports Android devices running Android 8 and above." },
  { q: "Is call recording stored securely?", a: "All recordings are encrypted in transit and at rest. Access is controlled by role-based permissions within your organisation." },
  { q: "Can managers see all employee calls?", a: "Yes. The web dashboard gives managers a complete view of all employee call activity, analytics, and AI summaries." },
  { q: "What is the company connect code?", a: "Each organisation gets a unique connect code. Employees enter this code in the mobile app to link their device to the company dashboard." },
  { q: "How long is the Diwali offer valid?", a: "The Diwali special pricing (60% off) is valid for a limited time. Contact us to lock in your discount before the offer expires." },
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
      <div className="co-plan-period">{plan.period}</div>
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
      <PageHeader active="Pricing" kicker="PRICING" title={<>Clear value.<br/><em>Made for your team.</em></>} sub="Start with our Diwali special offer. Desktop + Mobile App included for all plans." />

      {/* Plans */}
      <section className="co-section co-pricing-page">
        <div className="co-container">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.6 }}
            style={{ marginBottom: 32, textAlign: 'center' }}
          >
            <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
              Desktop + Mobile App
            </h2>
            <p style={{ fontSize: 15, color: 'var(--co-muted)' }}>1 Year Validity • Diwali Special Offer</p>
          </motion.div>

          {/* Pricing Table */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            whileInView={{ opacity: 1, y: 0 }} 
            viewport={{ once: true }} 
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ marginBottom: 48 }}
          >
            <div className="co-pricing-table">
              <div className="co-pricing-header">
                <div>Plan / Users</div>
                <div>Validity</div>
                <div>Regular Price</div>
                <div>Offer</div>
                <div>Diwali Offer Price</div>
              </div>
              {PRICING_TABLE.map((row, i) => (
                <div key={i} className="co-pricing-row">
                  <div><strong>{row.users}</strong></div>
                  <div>{row.validity}</div>
                  <div className="co-price-strike">{row.regular}</div>
                  <div className="co-price-offer">{row.offer}</div>
                  <div className="co-price-final">{row.diwali}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--co-muted)', marginTop: 12, textAlign: 'center' }}>
              * GST extra as applicable. Prices valid until stocks last.
            </p>
          </motion.div>

          {/* Feature Cards */}
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
        /* Pricing Table */
        .co-pricing-table { 
          border: 1.5px solid var(--co-border, #e5e7e6); 
          border-radius: 16px; 
          overflow: hidden; 
          background: var(--co-surface, #fff);
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        }
        .co-pricing-header, .co-pricing-row { 
          display: grid; 
          grid-template-columns: 1.5fr 1fr 1.2fr 1fr 1.5fr; 
          align-items: center;
        }
        .co-pricing-header { 
          background: var(--co-night, #07191c); 
          color: #fff; 
          font-size: 13px; 
          font-weight: 700; 
          letter-spacing: 0.3px; 
          padding: 16px 20px;
        }
        .co-pricing-row { 
          border-top: 1px solid var(--co-border, #e5e7e6); 
          font-size: 14px; 
          color: var(--co-ink, #101b1d); 
          padding: 16px 20px;
          transition: background 0.2s;
        }
        .co-pricing-row:hover { background: rgba(123, 217, 208, 0.05); }
        .co-pricing-row:nth-child(even) { background: rgba(123, 217, 208, 0.03); }
        .co-price-strike { 
          text-decoration: line-through; 
          color: var(--co-muted, #657170); 
          font-size: 13px;
        }
        .co-price-offer { 
          color: var(--co-teal, #7bd9d0); 
          font-weight: 700; 
          font-size: 13px;
        }
        .co-price-final { 
          color: var(--co-night, #07191c); 
          font-weight: 800; 
          font-size: 16px;
        }
        @media(max-width: 900px) { 
          .co-pricing-header, .co-pricing-row { 
            grid-template-columns: 1fr 1fr; 
            gap: 8px;
          }
          .co-pricing-header > div:nth-child(2),
          .co-pricing-header > div:nth-child(3),
          .co-pricing-header > div:nth-child(4),
          .co-pricing-row > div:nth-child(2),
          .co-pricing-row > div:nth-child(3),
          .co-pricing-row > div:nth-child(4) { display: none; }
          .co-pricing-header > div:first-child { grid-column: 1; }
          .co-pricing-header > div:last-child { grid-column: 2; }
        }

        /* Plan Cards */
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
        .co-plan-desc { font-size:13px; color:var(--co-muted,#657170); margin:0 0 12px; }
        .co-plan-card-dark .co-plan-desc { color:rgba(255,255,255,.5); }
        .co-plan-price { font-size:36px; font-weight:800; letter-spacing:-1.2px; margin-bottom:4px; line-height:1; }
        .co-plan-card-light .co-plan-price { color:var(--co-ink,#101b1d); }
        .co-plan-card-dark .co-plan-price { color:#fff; }
        .co-plan-period { font-size:12px; color:var(--co-muted,#657170); margin-bottom:20px; }
        .co-plan-card-dark .co-plan-period { color:rgba(255,255,255,.4); }
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

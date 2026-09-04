// ============================================================
// CALLOS mock data layer
// Mirrors the future backend model so widgets can later swap to:
//   GET /calls, GET /agents (employees), GET /leads, GET /opportunities
// Data model designed for the companion mobile app that reads each
// employee's phone call log and uploads records here.
// ============================================================

export const ORGANIZATION = {
  name: "Tzmicha IT Solutions",
  companyCode: "TZM-2026-5823",
  admin: {
    name: "Suresh Kumar",
    email: "tzmicha.sureshmd@gmail.com",
    initials: "SU",
  },
};

// --- Employees (agents / telecallers using the mobile app) ---
export const EMPLOYEES = [
  {
    id: "emp_1",
    name: "DANI EVENS",
    email: "DANIEVENS99@GMAIL.COM",
    mobile: "7731998508",
    registeredDate: "2026-09-01",
    workingHours: "00:01:49",
    nonWorkingHours: "07:58:11",
    lastCallTime: "2026-09-02T12:01:00",
    device: "V2303",
    sim: "SIM 1",
    status: "active",
    // aggregate stats
    calls: 11,
    connected: 1,
    connectedPct: 9,
    missed: 4,
    talkTimeSeconds: 109,
    repeatClients: 2,
  },
  {
    id: "emp_2",
    name: "SURESH KUMAR",
    email: "P.SURESHKUMAR048@GMAIL.COM",
    mobile: "8341551387",
    registeredDate: "2026-08-31",
    workingHours: "00:03:27",
    nonWorkingHours: "07:56:33",
    lastCallTime: "2026-09-02T10:35:00",
    device: "V2246",
    sim: "SIM 1",
    status: "active",
    calls: 18,
    connected: 9,
    connectedPct: 50,
    missed: 3,
    talkTimeSeconds: 620,
    repeatClients: 5,
  },
];

// --- Call logs (uploaded from employee phones) ---
// outcome: incoming | outgoing | missed | blocked | rejected
export const CALL_LOGS = [
  { id: "c1", date: "2026-09-02T12:01:00", type: "missed", phone: "+918037925617", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c2", date: "2026-09-02T11:46:00", type: "incoming", phone: "+919346947043", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 109, source: "SIM 1", device: "V2303", recordingUrl: "rec_c2.m4a" },
  { id: "c3", date: "2026-09-02T11:09:00", type: "missed", phone: "+917997994602", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c4", date: "2026-09-02T10:53:00", type: "blocked", phone: "+911409092724", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c5", date: "2026-09-02T10:42:00", type: "blocked", phone: "+917971641504", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c6", date: "2026-09-02T10:35:00", type: "outgoing", phone: "+919381470632", contact: "James hyd", employee: "SURESH KUMAR", durationSeconds: 0, source: "SIM 1", device: "V2246", recordingUrl: null },
  { id: "c7", date: "2026-09-02T10:15:00", type: "blocked", phone: "+918037716130", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c8", date: "2026-09-02T10:13:00", type: "blocked", phone: "+917971868737", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c9", date: "2026-09-02T10:13:00", type: "blocked", phone: "+911409091987", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c10", date: "2026-09-02T09:59:00", type: "outgoing", phone: "+919381470632", contact: "James hyd", employee: "SURESH KUMAR", durationSeconds: 0, source: "SIM 1", device: "V2246", recordingUrl: null },
  { id: "c11", date: "2026-09-02T09:43:00", type: "missed", phone: "+917316515810", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c12", date: "2026-09-02T08:57:00", type: "missed", phone: "+919971826065", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c13", date: "2026-09-02T06:34:00", type: "incoming", phone: "+919100670097", contact: "Kundan Ongl", employee: "SURESH KUMAR", durationSeconds: 207, source: "SIM 1", device: "V2246", recordingUrl: "rec_c13.m4a" },
  { id: "c14", date: "2026-09-02T00:28:00", type: "outgoing", phone: "+919494742784", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 0, source: "SIM 1", device: "V2303", recordingUrl: null },
  { id: "c15", date: "2026-09-01T23:37:00", type: "incoming", phone: "+917935048203", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 209, source: "SIM 1", device: "V2303", recordingUrl: "rec_c15.m4a" },
  { id: "c16", date: "2026-09-01T23:33:00", type: "incoming", phone: "+917935048203", contact: "Unknown", employee: "DANI EVENS", durationSeconds: 18, source: "SIM 1", device: "V2303", recordingUrl: "rec_c16.m4a" },
  { id: "c17", date: "2026-09-01T20:11:00", type: "outgoing", phone: "+917702059037", contact: "Tz. Harika_ramagari", employee: "SURESH KUMAR", durationSeconds: 234, source: "SIM 1", device: "V2246", recordingUrl: "rec_c17.m4a" },
  { id: "c18", date: "2026-09-01T18:02:00", type: "outgoing", phone: "+919347468445", contact: "Tz. Sai Kumar Nallabothula", employee: "SURESH KUMAR", durationSeconds: 1497, source: "SIM 1", device: "V2246", recordingUrl: "rec_c18.m4a" },
];

// --- Opportunities / Pipeline (derived leads from repeated connects) ---
export const OPPORTUNITIES = [
  { id: "o1", name: "Tz. Sai Kumar Nallabothula ( FS Developer)", phone: "+919347468445", connects: 2, talkTimeSeconds: 1497, lastContact: "Yesterday", status: "2+ New", hot: true },
  { id: "o2", name: "Amma (Yasodha). Sap", phone: "+917388866387", connects: 2, talkTimeSeconds: 970, lastContact: "Yesterday", status: "2+ New", hot: true },
  { id: "o3", name: "Tz. Harika_ramagari _ Hyd_Digital Marketing", phone: "+917702059037", connects: 2, talkTimeSeconds: 234, lastContact: "Yesterday", status: "2+ New", hot: true },
  { id: "o4", name: "Unknown", phone: "+917935048203", connects: 2, talkTimeSeconds: 227, lastContact: "Yesterday", status: "2+ New", hot: true },
  { id: "o5", name: "Tz. Narashimha. ( FS - Developer)", phone: "+917075476006", connects: 2, talkTimeSeconds: 158, lastContact: "Yesterday", status: "2+ New", hot: false },
  { id: "o6", name: "KONDA SASI KUMAR REDDY", phone: "+919182207851", connects: 1, talkTimeSeconds: 1654, lastContact: "Yesterday", status: "-", hot: false },
  { id: "o7", name: "chandrarao hyd", phone: "+917889720853", connects: 1, talkTimeSeconds: 357, lastContact: "Aug 31", status: "-", hot: false },
  { id: "o8", name: "Kundan Ongl", phone: "+919100670097", connects: 1, talkTimeSeconds: 207, lastContact: "Today", status: "-", hot: false },
  { id: "o9", name: "James hyd", phone: "+919381470632", connects: 1, talkTimeSeconds: 0, lastContact: "Yesterday", status: "-", hot: false },
];

// --- Weekly call metrics (last 7 days) for line chart ---
export const DAILY_METRICS = [
  { day: "Wed", total: 14, connected: 6, missed: 5 },
  { day: "Thu", total: 22, connected: 11, missed: 6 },
  { day: "Fri", total: 18, connected: 9, missed: 4 },
  { day: "Sat", total: 9, connected: 3, missed: 4 },
  { day: "Sun", total: 6, connected: 2, missed: 2 },
  { day: "Mon", total: 27, connected: 13, missed: 7 },
  { day: "Tue", total: 29, connected: 10, missed: 8 },
];

// --- Call outcome breakdown for stacked bar chart ---
export const OUTCOME_BREAKDOWN = [
  { day: "Wed", incoming: 5, outgoing: 6, missed: 3 },
  { day: "Thu", incoming: 8, outgoing: 9, missed: 5 },
  { day: "Fri", incoming: 6, outgoing: 8, missed: 4 },
  { day: "Sat", incoming: 3, outgoing: 4, missed: 2 },
  { day: "Sun", incoming: 2, outgoing: 3, missed: 1 },
  { day: "Mon", incoming: 10, outgoing: 11, missed: 6 },
  { day: "Tue", incoming: 11, outgoing: 10, missed: 8 },
];

// --- Duration distribution for donut chart ---
export const DURATION_DISTRIBUTION = [
  { name: "0-1 min", value: 42, color: "#94a3b8" },
  { name: "1-3 min", value: 28, color: "#6366f1" },
  { name: "3-5 min", value: 16, color: "#22c55e" },
  { name: "5+ min", value: 9, color: "#f59e0b" },
];

// --- Excluded phone numbers ---
export const EXCLUDED_NUMBERS = [
  { id: "ex1", number: "+911409092724", reason: "Spam / promotional", addedBy: "Suresh Kumar", date: "2026-08-30" },
  { id: "ex2", number: "+918037716130", reason: "Personal contact", addedBy: "Suresh Kumar", date: "2026-08-28" },
];

// --- Closed opportunities ---
export const CLOSED_OPPORTUNITIES = [
  { id: "co1", name: "Rahul Patel", phone: "+919812345678", employee: "SURESH KUMAR", value: "₹1,20,000", closedDate: "2026-08-29", outcome: "Won" },
  { id: "co2", name: "Ritika Mehta", phone: "+919898989898", employee: "DANI EVENS", value: "₹45,000", closedDate: "2026-08-27", outcome: "Won" },
  { id: "co3", name: "Mohit Vora", phone: "+917676767676", employee: "SURESH KUMAR", value: "—", closedDate: "2026-08-25", outcome: "Lost" },
];

// --- Invoices ---
export const INVOICES = [
  { id: "INV-2026-0009", period: "Sep 2026", users: 2, amount: "₹198.00", status: "Paid", date: "2026-09-01" },
  { id: "INV-2026-0008", period: "Aug 2026", users: 2, amount: "₹198.00", status: "Paid", date: "2026-08-01" },
  { id: "INV-2026-0007", period: "Jul 2026", users: 1, amount: "₹99.00", status: "Paid", date: "2026-07-01" },
];

// ============================================================
// Helpers
// ============================================================

export function formatTalkTime(seconds) {
  if (!seconds || seconds <= 0) return "0m 0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

// KPI aggregates for dashboard
export function getKpis() {
  const total = CALL_LOGS.length;
  const connected = CALL_LOGS.filter(
    (c) => c.durationSeconds > 0 && c.type !== "missed"
  ).length;
  const talkTime = CALL_LOGS.reduce((s, c) => s + c.durationSeconds, 0);
  const hotLeads = OPPORTUNITIES.filter((o) => o.hot).length;
  return {
    totalCalls: total,
    connected,
    connectedPct: total ? Math.round((connected / total) * 100) : 0,
    talkTimeSeconds: talkTime,
    hotLeads,
  };
}

export function getOpportunityBuckets() {
  return {
    twoPlus: OPPORTUNITIES.filter((o) => o.connects >= 2).length,
    threePlus: OPPORTUNITIES.filter((o) => o.connects >= 3).length,
    fivePlus: OPPORTUNITIES.filter((o) => o.connects >= 5).length,
    avgTalkTime: Math.round(
      OPPORTUNITIES.reduce((s, o) => s + o.talkTimeSeconds, 0) /
        (OPPORTUNITIES.length || 1)
    ),
  };
}

export function getTopPerformer() {
  return [...EMPLOYEES].sort((a, b) => b.connectedPct - a.connectedPct)[0];
}

export function getLeaderboard() {
  return [...EMPLOYEES]
    .sort((a, b) => b.calls - a.calls)
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

// ============================================================
// CALLOS NOVA — additional data for command-center features
// ============================================================

// Device health (from employee phones)
export const DEVICE_HEALTH = [
  { id: "d1", employee: "DANI EVENS", device: "Vivo V2303", android: "Android 14", appVersion: "1.4.2", battery: 45, lastSync: "2 min ago", permissions: { callLog: true, phoneState: true, contacts: true, recording: false }, sim: "SIM 1 · Airtel", background: "warning", status: "warning" },
  { id: "d2", employee: "SURESH KUMAR", device: "Vivo V2246", android: "Android 13", appVersion: "1.4.2", battery: 78, lastSync: "just now", permissions: { callLog: true, phoneState: true, contacts: true, recording: true }, sim: "SIM 1 · Jio", background: "ok", status: "healthy" },
];

// Needs Attention items (each links to a page)
export const NEEDS_ATTENTION = [
  { id: "n1", type: "hot_lead", severity: "high", title: "Hot lead without follow-up", detail: "Tz. Sai Kumar Nallabothula — 2 connects, no next action", to: "/leads" },
  { id: "n2", type: "overdue", severity: "high", title: "Follow-up overdue", detail: "Amma (Yasodha). Sap — due yesterday", to: "/leads" },
  { id: "n3", type: "permission", severity: "medium", title: "Recording permission disabled", detail: "DANI EVENS — Vivo V2303", to: "/device-health" },
  { id: "n4", type: "sync", severity: "medium", title: "Battery optimization warning", detail: "DANI EVENS — background sync may be delayed", to: "/device-health" },
];

// Live pulse feed (recent events)
export const LIVE_PULSE = [
  { id: "p1", time: "12:01", text: "Missed call from +91 8037925617", tone: "danger", employee: "DANI EVENS" },
  { id: "p2", time: "11:46", text: "Connected call · 1m 49s", tone: "success", employee: "DANI EVENS" },
  { id: "p3", time: "10:35", text: "Outgoing to James hyd", tone: "info", employee: "SURESH KUMAR" },
  { id: "p4", time: "06:34", text: "Connected call · 3m 27s", tone: "success", employee: "SURESH KUMAR" },
];

// Sales funnel
export const SALES_FUNNEL = [
  { stage: "Calls", value: 1284 },
  { stage: "Connected", value: 672 },
  { stage: "Conversations", value: 248 },
  { stage: "Follow-ups", value: 91 },
  { stage: "Hot Leads", value: 38 },
  { stage: "Opportunities", value: 12 },
  { stage: "Won", value: 4 },
];

// Leads
export const LEADS = [
  { id: "l1", name: "Tz. Sai Kumar Nallabothula", phone: "+919347468445", source: "Inbound call", employee: "SURESH KUMAR", status: "hot", priority: "High", lastContact: "Yesterday", nextFollowUp: "Today 4:00 PM", expectedValue: "₹1,20,000" },
  { id: "l2", name: "Amma (Yasodha). Sap", phone: "+917388866387", source: "Referral", employee: "SURESH KUMAR", status: "follow_up", priority: "High", lastContact: "Yesterday", nextFollowUp: "Overdue", expectedValue: "₹80,000" },
  { id: "l3", name: "Tz. Harika_ramagari", phone: "+917702059037", source: "Campaign", employee: "SURESH KUMAR", status: "interested", priority: "Medium", lastContact: "Yesterday", nextFollowUp: "Tomorrow", expectedValue: "₹45,000" },
  { id: "l4", name: "Kundan Ongl", phone: "+919100670097", source: "Inbound call", employee: "SURESH KUMAR", status: "contacted", priority: "Medium", lastContact: "Today", nextFollowUp: "—", expectedValue: "₹30,000" },
  { id: "l5", name: "chandrarao hyd", phone: "+917889720853", source: "Cold call", employee: "DANI EVENS", status: "new", priority: "Low", lastContact: "Aug 31", nextFollowUp: "—", expectedValue: "—" },
];

export const LEAD_STATUS_META = {
  new: { label: "New", tone: "neutral" },
  contacted: { label: "Contacted", tone: "info" },
  interested: { label: "Interested", tone: "violet" },
  follow_up: { label: "Follow-up", tone: "warning" },
  hot: { label: "Hot", tone: "danger" },
  qualified: { label: "Qualified", tone: "teal" },
  converted: { label: "Converted", tone: "success" },
  lost: { label: "Lost", tone: "neutral" },
};

// Opportunities (pipeline stages)
export const PIPELINE = [
  { id: "op1", lead: "Tz. Sai Kumar Nallabothula", customer: "FS Developer", employee: "SURESH KUMAR", value: 120000, probability: 0.6, stage: "Negotiation", closeDate: "Sep 15", nextAction: "Send proposal" },
  { id: "op2", lead: "Amma (Yasodha). Sap", customer: "SAP Consulting", employee: "SURESH KUMAR", value: 80000, probability: 0.4, stage: "Proposal", closeDate: "Sep 20", nextAction: "Follow-up call" },
  { id: "op3", lead: "Tz. Harika_ramagari", customer: "Digital Marketing", employee: "SURESH KUMAR", value: 45000, probability: 0.3, stage: "Qualified", closeDate: "Sep 28", nextAction: "Schedule demo" },
  { id: "op4", lead: "Kundan Ongl", customer: "Ongl Enterprises", employee: "SURESH KUMAR", value: 30000, probability: 0.2, stage: "New", closeDate: "Oct 5", nextAction: "Qualify need" },
];

export const PIPELINE_STAGES = ["New", "Qualified", "Proposal", "Negotiation", "Won", "Lost"];

// AI insight for a call (mock, clearly labeled non-authoritative)
export function getCallIntelligence(call) {
  return {
    aiScore: 84,
    interest: 91,
    sentiment: "Positive",
    summary: "Customer is interested but raised a pricing concern. Asked about payment flexibility and timeline.",
    objections: ["Pricing", "Decision timeline"],
    nextAction: "Follow up within 24 hours with a revised quote.",
    transcript: [
      { speaker: "Agent", text: "Hi, this is regarding your enquiry about our developer program." },
      { speaker: "Customer", text: "Yes, I'm interested but the pricing seems a bit high." },
      { speaker: "Agent", text: "I understand. We do have flexible monthly options." },
      { speaker: "Customer", text: "Okay, can you send me the details?" },
    ],
  };
}

// dataSource — all data from real backend API. No mock data.

import * as api from "./resources.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function relativeDate(iso) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function normalizeCall(c) {
  return {
    id: c.id,
    date: c.start_time,
    type: c.call_type,
    phone: c.phone_number,
    contact: c.contact_name || "Unknown",
    employee: c.employee_name || "—",
    durationSeconds: c.duration_seconds,
    source: c.source || "SIM 1",
    device: c.device_model || "—",
    recordingUrl: c.recording_url || null,
  };
}

function normalizeEmployee(e) {
  return {
    id: e.id,
    name: e.name,
    email: e.email || "—",
    mobile: e.phone || "—",
    registeredDate: e.created_at,
    workingHours: "—",
    nonWorkingHours: "—",
    lastCallTime: e.last_active_at || e.created_at,
    device: "—",
    sim: "SIM 1",
    status: e.status,
    calls: e.calls ?? 0,
    connected: e.connected ?? 0,
    connectedPct: e.connected_pct ?? 0,
    missed: e.missed ?? 0,
    talkTimeSeconds: e.talk_time_seconds ?? 0,
    repeatClients: 0,
  };
}

function normalizeDevice(d) {
  const perms = d.permissions_status || {};
  const allOk = perms.callLog && perms.phoneState && perms.contacts && perms.recording;
  const status = !d.is_online ? "offline" : !allOk ? "warning" : "healthy";
  const lastSeen = d.last_seen_at
    ? (() => {
        const diff = Date.now() - new Date(d.last_seen_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins} min ago`;
        return `${Math.floor(mins / 60)}h ago`;
      })()
    : "never";
  return {
    id: d.id,
    employee: d.employee_name || d.employee_id,
    device: d.model || "Unknown",
    android: d.android_version || "—",
    appVersion: d.app_version || "—",
    battery: d.battery_level ?? 0,
    lastSync: lastSeen,
    permissions: {
      callLog: !!perms.callLog,
      phoneState: !!perms.phoneState,
      contacts: !!perms.contacts,
      recording: !!perms.recording,
    },
    sim: "SIM 1",
    background: perms.background ? "ok" : "warning",
    status,
  };
}

function normalizeOpportunity(o) {
  return {
    id: o.id,
    name: o.name || o.lead,
    lead: o.name || o.lead,
    phone: o.phone || "—",
    customer: o.customer || "—",
    employee: o.employee || "—",
    employee_id: o.employee_id,
    stage: o.stage || "New",
    value: o.value || 0,
    probability: o.probability || 0,
    closeDate: o.close_date ? new Date(o.close_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—",
    nextAction: o.next_action || "—",
    connects: o.connects || 1,
    talkTimeSeconds: o.talk_time_seconds || 0,
    lastContact: relativeDate(o.last_contact_at),
    status: o.stage !== "New" ? o.stage : "-",
    hot: (o.connects || 1) >= 2,
    outcome: o.is_closed === "won" ? "Won" : o.is_closed === "lost" ? "Lost" : null,
    closedDate: o.closed_at,
  };
}

function normalizeLead(l) {
  return {
    id: l.id,
    name: l.name,
    phone: l.phone,
    source: l.source || "—",
    employee: l.employee || "—",
    employee_id: l.employee_id,
    status: l.status || "new",
    priority: l.priority || "Medium",
    expectedValue: l.expected_value || "—",
    nextFollowUp: l.next_follow_up
      ? (() => {
          const d = new Date(l.next_follow_up);
          return d < new Date() ? "Overdue" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
        })()
      : "—",
    lastContact: relativeDate(l.last_contact_at),
    notes: l.notes || "",
  };
}

function buildDashboard(analytics, devices) {
  const lb = (analytics.leaderboard || []).map((e, i) => ({
    id: e.id, name: e.name, rank: e.rank || i + 1,
    calls: e.calls, connected: e.connected,
    connectedPct: e.connected_pct ?? 0,
    missed: e.missed,
    talkTimeSeconds: e.talk_time_seconds ?? 0,
    repeatClients: 0,
  }));
  const kpis = analytics.kpis || {};
  const top = lb[0] || { name: "—", calls: 0, connected: 0, connectedPct: 0, missed: 0, talkTimeSeconds: 0, repeatClients: 0 };
  return {
    kpis: {
      totalCalls: kpis.total_calls ?? 0,
      connected: kpis.connected ?? 0,
      connectedPct: kpis.connected_pct ?? 0,
      talkTimeSeconds: kpis.talk_time_seconds ?? 0,
      hotLeads: kpis.hot_leads ?? 0,
    },
    topPerformer: top,
    leaderboard: lb,
    opportunities: [],
    dailyMetrics: (analytics.daily_metrics || []).map((d) => ({ day: d.day, total: d.total, connected: d.connected, missed: d.missed })),
    outcomeBreakdown: (analytics.outcome_breakdown || []).map((d) => ({ day: d.day, incoming: d.incoming, outgoing: d.outgoing, missed: d.missed })),
    durationDistribution: (analytics.duration_distribution || []).map((d) => ({ name: d.name, value: d.value, color: d.color })),
    deviceHealth: devices,
    needsAttention: [],
    livePulse: [],
    salesFunnel: [],
  };
}

// ── dataSource ────────────────────────────────────────────────────────────────

export const dataSource = {

  getOrganization: () => api.organizationApi.current(),

  getDashboard: async () => {
    const [analytics, devicesRes, oppsRes, attentionRes, pulseRes] = await Promise.all([
      api.analyticsApi.dashboard(),
      api.devicesApi.list().catch(() => []),
      api.opportunitiesApi.list({ closed: false, page_size: 20 }).catch(() => ({ items: [] })),
      api.analyticsApi.needsAttention().catch(() => ({ items: [] })),
      api.analyticsApi.livePulse().catch(() => ({ items: [] })),
    ]);
    const devices = (Array.isArray(devicesRes) ? devicesRes : devicesRes?.items || []).map(normalizeDevice);
    const opps = (oppsRes?.items || []).map(normalizeOpportunity);
    const dash = buildDashboard(analytics, devices);
    dash.opportunities = opps;
    dash.needsAttention = attentionRes.items || [];
    dash.livePulse = (pulseRes.items || []).map((p, i) => ({ ...p, id: p.id || i }));
    return dash;
  },

  getDeviceHealth: async () => {
    const res = await api.devicesApi.list();
    return { items: (Array.isArray(res) ? res : res?.items || []).map(normalizeDevice) };
  },

  getLeads: async () => {
    const res = await api.leadsApi.list();
    return { items: (res.items || []).map(normalizeLead) };
  },

  getPipeline: async () => {
    const res = await api.opportunitiesApi.list({ closed: false });
    return { items: (res.items || []).map(normalizeOpportunity), funnel: [] };
  },

  getAnalytics: async () => {
    const res = await api.analyticsApi.dashboard();
    return {
      dailyMetrics: (res.daily_metrics || []).map((d) => ({ day: d.day, total: d.total, connected: d.connected, missed: d.missed })),
      outcomeBreakdown: (res.outcome_breakdown || []).map((d) => ({ day: d.day, incoming: d.incoming, outgoing: d.outgoing, missed: d.missed })),
      durationDistribution: (res.duration_distribution || []).map((d) => ({ name: d.name, value: d.value, color: d.color })),
      funnel: [],
      leaderboard: (res.leaderboard || []).map((e, i) => ({
        id: e.id, name: e.name, rank: e.rank || i + 1,
        calls: e.calls, connected: e.connected,
        connectedPct: e.connected_pct ?? 0,
        missed: e.missed,
        talkTimeSeconds: e.talk_time_seconds ?? 0,
      })),
    };
  },

  getEmployees: async (params) => {
    const res = await api.employeesApi.list(params);
    return { items: (res.items || []).map(normalizeEmployee), total: res.total || 0 };
  },

  getCalls: async (params) => {
    const res = await api.callsApi.list(params);
    return { items: (res.items || []).map(normalizeCall), total: res.total || 0 };
  },

  getOpportunities: async () => {
    const res = await api.opportunitiesApi.list({ closed: false });
    return { items: (res.items || []).map(normalizeOpportunity) };
  },

  getClosedOpportunities: async () => {
    const res = await api.opportunitiesApi.list({ closed: true });
    return {
      items: (res.items || []).map((o) => ({
        ...normalizeOpportunity(o),
        outcome: o.is_closed === "won" ? "Won" : "Lost",
        value: o.value ? `₹${Number(o.value).toLocaleString("en-IN")}` : "—",
        closedDate: o.closed_at,
      })),
    };
  },

  getExcludedNumbers: async () => {
    const res = await api.excludedApi.list();
    return {
      items: (res.items || []).map((n) => ({
        id: n.id, number: n.number, reason: n.reason || "—",
        addedBy: n.added_by_id || "Admin", date: n.date,
      })),
    };
  },

  getRecordedCalls: async () => {
    const res = await api.transcriptsApi.list();
    return {
      items: (res.items || []).map((c) => ({
        id: c.id,
        contact: c.contact || "Unknown",
        phone: c.phone,
        employee: c.employee || "—",
        date: c.date,
        durationSeconds: c.duration_seconds,
        recordingUrl: c.recording_url || null,
        transcriptStatus: c.transcript_status || "pending",
      })),
    };
  },

  getInvoices: async () => {
    const res = await api.invoicesApi.list();
    return {
      items: (res.items || []).map((inv) => ({
        id: inv.id, period: inv.period, users: inv.users,
        amount: `₹${Number(inv.amount).toLocaleString("en-IN")}`,
        status: inv.status, date: inv.date,
      })),
    };
  },

  getSubscription: async () => {
    const res = await api.subscriptionApi.current();
    return { users: res.users, perUser: res.per_user ?? 99 };
  },
};

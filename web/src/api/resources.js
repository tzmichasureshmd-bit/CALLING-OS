import client from "./client.js";

// Thin resource wrappers over the API client. One place per domain.
// Endpoints match docs/CALLOS_API_PLAN.md.

export const authApi = {
  login: (payload) => client.post("/auth/login", payload).then((r) => r.data),
  register: (payload) => client.post("/auth/register", payload).then((r) => r.data),
  registerEmployee: (payload) => client.post("/auth/register/employee", payload).then((r) => r.data),
  google: (credential) => client.post("/auth/google", { credential }).then((r) => r.data),
  otp: (credential) => client.post("/auth/otp", { credential }).then((r) => r.data),
  refresh: (refresh_token) => client.post("/auth/refresh", { refresh_token }).then((r) => r.data),
  logout: () => client.post("/auth/logout").then((r) => r.data),
  me: () => client.get("/auth/me").then((r) => r.data),
};

export const organizationApi = {
  current: () => client.get("/organizations/current").then((r) => r.data),
  list: () => client.get("/organizations").then((r) => r.data),
  create: (payload) => client.post("/organizations", payload).then((r) => r.data),
  switch: (id) => client.post(`/organizations/${id}/switch`).then((r) => r.data),
  update: (payload) => client.patch("/organizations/current", payload).then((r) => r.data),
  regenerateCode: () => client.post("/organizations/current/regenerate-code").then((r) => r.data),
};

export const employeesApi = {
  list: (params) => client.get("/employees", { params }).then((r) => r.data),
  get: (id) => client.get(`/employees/${id}`).then((r) => r.data),
  create: (payload) => client.post("/employees", payload).then((r) => r.data),
  update: (id, payload) => client.patch(`/employees/${id}`, payload).then((r) => r.data),
  remove: (id) => client.delete(`/employees/${id}`).then((r) => r.data),
};

export const devicesApi = {
  list: (params) => client.get("/devices", { params }).then((r) => r.data),
  reconnect: (id) => client.post(`/devices/${id}/reconnect`).then((r) => r.data),
};

export const callsApi = {
  list: (params) => client.get("/calls", { params }).then((r) => r.data),
  get: (id) => client.get(`/calls/${id}`).then((r) => r.data),
  sync: (payload) => client.post("/calls/sync", payload).then((r) => r.data),
  // Get a short-lived signed URL for recording playback (ADMIN only)
  getRecordingUrl: (callId) => client.get(`/calls/${callId}/recording-url`).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: (params) => client.get("/analytics/dashboard", { params }).then((r) => r.data),
  employees: (params) => client.get("/analytics/employees", { params }).then((r) => r.data),
  team: (params) => client.get("/analytics/team", { params }).then((r) => r.data),
  needsAttention: () => client.get("/analytics/needs-attention").then((r) => r.data),
  livePulse: () => client.get("/analytics/live-pulse").then((r) => r.data),
};

export const leadsApi = {
  list: (params) => client.get("/leads", { params }).then((r) => r.data),
  create: (payload) => client.post("/leads", payload).then((r) => r.data),
  update: (id, payload) => client.patch(`/leads/${id}`, payload).then((r) => r.data),
};

export const opportunitiesApi = {
  list: (params) => client.get("/opportunities", { params }).then((r) => r.data),
};

export const excludedApi = {
  list: (params) => client.get("/excluded-phone-numbers", { params }).then((r) => r.data),
  create: (payload) => client.post("/excluded-phone-numbers", payload).then((r) => r.data),
  remove: (id) => client.delete(`/excluded-phone-numbers/${id}`).then((r) => r.data),
};

export const invoicesApi = {
  list: (params) => client.get("/invoices", { params }).then((r) => r.data),
};

export const subscriptionApi = {
  current: () => client.get("/subscriptions/current").then((r) => r.data),
  selectPlan: (plan, billing_cycle = "monthly") => client.post("/subscriptions/select-plan", { plan, billing_cycle }).then((r) => r.data),
  applyCoupon: (code) => client.post("/subscriptions/apply-coupon", { code }).then((r) => r.data),
};

export const transcriptsApi = {
  list: (params) => client.get("/transcripts", { params }).then((r) => r.data),
  transcribe: (callId) => client.post(`/transcripts/${callId}/transcribe`).then((r) => r.data),
  retry: (callId) => client.post(`/transcripts/${callId}/transcribe/retry`).then((r) => r.data),
};

export const auditApi = {
  list: (params) => client.get("/audit-logs", { params }).then((r) => r.data),
};

export const twoFaApi = {
  setup:   ()           => client.post("/auth/2fa/setup").then((r) => r.data),
  verify:  (code)       => client.post("/auth/2fa/verify", { code }).then((r) => r.data),
  disable: (code)       => client.post("/auth/2fa/disable", { code }).then((r) => r.data),
};

export const notificationsApi = {
  needsAttention: () => client.get("/analytics/needs-attention").then((r) => r.data),
  recentCalls: () => client.get("/calls", { params: { page_size: 20 } }).then((r) => r.data),
};

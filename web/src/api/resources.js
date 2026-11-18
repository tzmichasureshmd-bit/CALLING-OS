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
  changePassword: (payload) => client.post("/auth/change-password", payload).then((r) => r.data),
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
  getRecordingUrl: (callId) => client.get(`/calls/${callId}/recording-url`).then((r) => r.data),
  updateNote: (callId, status, notes) => client.patch(`/calls/${callId}/note`, { call_status: status, notes }).then((r) => r.data),
  setPrivacy: (callId, privacy) => client.patch(`/calls/${callId}/privacy`, { call_privacy: privacy }).then((r) => r.data),
  deleteRecording: (callId) => client.delete(`/calls/${callId}/recording`).then((r) => r.data),
};

export const analyticsApi = {
  dashboard: (params) => client.get("/analytics/dashboard", { params }).then((r) => r.data),
  employees: (params) => client.get("/analytics/employees", { params }).then((r) => r.data),
  employee: (employeeId, params) => client.get(`/analytics/employees/${employeeId}`, { params }).then((r) => r.data),
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
  create: (payload) => client.post("/opportunities", payload).then((r) => r.data),
  update: (id, payload) => client.patch(`/opportunities/${id}`, payload).then((r) => r.data),
};

export const followUpsApi = {
  list: (params) => client.get("/follow-ups", { params }).then((r) => r.data),
  create: (payload) => client.post("/follow-ups", payload).then((r) => r.data),
  update: (id, payload) => client.patch(`/follow-ups/${id}`, payload).then((r) => r.data),
  complete: (id) => client.post(`/follow-ups/${id}/complete`).then((r) => r.data),
};

export const customersApi = {
  list: (params) => client.get("/customers", { params }).then((r) => r.data),
  create: (payload) => client.post("/customers", payload).then((r) => r.data),
  get: (id) => client.get(`/customers/${id}`).then((r) => r.data),
  update: (id, payload) => client.patch(`/customers/${id}`, payload).then((r) => r.data),
  timeline: (id, params) => client.get(`/customers/${id}/timeline`, { params }).then((r) => r.data),
};

export const excludedApi = {
  list: (params) => client.get("/excluded-phone-numbers", { params }).then((r) => r.data),
  create: (payload) => client.post("/excluded-phone-numbers", payload).then((r) => r.data),
  remove: (id) => client.delete(`/excluded-phone-numbers/${id}`).then((r) => r.data),
};

export const invoicesApi = {
  list: (params) => client.get("/invoices", { params }).then((r) => r.data),
  get: (id) => client.get(`/subscription/invoices/${id}`).then((r) => r.data),
};

export const subscriptionAdminApi = {
  plans: () => client.get("/admin/plans").then((r) => r.data),
  subscriptions: () => client.get("/admin/subscriptions").then((r) => r.data),
  createPlan: (payload) => client.post("/admin/plans", payload).then((r) => r.data),
  updatePlan: (id, payload) => client.patch(`/admin/plans/${id}`, payload).then((r) => r.data),
  updatePrice: (id, payload) => client.patch(`/admin/plan-prices/${id}`, payload).then((r) => r.data),
  extend: (id, payload) => client.post(`/admin/subscriptions/${id}/extend`, payload).then((r) => r.data),
  suspend: (id, payload) => client.post(`/admin/subscriptions/${id}/suspend`, payload).then((r) => r.data),
};



export const subscriptionApi = {
  plans: () => client.get("/subscription/plans").then((r) => r.data),
  plan: (id) => client.get(`/subscription/plans/${id}`).then((r) => r.data),
  current: () => client.get("/subscription/current").then((r) => r.data),
  checkout: (payload) => client.post("/subscription/checkout", payload).then((r) => r.data),
  selectPlan: (plan, billing_cycle = "monthly") => client.post("/subscriptions/select-plan", { plan, duration: billing_cycle }).then((r) => r.data),
  applyCoupon: (code) => client.post("/subscriptions/apply-coupon", { code }).then((r) => r.data),
  verifyPayment: (payload) => client.post("/subscription/payment/verify", payload).then((r) => r.data),
  renew: (payload = {}) => client.post("/subscription/renew", payload).then((r) => r.data),
  changePlan: (payload) => client.post("/subscription/change-plan", payload).then((r) => r.data),
  payments: () => client.get("/subscription/payments").then((r) => r.data),
  invoices: () => client.get("/subscription/invoices").then((r) => r.data),
  usage: () => client.get("/subscription/usage").then((r) => r.data),
};

export const transcriptsApi = {
  list: (params) => client.get("/transcripts", { params }).then((r) => r.data),
  get: (callId) => client.get(`/transcripts/${callId}`).then((r) => r.data),
  transcribe: (callId) => client.post(`/transcripts/${callId}/transcribe`).then((r) => r.data),
  retry: (callId) => client.post(`/transcripts/${callId}/transcribe/retry`).then((r) => r.data),
  summarize: (callId) => client.post(`/transcripts/${callId}/summarize`).then((r) => r.data),
  retrySummary: (callId) => client.post(`/transcripts/${callId}/summarize/retry`).then((r) => r.data),
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

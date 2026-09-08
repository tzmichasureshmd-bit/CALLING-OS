import client from "../../api/client.js";

export const superApi = {
  // existing
  stats:     ()         => client.get("/superadmin/stats").then((r) => r.data),
  orgs:      (p = {})   => client.get("/superadmin/organizations", { params: p }).then((r) => r.data),
  orgDetail: (id)       => client.get(`/superadmin/organizations/${id}`).then((r) => r.data),
  toggle:    (id)       => client.patch(`/superadmin/organizations/${id}/status`).then((r) => r.data),
  deleteOrg: (id)       => client.delete(`/superadmin/organizations/${id}`).then((r) => r.data),
  createOrg: (body)     => client.post("/superadmin/organizations", body).then((r) => r.data),
  resetPass: (id, pwd)  => client.post(`/superadmin/organizations/${id}/reset-password`, { new_password: pwd }).then((r) => r.data),
  calls:     (p = {})   => client.get("/superadmin/calls", { params: p }).then((r) => r.data),
  devices:   (p = {})   => client.get("/superadmin/devices", { params: p }).then((r) => r.data),
  deviceDetail: (id)    => client.get(`/superadmin/devices/${id}`).then((r) => r.data),
  // SIM management
  sims:        (p = {}) => client.get("/superadmin/sims", { params: p }).then((r) => r.data),
  simChanges:  (p = {}) => client.get("/superadmin/sims/changes", { params: p }).then((r) => r.data),
  // Sync health
  syncHealth:  (p = {}) => client.get("/superadmin/sync-health", { params: p }).then((r) => r.data),
  // Audit logs
  auditLogs:   (p = {}) => client.get("/superadmin/audit-logs", { params: p }).then((r) => r.data),
  // System health
  systemHealth: ()      => client.get("/superadmin/system-health").then((r) => r.data),
  // App versions
  appVersions:  ()      => client.get("/superadmin/app-versions").then((r) => r.data),
  // Global search
  search:      (q)      => client.get("/superadmin/search", { params: { q } }).then((r) => r.data),
  // Employee actions
  toggleEmployee:   (id)       => client.patch(`/superadmin/employees/${id}/status`).then((r) => r.data),
  resetEmpPass:     (id, pwd)  => client.post(`/superadmin/employees/${id}/reset-password`, { new_password: pwd }).then((r) => r.data),
  forceLogout:      (id)       => client.post(`/superadmin/employees/${id}/force-logout`).then((r) => r.data),
  // Platform alerts
  alerts:      (p = {}) => client.get("/superadmin/alerts", { params: p }).then((r) => r.data),
  resolveAlert:(id)     => client.patch(`/superadmin/alerts/${id}/resolve`).then((r) => r.data),
};

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDur(s) {
  if (!s && s !== 0) return "—";
  if (s === 0) return "0s";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}
export const TH = {
  textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700,
  color: "var(--text-muted)", borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em",
  background: "var(--bg-hover)",
};
export const TD = (extra = {}) => ({
  padding: "12px 16px", fontSize: 13,
  borderBottom: "1px solid var(--border)", ...extra,
});

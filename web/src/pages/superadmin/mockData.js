export const ORGS = [
  { id: "1", name: "Tzmicha IT Solutions", code: "TZM-2026-5823", email: "admin@tzmicha.com", phone: "+1 555 1000", employees: 5, calls: 142, devices: 3, created_at: "2024-01-15", status: "active" },
  { id: "2", name: "Acme Corp",            code: "ACM-2025-1234", email: "admin@acme.com",   phone: "+1 555 2000", employees: 4, calls: 98,  devices: 3, created_at: "2024-03-10", status: "active" },
  { id: "3", name: "Beta Sales Ltd",       code: "BTA-2025-9900", email: "admin@beta.com",   phone: "+1 555 3000", employees: 3, calls: 44,  devices: 2, created_at: "2024-06-01", status: "suspended" },
];

export const DETAILS = {
  "1": {
    employees: [
      { id: "e1", name: "Alice Johnson", email: "alice@tzmicha.com", phone: "+1 555 0101", code: "EMP-001", status: "active",   joined: "2024-02-01", org: "Tzmicha IT Solutions" },
      { id: "e2", name: "Bob Smith",     email: "bob@tzmicha.com",   phone: "+1 555 0102", code: "EMP-002", status: "active",   joined: "2024-02-15", org: "Tzmicha IT Solutions" },
      { id: "e3", name: "Carol White",   email: "carol@tzmicha.com", phone: "+1 555 0103", code: "EMP-003", status: "active",   joined: "2024-03-01", org: "Tzmicha IT Solutions" },
      { id: "e4", name: "David Lee",     email: "david@tzmicha.com", phone: "+1 555 0104", code: "EMP-004", status: "inactive", joined: "2024-03-20", org: "Tzmicha IT Solutions" },
      { id: "e5", name: "Eva Brown",     email: "eva@tzmicha.com",   phone: "+1 555 0105", code: "EMP-005", status: "active",   joined: "2024-04-01", org: "Tzmicha IT Solutions" },
    ],
    calls: [
      { id: "c1", contact: "John Doe",    phone: "+1 555 9001", type: "outgoing", duration: 185, date: "2024-12-01", org: "Tzmicha IT Solutions" },
      { id: "c2", contact: "Jane Roe",    phone: "+1 555 9002", type: "incoming", duration: 92,  date: "2024-12-02", org: "Tzmicha IT Solutions" },
      { id: "c3", contact: "Unknown",     phone: "+1 555 9003", type: "missed",   duration: 0,   date: "2024-12-03", org: "Tzmicha IT Solutions" },
      { id: "c4", contact: "Mark Twain",  phone: "+1 555 9004", type: "outgoing", duration: 310, date: "2024-12-04", org: "Tzmicha IT Solutions" },
      { id: "c5", contact: "Sara Connor", phone: "+1 555 9005", type: "incoming", duration: 47,  date: "2024-12-05", org: "Tzmicha IT Solutions" },
    ],
    devices: [
      { id: "d1", model: "Samsung Galaxy A54",   online: true,  battery: 78, last_seen: "2024-12-10", org: "Tzmicha IT Solutions" },
      { id: "d2", model: "Xiaomi Redmi Note 12", online: false, battery: 23, last_seen: "2024-12-08", org: "Tzmicha IT Solutions" },
      { id: "d3", model: "OnePlus Nord CE 3",    online: true,  battery: 91, last_seen: "2024-12-10", org: "Tzmicha IT Solutions" },
    ],
  },
  "2": {
    employees: [
      { id: "e6", name: "Frank Miller", email: "frank@acme.com", phone: "+1 555 0201", code: "ACM-001", status: "active",   joined: "2024-04-01", org: "Acme Corp" },
      { id: "e7", name: "Grace Hall",   email: "grace@acme.com", phone: "+1 555 0202", code: "ACM-002", status: "active",   joined: "2024-04-15", org: "Acme Corp" },
      { id: "e8", name: "Henry Ford",   email: "henry@acme.com", phone: "+1 555 0203", code: "ACM-003", status: "inactive", joined: "2024-05-01", org: "Acme Corp" },
      { id: "e9", name: "Iris West",    email: "iris@acme.com",  phone: "+1 555 0204", code: "ACM-004", status: "active",   joined: "2024-05-20", org: "Acme Corp" },
    ],
    calls: [
      { id: "c6", contact: "Tom Hardy", phone: "+1 555 8001", type: "outgoing", duration: 220, date: "2024-12-01", org: "Acme Corp" },
      { id: "c7", contact: "Lisa Ray",  phone: "+1 555 8002", type: "incoming", duration: 135, date: "2024-12-02", org: "Acme Corp" },
      { id: "c8", contact: "Unknown",   phone: "+1 555 8003", type: "missed",   duration: 0,   date: "2024-12-03", org: "Acme Corp" },
    ],
    devices: [
      { id: "d4", model: "Realme 11 Pro",      online: true,  battery: 65, last_seen: "2024-12-10", org: "Acme Corp" },
      { id: "d5", model: "Samsung Galaxy S23", online: true,  battery: 88, last_seen: "2024-12-10", org: "Acme Corp" },
      { id: "d6", model: "Motorola Edge 40",   online: false, battery: 12, last_seen: "2024-12-07", org: "Acme Corp" },
    ],
  },
  "3": {
    employees: [
      { id: "e10", name: "Jack Sparrow", email: "jack@beta.com", phone: "+1 555 0301", code: "BTA-001", status: "active",   joined: "2024-07-01", org: "Beta Sales Ltd" },
      { id: "e11", name: "Kate Bishop",  email: "kate@beta.com", phone: "+1 555 0302", code: "BTA-002", status: "inactive", joined: "2024-07-15", org: "Beta Sales Ltd" },
      { id: "e12", name: "Leo Messi",    email: "leo@beta.com",  phone: "+1 555 0303", code: "BTA-003", status: "active",   joined: "2024-08-01", org: "Beta Sales Ltd" },
    ],
    calls: [
      { id: "c9",  contact: "Nina Simone", phone: "+1 555 7001", type: "outgoing", duration: 90, date: "2024-11-28", org: "Beta Sales Ltd" },
      { id: "c10", contact: "Oscar Wild",  phone: "+1 555 7002", type: "incoming", duration: 55, date: "2024-11-29", org: "Beta Sales Ltd" },
    ],
    devices: [
      { id: "d7", model: "iPhone 13",        online: false, battery: 5,  last_seen: "2024-12-05", org: "Beta Sales Ltd" },
      { id: "d8", model: "Oppo Reno 10 Pro", online: true,  battery: 72, last_seen: "2024-12-10", org: "Beta Sales Ltd" },
    ],
  },
};

export const ALL_EMPLOYEES = Object.values(DETAILS).flatMap((d) => d.employees);
export const ALL_CALLS     = Object.values(DETAILS).flatMap((d) => d.calls);
export const ALL_DEVICES   = Object.values(DETAILS).flatMap((d) => d.devices);

export function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
export function fmtDur(s) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export const TH = { textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em", background: "var(--bg-hover)" };
export const TD = (extra = {}) => ({ padding: "12px 16px", fontSize: 13, borderBottom: "1px solid var(--border)", ...extra });

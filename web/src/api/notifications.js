// Real notifications — sourced from backend needs-attention + recent missed calls.
// Read state persisted in localStorage so it survives page refresh.

import { notificationsApi } from "./resources.js";

const STORAGE_KEY = "callos_read_notifs";

function getReadIds() {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); }
  catch { return new Set(); }
}

export function markRead(ids) {
  const existing = getReadIds();
  ids.forEach((id) => existing.add(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing]));
}

export function markAllRead(notifs) {
  markRead(notifs.map((n) => n.id));
}

// Severity → icon type mapping consumed by Topbar
const SEVERITY_ICON = {
  high:   "alert",
  medium: "warning",
  low:    "info",
};

function relTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function fetchNotifications() {
  const readIds = getReadIds();

  const [attentionRes, callsRes] = await Promise.all([
    notificationsApi.needsAttention().catch(() => ({ items: [] })),
    notificationsApi.recentCalls().catch(() => ({ items: [] })),
  ]);

  const notifs = [];

  // 1. Needs-attention items from backend (device offline, permission issues, missed spike)
  for (const item of attentionRes.items || []) {
    notifs.push({
      id: item.id,
      type: item.severity === "high" ? "alert" : "warning",
      title: item.title,
      sub: item.detail,
      to: item.to || null,
      read: readIds.has(item.id),
      ts: null,
    });
  }

  // 2. Recent missed calls from real call log
  const missed = (callsRes.items || [])
    .filter((c) => c.call_type === "missed" || c.type === "missed")
    .slice(0, 5);

  for (const c of missed) {
    const id = `missed-${c.id}`;
    const name = c.contact_name || c.contact || c.phone_number || c.phone || "Unknown";
    const emp = c.employee_name || c.employee || "";
    notifs.push({
      id,
      type: "missed",
      title: `Missed call — ${name}`,
      sub: `${emp ? emp + " · " : ""}${relTime(c.start_time || c.date)}`,
      to: "/call-logs",
      read: readIds.has(id),
      ts: c.start_time || c.date,
    });
  }

  // 3. Recent recordings synced
  const recordings = (callsRes.items || [])
    .filter((c) => c.recording_url || c.recordingUrl)
    .slice(0, 3);

  for (const c of recordings) {
    const id = `rec-${c.id}`;
    const name = c.contact_name || c.contact || c.phone_number || c.phone || "Unknown";
    const emp = c.employee_name || c.employee || "";
    notifs.push({
      id,
      type: "recording",
      title: `Recording available — ${name}`,
      sub: `${emp ? emp + " · " : ""}${relTime(c.start_time || c.date)}`,
      to: "/transcribe",
      read: readIds.has(id),
      ts: c.start_time || c.date,
    });
  }

  // Sort: unread first, then by ts desc
  notifs.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    if (a.ts && b.ts) return new Date(b.ts) - new Date(a.ts);
    return 0;
  });

  return notifs;
}

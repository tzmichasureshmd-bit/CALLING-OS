/**
 * notificationStore.js
 *
 * Persistent in-app notification center.
 * Stores every pipeline event (call synced, recording uploaded, transcription done, etc.)
 * as a notification record in AsyncStorage.
 *
 * Separate from expo-notifications (OS-level) — this powers the in-app bell panel.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STORE_KEY  = "callos_inapp_notifications";
const MAX_ITEMS  = 200;

// ── Types ─────────────────────────────────────────────────────────────────────
// call_completed | call_synced | recording_uploaded | transcription_completed
// sync_failed | missed_call

// ── Internal ──────────────────────────────────────────────────────────────────
async function _load() {
  try {
    const raw = await AsyncStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function _save(items) {
  try {
    const trimmed = items.slice(0, MAX_ITEMS);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a notification to the in-app store.
 * Deduplicates by id — safe to call multiple times for same event.
 */
export async function addNotification({ id, type, title, message, callId, clientEventId }) {
  const items = await _load();
  // Deduplicate: if same id exists, update it in-place
  const idx = items.findIndex(n => n.id === id);
  const entry = {
    id:             id || `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type:           type || "call_completed",
    title:          title || "CallNexa",
    message:        message || "",
    timestamp:      new Date().toISOString(),
    read:           false,
    callId:         callId || null,
    clientEventId:  clientEventId || null,
  };
  if (idx >= 0) {
    items[idx] = { ...items[idx], ...entry, read: items[idx].read };
  } else {
    items.unshift(entry);
  }
  await _save(items);
}

/**
 * Get all notifications, newest first.
 */
export async function getInAppNotifications() {
  return _load();
}

/**
 * Get unread count.
 */
export async function getUnreadCount() {
  const items = await _load();
  return items.filter(n => !n.read).length;
}

/**
 * Mark a single notification as read.
 */
export async function markRead(id) {
  const items = await _load();
  const idx = items.findIndex(n => n.id === id);
  if (idx >= 0) { items[idx].read = true; await _save(items); }
}

/**
 * Mark all notifications as read.
 */
export async function markAllRead() {
  const items = await _load();
  items.forEach(n => { n.read = true; });
  await _save(items);
}

/**
 * Clear all notifications (e.g. on logout).
 */
export async function clearNotifications() {
  await AsyncStorage.removeItem(STORE_KEY);
}

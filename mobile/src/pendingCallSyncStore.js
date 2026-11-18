import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_KEY = "callos_pending_call_sync";
const SKIPPED_KEY = "callos_skipped_call_sync";

async function read(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

async function write(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value.slice(0, 200)));
}

export async function queuePendingCall(call) {
  if (!call?.client_event_id) return null;
  const skipped = await read(SKIPPED_KEY);
  if (skipped.includes(call.client_event_id)) return null;
  const pending = await read(PENDING_KEY);
  if (pending.some((item) => item.client_event_id === call.client_event_id)) return pending.find((item) => item.client_event_id === call.client_event_id);
  const item = { ...call, queuedAt: new Date().toISOString() };
  await write(PENDING_KEY, [item, ...pending]);
  return item;
}

export async function getPendingCalls() { return read(PENDING_KEY); }

export async function removePendingCall(clientEventId) {
  const pending = await read(PENDING_KEY);
  await write(PENDING_KEY, pending.filter((item) => item.client_event_id !== clientEventId));
}

export async function skipPendingCall(clientEventId) {
  await removePendingCall(clientEventId);
  const skipped = await read(SKIPPED_KEY);
  if (!skipped.includes(clientEventId)) await write(SKIPPED_KEY, [clientEventId, ...skipped]);
}

export async function clearSkippedCall(clientEventId) {
  const skipped = await read(SKIPPED_KEY);
  await write(SKIPPED_KEY, skipped.filter((id) => id !== clientEventId));
}

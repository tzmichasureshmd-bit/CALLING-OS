import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "callos_pending_post_call_actions";

async function readAll() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeAll(items) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
}

export async function enqueuePostCall(call) {
  if (!call?.callId && !call?.clientEventId) return null;
  const items = await readAll();
  const key = call.callId || call.clientEventId;
  const existing = items.find((item) => (item.callId || item.clientEventId) === key);
  if (existing) return existing;
  const item = {
    ...call,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await writeAll([item, ...items]);
  return item;
}

export async function getPendingPostCalls() {
  return readAll();
}

export async function removePendingPostCall(callIdOrEventId) {
  const items = await readAll();
  await writeAll(items.filter((item) => (item.callId || item.clientEventId) !== callIdOrEventId));
}

export async function markPostCallAttempt(callIdOrEventId, error) {
  const items = await readAll();
  const updated = items.map((item) => {
    if ((item.callId || item.clientEventId) !== callIdOrEventId) return item;
    return { ...item, attempts: (item.attempts || 0) + 1, lastError: error || null };
  });
  await writeAll(updated);
}

const KEY = "callos_follow_ups";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export const followUpsStore = {
  getAll: () => load(),
  add(item) {
    const items = load();
    const entry = { ...item, id: Date.now().toString(), createdAt: new Date().toISOString() };
    save([entry, ...items]);
    return entry;
  },
  update(id, patch) {
    const items = load().map(i => i.id === id ? { ...i, ...patch } : i);
    save(items);
  },
  remove(id) {
    save(load().filter(i => i.id !== id));
  },
};

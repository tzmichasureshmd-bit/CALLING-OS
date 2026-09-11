import AsyncStorage from "@react-native-async-storage/async-storage";
import { readSimInfo } from "./nativeModules";
import { api } from "./api";

const SIM_INVENTORY_KEY   = "callos_sim_inventory";
const SIM_LAST_SYNC_KEY   = "callos_sim_last_sync";
const SIM_RESCAN_INTERVAL = 5 * 60 * 1000; // 5 min rate-limit for background scans

// ── Local persistence ─────────────────────────────────────────────────────────

async function _loadStored() {
  try {
    const raw = await AsyncStorage.getItem(SIM_INVENTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

async function _saveInventory(sims) {
  try {
    await AsyncStorage.setItem(SIM_INVENTORY_KEY, JSON.stringify(sims));
    await AsyncStorage.setItem(SIM_LAST_SYNC_KEY, String(Date.now()));
  } catch {}
}

// ── Change detection ──────────────────────────────────────────────────────────
// Primary key: subscriptionId (stable SIM identity)
// Fallback key: slot (physical slot)

function _simKey(sim) {
  return sim.subscriptionId ? `sub:${sim.subscriptionId}` : `slot:${sim.slot}`;
}

function _detectChanges(previous, current) {
  const changes = [];
  const prevMap = {};
  previous.forEach((s) => { prevMap[_simKey(s)] = s; });
  const currMap = {};
  current.forEach((s) => { currMap[_simKey(s)] = s; });

  for (const [key, curr] of Object.entries(currMap)) {
    const prev = prevMap[key];
    if (!prev) {
      changes.push({
        slot: curr.slot,
        change_type: "INSERTED",
        new_carrier: curr.carrierName,
        new_subscription_id: curr.subscriptionId,
      });
    } else {
      const carrierChanged = prev.carrierName && curr.carrierName &&
        prev.carrierName.trim() !== curr.carrierName.trim();
      const subChanged = prev.subscriptionId && curr.subscriptionId &&
        prev.subscriptionId !== curr.subscriptionId;
      const networkChanged = prev.networkType && curr.networkType &&
        prev.networkType !== curr.networkType;

      if (subChanged) {
        changes.push({
          slot: curr.slot,
          change_type: "REPLACED",
          previous_carrier: prev.carrierName,
          new_carrier: curr.carrierName,
          previous_subscription_id: prev.subscriptionId,
          new_subscription_id: curr.subscriptionId,
        });
      } else if (carrierChanged) {
        changes.push({
          slot: curr.slot,
          change_type: "CARRIER_CHANGED",
          previous_carrier: prev.carrierName,
          new_carrier: curr.carrierName,
          subscription_id: curr.subscriptionId,
        });
      } else if (networkChanged) {
        changes.push({
          slot: curr.slot,
          change_type: "NETWORK_CHANGED",
          previous_network: prev.networkType,
          new_network: curr.networkType,
          subscription_id: curr.subscriptionId,
        });
      }
    }
  }

  for (const [key, prev] of Object.entries(prevMap)) {
    if (!currMap[key]) {
      changes.push({
        slot: prev.slot,
        change_type: "REMOVED",
        previous_carrier: prev.carrierName,
        previous_subscription_id: prev.subscriptionId,
      });
    }
  }
  return changes;
}

// ── Convert normalized SIM → backend SIMSyncItem ──────────────────────────────
// slot sent to backend is 1-indexed (display_slot)

function _toSyncItem(sim) {
  return {
    slot:            sim.slot + 1,          // 1-indexed for backend
    carrier:         sim.carrierName        || null,
    display_name:    sim.displayName        || null,
    phone_number:    sim.phoneNumber        || null,
    mcc:             sim.mcc               || null,
    mnc:             sim.mnc               || null,
    country_iso:     sim.countryIso        || null,
    subscription_id: sim.subscriptionId    || null,
    network_type:    sim.networkType       || null,
    is_active:       sim.isActive !== false,
    is_embedded:     sim.isEmbedded        || false,
    card_id:         sim.cardId            ?? null,
    carrier_id:      sim.carrierId         ?? null,
    data_roaming:    sim.dataRoaming       || false,
    icc_id:          sim.iccId             || null,
    source:          sim._source           || null,
  };
}

// ── Main sync ─────────────────────────────────────────────────────────────────
// force=true → always read Android (used for manual refresh, login, permission grant)
// force=false → rate-limited background scan

export async function syncSimInventory(deviceId, force = false) {
  if (!deviceId) return { sims: [], changes: [], synced: false };

  if (!force) {
    const last = await AsyncStorage.getItem(SIM_LAST_SYNC_KEY).catch(() => null);
    if (last && Date.now() - parseInt(last, 10) < SIM_RESCAN_INTERVAL) {
      return { sims: await _loadStored(), changes: [], synced: false };
    }
  }

  // Always read from Android OS — never use stale cache as source of truth
  let currentRaw;
  try {
    currentRaw = await readSimInfo();
  } catch (e) {
    console.warn("[SimInventory] readSimInfo threw:", e?.message);
    return { sims: await _loadStored(), changes: [], synced: false };
  }

  if (!currentRaw.length) {
    return { sims: [], changes: [], synced: false };
  }

  const previous = await _loadStored();
  const changes  = _detectChanges(previous, currentRaw);
  const syncItems = currentRaw.map(_toSyncItem);

  let synced = false;
  try {
    await api.syncSims(deviceId, syncItems);
    synced = true;
  } catch {}

  await _saveInventory(currentRaw);
  return { sims: currentRaw, changes, synced };
}

export async function getStoredSimInventory() {
  return _loadStored();
}

// ── SIM lookup for call-to-SIM mapping ───────────────────────────────────────
// Primary: subscriptionId match (stable Android identity)
// Fallback: physical slot match

export async function findSimForCall(simSlotAndroid, subscriptionId) {
  const inventory = await _loadStored();
  if (!inventory.length) return null;

  // Primary: match by subscriptionId
  if (subscriptionId !== null && subscriptionId !== undefined) {
    const match = inventory.find((s) => s.subscriptionId === String(subscriptionId));
    if (match) return match;
  }

  // Fallback: match by physical slot
  if (simSlotAndroid !== null && simSlotAndroid !== undefined) {
    const slot = parseInt(simSlotAndroid, 10);
    return inventory.find((s) => s.slot === slot) || null;
  }

  return null;
}

export async function buildCallSource(simSlotAndroid, subscriptionId) {
  const sim = await findSimForCall(simSlotAndroid, subscriptionId);
  if (!sim) return "UNKNOWN";
  const label = `SIM ${sim.slot + 1}`;
  return sim.carrierName ? `${label} — ${sim.carrierName}` : label;
}

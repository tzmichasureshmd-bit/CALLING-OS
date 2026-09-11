/**
 * simSelectionService.js
 *
 * Single source of truth for the employee's selected SIM.
 *
 * Storage keys:
 *   callos_selected_subscription_id  — Android subscriptionId (primary identity)
 *   callos_selected_sim_slot         — physical slot index 0-based (fallback)
 *   callos_selected_sim_carrier      — carrier name at time of selection (for change detection)
 *   callos_selected_sim_snapshot     — full SIM object at time of selection (JSON)
 *
 * Rules:
 *   - subscriptionId is the primary key. Slot is fallback only.
 *   - Never confuse subscriptionId with slot.
 *   - On SIM change (subscriptionId no longer in inventory), require reselection.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const SELECTED_SUB_ID_KEY  = "callos_selected_subscription_id";
const SELECTED_SLOT_KEY    = "callos_selected_sim_slot";
const SELECTED_CARRIER_KEY = "callos_selected_sim_carrier";
const SELECTED_SNAPSHOT_KEY = "callos_selected_sim_snapshot";

// ── Save selection ────────────────────────────────────────────────────────────

/**
 * Persist the employee's SIM selection.
 * @param {object} sim - normalized SIM object from nativeModules.readSimInfo()
 */
export async function saveSimSelection(sim) {
  await Promise.all([
    AsyncStorage.setItem(SELECTED_SUB_ID_KEY,  sim.subscriptionId ? String(sim.subscriptionId) : ""),
    AsyncStorage.setItem(SELECTED_SLOT_KEY,    String(sim.slot)),
    AsyncStorage.setItem(SELECTED_CARRIER_KEY, sim.carrierName || ""),
    AsyncStorage.setItem(SELECTED_SNAPSHOT_KEY, JSON.stringify(sim)),
  ]);
}

// ── Load selection ────────────────────────────────────────────────────────────

export async function getSimSelection() {
  const [subId, slot, carrier, snapshot] = await Promise.all([
    AsyncStorage.getItem(SELECTED_SUB_ID_KEY),
    AsyncStorage.getItem(SELECTED_SLOT_KEY),
    AsyncStorage.getItem(SELECTED_CARRIER_KEY),
    AsyncStorage.getItem(SELECTED_SNAPSHOT_KEY),
  ]);
  return {
    subscriptionId: subId || null,
    slot:           slot !== null && slot !== "" ? parseInt(slot, 10) : null,
    carrier:        carrier || null,
    snapshot:       snapshot ? JSON.parse(snapshot) : null,
  };
}

export async function clearSimSelection() {
  await AsyncStorage.multiRemove([
    SELECTED_SUB_ID_KEY,
    SELECTED_SLOT_KEY,
    SELECTED_CARRIER_KEY,
    SELECTED_SNAPSHOT_KEY,
  ]);
}

// ── Change detection ──────────────────────────────────────────────────────────

/**
 * Check whether the previously selected SIM is still present in the current inventory.
 *
 * Returns:
 *   { changed: false }                          — SIM still present, no action needed
 *   { changed: true, previous, current }        — subscriptionId replaced (SIM swapped)
 *   { changed: true, previous, current: null }  — selected SIM removed entirely
 *   { changed: false, noSelection: true }       — no SIM was ever selected
 */
export async function checkSimChange(currentInventory) {
  const selection = await getSimSelection();

  if (!selection.subscriptionId && selection.slot === null) {
    return { changed: false, noSelection: true };
  }

  // Primary: find by subscriptionId
  if (selection.subscriptionId) {
    const stillPresent = currentInventory.find(
      (s) => s.subscriptionId && String(s.subscriptionId) === selection.subscriptionId
    );
    if (stillPresent) return { changed: false };

    // subscriptionId gone — find what's now in the same slot
    const sameSlot = selection.slot !== null
      ? currentInventory.find((s) => s.slot === selection.slot)
      : null;

    return {
      changed:  true,
      previous: selection.snapshot || { subscriptionId: selection.subscriptionId, carrierName: selection.carrier, slot: selection.slot },
      current:  sameSlot || null,
    };
  }

  // Fallback: slot-only selection
  if (selection.slot !== null) {
    const sameSlot = currentInventory.find((s) => s.slot === selection.slot);
    if (!sameSlot) {
      return {
        changed:  true,
        previous: selection.snapshot || { slot: selection.slot, carrierName: selection.carrier },
        current:  null,
      };
    }
    // Slot present — check if carrier changed significantly
    const prevCarrier = selection.carrier;
    const currCarrier = sameSlot.carrierName;
    if (prevCarrier && currCarrier && prevCarrier.trim() !== currCarrier.trim()) {
      return {
        changed:  true,
        previous: selection.snapshot || { slot: selection.slot, carrierName: prevCarrier },
        current:  sameSlot,
      };
    }
    return { changed: false };
  }

  return { changed: false };
}

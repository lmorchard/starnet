// @ts-check
// Darknet broker store — bridge between game logic and <starnet-store> component.
// Buy logic lives in store-logic.js; this module wires events to the component.

/** @typedef {import('../core/types.js').GameState} GameState */

import { emitEvent, E } from "../core/events.js";
import { resumeTimers } from "../core/timers.js";
import { getPackCatalog } from "../core/packs.js";
import { buyFromStore } from "../core/store-logic.js";
import { getState } from "../core/state.js";

/**
 * Open the darknet broker store modal. Pauses timers while open.
 * Called by ActionContext.openDarknetsStore() after it pauses timers.
 * @param {GameState} state
 */
export function openDarknetsStore(state) {
  const storeEl = /** @type {any} */ (document.getElementById("darknet-store"));
  if (!storeEl || storeEl.open) return; // already open

  emitEvent(E.LOG_ENTRY, { text: "[DARKNET] Connected to broker. Commands: darknet — list catalog | buy <n> — purchase pack", type: "meta" });

  let currentCash = state.player.cash;
  storeEl.catalog = getPackCatalog();
  storeEl.cash = currentCash;
  storeEl.open = true;

  function closeModal() {
    storeEl.open = false;
    resumeTimers();
    // Remove listeners
    storeEl.removeEventListener("buy", onBuy);
    storeEl.removeEventListener("close", onClose);
  }

  /** @param {CustomEvent} evt */
  function onBuy(evt) {
    const { index } = evt.detail;
    emitEvent(E.COMMAND_ISSUED, { cmd: `buy ${index}` });
    const result = buyFromStore(index);
    if (result) {
      emitEvent(E.LOG_ENTRY, { text: `Purchased: ${result.pack.name}  ${result.rounds.length} round(s)  cost:¥${result.price}`, type: "success" });
      currentCash -= result.price;
      storeEl.cash = currentCash;
      storeEl.catalog = getPackCatalog();
    }
  }

  function onClose() {
    closeModal();
  }

  storeEl.addEventListener("buy", onBuy);
  storeEl.addEventListener("close", onClose);
}

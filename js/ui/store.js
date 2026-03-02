// @ts-check
// Darknet broker store — DOM modal UI.
// Buy logic lives in store-logic.js; this module only handles the modal rendering.

/** @typedef {import('../core/types.js').GameState} GameState */

import { emitEvent, E } from "../core/events.js";
import { resumeTimers } from "../core/timers.js";
import { getStoreCatalog } from "../core/exploits.js";
import { buyFromStore } from "../core/store-logic.js";

/**
 * Open the darknet broker store modal. Pauses timers while open.
 * Called by ActionContext.openDarknetsStore() after it pauses timers.
 * @param {GameState} state
 */
export function openDarknetsStore(state) {
  const existing = document.getElementById("darknet-store-modal");
  if (existing) return; // already open

  emitEvent(E.LOG_ENTRY, { text: "[DARKNET] Connected to broker. Commands: store — list catalog | buy <n> — purchase", type: "meta" });

  const modal = document.createElement("div");
  modal.id = "darknet-store-modal";

  function renderModal(currentCash) {
    const catalog = getStoreCatalog();
    modal.innerHTML = `
      <div class="store-box">
        <div class="store-header">
          <span class="store-title">// DARKNET BROKER</span>
          <span class="store-wallet">¥${currentCash.toLocaleString()}</span>
        </div>
        <div class="store-card-list">
          ${catalog.map((item, i) => {
            const canAfford = currentCash >= item.price;
            return `<div class="store-card-row">
              <span class="store-item-name">${item.name} <span class="store-item-rarity rarity-${item.rarity}">[${item.rarity}]</span> <span class="store-item-vuln">${item.vulnId}</span></span>
              <span class="store-item-price">¥${item.price}</span>
              <button class="store-buy-btn" data-vuln-id="${item.vulnId}" data-index="${i + 1}" ${canAfford ? "" : "disabled"}>[ BUY ]</button>
            </div>`;
          }).join("")}
        </div>
        <div class="store-footer">
          <button class="store-close-btn" id="darknet-close-btn">[ CLOSE ]</button>
        </div>
      </div>`;

    modal.querySelector("#darknet-close-btn").addEventListener("click", closeModal);

    modal.querySelectorAll(".store-buy-btn:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = /** @type {HTMLElement} */ (btn);
        const index = Number(el.dataset.index);
        emitEvent(E.COMMAND_ISSUED, { cmd: `buy ${index}` });
        const result = buyFromStore(index);
        if (result) {
          emitEvent(E.LOG_ENTRY, { text: `Purchased: ${result.card.name}  [${result.card.rarity}]  targets:${result.vulnId}  cost:¥${result.price}`, type: "success" });
          renderModal(currentCash - result.price);
        }
      });
    });
  }

  function closeModal() {
    modal.remove();
    resumeTimers();
  }

  // Click on backdrop (not inside .store-box) closes the modal
  modal.addEventListener("click", (evt) => {
    if (!/** @type {Element} */ (evt.target).closest(".store-box")) closeModal();
  });

  renderModal(state.player.cash);
  document.getElementById("graph-container").appendChild(modal);
}

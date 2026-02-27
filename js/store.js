// @ts-check
// Darknet broker store — modal UI and catalog logic.

/** @typedef {import('./types.js').GameState} GameState */

import { emitEvent, E } from "./events.js";
import { resumeTimers } from "./timers.js";
import { generateExploitForVuln, getStoreCatalog } from "./exploits.js";

/**
 * Open the darknet broker store modal. Pauses timers while open.
 * Called by ActionContext.openDarknetsStore() after it pauses timers.
 * @param {GameState} state
 * @param {(card: import('./types.js').ExploitCard, price: number) => boolean} onBuy
 */
export function openDarknetsStore(state, onBuy) {
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
              <button class="store-buy-btn" data-vuln-id="${item.vulnId}" data-price="${item.price}" data-index="${i + 1}" ${canAfford ? "" : "disabled"}>[ BUY ]</button>
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
        const vulnId = el.dataset.vulnId;
        const price = Number(el.dataset.price);
        const index = el.dataset.index;
        const card = generateExploitForVuln(vulnId);
        emitEvent(E.COMMAND_ISSUED, { cmd: `buy ${index}` });
        const success = onBuy(card, price);
        if (success) {
          emitEvent(E.LOG_ENTRY, { text: `Purchased: ${card.name}  [${card.rarity}]  targets:${vulnId}  cost:¥${price}`, type: "success" });
          // STATE_CHANGED fires from buyExploit() → re-renders hand + wallet HUD.
          // Re-render the modal in-place with the updated cash.
          renderModal(currentCash - price);
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

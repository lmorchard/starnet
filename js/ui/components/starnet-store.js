// <starnet-store> — Darknet broker store modal.
// Shows research pack catalog with buy buttons. Controlled by store.js bridge.
// At the hub, also shows a GEAR section below packs (gearCatalog property).
// The element itself acts as the backdrop overlay (styled via #darknet-store in CSS).

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

/** Format a pack mix object as a short summary string, e.g. "6× common · 3× uncommon" */
function mixSummary(mix) {
  if (!mix) return "";
  return Object.entries(mix)
    .filter(([, count]) => count > 0)
    .map(([rarity, count]) => `${count}× ${rarity}`)
    .join(" · ");
}

class StarnetStore extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    catalog: { type: Array },
    gearCatalog: { type: Array },
    cash: { type: Number },
    subtitle: { type: String },
  };

  constructor() {
    super();
    this.open = false;
    this.catalog = [];
    this.gearCatalog = [];
    this.cash = 0;
    this.subtitle = "";
  }

  updated(changed) {
    if (changed.has("open")) {
      this.style.display = this.open ? "" : "none";
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = this.open ? "" : "none";
    this.addEventListener("click", this._onBackdropClick);
  }

  _onBuy(item, index) {
    this.dispatchEvent(new CustomEvent("buy", {
      bubbles: true,
      detail: { packId: item.id, index },
    }));
  }

  _onBuyGear(item) {
    this.dispatchEvent(new CustomEvent("buy-gear", {
      bubbles: true,
      detail: { gearId: item.id },
    }));
  }

  _onClose() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
  }

  _onBackdropClick = (e) => {
    if (!e.target.closest(".store-box")) this._onClose();
  };

  render() {
    if (!this.open) return nothing;

    const hasGearSection = Array.isArray(this.gearCatalog) && this.gearCatalog.length > 0;

    return html`
      <div class="store-box">
        <div class="store-header">
          <span class="store-title">// DARKNET BROKER</span>
          <span class="store-wallet">¥${this.cash.toLocaleString()}</span>
        </div>
        ${this.subtitle ? html`<div class="store-subtitle">${this.subtitle}</div>` : nothing}
        <div class="store-card-list">
          ${(this.catalog || []).map((item, i) => {
            const canAfford = this.cash >= item.price;
            const mix = mixSummary(item.mix);
            return html`
              <div class="store-card-row">
                <span class="store-item-name">${item.name}
                  <span class="store-item-mix">${mix}</span>
                  <span class="store-item-size">[${item.size} rounds]</span>
                </span>
                <span class="store-item-price">¥${item.price}</span>
                <button class="store-buy-btn" ?disabled=${!canAfford}
                        @click=${() => this._onBuy(item, i + 1)}>[ BUY ]</button>
              </div>`;
          })}
        </div>
        ${hasGearSection ? html`
          <div class="store-section-header">// GEAR</div>
          <div class="store-card-list store-gear-list">
            ${this.gearCatalog.map((item) => {
              const canAfford = this.cash >= item.price;
              return html`
                <div class="store-card-row">
                  <span class="store-item-name">${item.name}
                    <span class="store-item-mix">${item.kind}</span>
                    <span class="store-item-desc">${item.desc}</span>
                  </span>
                  <span class="store-item-price">¥${item.price}</span>
                  ${item.owned
                    ? html`<span class="store-item-owned">[ OWNED ]</span>`
                    : html`<button class="store-buy-btn" ?disabled=${!canAfford}
                                   @click=${() => this._onBuyGear(item)}>[ BUY ]</button>`}
                </div>`;
            })}
          </div>
        ` : nothing}
        <div class="store-footer">
          <button class="store-close-btn" @click=${this._onClose}>[ CLOSE ]</button>
        </div>
      </div>`;
  }
}

customElements.define("starnet-store", StarnetStore);

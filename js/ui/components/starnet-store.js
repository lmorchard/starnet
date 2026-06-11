// <starnet-store> — Darknet broker store modal.
// Shows exploit catalog with buy buttons. Controlled by store.js bridge.
// The element itself acts as the backdrop overlay (styled via #darknet-store in CSS).

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetStore extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    catalog: { type: Array },
    cash: { type: Number },
    subtitle: { type: String },
  };

  constructor() {
    super();
    this.open = false;
    this.catalog = [];
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
      detail: { vulnId: item.vulnId, index },
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
            return html`
              <div class="store-card-row">
                <span class="store-item-name">${item.name}
                  <span class="store-item-rarity rarity-${item.rarity}">[${item.rarity}]</span>
                  <span class="store-item-vuln">${item.vulnId}</span>
                </span>
                <span class="store-item-price">¥${item.price}</span>
                <button class="store-buy-btn" ?disabled=${!canAfford}
                        @click=${() => this._onBuy(item, i + 1)}>[ BUY ]</button>
              </div>`;
          })}
        </div>
        <div class="store-footer">
          <button class="store-close-btn" @click=${this._onClose}>[ CLOSE ]</button>
        </div>
      </div>`;
  }
}

customElements.define("starnet-store", StarnetStore);

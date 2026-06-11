// <starnet-hub> — Overworld hub overlay: manage the persistent bank + exploit
// inventory, pick a loadout and how much cash to carry, and launch a target.
// Pure view: it renders props set by hub.js and dispatches intent events back.

import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StarnetElement } from "./starnet-element.js";

class StarnetHub extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    bank: { type: Number },
    inventory: { type: Array },
    loadout: { type: Array },          // selected instanceIds
    withdrawAmount: { type: Number },
    targets: { type: Array },
  };

  constructor() {
    super();
    this.open = false;
    this.bank = 0;
    this.inventory = [];
    this.loadout = [];
    this.withdrawAmount = 0;
    this.targets = [];
  }

  updated(changed) {
    if (changed.has("open")) this.style.display = this.open ? "" : "none";
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = this.open ? "" : "none";
  }

  _toggle(instanceId) {
    this.dispatchEvent(new CustomEvent("loadout-toggle", { bubbles: true, detail: { instanceId } }));
  }

  _withdraw(e) {
    this.dispatchEvent(new CustomEvent("withdraw-change", { bubbles: true, detail: { amount: Number(e.target.value) } }));
  }

  _launch(targetId) {
    this.dispatchEvent(new CustomEvent("launch", { bubbles: true, detail: { targetId } }));
  }

  _discardDisclosed() {
    this.dispatchEvent(new CustomEvent("discard-disclosed", { bubbles: true }));
  }

  _visitDarknet() {
    this.dispatchEvent(new CustomEvent("visit-darknet", { bubbles: true }));
  }

  render() {
    if (!this.open) return nothing;
    const loadout = this.loadout ?? [];
    const disclosed = (this.inventory ?? []).filter((c) => c.decayState === "disclosed").length;
    return html`
      <div class="hub-box">
        <div class="hub-title">▶ OVERWORLD HUB ◀</div>
        <div class="hub-divider">════════════════════════</div>
        <div class="hub-row"><span class="hub-key">BANK</span><span class="hub-val">¥${this.bank.toLocaleString()}</span></div>
        <div class="hub-actions">
          <button class="hub-btn" @click=${this._visitDarknet}>[ VISIT DARKNET ]</button>
        </div>

        <div class="hub-section">EXPLOIT INVENTORY — loadout ${loadout.length}/5</div>
        ${this.inventory.length === 0
          ? html`<div class="hub-empty">(inventory empty — mine or buy exploits)</div>`
          : repeat(this.inventory, (c) => c.instanceId, (c) => html`
              <div class="hub-card ${loadout.includes(c.instanceId) ? "equipped" : ""} ${c.decayState === "disclosed" ? "burned" : ""}"
                   @click=${() => this._toggle(c.instanceId)}>
                <span class="hub-card-name">${loadout.includes(c.instanceId) ? "▣" : "▢"} ${c.name}</span>
                <span class="hub-card-meta">[${c.rarity}] ${c.decayState} ×${c.usesRemaining}</span>
              </div>`)}

        <div class="hub-actions">
          <button class="hub-btn" ?disabled=${disclosed === 0} @click=${this._discardDisclosed}>
            [ DISCARD DISCLOSED${disclosed ? ` (${disclosed})` : ""} ]
          </button>
        </div>

        <div class="hub-section">CARRY CASH</div>
        <input class="hub-carry" type="number" min="0" max=${this.bank}
               .value=${String(this.withdrawAmount)} @input=${this._withdraw} />

        <div class="hub-section">AVAILABLE TARGETS</div>
        ${repeat(this.targets, (t) => t.id, (t) => html`
          <div class="hub-target" @click=${() => this._launch(t.id)}>
            <span class="hub-target-label">▸ ${t.label}</span>
            <span class="hub-target-grade">threat ${t.spec.threat} · wealth ${t.spec.wealth}</span>
          </div>`)}
      </div>`;
  }
}

customElements.define("starnet-hub", StarnetHub);

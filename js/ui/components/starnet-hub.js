// <starnet-hub> — Overworld hub overlay: manage the persistent bank + carry-all
// exploit-round hoard, pick how much cash to carry, and launch a target. The ENTIRE
// hoard is carried into every run (no loadout/equip after the E1 hoard cutover), so
// this view shows a minimal hoard summary (total + per-rarity). The rich grouped
// hoard view is Phase 7. Pure view: renders props set by hub.js, dispatches intents.

import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StarnetElement } from "./starnet-element.js";

class StarnetHub extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    bank: { type: Number },
    hoard: { type: Array },
    withdrawAmount: { type: Number },
    targets: { type: Array },
  };

  constructor() {
    super();
    this.open = false;
    this.bank = 0;
    this.hoard = [];
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
    const hoard = this.hoard ?? [];
    let common = 0, uncommon = 0, rare = 0, disclosed = 0;
    for (const r of hoard) {
      if (r.rarity === "common") common++;
      else if (r.rarity === "uncommon") uncommon++;
      else if (r.rarity === "rare") rare++;
      if (r.disclosed) disclosed++;
    }
    return html`
      <div class="hub-box">
        <div class="hub-title">▶ OVERWORLD HUB ◀</div>
        <div class="hub-divider">════════════════════════</div>
        <div class="hub-row"><span class="hub-key">BANK</span><span class="hub-val">¥${this.bank.toLocaleString()}</span></div>
        <div class="hub-actions">
          <button class="hub-btn" @click=${this._visitDarknet}>[ VISIT DARKNET ]</button>
        </div>

        <div class="hub-section">EXPLOIT HOARD</div>
        <div class="hub-hoard-summary">
          HOARD — ${hoard.length} round${hoard.length === 1 ? "" : "s"} ·
          ${common} common · ${uncommon} uncommon · ${rare} rare
        </div>

        <div class="hub-actions">
          <button class="hub-btn" ?disabled=${disclosed === 0} @click=${this._discardDisclosed}>
            [ DISCARD DISCLOSED${disclosed ? ` (${disclosed})` : ""} ]
          </button>
        </div>

        <div class="hub-section">CARRY CASH</div>
        <input class="hub-carry" type="number" min="0" max=${this.bank}
               .value=${String(this.withdrawAmount)} @input=${this._withdraw} />

        <div class="hub-section">AVAILABLE TARGETS</div>
        <div class="hub-list">
          ${repeat(this.targets, (t) => t.id, (t) => html`
            <div class="hub-target" @click=${() => this._launch(t.id)}>
              <span class="hub-target-label">▸ ${t.label}</span>
              <span class="hub-target-grade">${t.spec ? html`threat ${t.spec.threat} · wealth ${t.spec.wealth}` : "authored network"}</span>
            </div>`)}
        </div>
      </div>`;
  }
}

customElements.define("starnet-hub", StarnetHub);

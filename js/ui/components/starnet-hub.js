// <starnet-hub> — Overworld hub overlay: manage the persistent bank + carry-all
// exploit-round hoard, pick how much cash to carry, equip gear into the run loadout,
// and launch a target. The ENTIRE hoard is carried into every run. Gear equip:
// up to GEAR_SLOTS items can be equipped into the loadout that rides into the run.
// Pure view: renders props set by hub.js, dispatches intents.

import { html, nothing } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StarnetElement } from "./starnet-element.js";
import { GEAR } from "../../core/gear.js";
import { GEAR_SLOTS } from "../../core/balance.js";

class StarnetHub extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    bank: { type: Number },
    hoard: { type: Array },
    gear: { type: Array },
    loadout: { type: Array },
    withdrawAmount: { type: Number },
    targets: { type: Array },
  };

  constructor() {
    super();
    this.open = false;
    this.bank = 0;
    this.hoard = [];
    this.gear = [];
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

  _equipGear(gearId) {
    this.dispatchEvent(new CustomEvent("equip-gear", { bubbles: true, detail: { gearId } }));
  }

  _unequipGear(gearId) {
    this.dispatchEvent(new CustomEvent("unequip-gear", { bubbles: true, detail: { gearId } }));
  }

  render() {
    if (!this.open) return nothing;
    const hoard = this.hoard ?? [];
    const gear = this.gear ?? [];
    const loadout = this.loadout ?? [];
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

        ${gear.length > 0 ? html`
          <div class="hub-section">GEAR LOADOUT <span class="hub-loadout-slots">${loadout.length}/${GEAR_SLOTS}</span></div>
          <div class="hub-gear-list">
            ${gear.map((gearId) => {
              const g = GEAR[gearId];
              if (!g) return nothing;
              const equipped = loadout.includes(gearId);
              return html`
                <div class="hub-gear-item ${equipped ? "hub-gear-equipped" : ""}">
                  <span class="hub-gear-name">${g.name}</span>
                  <span class="hub-gear-kind">${g.kind}</span>
                  <span class="hub-gear-desc">${g.desc}</span>
                  ${equipped
                    ? html`<button class="hub-btn hub-gear-btn" @click=${() => this._unequipGear(gearId)}>[ UNEQUIP ]</button>`
                    : html`<button class="hub-btn hub-gear-btn"
                                   ?disabled=${loadout.length >= GEAR_SLOTS}
                                   @click=${() => this._equipGear(gearId)}>[ EQUIP ]</button>`}
                </div>`;
            })}
          </div>
        ` : nothing}

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

// <starnet-hoard> — Exploit hoard summary strip (Phase 7b minimal).
// Renders a single on-brand line showing usable round counts by rarity.
// Rich grouped/blurred view deferred to PR2 (interactive feel-port).

import { html } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetHoard extends StarnetElement {
  static properties = {
    hoard: { type: Array },
  };

  constructor() {
    super();
    this.hoard = [];
  }

  render() {
    const hoard = this.hoard ?? [];
    const usable = hoard.filter((r) => !r.disclosed);
    const total = usable.length;

    const byRarity = { common: 0, uncommon: 0, rare: 0 };
    for (const r of usable) {
      if (r.rarity in byRarity) byRarity[r.rarity]++;
    }

    return html`<div class="hoard-strip">
      <span class="hoard-label">HOARD ▚</span>
      <span class="hoard-count">${total} rounds</span>
      <span class="hoard-sep">·</span>
      <span class="hoard-rarity hoard-common">${byRarity.common}c</span>
      <span class="hoard-sep">·</span>
      <span class="hoard-rarity hoard-uncommon">${byRarity.uncommon}u</span>
      <span class="hoard-sep">·</span>
      <span class="hoard-rarity hoard-rare">${byRarity.rare}r</span>
    </div>`;
  }
}

customElements.define("starnet-hoard", StarnetHoard);

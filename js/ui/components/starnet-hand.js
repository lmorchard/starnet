// <starnet-hand> — Exploit card hand component.
// Receives sorted cards, selected node, and execution state from visual-renderer.js bridge.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { exploitCardBody } from "./exploit-card-view.js";
import { matchingVulnIds, wearFraction } from "../../core/exploits.js";

class StarnetHand extends StarnetElement {
  static properties = {
    cards: { type: Array },
    selectedNode: { type: Object },
    executingCardId: { type: String },
    execProgress: { type: Number },
    isSelecting: { type: Boolean },
    selectedNodeId: { type: String },
  };

  constructor() {
    super();
    this.cards = [];
    this.selectedNode = null;
    this.executingCardId = null;
    this.execProgress = 0;
    this.isSelecting = false;
    this.selectedNodeId = "";
  }

  _onCardClick(card, index) {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId: "xploit", nodeId: this.selectedNodeId, exploitId: card.id, cardIndex: index },
    }));
  }

  _onCancel() {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId: "abort" },
    }));
  }

  render() {
    const executing = !!this.executingCardId;
    const handClass = ["nd-hand",
      this.isSelecting ? "selectable" : "",
      executing ? "exploit-hand-executing" : "",
    ].filter(Boolean).join(" ");

    return html`
      <div class="${handClass}">
        ${this.cards.length === 0
          ? html`<span class="nd-dim">No exploits in hand.</span>`
          : this.cards.map((c, i) => this._renderCard(c, i + 1))}
      </div>`;
  }

  _renderCard(card, index) {
    const isExec = this.executingCardId === card.id;
    const disclosed = card.decayState === "disclosed";
    const worn = card.decayState === "worn";

    // Only usable cards participate in match highlighting — a disclosed or
    // used-up card can't be played, so it should never read as a match.
    const usable = !disclosed && card.usesRemaining > 0;
    let matchClass = "";
    let matchedVulnIds = [];
    if (this.selectedNode?.probed && !isExec && usable) {
      matchedVulnIds = matchingVulnIds(card, this.selectedNode);
      matchClass = matchedVulnIds.length > 0 ? "match" : "no-match";
    }

    const isSelectable = this.isSelecting && !disclosed;
    const classes = [
      "exploit-card", `rarity-${card.rarity}`,
      disclosed ? "disclosed" : "",
      worn ? "worn" : "",
      matchClass,
      isSelectable ? "selectable-card" : "",
      isExec ? "executing" : "",
    ].filter(Boolean).join(" ");

    const execPct = isExec ? Math.min(100, Math.round(this.execProgress * 100)) : 0;

    return html`
      <div class="${classes}"
           style=${`--wear:${wearFraction(card)}`}
           @click=${isSelectable ? () => this._onCardClick(card, index) : null}>
        ${exploitCardBody(card, `${index}.`, matchedVulnIds)}
        <div class="ec-executing-label">▶ EXECUTING — ${execPct}%</div>
        ${isExec ? html`
          <div class="ec-cancel-overlay" @click=${(e) => { e.stopPropagation(); this._onCancel(); }}>
            <span class="ec-cancel-x">✕</span>
          </div>` : nothing}
      </div>`;
  }
}

customElements.define("starnet-hand", StarnetHand);

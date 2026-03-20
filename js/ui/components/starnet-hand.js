// <starnet-hand> — Exploit card hand component.
// Receives sorted cards, selected node, and execution state from visual-renderer.js bridge.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

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
    const qualityPips = Math.round(card.quality * 5);
    const pips = "█".repeat(qualityPips) + "░".repeat(5 - qualityPips);

    let matchClass = "";
    if (this.selectedNode?.probed && !isExec) {
      const knownVulnIds = this.selectedNode.vulnerabilities
        .filter((v) => !v.patched && !v.hidden)
        .map((v) => v.id);
      const hasMatch = card.targetVulnTypes.some((t) => knownVulnIds.includes(t));
      matchClass = hasMatch ? "match" : "no-match";
    }

    const isSelectable = this.isSelecting && !disclosed;
    const classes = [
      "exploit-card", `rarity-${card.rarity}`,
      disclosed ? "disclosed" : "",
      matchClass,
      isSelectable ? "selectable-card" : "",
      isExec ? "executing" : "",
    ].filter(Boolean).join(" ");

    const execPct = isExec ? Math.min(100, Math.round(this.execProgress * 100)) : 0;

    return html`
      <div class="${classes}"
           @click=${isSelectable ? () => this._onCardClick(card, index) : null}>
        <div class="ec-header">
          <span class="ec-index">${index}.</span>
          <span class="ec-name">${card.name}</span>
        </div>
        <div class="ec-row">
          <span class="ec-key">QUAL</span>
          <span class="ec-pips">${pips}</span>
        </div>
        <div class="ec-row">
          <span class="ec-key">USES</span>
          <span class="ec-val">${disclosed ? "DISCLOSED" : worn ? `${card.usesRemaining} (worn)` : card.usesRemaining}</span>
        </div>
        <div class="ec-vulns">${card.targetVulnTypes.map((t) => html`<div class="ec-vuln">${t}</div>`)}</div>
        <div class="ec-executing-label">▶ EXECUTING — ${execPct}%</div>
        ${isExec ? html`
          <div class="ec-cancel-overlay" @click=${(e) => { e.stopPropagation(); this._onCancel(); }}>
            <span class="ec-cancel-x">✕</span>
          </div>` : nothing}
      </div>`;
  }
}

customElements.define("starnet-hand", StarnetHand);

// <starnet-end-screen> — Game over overlay component.
// Shows run outcome, score stats, and run-again button.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetEndScreen extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    outcome: { type: String },
    cash: { type: Number },
    missionComplete: { type: Boolean },
    hasMission: { type: Boolean },
    nodesCompromised: { type: Number },
    nodesOwned: { type: Number },
    macguffinsLooted: { type: Number },
    isCheating: { type: Boolean },
  };

  constructor() {
    super();
    this.open = false;
    this.outcome = "";
    this.cash = 0;
    this.missionComplete = false;
    this.hasMission = false;
    this.nodesCompromised = 0;
    this.nodesOwned = 0;
    this.macguffinsLooted = 0;
    this.isCheating = false;
  }

  updated(changed) {
    if (changed.has("open")) {
      this.style.display = this.open ? "" : "none";
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = this.open ? "" : "none";
  }

  _onRunAgain() {
    this.open = false;
    this.dispatchEvent(new CustomEvent("run-again", { bubbles: true }));
  }

  render() {
    if (!this.open) return nothing;

    const failed = this.outcome === "caught"
      || this.outcome === "burned"
      || this.outcome === "bricked";
    const title =
      this.outcome === "caught"  ? "▶ TRACED ◀" :
      this.outcome === "burned"  ? "▶ FLATLINED ◀" :
      this.outcome === "bricked" ? "▶ DECK FRIED ◀" :
                                   "▶ RUN COMPLETE ◀";

    return html`
      <div class="end-box">
        <div class="end-title">${title}</div>
        <div class="end-divider">════════════════════════</div>
        <div class="end-row">
          <span class="end-key">CASH EXTRACTED</span>
          <span class="end-val ${failed ? "end-zero" : ""}">¥${this.cash.toLocaleString()}</span>
        </div>
        ${this.hasMission ? html`
          <div class="end-row">
            <span class="end-key">MISSION</span>
            <span class="end-val ${this.missionComplete ? "end-mission-complete" : "end-zero"}">
              ${this.missionComplete ? "COMPLETE" : "FAILED"}
            </span>
          </div>
        ` : nothing}
        <div class="end-row">
          <span class="end-key">NODES COMPROMISED</span>
          <span class="end-val">${this.nodesCompromised}</span>
        </div>
        <div class="end-row">
          <span class="end-key">NODES OWNED</span>
          <span class="end-val">${this.nodesOwned}</span>
        </div>
        <div class="end-row">
          <span class="end-key">MACGUFFINS LOOTED</span>
          <span class="end-val">${this.macguffinsLooted}</span>
        </div>
        <div class="end-divider">════════════════════════</div>
        <button class="end-btn" @click=${this._onRunAgain}>[ RETURN TO HUB ]</button>
      </div>`;
  }
}

customElements.define("starnet-end-screen", StarnetEndScreen);

// <starnet-action-choices> — generic node-anchored follow-up choice panel.
// Driven by visual-renderer.js: receives a title, an actionId, the nodeId, and a
// choices array ([{ id, payloadKey, render, data }]). Picking a choice re-dispatches
// the SAME starnet:action event (with the choice's payload) that the hand/console fire,
// so core dispatch is unchanged. Cancel/ESC emits starnet:choices-close.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { exploitCardBody } from "./exploit-card-view.js";
import { wearFraction } from "../../core/exploits.js";

class StarnetActionChoices extends StarnetElement {
  static properties = {
    title: { type: String },
    actionId: { type: String },
    nodeId: { type: String },
    choices: { type: Array },
    visible: { type: Boolean },
  };

  constructor() {
    super();
    this.title = "";
    this.actionId = "";
    this.nodeId = "";
    /** @type {Array<{id: string, payloadKey: string, render: string, data: any}>} */
    this.choices = [];
    this.visible = false;
    this._onKeydown = this._onKeydown.bind(this);
  }

  updated(changed) {
    if (changed.has("visible") || changed.has("choices")) {
      this.style.display = (this.visible && this.choices && this.choices.length) ? "block" : "none";
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = this.visible ? "" : "none";
    document.addEventListener("keydown", this._onKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKeydown);
    super.disconnectedCallback();
  }

  _onKeydown(e) {
    if (this.visible && e.key === "Escape") this._close();
  }

  _pick(choice) {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId: this.actionId, nodeId: this.nodeId, [choice.payloadKey]: choice.id },
    }));
    this._close();
  }

  _close() {
    this.dispatchEvent(new CustomEvent("starnet:choices-close", { bubbles: true }));
  }

  _renderChoice(choice) {
    if (choice.render === "exploit-card") {
      // Mirror the hand: light the shared glyph(s) + apply the match glow when the
      // node reveals a target. Pre-probe (blind play) matchedVulnIds is empty, so
      // candidates render neutral rather than falsely highlighted.
      const matched = choice.matchedVulnIds || [];
      const worn = choice.data.decayState === "worn";
      return html`
        <div class="exploit-card rarity-${choice.data.rarity} selectable-card ${matched.length ? "match" : ""} ${worn ? "worn" : ""}"
             style=${`--wear:${wearFraction(choice.data)}`}
             @click=${() => this._pick(choice)}>
          ${exploitCardBody(choice.data, undefined, matched)}
        </div>`;
    }
    if (choice.render === "action") {
      return html`
        <button class="ctx-item" @click=${() => this._pick(choice)}>
          [ ${choice.data.label} ]${choice.data.desc
            ? html`<span class="ctx-item-desc">${choice.data.desc}</span>`
            : nothing}
        </button>`;
    }
    return nothing;
  }

  render() {
    if (!this.visible || !this.choices || this.choices.length === 0) return nothing;
    return html`
      <div class="ac-header">
        <span class="ac-title">${this.title}</span>
        <button class="ac-close" @click=${() => this._close()}>✕</button>
      </div>
      <div class="ac-choices">
        ${this.choices.map((ch) => this._renderChoice(ch))}
      </div>`;
  }
}

customElements.define("starnet-action-choices", StarnetActionChoices);

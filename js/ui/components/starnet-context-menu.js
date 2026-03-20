// <starnet-context-menu> — Action menu overlay on graph.
// Receives available actions and node ID from visual-renderer.js bridge.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetContextMenu extends StarnetElement {
  static properties = {
    actions: { type: Array },
    nodeId: { type: String },
    visible: { type: Boolean },
  };

  constructor() {
    super();
    /** @type {Array<{ id: string, label: string, desc: string }>} */
    this.actions = [];
    this.nodeId = "";
    this.visible = false;
  }

  _onAction(actionId) {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId, nodeId: this.nodeId },
    }));
  }

  render() {
    if (!this.visible || !this.actions || this.actions.length === 0) return nothing;

    return html`${this.actions.map((a) => html`
      <button class="ctx-item" @click=${() => this._onAction(a.id)}>
        [ ${a.label} ]${a.desc ? html`<span class="ctx-item-desc">${a.desc}</span>` : nothing}
      </button>
    `)}`;
  }
}

customElements.define("starnet-context-menu", StarnetContextMenu);

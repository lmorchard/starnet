// <starnet-context-menu> — Action menu overlay on graph.
// Receives available actions and node ID from visual-renderer.js bridge.
// Items may be { id, label, desc, disabled?, disabledReason?, hasFollowup? }.
// - normal item    → emits starnet:action { actionId, nodeId }
// - followup item   → emits starnet:open-choices { actionId, nodeId } (UI opens a picker)
// - disabled item  → not clickable; shows disabledReason as a tooltip

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
    /** @type {Array<{ id: string, label: string, desc: string, disabled?: boolean, disabledReason?: string, hasFollowup?: boolean }>} */
    this.actions = [];
    this.nodeId = "";
    this.visible = false;
  }

  _emit(name, actionId) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: { actionId, nodeId: this.nodeId },
    }));
  }

  render() {
    if (!this.visible || !this.actions || this.actions.length === 0) return nothing;

    return html`${this.actions.map((a) => {
      if (a.disabled) {
        return html`
          <button class="ctx-item ctx-disabled" disabled title=${a.disabledReason || ""}>
            [ ${a.label} ]${a.disabledReason ? html`<span class="ctx-item-desc">${a.disabledReason}</span>` : nothing}
          </button>`;
      }
      const event = a.hasFollowup ? "starnet:open-choices" : "starnet:action";
      return html`
        <button class="ctx-item" @click=${() => this._emit(event, a.id)}>
          [ ${a.label} ]${a.desc ? html`<span class="ctx-item-desc">${a.desc}</span>` : nothing}
        </button>`;
    })}`;
  }
}

customElements.define("starnet-context-menu", StarnetContextMenu);

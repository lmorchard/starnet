// <starnet-uplink> — Floating uplink control beneath the vital traces.
// Driven by visual-renderer from game state:
//   VISIT WAN  → selects the WAN node (its inspector exposes ACCESS DARKNET /
//                LIE LOW / DISCONNECT). Shown whenever a WAN node exists.
//   JACK OUT   → the escape hatch, stacked beneath VISIT WAN when alert is
//                elevated or a trace is counting down. VISIT WAN stays available
//                so the player can still hop to the WAN to LIE LOW under pressure.
// Dispatches the shared bubbling `starnet:action` event (forwarded by main.js),
// so no bespoke wiring is required.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetUplink extends StarnetElement {
  static properties = {
    danger: { type: Boolean },     // alert elevated or trace counting down
    visible: { type: Boolean },
    wanNodeId: { type: String },
  };

  constructor() {
    super();
    this.danger = false;
    this.visible = false;
    this.wanNodeId = "";
  }

  _action(actionId, extra = {}) {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId, ...extra },
    }));
  }

  render() {
    if (!this.visible) return nothing;
    return html`
      ${this.wanNodeId ? html`
        <button class="uplink-btn"
                @click=${() => this._action("target", { nodeId: this.wanNodeId })}>
          [ VISIT WAN ]
        </button>` : nothing}
      ${this.danger ? html`
        <button class="uplink-btn uplink-danger"
                @click=${() => this._action("jackout")}>
          [ JACK OUT ]
        </button>` : nothing}`;
  }
}

customElements.define("starnet-uplink", StarnetUplink);

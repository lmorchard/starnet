// <starnet-uplink> — Floating uplink control beneath the vital traces.
// Two modes, driven by visual-renderer from game state:
//   "visit"   → "[ VISIT WAN ]" selects the WAN node (its inspector exposes
//               ACCESS DARKNET / LIE LOW / DISCONNECT).
//   "jackout" → "[ JACK OUT ]" replaces it when alert is elevated or a trace is
//               counting down — the escape hatch, surfaced exactly when needed.
// Dispatches the shared bubbling `starnet:action` event (forwarded by main.js),
// so no bespoke wiring is required.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetUplink extends StarnetElement {
  static properties = {
    mode: { type: String },        // "visit" | "jackout"
    visible: { type: Boolean },
    wanNodeId: { type: String },
  };

  constructor() {
    super();
    this.mode = "visit";
    this.visible = false;
    this.wanNodeId = "";
  }

  _action(actionId, extra = {}) {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId, ...extra },
    }));
  }

  _onClick() {
    if (this.mode === "jackout") {
      this._action("jackout");
    } else if (this.wanNodeId) {
      this._action("target", { nodeId: this.wanNodeId });
    }
  }

  render() {
    if (!this.visible) return nothing;
    const jackout = this.mode === "jackout";
    return html`
      <button class="uplink-btn ${jackout ? "uplink-danger" : ""}"
              @click=${() => this._onClick()}>
        ${jackout ? "[ JACK OUT ]" : "[ VISIT WAN ]"}
      </button>`;
  }
}

customElements.define("starnet-uplink", StarnetUplink);

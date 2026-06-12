// <starnet-hud> — Header bar component.
// Shows alert level, wallet, trace countdown, connection status, and action buttons.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { alertLampDataUri, connStatusDataUri } from "../indicator-glyphs.js";

class StarnetHud extends StarnetElement {
  static properties = {
    alert: { type: String },
    cash: { type: Number },
    traceSeconds: { type: Number },
    connectionStatus: { type: String },
    connectionLabel: { type: String },
    isCheating: { type: Boolean },
    phase: { type: String },
    paused: { type: Boolean },
  };

  constructor() {
    super();
    this.alert = "green";
    this.cash = 0;
    this.traceSeconds = null;
    this.connectionStatus = "";
    this.connectionLabel = "PASSIVE SCAN";
    this.isCheating = false;
    this.phase = "";
    this.paused = false;
  }

  _emit(action, detail = {}) {
    this.dispatchEvent(new CustomEvent("hud-action", {
      bubbles: true, detail: { action, ...detail },
    }));
  }

  _onLoadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    this._emit("load", { file });
    e.target.value = "";
  }

  render() {
    const alertColor =
      this.alert === "green"  ? "var(--green)" :
      this.alert === "yellow" ? "var(--yellow)" :
                                 "var(--red)";

    return html`
      <span class="hud-title">★ STARNET</span>

      <div id="hud-connection">
        <img class="hud-lamp" id="conn-dot" alt="link ${this.connectionStatus}" src=${connStatusDataUri(this.connectionStatus)}>
        <span class="hud-value ${this.connectionStatus}" id="conn-status">${this.connectionLabel}</span>
      </div>

      <div class="hud-alert">
        <img class="hud-lamp" id="alert-dot" alt="alert ${this.alert}" src=${alertLampDataUri(this.alert)}>
        <span class="hud-label">ALERT:</span>
        <span class="hud-value" id="alert-level" style="color:${alertColor}">${this.alert.toUpperCase()}</span>
      </div>

      <span class="hud-label">WALLET:</span>
      <span class="hud-value" id="wallet">¥${this.cash.toLocaleString()}</span>

      ${this.traceSeconds !== null && this.phase === "playing" ? html`
        <span id="trace-countdown" class="hud-value trace-countdown">TRACE: ${this.traceSeconds}s</span>
      ` : nothing}

      <button id="new-run-btn" title="Start a new run with custom parameters"
              @click=${() => this._emit("new-run")}>[ NEW RUN ]</button>
      <button id="pause-btn" class="${this.paused ? "active" : ""}"
              @click=${() => this._emit("pause")}>${this.paused ? "[ RESUME ]" : "[ PAUSE ]"}</button>
      <button id="save-btn" title="Save game state to file"
              @click=${() => this._emit("save")}>[ SAVE ]</button>
      <label id="load-btn" title="Load game state from file">[ LOAD ]
        <input id="load-file-input" type="file" accept=".json" style="display:none"
               @change=${this._onLoadFile} />
      </label>
      <button id="jack-out-btn" ?disabled=${this.phase !== "playing"}
              @click=${() => this._emit("jackout")}>[ JACK OUT ]</button>

      ${this.isCheating ? html`
        <span id="cheat-label" class="hud-cheat-label">// CHEAT</span>
      ` : nothing}
    `;
  }
}

customElements.define("starnet-hud", StarnetHud);

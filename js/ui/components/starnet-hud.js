// <starnet-hud> — Status bar component (sits above the terminal).
// Shows alert level, wallet, trace countdown, connection status, mission, and action buttons.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { alertLampDataUri, connStatusDataUri, missionMarkDataUri } from "../indicator-glyphs.js";

class StarnetHud extends StarnetElement {
  static properties = {
    alert: { type: String },
    cash: { type: Number },
    programNoise: { type: Number },
    traceSeconds: { type: Number },
    connectionStatus: { type: String },
    connectionLabel: { type: String },
    isCheating: { type: Boolean },
    phase: { type: String },
    paused: { type: Boolean },
    mission: { type: Object },
    menuOpen: { type: Boolean },
    musicEnabled: { type: Boolean },
    sfxEnabled: { type: Boolean },
  };

  constructor() {
    super();
    this.alert = "green";
    this.cash = 0;
    this.programNoise = 0;
    this.traceSeconds = null;
    this.connectionStatus = "";
    this.connectionLabel = "PASSIVE SCAN";
    this.isCheating = false;
    this.phase = "";
    this.paused = false;
    this.mission = null;
    this.menuOpen = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
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

  _renderMission() {
    if (!this.mission) return nothing;

    let statusClass, statusContent;
    if (this.mission.complete) {
      statusClass = "mission-status-complete";
      statusContent = html`<img class="mission-mark" alt="complete" src=${missionMarkDataUri("complete")}> COMPLETE`;
    } else if (this.phase === "ended") {
      statusClass = "mission-status-failed";
      statusContent = html`<img class="mission-mark" alt="failed" src=${missionMarkDataUri("failed")}> FAILED`;
    } else {
      statusClass = "mission-status-active";
      statusContent = html`▶ ACTIVE`;
    }

    return html`
      <div id="hud-mission">
        <span class="hud-mission-target">⬡ ${this.mission.targetName}</span>
        <span class="hud-mission-status ${statusClass}">${statusContent}</span>
      </div>
    `;
  }

  render() {
    const alertColor =
      this.alert === "green"  ? "var(--green)" :
      this.alert === "yellow" ? "var(--yellow)" :
                                 "var(--red)";

    return html`
      <div id="hud-connection">
        <img class="hud-lamp" id="conn-dot" alt="link ${this.connectionStatus}" src=${connStatusDataUri(this.connectionStatus)}>
        <span class="hud-value ${this.connectionStatus}" id="conn-status">${this.connectionLabel}</span>
      </div>

      <div class="hud-alert">
        <img class="hud-lamp" id="alert-dot" alt="alert ${this.alert}" src=${alertLampDataUri(this.alert)}>
        <span class="hud-label">ALERT:</span>
        <span class="hud-value" id="alert-level" style="color:${alertColor}">${this.alert.toUpperCase()}</span>
        ${this.phase === "playing" ? html`
          <span class="hud-label">NOISE:</span>
          <span class="hud-value" id="noise-level">${this.programNoise ?? 0}</span>
        ` : nothing}
      </div>

      <span class="hud-label">WALLET:</span>
      <span class="hud-value" id="wallet">¥${this.cash.toLocaleString()}</span>

      ${this.traceSeconds !== null && this.phase === "playing" ? html`
        <span id="trace-countdown" class="hud-value trace-countdown">TRACE: ${this.traceSeconds}s</span>
      ` : nothing}

      ${this._renderMission()}

      ${this._renderCheatLabel()}

      <div class="hud-menu-wrap">
        <button id="hud-menu-btn" class=${this.menuOpen ? "active" : ""} title="Toggle controls"
                @click=${() => this._emit("toggle-menu")}>[ ☰ ]</button>

        <div id="hud-menu" class=${this.menuOpen ? "open" : "closed"}>
          <button id="new-run-btn" title="Start a new run with custom parameters"
                  @click=${() => this._emit("new-run")}>[ NEW RUN ]</button>
          <button id="pause-btn" class="${this.paused ? "active" : ""}"
                  @click=${() => this._emit("pause")}>${this.paused ? "[ RESUME ]" : "[ PAUSE ]"}</button>
          <button id="music-btn" title="Toggle music"
                  @click=${() => this._emit("toggle-music")}>${this.musicEnabled ? "[ MUSIC: ON ]" : "[ MUSIC: OFF ]"}</button>
          <button id="sfx-btn" title="Toggle sound effects"
                  @click=${() => this._emit("toggle-sfx")}>${this.sfxEnabled ? "[ SFX: ON ]" : "[ SFX: OFF ]"}</button>
          <button id="save-btn" title="Save game state to file"
                  @click=${() => this._emit("save")}>[ SAVE ]</button>
          <label id="load-btn" title="Load game state from file">[ LOAD ]
            <input id="load-file-input" type="file" accept=".json" style="display:none"
                   @change=${this._onLoadFile} />
          </label>
        </div>
      </div>
    `;
  }

  // // CHEAT indicator — shown in the status bar when cheats are active.
  // `isCheating` is fed by the renderer.
  _renderCheatLabel() {
    return this.isCheating
      ? html`<span id="cheat-label" class="hud-cheat-label">// CHEAT</span>`
      : nothing;
  }
}

customElements.define("starnet-hud", StarnetHud);

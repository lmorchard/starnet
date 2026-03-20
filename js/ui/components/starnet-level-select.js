// <starnet-level-select> — Level/seed selection modal.
// Form-heavy component: user picks network, seed, and difficulty params.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

const GRADES = ["F", "D", "C", "B", "A", "S"];

const NETWORK_OPTIONS = [
  { value: "corporate-foothold", label: "Corporate Foothold", desc: "Tutorial. No ICE." },
  { value: "research-station", label: "Research Station", desc: "Circuit puzzles. No ICE." },
  { value: "corporate-exchange", label: "Corporate Exchange", desc: "Aggressive ICE." },
  { value: "generated", label: "// GENERATED //", desc: "Procedural network." },
];

class StarnetLevelSelect extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    defaults: { type: Object },
  };

  constructor() {
    super();
    this.open = false;
    this.defaults = {};
    // Internal form state
    this._network = "corporate-foothold";
    this._seed = "";
    this._threat = "C";
    this._wealth = "B";
    this._complexity = "C";
    this._depth = "C";
  }

  updated(changed) {
    if (changed.has("open")) {
      this.style.display = this.open ? "" : "none";
      if (this.open) this._initFromDefaults();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = this.open ? "" : "none";
    this.addEventListener("click", this._onBackdropClick);
  }

  _initFromDefaults() {
    const d = this.defaults || {};
    this._network = d.network || "corporate-foothold";
    this._seed = d.seed || "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
    this._threat = d.threat || "C";
    this._wealth = d.wealth || "B";
    this._complexity = d.complexity || "C";
    this._depth = d.depth || "C";
    this.requestUpdate();
  }

  _onClose() {
    this.dispatchEvent(new CustomEvent("close", { bubbles: true }));
  }

  _onBackdropClick = (e) => {
    if (!e.target.closest(".level-select-box")) this._onClose();
  };

  _onRandomSeed() {
    this._seed = "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
    this.requestUpdate();
  }

  _onGo() {
    if (!this._seed.trim()) return;

    const url = new URL(location.href);
    url.searchParams.set("network", this._network);
    url.searchParams.set("seed", this._seed.trim());

    if (this._network === "generated") {
      url.searchParams.set("threat", this._threat);
      url.searchParams.set("wealth", this._wealth);
      url.searchParams.set("complexity", this._complexity);
      url.searchParams.set("depth", this._depth);
      url.searchParams.delete("time");
      url.searchParams.delete("money");
    } else {
      url.searchParams.delete("threat");
      url.searchParams.delete("wealth");
      url.searchParams.delete("complexity");
      url.searchParams.delete("depth");
    }

    this.dispatchEvent(new CustomEvent("start", {
      bubbles: true,
      detail: { url: url.toString() },
    }));
  }

  _onSeedKeydown(e) {
    if (e.key === "Enter") this._onGo();
  }

  render() {
    if (!this.open) return nothing;

    const isGenerated = this._network === "generated";

    return html`
      <div class="level-select-box">
        <div class="level-select-header">// NEW RUN</div>
        <div class="level-select-form">
          <label class="level-select-label">
            NETWORK
            <select class="level-select-select"
                    @change=${(e) => { this._network = e.target.value; this.requestUpdate(); }}>
              ${NETWORK_OPTIONS.map(n => html`
                <option value="${n.value}" ?selected=${n.value === this._network}>${n.label}</option>
              `)}
            </select>
          </label>
          <label class="level-select-label">
            SEED
            <input type="text" class="level-select-input" .value=${this._seed}
                   @input=${(e) => { this._seed = e.target.value; }}
                   @keydown=${this._onSeedKeydown} />
          </label>
          ${isGenerated ? html`
            <div>
              ${this._gradeField("THREAT", this._threat, "Security, ICE, pressure", (v) => { this._threat = v; })}
              ${this._gradeField("WEALTH", this._wealth, "Loot density, cash rewards", (v) => { this._wealth = v; })}
              ${this._gradeField("COMPLEXITY", this._complexity, "Puzzles, gates", (v) => { this._complexity = v; })}
              ${this._gradeField("DEPTH", this._depth, "Hops from gateway to deepest node", (v) => { this._depth = v; })}
            </div>
          ` : nothing}
        </div>
        <div class="level-select-actions">
          <button class="level-select-btn" @click=${() => this._onRandomSeed()}>[ RANDOM SEED ]</button>
          <button class="level-select-btn level-select-go" @click=${() => this._onGo()}>[ JACK IN ]</button>
          <button class="level-select-btn" @click=${() => this._onClose()}>[ CANCEL ]</button>
        </div>
      </div>`;
  }

  _gradeField(label, value, hint, onChange) {
    return html`
      <label class="level-select-label">
        ${label}
        <select class="level-select-select"
                @change=${(e) => { onChange(e.target.value); }}>
          ${GRADES.map(g => html`<option value="${g}" ?selected=${g === value}>${g}</option>`)}
        </select>
        <span class="level-select-hint">${hint}</span>
      </label>`;
  }
}

customElements.define("starnet-level-select", StarnetLevelSelect);

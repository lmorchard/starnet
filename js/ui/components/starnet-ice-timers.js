// <starnet-ice-timers> — Timer display component.
// Shows active ICE/action timers in the sidebar node panel.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetIceTimers extends StarnetElement {
  static properties = {
    timers: { type: Array },
  };

  constructor() {
    super();
    /** @type {Array<{ label: string, remaining: number, progress: number }>} */
    this.timers = [];
  }

  render() {
    if (!this.timers || this.timers.length === 0) return nothing;

    return html`
      <div class="ice-timers">
        ${this.timers.map((t) => {
          const cls = t.label === "ICE DETECTION" ? "ice-timer-detect"
            : t.label === "EXECUTING"      ? "ice-timer-executing"
            : t.label === "SCANNING"       ? "ice-timer-scanning"
            : t.label === "READING"        ? "ice-timer-scanning"
            : t.label === "EXTRACTING"     ? "ice-timer-scanning"
            : "ice-timer-reboot";
          return html`<div class="ice-timer ${cls}">⚠ ${t.label}: ${t.remaining}s</div>`;
        })}
      </div>`;
  }
}

customElements.define("starnet-ice-timers", StarnetIceTimers);

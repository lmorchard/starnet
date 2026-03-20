// <starnet-log> — Log pane component.
// Receives entries array from log-renderer.js bridge, renders log lines.

import { html } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { StarnetElement } from "./starnet-element.js";

class StarnetLog extends StarnetElement {
  static properties = {
    entries: { type: Array },
  };

  constructor() {
    super();
    /** @type {Array<{ text: string, type: string }>} */
    this.entries = [];
    /** @private */
    this._wasNearBottom = true;
  }

  willUpdate() {
    // Capture scroll position before render
    this._wasNearBottom =
      this.scrollTop + this.clientHeight >= this.scrollHeight - 20;
  }

  updated() {
    // Auto-scroll to bottom if user was already near bottom
    if (this._wasNearBottom) {
      this.scrollTop = this.scrollHeight;
    }
  }

  render() {
    return html`${repeat(
      this.entries,
      (_entry, i) => i,
      (entry) => html`<div class="log-entry log-${entry.type}">${entry.text}</div>`
    )}`;
  }
}

customElements.define("starnet-log", StarnetLog);

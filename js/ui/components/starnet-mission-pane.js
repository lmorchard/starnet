// <starnet-mission-pane> — Mission briefing sidebar component.
// Receives mission object and game phase from visual-renderer.js bridge.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetMissionPane extends StarnetElement {
  static properties = {
    mission: { type: Object },
    phase: { type: String },
  };

  constructor() {
    super();
    this.mission = null;
    this.phase = "";
  }

  render() {
    if (!this.mission) return nothing;

    let statusClass, statusText;
    if (this.mission.complete) {
      statusClass = "mission-status-complete";
      statusText = "STATUS: ██ COMPLETE";
    } else if (this.phase === "ended") {
      statusClass = "mission-status-failed";
      statusText = "STATUS: ░░ FAILED";
    } else {
      statusClass = "mission-status-active";
      statusText = "STATUS: ▶ ACTIVE";
    }

    return html`
      <div class="mission-label">// MISSION</div>
      <div class="mission-target">⬡ ${this.mission.targetName}</div>
      <div class="${statusClass}">${statusText}</div>`;
  }
}

customElements.define("starnet-mission-pane", StarnetMissionPane);

// <starnet-mission-pane> — Mission briefing sidebar component.
// Receives mission object and game phase from visual-renderer.js bridge.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { missionMarkDataUri } from "../indicator-glyphs.js";

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

    let statusClass, statusContent;
    if (this.mission.complete) {
      statusClass = "mission-status-complete";
      statusContent = html`STATUS: <img class="mission-mark" alt="" src=${missionMarkDataUri("complete")}> COMPLETE`;
    } else if (this.phase === "ended") {
      statusClass = "mission-status-failed";
      statusContent = html`STATUS: <img class="mission-mark" alt="" src=${missionMarkDataUri("failed")}> FAILED`;
    } else {
      statusClass = "mission-status-active";
      statusContent = html`STATUS: ▶ ACTIVE`;
    }

    return html`
      <div class="mission-label">// MISSION</div>
      <div class="mission-target">⬡ ${this.mission.targetName}</div>
      <div class="${statusClass}">${statusContent}</div>`;
  }
}

customElements.define("starnet-mission-pane", StarnetMissionPane);

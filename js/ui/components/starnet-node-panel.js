// <starnet-node-panel> — Sidebar node detail component.
// Shows node type, grade, access, alert, vulnerabilities, macguffins, and ICE timers.

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";

class StarnetNodePanel extends StarnetElement {
  static properties = {
    node: { type: Object },
    selectedNodeId: { type: String },
    timers: { type: Array },
  };

  constructor() {
    super();
    this.node = null;
    this.selectedNodeId = "";
    this.timers = [];
  }

  _onUntarget() {
    this.dispatchEvent(new CustomEvent("starnet:action", {
      bubbles: true,
      detail: { actionId: "untarget" },
    }));
  }

  render() {
    if (!this.selectedNodeId || !this.node) {
      return html`<div class="sidebar-placeholder">
        &gt; SELECT A NODE<br />&gt; TO BEGIN INTRUSION
      </div>`;
    }

    const node = this.node;

    // Unknown/unrevealed node
    if (node.visibility === "revealed") {
      return html`<div class="sidebar-placeholder">
        [???] UNKNOWN NODE<br /><br />
        Signal detected on network.<br />
        Gain access to a connected node<br />to probe further.
      </div>`;
    }

    const alertState = node.alertState || "green";
    const alertColor =
      alertState === "green"  ? "var(--green)" :
      alertState === "yellow" ? "var(--yellow)" :
                                 "var(--red)";

    const visibleVulns = (node.vulnerabilities || []).filter((v) => !v.hidden);

    return html`
      <div class="node-detail">
        <div class="nd-header">
          <span class="nd-type">[${node.type.toUpperCase()}]</span>
          <span class="nd-label">${node.label}</span>
          <button class="untarget-btn" @click=${this._onUntarget}>[ UNTARGET ]</button>
        </div>
        <div class="nd-row">
          <span class="nd-key">GRADE</span>
          <span class="nd-val grade-${node.grade || ""}">${node.grade || "—"}</span>
        </div>
        <div class="nd-row">
          <span class="nd-key">ACCESS</span>
          <span class="nd-val">${node.accessLevel.toUpperCase()}</span>
        </div>
        <div class="nd-row">
          <span class="nd-key">ALERT</span>
          <span class="nd-val" style="color:${alertColor}">● ${alertState.toUpperCase()}</span>
        </div>
        <div class="nd-divider">──────────────────</div>
        ${this._renderVulns(node, visibleVulns)}
        ${this._renderMacguffins(node)}
        <div class="nd-divider">──────────────────</div>
        <starnet-ice-timers class="ice-timers-slot" .timers=${this.timers}></starnet-ice-timers>
      </div>`;
  }

  _renderVulns(node, visibleVulns) {
    if (!node.probed) {
      return html`<div class="nd-dim nd-indent">Run PROBE to reveal vulnerabilities.</div>`;
    }
    return html`
      <div class="nd-section-label">VULNERABILITIES</div>
      <div class="nd-vulns">
        ${visibleVulns.map((v) => html`
          <div class="nd-vuln ${v.patched ? "patched" : ""}">
            <span class="vuln-name">${v.name}</span>
            <span class="vuln-rarity rarity-${v.rarity}">[${v.rarity.toUpperCase()}]</span>
          </div>
        `)}
      </div>`;
  }

  _renderMacguffins(node) {
    if (!node.read) return nothing;
    if (node.macguffins.length === 0) {
      return html`
        <div class="nd-divider">──────────────────</div>
        <div class="nd-dim nd-indent">No valuables detected.</div>`;
    }
    return html`
      <div class="nd-divider">──────────────────</div>
      <div class="nd-section-label">CONTENTS</div>
      <div class="nd-macguffins">
        ${node.macguffins.map((m) => html`
          <div class="macguffin ${m.collected ? "collected" : ""} ${m.isMission ? "mission-target" : ""}">
            <span class="mg-name">${m.name}</span>
            ${m.isMission && !m.collected ? html`<span class="mg-mission-tag">★ MISSION</span>` : nothing}
            <span class="mg-value ${m.collected ? "mg-collected" : ""}">
              ${m.collected ? "EXTRACTED" : `¥${m.cashValue.toLocaleString()}`}
            </span>
          </div>
        `)}
      </div>`;
  }
}

customElements.define("starnet-node-panel", StarnetNodePanel);

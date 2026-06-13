// <starnet-context-menu> — Action menu overlay on graph.
// Receives available actions and node ID from visual-renderer.js bridge.
// Items may be { id, label, desc, disabled?, disabledReason?, hasFollowup? }.
// - normal item    → emits starnet:action { actionId, nodeId }
// - followup item   → emits starnet:open-choices { actionId, nodeId } (UI opens a picker)
// - disabled item  → not clickable; shows disabledReason as a tooltip
//
// When `node` is set (task 1.4+), renders a header (identity rows) above the
// action buttons and a footer (ICE timers → vulns → macguffins) below them.
// When `node` is null, renders action buttons only (original behavior).

import { html, nothing } from "lit";
import { StarnetElement } from "./starnet-element.js";
import { isObscured } from "../../core/state.js";
import { vulnGlyphDataUri } from "../vuln-glyphs.js";
import { alertLampDataUri, accessGlyphDataUri } from "../indicator-glyphs.js";

class StarnetContextMenu extends StarnetElement {
  static properties = {
    actions: { type: Array },
    nodeId: { type: String },
    visible: { type: Boolean },
    node: { type: Object },
    timers: { type: Array },
    inProgressLabel: { type: String },
    inProgressProgress: { type: Number },
  };

  constructor() {
    super();
    /** @type {Array<{ id: string, label: string, desc: string, disabled?: boolean, disabledReason?: string, hasFollowup?: boolean }>} */
    this.actions = [];
    this.nodeId = "";
    this.visible = false;
    /** @type {import('../../core/state/node.js').NodeState | null} */
    this.node = null;
    this.timers = [];
    // While a timed action runs on this node, the bridge sets a human label
    // (e.g. "EXECUTING") and a 0..1 progress so the action band shows a busy
    // indicator + tick ladder instead of the (then-empty) buttons.
    this.inProgressLabel = "";
    this.inProgressProgress = 0;
  }

  _emit(name, actionId) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: { actionId, nodeId: this.nodeId },
    }));
  }

  _renderActions() {
    return html`${this.actions.map((a) => {
      if (a.disabled) {
        return html`
          <button class="ctx-item ctx-disabled" disabled title=${a.disabledReason || ""}>
            [ ${a.label} ]${a.disabledReason ? html`<span class="ctx-item-desc">${a.disabledReason}</span>` : nothing}
          </button>`;
      }
      const event = a.hasFollowup ? "starnet:open-choices" : "starnet:action";
      return html`
        <button class="ctx-item" @click=${() => this._emit(event, a.id)}>
          [ ${a.label} ]${a.desc ? html`<span class="ctx-item-desc">${a.desc}</span>` : nothing}
        </button>`;
    })}`;
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
            <img class="nd-vuln-glyph" src=${vulnGlyphDataUri(v.id)} alt="" />
            <span class="vuln-name">${v.name}</span>
            <span class="vuln-rarity rarity-${v.rarity}">[${v.rarity.toUpperCase()}]</span>
          </div>
        `)}
      </div>`;
  }

  _renderMacguffins(node) {
    if (!node.read) return nothing;
    if (node.macguffins.length === 0) {
      return html`<div class="nd-dim nd-indent">No valuables detected.</div>`;
    }
    return html`
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

  // Identity header — same compact form for known and obscured nodes; obscured
  // nodes fill type/grade with ??? and use the sig-N alias instead of the label.
  _renderHeader(node, obscured) {
    const alertState = node.alertState || "green";
    const alertColor =
      alertState === "green"  ? "var(--green)" :
      alertState === "yellow" ? "var(--yellow)" :
                                 "var(--red)";
    const type  = obscured ? "???" : node.type.toUpperCase();
    const label = obscured ? (node.sigAlias || "???") : node.label;
    const grade = obscured ? "?" : (node.grade || "—");
    return html`
      <div class="insp-section insp-header">
        <div class="insp-typerow">
          <span class="nd-type">[${type}]</span>
          <div class="insp-meta">
            <span class="im-key">GRADE</span>
            <span class="im-val grade-${obscured ? "" : (node.grade || "")}">${grade}</span>
            <span class="im-sep">·</span>
            <span class="im-val"><img class="access-glyph" alt="" src=${accessGlyphDataUri(node.accessLevel)}> ${(node.accessLevel || "—").toUpperCase()}</span>
            <span class="im-sep">·</span>
            <span class="im-val" style="color:${alertColor}"><img class="nd-lamp" alt="" src=${alertLampDataUri(alertState)}> ${alertState.toUpperCase()}</span>
          </div>
        </div>
        <div class="nd-label">${label}</div>
      </div>`;
  }

  // Stroked tick ladder (count is the colorblind-safe channel) for action progress.
  _renderTickLadder(progress) {
    const N = 10;
    const on = Math.max(0, Math.min(N, Math.round((progress || 0) * N)));
    const ticks = [];
    for (let i = 0; i < N; i++) ticks.push(html`<span class="tick ${i < on ? "on" : ""}"></span>`);
    return html`<span class="insp-ladder">${ticks}</span>`;
  }

  // The action band: buttons normally; a busy indicator + tick ladder while a
  // timed action runs; a short hint for an unreachable obscured node.
  _renderActionBand(node, obscured) {
    let content;
    if (this.inProgressLabel) {
      content = html`<span class="insp-inprogress">▶ ${this.inProgressLabel}${this._renderTickLadder(this.inProgressProgress)}</span>`;
    } else if (this.actions && this.actions.length) {
      content = this._renderActions();
    } else if (obscured && node.visibility !== "accessible") {
      content = html`<div class="nd-dim insp-hint">Reach a connected node to probe.</div>`;
    } else {
      return nothing;
    }
    return html`<div class="insp-section insp-actions">${content}</div>`;
  }

  render() {
    if (!this.visible) return nothing;

    const node = this.node;
    const hasActions = this.actions && this.actions.length > 0;

    if (!node) {
      // No node data fed — actions-only (legacy/defensive path).
      return hasActions ? this._renderActions() : nothing;
    }

    const obscured = isObscured(node);
    const sections = [this._renderHeader(node, obscured)];

    const band = this._renderActionBand(node, obscured);
    if (band !== nothing) sections.push(band);

    if (!obscured) {
      if (this.timers && this.timers.length) {
        sections.push(html`<div class="insp-section insp-timers">
          <starnet-ice-timers .timers=${this.timers}></starnet-ice-timers>
        </div>`);
      }
      if (node.read) {
        sections.push(html`<div class="insp-section">${this._renderMacguffins(node)}</div>`);
      }
      const visibleVulns = (node.vulnerabilities || []).filter((v) => !v.hidden);
      sections.push(html`<div class="insp-section">${this._renderVulns(node, visibleVulns)}</div>`);
    }

    return html`${sections}`;
  }
}

customElements.define("starnet-context-menu", StarnetContextMenu);

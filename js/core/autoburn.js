// @ts-check
/**
 * AUTO-BURN — coherence-erosion process client.
 *
 * One round per tick: pick a round from the hoard (via burn-select.js), chip the
 * target node's coherence, accumulate burst heat, and crack the node if coherence
 * hits zero. Stops early on hoard-dry or heat-ceiling. Built as a client of the
 * progressive-process framework (js/core/processes.js) — the same pattern as SWEEP.
 *
 * Phase 4 will wire XPLOIT → startAutoBurn; for now the loop is exercised
 * headlessly (playtest harness, tests) by seeding the hoard directly.
 */

/** @typedef {import('./types.js').GameState} GameState */
/** @typedef {import('./types.js').Process} Process */

import { getState, revealNeighbors } from "./state.js";
import { addProcess, nextProcessId } from "./state/process.js";
import { registerProcess, activeProcessOnNode } from "./processes.js";
import { setNodeAccessLevel, setNodeCoherence, setNodeCoherenceMax, setNodeProbed } from "./state/node.js";
import { markRoundDisclosed } from "./state/player.js";
import { recordHeat } from "./alert.js";
import { chip, rollDisclosure } from "./coherence.js";
import { nextRound } from "./burn-select.js";
import { COHERENCE, BURN_CEILING_DEFAULT, HEAT_COST, BURN_ARM_TICKS, BURN_CADENCE_TICKS } from "./balance.js";
import { emitEvent, E } from "./events.js";
import { A } from "./action-ids.js";

// ── Crack helper ──────────────────────────────────────────────────────────────

/**
 * Grant access: set node to "owned", reveal its neighbors, and emit the standard
 * pair of game events. Owning a node reveals what's beyond it — the same "own it =
 * see past it" rule the retired card path applied, and the only reveal path for
 * gateAccess:"owned" gates (firewalls, IDS, monitors) now that access is two-tier.
 * Decoupled from the process step so it reads cleanly and can be tested standalone.
 * @param {string} nodeId
 */
function crackNode(nodeId) {
  const s = getState();
  const node = s.nodes[nodeId];
  if (!node) return;
  const prev = node.accessLevel;
  const label = node.label ?? nodeId;
  setNodeAccessLevel(nodeId, "owned");
  setNodeProbed(nodeId);   // "own it = know it": crack implies full recon, so DUMP is available
  revealNeighbors(nodeId);
  emitEvent(E.NODE_ACCESSED, { nodeId, label, prev, next: "owned" });
  emitEvent(E.ACTION_RESOLVED, {
    action: A.XPLOIT,
    nodeId,
    label,
    success: true,
    detail: { outcome: "cracked" },
  });
}

// ── Process registration ───────────────────────────────────────────────────────
//
// Module-level: registerProcess populates the HANDLERS Map and survives
// clearHandlers() (which only resets the event bus). initAutoBurn is the
// idempotent call-site hook so both init sites (initGame + wireRunHandlers)
// trigger this module's import and process registration, exactly as sweep does.

registerProcess("autoburn", {
  /**
   * One step = one round fired at the node.
   * Returns true when the process should end (crack / hoard-dry / heat-ceiling).
   * @param {Process} proc
   * @param {GameState} s
   * @returns {boolean}
   */
  step(proc, s) {
    const node = s.nodes[proc.nodeId];
    if (!node || node.accessLevel === "owned") return true;

    // Pacing: wait out the arm delay (camera focus settles + instrument arms),
    // then fire only on the cadence beat. Non-firing ticks just wait — the process
    // stays alive. Keeps the barrage watchable and sequenced after the zoom.
    proc.tick = (proc.tick ?? 0) + 1;
    if (proc.tick <= BURN_ARM_TICKS) return false;
    if ((proc.tick - BURN_ARM_TICKS - 1) % BURN_CADENCE_TICKS !== 0) return false;

    const round = nextRound(s.player.hoard, node, proc);
    if (!round) {
      emitEvent(E.ACTION_RESOLVED, {
        action: A.XPLOIT,
        nodeId: proc.nodeId,
        success: false,
        detail: { outcome: "hoard-dry" },
      });
      return true;
    }

    const dmg = chip(round, node, true);
    const next = Math.max(0, (node.coherence ?? 0) - dmg);
    setNodeCoherence(proc.nodeId, next);

    proc.heat += HEAT_COST.xploit;       // burst-local heat (drives ceiling stop)
    recordHeat(HEAT_COST.xploit);        // global heat → shipped alert ratchet

    if (rollDisclosure(node.grade)) markRoundDisclosed(round.id);

    emitEvent(E.PROCESS_STEP, {
      type: "autoburn",
      nodeId: proc.nodeId,
      chip: dmg,
      coherence: next,
      roundId: round.id,
      rarity: round.rarity,
      disclosed: round.disclosed,
    });

    if (next <= 0) {
      crackNode(proc.nodeId);
      return true;
    }

    if (proc.heat >= proc.ceiling) {
      emitEvent(E.ACTION_RESOLVED, {
        action: A.XPLOIT,
        nodeId: proc.nodeId,
        success: false,
        detail: { outcome: "heat-ceiling" },
      });
      return true;
    }

    return false;
  },

  onAbort(_proc, _s) {
    // Idempotent; nothing to unwind — coherence stays eroded (no reboot in E1).
  },
});

// ── Launcher ──────────────────────────────────────────────────────────────────

/**
 * Begin a coherence-erosion burst on `nodeId`. No-ops if:
 *   - no NodeGraph is registered (headless startup race)
 *   - a process is already active on this node
 *   - the node is already owned or missing
 *
 * Lazy-seeds `node.coherence` from the COHERENCE[grade] table on first start.
 *
 * @param {string} nodeId
 * @param {{ ceiling?: number, strategy?: string }} [params]
 */
export function startAutoBurn(nodeId, params = {}) {
  const s = getState();
  const graph = s.nodeGraph;
  const node = s.nodes[nodeId];

  if (!graph || !node) return;
  if (activeProcessOnNode(s, nodeId)) return;
  if (node.accessLevel === "owned") return;

  // Lazy-seed coherence if not already set; record the max for UI readouts.
  if (node.coherence == null) {
    const cohMax = COHERENCE[node.grade] ?? COHERENCE["C"];
    setNodeCoherence(nodeId, cohMax);
    setNodeCoherenceMax(nodeId, cohMax);
  }

  const ceiling = params.ceiling ?? BURN_CEILING_DEFAULT;
  addProcess({ id: nextProcessId(), type: "autoburn", nodeId, source: "player", ceiling, heat: 0, tick: 0 });
  emitEvent(E.PROCESS_STARTED, { type: "autoburn", nodeId, ceiling });
}

// ── Init hook ─────────────────────────────────────────────────────────────────

/**
 * Idempotent init hook. Called from initGame() and wireRunHandlers() so both
 * entry points (browser + headless) trigger this module's import and the
 * module-level registerProcess("autoburn", …) call — identical to how sweep.js
 * exposes initSweepForwarding().
 *
 * The registerProcess call itself is module-level (Map.set is idempotent), so
 * repeated calls are safe.
 */
export function initAutoBurn() {
  // Intentionally empty — the work happens at module-import time via the
  // module-level registerProcess() call above. This function exists so both
  // init sites can `import { initAutoBurn } from "../autoburn.js"` and call it,
  // triggering the import side-effect even in environments where tree-shaking
  // might otherwise elide the module.
}

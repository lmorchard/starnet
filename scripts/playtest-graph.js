// Quick headless playtest using the new NodeGraph-based initGame().
// Exercises: init → select → probe → exploit → read → loot → jackout
//
// Usage: node scripts/playtest-graph.js [--network name] [--seed seed]

import { initGame, getState } from "../js/core/state.js";
import { startIce, handleIceTick, handleIceDetect } from "../js/core/ice.js";
import { on, emitEvent, E } from "../js/core/events.js";
import { tick, TIMER } from "../js/core/timers.js";
import { handleTraceTick } from "../js/core/alert.js";
import { initLog } from "../js/core/log.js";
import { buildActionContext, initActionDispatcher } from "../js/core/actions/action-context.js";
import { getAvailableActions } from "../js/core/actions/node-actions.js";
import { initGraphBridge } from "../js/core/graph-bridge.js";

import { buildNetwork as buildCorporateFoothold } from "../data/networks/corporate-foothold.js";
import { buildNetwork as buildResearchStation } from "../data/networks/research-station.js";
import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";

// ── Init plumbing ──────────────────────────────────────────
initLog();

// Timer handlers
on(TIMER.ICE_MOVE,        ()        => handleIceTick());
on(TIMER.ICE_DETECT,      (payload) => handleIceDetect(payload));
on(TIMER.TRACE_TICK,      ()        => handleTraceTick());
// Probe, exploit, read, loot, reboot timers removed — timed-action operator drives these

// Action dispatcher
const ctx = buildActionContext();
initActionDispatcher(ctx);

// Collect output
const lines = [];
function out(msg) { lines.push(String(msg)); }
on(E.LOG_ENTRY,           ({ text }) => out(text));
on(E.NODE_PROBED,         ({ label }) => out(`  [PROBED] ${label}`));
on(E.NODE_ACCESSED,       ({ label, prev, next }) => out(`  [ACCESS] ${label}: ${prev} → ${next}`));
on(E.NODE_READ,           ({ label, macguffinCount }) => out(`  [READ] ${label}: ${macguffinCount} items`));
on(E.NODE_LOOTED,         ({ label, items, total }) => out(`  [LOOT] ${label}: ${items} items — ¥${total}`));
on(E.EXPLOIT_SUCCESS,     ({ label, exploitName }) => out(`  [EXPLOIT ✓] ${label} — ${exploitName}`));
on(E.EXPLOIT_FAILURE,     ({ label, exploitName }) => out(`  [EXPLOIT ✗] ${label} — ${exploitName}`));
on(E.ALERT_GLOBAL_RAISED, ({ prev, next }) => out(`  [ALERT] ${prev} → ${next}`));
on(E.ALERT_TRACE_STARTED, ({ seconds }) => out(`  [TRACE] ${seconds}s countdown!`));
on(E.RUN_ENDED,           ({ outcome }) => out(`  [RUN END] ${outcome}`));

// ── Network selection ──────────────────────────────────────
const NETWORKS = {
  "corporate-foothold": buildCorporateFoothold,
  "research-station": buildResearchStation,
  "corporate-exchange": buildCorporateExchange,
};

const args = process.argv.slice(2);
let networkName = "corporate-foothold";
let seed = "playtest-1";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--network" && args[i+1]) networkName = args[++i];
  if (args[i] === "--seed" && args[i+1]) seed = args[++i];
}

const buildFn = NETWORKS[networkName];
if (!buildFn) {
  console.error(`Unknown network: ${networkName}. Available: ${Object.keys(NETWORKS).join(", ")}`);
  process.exit(1);
}

// ── Helper functions ───────────────────────────────────────

function dispatch(actionId, opts = {}) {
  emitEvent("starnet:action", { actionId, fromConsole: true, ...opts });
}

function flushLines() {
  if (lines.length) {
    for (const l of lines) console.log(l);
    lines.length = 0;
  }
}

function status() {
  const s = getState();
  const nodeCount = Object.keys(s.nodes).length;
  const accessible = Object.values(s.nodes).filter(n => n.visibility === "accessible").length;
  const probed = Object.values(s.nodes).filter(n => n.probed).length;
  const owned = Object.values(s.nodes).filter(n => n.accessLevel === "owned").length;
  console.log(`  Nodes: ${nodeCount} total, ${accessible} accessible, ${probed} probed, ${owned} owned`);
  console.log(`  Cash: ¥${s.player.cash}  Hand: ${s.player.hand.length} cards  Alert: ${s.globalAlert}`);
  if (s.ice?.active) console.log(`  ICE: ${s.ice.grade} at ${s.ice.attentionNodeId}`);
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    console.log(`  Selected: ${sel.id} (${sel.type}, ${sel.accessLevel}, probed:${sel.probed})`);
    const actions = getAvailableActions(sel, s);
    const nodeActions = actions.filter(a => a.id !== "jackout" && a.id !== "select" && a.id !== "deselect");
    if (nodeActions.length) console.log(`  Actions: ${nodeActions.map(a => a.id).join(", ")}`);
  }
  if (s.nodeGraph) console.log(`  Graph: ${s.nodeGraph.getNodeIds().length} nodes, ticking`);
}

// ── Playthrough ────────────────────────────────────────────

console.log(`\n═══ Headless Playtest: ${networkName} (seed: ${seed}) ═══\n`);

// Init
console.log("▸ Initializing game...");
initGame(() => buildFn(), seed);
initGraphBridge();
const s0 = getState();
if (s0.ice?.active) startIce();
console.log(`  Network: ${Object.keys(s0.nodes).length} nodes`);
console.log(`  Start: ${s0.nodes["gateway"]?.label ?? "gateway"}`);
console.log(`  Hand: ${s0.player.hand.map(c => c.name).join(", ")}`);
flushLines();

// Select gateway
console.log("\n▸ Select gateway");
dispatch("select", { nodeId: "gateway" });
flushLines();
status();

// Probe gateway
console.log("\n▸ Probe gateway");
dispatch("probe");
flushLines();
tick(30); // flush probe timer
flushLines();
status();

// Try to exploit gateway with first card
const s1 = getState();
if (s1.player.hand.length > 0) {
  const card = s1.player.hand[0];
  console.log(`\n▸ Exploit gateway with ${card.name}`);
  dispatch("exploit", { exploitId: card.id });
  flushLines();
  tick(50); // flush exploit timer
  flushLines();
  status();
}

// Look for an accessible neighbor to probe/exploit
const s2 = getState();
const neighbors = s2.adjacency["gateway"] || [];
const accessibleNeighbor = neighbors.find(nid => {
  const n = s2.nodes[nid];
  return n && n.visibility === "accessible" && n.accessLevel === "locked";
});

if (accessibleNeighbor) {
  console.log(`\n▸ Select ${accessibleNeighbor}`);
  dispatch("select", { nodeId: accessibleNeighbor });
  flushLines();

  console.log(`\n▸ Probe ${accessibleNeighbor}`);
  dispatch("probe");
  flushLines();
  tick(30);
  flushLines();

  // Try exploit with second card
  const s3 = getState();
  if (s3.player.hand.length > 0) {
    const card2 = s3.player.hand[0];
    console.log(`\n▸ Exploit ${accessibleNeighbor} with ${card2.name}`);
    dispatch("exploit", { exploitId: card2.id });
    flushLines();
    tick(50);
    flushLines();
  }
  status();
}

// Try read + loot on any owned node
const s4 = getState();
const ownedNode = Object.values(s4.nodes).find(n =>
  n.accessLevel === "owned" && !n.read && n.macguffins?.length > 0
);
if (ownedNode) {
  console.log(`\n▸ Select ${ownedNode.id} (owned, has macguffins)`);
  dispatch("select", { nodeId: ownedNode.id });
  flushLines();

  console.log(`\n▸ Read ${ownedNode.id}`);
  dispatch("read");
  flushLines();
  tick(30);
  flushLines();

  console.log(`\n▸ Loot ${ownedNode.id}`);
  dispatch("loot");
  flushLines();
  tick(30);
  flushLines();
  status();
}

// Jack out
console.log("\n▸ Jack out");
dispatch("jackout");
flushLines();

const final = getState();
console.log(`\n═══ Run Complete ═══`);
console.log(`  Outcome: ${final.runOutcome}`);
console.log(`  Cash: ¥${final.player.cash}`);
console.log(`  Nodes owned: ${Object.values(final.nodes).filter(n => n.accessLevel === "owned").length}`);
console.log(`  Phase: ${final.phase}`);
console.log();

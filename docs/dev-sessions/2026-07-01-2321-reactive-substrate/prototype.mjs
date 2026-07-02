// @ts-nocheck
/**
 * Reactive-substrate spike (#286) — empirical pulse-cascade prototype.
 *
 * Goal (from the issue, approach LOCKED prototype-first): compose the EXISTING node-graph runtime
 * primitives into an entity-injected, time-resolving, propagating (spawning) pulse cascade — the
 * generalization of SWEEP. Find which primitives are actually missing vs. expressible today by
 * RUNNING into the walls, not by reasoning about them.
 *
 * Run:  node docs/dev-sessions/2026-07-01-2321-reactive-substrate/prototype.mjs
 *
 * Each EXPERIMENT prints what happened. Findings are transcribed into research.md.
 */

import { NodeGraph } from "../../../js/core/node-graph/runtime.js";
import { registerOperator } from "../../../js/core/node-graph/operators.js";

// ── tiny instrumentation ─────────────────────────────────────────────────────
let deliveries;
function freshCounters() { deliveries = {}; }
function onEvent(type, payload) {
  if (type === "message-delivered" && payload.message?.type !== "tick") {
    const id = payload.nodeId;
    deliveries[id] = (deliveries[id] ?? 0) + 1;
  }
}
const hits = () => Object.entries(deliveries).map(([k, v]) => `${k}×${v}`).join("  ") || "(none)";

// Topology: a line with one branch at b.
//   origin — a — b — c
//                 \
//                  d
const EDGES = [["origin", "a"], ["a", "b"], ["b", "c"], ["b", "d"]];
const banner = (n) => console.log(`\n${"═".repeat(78)}\n${n}\n${"═".repeat(78)}`);

// =============================================================================
banner("EXP 1 — cascade via `relay` (does stimulus propagate node→node at all?)");
// Every node relays `pulse` to its neighbors. Inject once at origin.
{
  freshCounters();
  const nodes = ["origin", "a", "b", "c", "d"].map((id) => ({
    id, type: "host",
    attributes: { forwardingEnabled: true },
    operators: [{ name: "relay", filter: "pulse" }],
  }));
  const g = new NodeGraph({ nodes, edges: EDGES }, undefined, onEvent);
  g.init();
  g.sendMessage("origin", { type: "pulse", payload: { ttl: 2, source: "player" } });
  console.log("delivered to:", hits());
  console.log("→ FINDING: relay cascades instantly & synchronously to the WHOLE connected");
  console.log("  component in one sendMessage. Cycle-guard (message.path) stops loops, so it");
  console.log("  terminates — but there is NO timing (all hops in one call) and NO depth bound:");
  console.log("  ttl:2 in the payload was ignored; c and d (3 hops out) still got it.");
}

// =============================================================================
banner("EXP 2 — two-way gate control via `forwardingEnabled` (the corrupt mechanic, generalized)");
// Same as EXP1 but node `b` has forwarding disabled — the pulse must die at b.
{
  freshCounters();
  const nodes = ["origin", "a", "b", "c", "d"].map((id) => ({
    id, type: "host",
    attributes: { forwardingEnabled: id !== "b" },   // b is a subverted/closed gate
    operators: [{ name: "relay", filter: "pulse" }],
  }));
  const g = new NodeGraph({ nodes, edges: EDGES }, undefined, onEvent);
  g.init();
  g.sendMessage("origin", { type: "pulse", payload: { ttl: 9, source: "player" } });
  console.log("delivered to:", hits());
  console.log("→ FINDING: gate blocking WORKS TODAY. b received the pulse but did not forward,");
  console.log("  so c and d behind it are untouched. This is exactly the two-way gate-control the");
  console.log("  issue wants (subvert a gate → block a hostile pulse). Zero new code.");
}

// =============================================================================
banner("EXP 3 — timed-then-forward by composition (flag → timed-action → emit-message)");
// The real target: each node reacts over REAL ticks, THEN forwards to neighbors — a wave, not a
// flash. Compose: `flag` starts a timed reaction on pulse; `timed-action` runs it; onComplete
// emits the next pulse. Watch for where it breaks.
{
  freshCounters();
  const REACT_TICKS = 2;
  const mkNode = (id) => ({
    id, type: "host",
    attributes: { forwardingEnabled: true, reactTicks: REACT_TICKS },
    operators: [
      // start the reaction when a pulse arrives
      { name: "flag", on: "pulse", attr: "reacting", value: true },
      // react over reactTicks, then forward a pulse to neighbors
      {
        name: "timed-action", action: "react", activeAttr: "reacting",
        durationAttrSource: "reactTicks",
        onComplete: [
          { effect: "set-attr", attr: "reacting", value: false },
          { effect: "emit-message", message: { type: "pulse", payload: { ttl: 1, source: "player" } } },
        ],
      },
    ],
  });
  const nodes = ["origin", "a", "b", "c", "d"].map(mkNode);
  const g = new NodeGraph({ nodes, edges: EDGES }, undefined, onEvent);
  g.init();
  g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });

  // Advance the clock and watch the wave. Cap ticks so a runaway cascade can't hang the spike.
  let tick = 0, MAX = 40, prevReactingCount = -1, stableFor = 0;
  const reactingNodes = () => g.getNodeIds().filter((id) => g.getNodeState(id).reacting);
  console.log(`t=${String(tick).padStart(2)}  reacting: [${reactingNodes().join(",")}]`);
  while (tick < MAX) {
    g.tick(1); tick++;
    const rc = reactingNodes();
    console.log(`t=${String(tick).padStart(2)}  reacting: [${rc.join(",")}]   deliveries: ${hits()}`);
    // detect non-termination: nodes keep re-reacting forever
    if (rc.length === prevReactingCount) { stableFor++; } else { stableFor = 0; }
    prevReactingCount = rc.length;
    if (tick >= 12 && rc.length > 0) {
      console.log("  … still reacting at t=12 — this is NOT terminating (see finding below). Cutting off.");
      break;
    }
    if (rc.length === 0 && tick > REACT_TICKS + 1) break;
  }
  console.log("total deliveries:", hits());
  console.log("→ FINDING: a timed WAVE does propagate (reaction moves origin→a→b→…), proving");
  console.log("  timed-then-forward is *composable in spirit*. BUT it breaks two ways:");
  console.log("  (1) emit-message routes through _emitFrom, which resets message.path to [self].");
  console.log("      The cycle-guard is defeated → the pulse ping-pongs backward (a→origin→a…) and");
  console.log("      the cascade never terminates. Note repeated re-deliveries above.");
  console.log("  (2) TTL cannot decrement: onComplete.emit-message.payload is STATIC config. Every");
  console.log("      node emits the same hardcoded ttl; there is no attr→payload arithmetic. So even");
  console.log("      with a good path guard, there is no depth bound.");
  console.log("  (3) `flag`/effects cannot COPY payload fields (ttl, source) into node attributes,");
  console.log("      so a node can't remember 'what ttl did I arrive with' to forward ttl-1.");
}

// =============================================================================
banner("EXP 4 — minimal gap-fill: a single `pulse-cascade` operator closes it (~20 lines)");
// Proof that the gap is small and composes cleanly with the existing model: one operator that
// (a) reads ttl+source from the arriving pulse payload, (b) forwards ttl-1 only while ttl>0,
// (c) preserves the incoming path so the cycle-guard still terminates it, (d) respects
// forwardingEnabled for gate control. (Timed delay omitted here to isolate the propagation fix;
// wiring it to timed-action completion is the same emit, deferred by N ticks.)
{
  freshCounters();
  // NEW experimental primitive — the shape a real substrate would provide.
  registerOperator("pulse-cascade", (config, attrs, message) => {
    if (!message || message.type !== "pulse") return {};
    if (attrs.forwardingEnabled === false) return {};        // gate control (EXP2) still applies
    const ttl = (message.payload?.ttl ?? 0) - 1;             // hop-decrement
    if (ttl <= 0) return {};                                 // depth bound → terminates
    return {
      // relay-style: forward to neighbors with a decremented ttl, carrying source attribution.
      outgoing: [{ type: "pulse", payload: { ttl, source: message.payload.source } }],
    };
  });
  const nodes = ["origin", "a", "b", "c", "d"].map((id) => ({
    id, type: "host",
    attributes: { forwardingEnabled: true },
    operators: [{ name: "pulse-cascade" }],
  }));
  const g = new NodeGraph({ nodes, edges: EDGES }, undefined, onEvent);
  g.init();
  g.sendMessage("origin", { type: "pulse", payload: { ttl: 3, source: "player" } });
  console.log("delivered to:", hits());
  console.log("→ FINDING: ttl:3 from origin reaches a (ttl2) and b (ttl1) then STOPS — c/d beyond");
  console.log("  the depth bound are untouched, and it terminates (outgoing keeps the runtime path).");
  console.log("  A depth-bounded, entity-attributed, gate-gated cascade in ~20 lines: the substrate");
  console.log("  is 'compose existing primitives + a small gap-fill', not a from-scratch subsystem.");
  console.log("  STILL MISSING for the real thing: timed delay per hop (compose with timed-action),");
  console.log("  cascade IDENTITY for abort/lifecycle, and RUNTIME-ATTACH (operators are baked at");
  console.log("  construction — the loadout needs to add this behavior to a node at runtime).");
}

console.log("\nDone.\n");

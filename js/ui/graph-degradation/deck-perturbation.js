// @ts-check
// Deck-perturbation: dying-graph chaos in the REAL Cytoscape graph, as a lightweight PARTICLE
// system. Each tick (~30Hz) a severity-scaled budget emits glitch "particles" — node shakes,
// blink / id-scramble / glyph-swap / undiscover, real-edge drop-out, phantom nodes & edges,
// grid-backdrop spasms — each with a lifetime, an optional per-tick update, and a self-cleanup.
// Operates on cy's render positions/styles only; the game model (state/nodeGraph) is untouched,
// so save/load is unaffected. Restored cleanly on heal/stop. Split out of graph-degradation.js
// per issue #166.

import { getCy } from "../graph.js";
import { ALL_GLYPH_TYPES, nodeFaceDataUri } from "../node-glyphs.js";
import { ParticlePool } from "../particle-pool.js";

let containerEl = null;        // #graph-container, for grid-backdrop glitches
let gridGlitchActive = false;  // guard so overlapping grid glitches don't clear early
// cy render positions aren't saved state, so this is purely visual; base positions are
// restored on heal.
let basePos = null;        // Map<nodeId, {x,y}> | null — resting positions while degraded
let deckTickLast = 0;      // throttle for the position/style writes
// A glitch "particle" is a transient corruption with a lifetime: `update` (optional) runs each
// tick while alive (shakes re-jitter); `restore` undoes it exactly, on expiry or heal. Style/
// structural glitches are apply-on-spawn + restore (no update). The shared ParticlePool owns the
// age/cull lifecycle (see js/ui/particle-pool.js).
/** @typedef {import("../particle-pool.js").Particle} Particle */
const pool = new ParticlePool(); // live glitch particles — every type shares one pool
let phantomSeq = 0;        // unique-id counter for hallucinated phantom nodes

// ── Glitch particle factories ───────────────────────────────────────────────
// Each returns (or, for style glitches, applies-then-returns) the restore() half of a
// Particle; the spawner wraps it with a lifetime. Everything is discrete particles emitted
// on one rate curve: per tick (~30Hz) the budget = SPAWN_K * severity spawns floor + a
// fractional extra, so the convex deck severity yields "did I see that?" at >90% deck, ~1
// every few seconds at ~75%, and near-continuous chaos (overlapping particles) below ~25%.
const SPAWN_K = 4.5;       // expected events PER TICK = SPAWN_K * severity. >1 well before empty,
                           // so multiple events fire per tick → an overwhelming, unusable floor
const SHAKE_MIN_MS = 150;  // single-node shake duration range; many overlapping independent
const SHAKE_MAX_MS = 400;  // shakes at low deck merge into a continuous, desynced tremor

function randChars(n) {
  const c = "ABCDEF0123456789#$%&@!";
  let s = "";
  for (let i = 0; i < n; i++) s += c[(Math.random() * c.length) | 0];
  return s;
}
/** Blink a node nearly out. */
function glitchBlink(node) {
  node.style("opacity", 0.04);
  return () => node.removeStyle("opacity");
}
/** Scramble a node's displayed id/label (inline label overrides the data(id) mapping). */
function glitchScramble(node) {
  node.style("label", randChars(Math.max(4, node.id().length)));
  return () => node.removeStyle("label");
}
/** Flash a different node glyph by swapping the inline background-image face. */
function glitchGlyph(node) {
  const orig = node.style("background-image");
  const t = ALL_GLYPH_TYPES[(Math.random() * ALL_GLYPH_TYPES.length) | 0];
  node.style("background-image", nodeFaceDataUri(t, "owned"));
  return () => node.style("background-image", orig);
}
/**
 * Hallucinate a phantom "undiscovered" node — a dim "???" node with 1–2 random edges to
 * real nodes — then remove it. Deliberately inert: `events: "no"` + non-selectable/grabbable
 * so it can never be clicked or targeted (it isn't in game state). Removing the node removes
 * its edges too. Uses a `phantom-glitch` class so it's never mistaken for a real node.
 */
function glitchPhantom(cy) {
  const real = cy.nodes().filter((n) => !n.hasClass("phantom-glitch"));
  if (real.length < 2) return () => {};
  const id = `phantom-glitch-${phantomSeq++}`;
  const anchor = real[(Math.random() * real.length) | 0].position();
  cy.add({
    group: "nodes",
    data: { id, label: "???" },
    position: { x: anchor.x + (Math.random() * 2 - 1) * 180, y: anchor.y + (Math.random() * 2 - 1) * 140 },
    classes: "phantom-glitch",
    selectable: false,
    grabbable: false,
  });
  const pn = cy.getElementById(id);
  pn.style({
    events: "no", label: "???", "background-image": "none", "background-color": "#0a0a12",
    "border-color": "#3a4a5a", "border-width": 1, color: "#6a8a7a", opacity: 0.7,
    shape: "ellipse", width: 26, height: 26, "font-size": 9,
  });
  const k = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < k; i++) {
    const target = real[(Math.random() * real.length) | 0].id();
    const eid = `${id}-e${i}`;
    cy.add({ group: "edges", data: { id: eid, source: id, target }, classes: "phantom-glitch" });
    cy.getElementById(eid).style({ events: "no", "line-color": "#3a4a5a", "line-style": "dashed", opacity: 0.55, width: 1 });
  }
  return () => { const el = cy.getElementById(id); if (el && el.length) cy.remove(el); };
}
/** Hallucinate a phantom connection between two real nodes (inert), then remove it. */
function glitchPhantomEdge(cy) {
  const real = cy.nodes().filter((n) => !n.hasClass("phantom-glitch"));
  if (real.length < 2) return () => {};
  const a = real[(Math.random() * real.length) | 0];
  const b = real[(Math.random() * real.length) | 0];
  if (a.id() === b.id()) return () => {};
  const eid = `phantom-glitch-edge-${phantomSeq++}`;
  cy.add({ group: "edges", data: { id: eid, source: a.id(), target: b.id() }, classes: "phantom-glitch" });
  cy.getElementById(eid).style({ events: "no", "line-color": "#3a4a5a", "line-style": "dashed", opacity: 0.6, width: 1 });
  return () => { const e = cy.getElementById(eid); if (e && e.length) cy.remove(e); };
}
/** Briefly flip a discovered node back to an "undiscovered" look — "???" label, no glyph. */
function glitchUndiscover(node) {
  const origImg = node.style("background-image");
  node.style({ label: "???", "background-image": "none" });
  return () => { node.style("background-image", origImg); node.removeStyle("label"); };
}
/** Drop a REAL connection out for a beat — the edge vanishes, then comes back. */
function glitchHideEdge(cy) {
  const realEdges = cy.edges().filter((e) => !e.hasClass("phantom-glitch") && +e.style("opacity") > 0.05);
  if (!realEdges.length) return () => {};
  const e = realEdges[(Math.random() * realEdges.length) | 0];
  e.style("opacity", 0);
  return () => e.removeStyle("opacity");
}
/**
 * Glitch the grid backdrop on #graph-container: a brighter/recolored flash, a drop-out, or a
 * spacing jump. Global, so guarded against overlap; restores to the stylesheet grid.
 */
function glitchGrid(container) {
  if (!container) return () => {};
  gridGlitchActive = true;
  const r = Math.random();
  if (r < 0.4) {
    const col = Math.random() < 0.5 ? "rgba(255,0,255,0.12)" : "rgba(0,255,255,0.16)";
    container.style.backgroundImage = `linear-gradient(${col} 1px, transparent 1px), linear-gradient(90deg, ${col} 1px, transparent 1px)`;
  } else if (r < 0.7) {
    container.style.backgroundImage = "none"; // grid drops out
  } else {
    const s = (18 + Math.random() * 70) | 0;
    container.style.backgroundSize = `${s}px ${s}px`; // spacing jumps
  }
  return () => { container.style.backgroundImage = ""; container.style.backgroundSize = ""; gridGlitchActive = false; };
}
/**
 * Shake particle: jitters ONE node along ONE axis ('h' or 'v') by a tiny 1–2px each tick
 * (update), and settles it back on expiry/heal (restore). The axis lock + micro-magnitude
 * read as a fine signal tremor (not a cheesy 2D wobble); independent windows of mixed axes
 * desync into a sequence. @param {any} cy @param {string} id @param {number} until
 * @param {"h"|"v"} axis @returns {Particle}
 */
function shakeParticle(cy, id, until, axis) {
  return {
    until,
    update() {
      const b = basePos && basePos.get(id);
      const n = cy.getElementById(id);
      if (!b || !n.length) return;
      const d = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random()); // 1–2px, either direction
      if (axis === "h") n.position({ x: b.x + d, y: b.y });
      else n.position({ x: b.x, y: b.y + d });
    },
    restore() {
      const b = basePos && basePos.get(id);
      const n = cy.getElementById(id);
      if (b && n.length) n.position({ x: b.x, y: b.y });
    },
  };
}

/** Register the #graph-container used for grid-backdrop glitches. */
export function initDeckPerturbation(container) {
  containerEl = container;
}

/**
 * Deck = dying-graph chaos via Cytoscape's model, as DISCRETE events on one convex rate
 * curve (no continuous background motion). Each tick spawns events from a severity-scaled
 * budget (`SPAWN_K * sev` expected per tick — so zero or one while mild, several per tick once
 * `SPAWN_K * sev > 1` near empty). Each event is a shake burst (vibrates a few nodes briefly;
 * edges/labels follow) or a transient glitch (blink / glyph-swap / id-scramble / undiscover /
 * phantom node / phantom edge). Event rate and shake-victim count rise with severity, so bursts
 * overlap into continuous chaos near empty.
 * All restored cleanly on heal. cy positions aren't saved state, so this never corrupts the
 * game.
 * @param {number} now rAF timestamp (ms)
 * @param {number} sev deck severity 0..1
 */
export function applyDeckPerturbation(now, sev) {
  const cy = getCy();
  if (!cy) return;
  if (sev <= 0) {
    if (basePos || pool.size) restoreDeck(cy);
    return;
  }
  // Particle UPDATES run every rAF frame (so the 1–2px shake re-jitters at full ~60Hz and
  // blurs rather than stepping); spawning + base capture are gated to ~30Hz so the tuned
  // event rate is frame-rate-independent.
  const tick = now - deckTickLast >= 33;
  if (tick) deckTickLast = now;
  if (pool.size === 0 && !tick) return; // nothing to do this frame

  cy.batch(() => {
    if (!basePos) basePos = new Map();

    // Update the live pool EVERY frame; reap expired particles (each restores itself). The
    // graph is STILL wherever no particle is acting — shakes settle their node on expiry, so
    // there's no residue. Independent shake windows desync into a sequence, not one burst.
    pool.tick(now);

    if (!tick) return; // base capture + spawning only at the throttled cadence

    // Real nodes only — phantoms are transient decoration, never shaken/captured.
    const real = cy.nodes().filter((n) => !n.hasClass("phantom-glitch"));
    // Lazy base capture (covers nodes revealed mid-degradation).
    real.forEach((n) => {
      const id = n.id();
      if (!basePos.has(id)) basePos.set(id, { x: n.position("x"), y: n.position("y") });
    });

    // Emit new particles at the convex severity-scaled rate. Durations vary by type with a
    // shuffle so they overlap organically: shakes are quick tremors; blink is a flicker;
    // glyph / id-scramble / undiscover linger so you read them; phantoms persist longest.
    if (real.length) {
      const pick = () => real[(Math.random() * real.length) | 0];
      const dur = () => now + SHAKE_MIN_MS + Math.random() * (SHAKE_MAX_MS - SHAKE_MIN_MS);
      const hold = (min, max) => now + (min + Math.random() * (max - min)) * (0.6 + Math.random() * 1.1);
      const spawnOne = () => {
        const roll = Math.random();
        if (roll < 0.46) {
          const axis = () => (Math.random() < 0.5 ? "h" : "v"); // mix of horizontal + vertical tremors
          pool.add(shakeParticle(cy, pick().id(), dur(), axis()));
          if (Math.random() < sev) pool.add(shakeParticle(cy, pick().id(), dur(), axis())); // a 2nd, staggered, at high severity
        } else if (roll < 0.57) {
          pool.add({ until: hold(80, 380), restore: glitchBlink(pick()) });        // flicker
        } else if (roll < 0.68) {
          pool.add({ until: hold(400, 1600), restore: glitchScramble(pick()) });   // lingering scramble
        } else if (roll < 0.78) {
          pool.add({ until: hold(400, 1600), restore: glitchGlyph(pick()) });      // wrong glyph holds
        } else if (roll < 0.86) {
          pool.add({ until: hold(400, 1600), restore: glitchUndiscover(pick()) }); // stays "???"
        } else if (roll < 0.92) {
          pool.add({ until: hold(400, 1800), restore: glitchHideEdge(cy) });        // a real link drops out
        } else if (roll < 0.97) {
          if (real.length >= 2) {
            const restore = Math.random() < 0.5 ? glitchPhantom(cy) : glitchPhantomEdge(cy);
            pool.add({ until: hold(700, 2500), restore });                          // phantoms persist
          }
        } else if (!gridGlitchActive) {
          pool.add({ until: hold(150, 700), restore: glitchGrid(containerEl) });    // grid backdrop spasms
        }
      };
      // Budget = expected events this tick. Spawn floor(budget) particles + a fractional
      // chance for one more, so the rate climbs past one-per-tick into chaos near empty.
      let budget = SPAWN_K * sev;
      while (budget > 0) {
        if (budget < 1 && Math.random() >= budget) break;
        spawnOne();
        budget -= 1;
      }
    }
  });
}

/**
 * Heal: undo every live particle via its own restore() (precise — shakes reset their node's
 * position, style glitches clear their inline style, phantoms remove themselves; never
 * blanket-clears styles legit code may set inline). Then clear all deck state.
 */
export function restoreDeck(cy) {
  cy.batch(() => pool.clear());
  basePos = null;
  // Defensive: ensure the global grid backdrop is back to its stylesheet state.
  if (containerEl) { containerEl.style.backgroundImage = ""; containerEl.style.backgroundSize = ""; }
  gridGlitchActive = false;
}

/**
 * Discard deck state WITHOUT restoring to cy — for teardown when the graph is already
 * disposed and there's no live cy to restore positions/styles to. Returns the module to a
 * clean baseline so a later restart can't inherit stale particles / a stuck grid flag.
 */
export function discardDeck() {
  pool.reset();
  basePos = null;
  if (containerEl) { containerEl.style.backgroundImage = ""; containerEl.style.backgroundSize = ""; }
  gridGlitchActive = false;
}

/** True if there are live positions/particles that a live cy could restore. */
export function hasRestorableDeck() {
  return !!(basePos || pool.size);
}

/** True if any deck residue exists (positions, particles, or a stuck grid flag). */
export function hasAnyDeckState() {
  return !!(basePos || pool.size || gridGlitchActive);
}

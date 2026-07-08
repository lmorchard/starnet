// Lab B — live-game butterchurn brain-damage proof. Injected into the running game.
// Reference artifact; does NOT modify shippable game logic. Load via devtools import
// (see lab-b-README.md) after starting a run and arming audio.
//
// Proves the hybrid drive against REAL gameplay:
//   1. live game audio  -> butterchurn analyser (ambient reactive texture)
//   2. wetware damage    -> synthetic bass impulse punched into the analyser (shock flare)
//   3. game-state severity -> ambient-bed opacity; blend/preset chosen for feel
//
// Findings from Lab A: `screen` blend handles the severity ramp best; `normal` reads well
// too and obscuring the UI is acceptable as impairment. Damage has NO discrete event, so we
// watch health/deck values frame-to-frame and fire a shock on a drop (see notes.md).
import butterchurn from "https://esm.sh/butterchurn@2.6.7";
import butterchurnPresets from "https://esm.sh/butterchurn-presets@2.4.7";
import { getState } from "/js/core/state.js";
import { degradationParams } from "/js/ui/graph-degradation/params.js";

// --- Tunables (adjustable live via the control panel below) ----------------
const cfg = {
  blend: "screen",       // Lab A: screen for the bed; normal also fine
  bedWeight: 0.7,        // severity -> opacity contribution
  flareGain: 0.6,        // shock opacity spike
  shockMs: 900,          // shock decay window
  preset: null,          // set after presets load
};

// --- Audio context (shared with Strudel/superdough) ------------------------
const ctx = window.getAudioContext?.();
if (!ctx) {
  console.warn("[lab-b] No AudioContext yet — arm audio (press a key) before importing.");
}

// Non-invasive master tap: fan every →destination connection to an analyser.
// Strudel schedules many short-lived source nodes for the reactive score; each new
// connection made after this shim installs is tapped. (Nodes connected before import
// are missed — load early. See README.)
const analyser = ctx.createAnalyser();
(function installTap() {
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const result = origConnect.call(this, dest, ...rest);
    if (dest === ctx.destination) {
      try { origConnect.call(this, analyser); } catch (_) { /* already tapped */ }
    }
    return result;
  };
})();

// Synthetic shock bus → analyser only (not heard).
const shockBus = ctx.createGain();
shockBus.connect(analyser);

// --- Mount butterchurn over the live graph ---------------------------------
const container = document.getElementById("graph-container");
const canvas = document.createElement("canvas");
canvas.id = "lab-b-butterchurn";
Object.assign(canvas.style, {
  position: "absolute", inset: "0", width: "100%", height: "100%",
  pointerEvents: "none", zIndex: "6",           // above the WebGL1 health-plasma (zIndex 5)
  mixBlendMode: cfg.blend, opacity: "0",
});
container.appendChild(canvas);

// Suppress the existing WebGL1 health-plasma while Lab B is active — butterchurn is its
// candidate REPLACEMENT, so evaluate it clean rather than mixed with the old overlay.
// (The #cy CSS haze filter is left alone; it also carries the base bloom.)
const plasma = document.getElementById("graph-degradation-layer");
const plasmaPrevDisplay = plasma ? plasma.style.display : null;
if (plasma) plasma.style.display = "none";

const viz = butterchurn.createVisualizer(ctx, canvas, {
  width: container.clientWidth, height: container.clientHeight,
});
viz.connectAudio(analyser);

const presets = butterchurnPresets.getPresets();
const presetNames = Object.keys(presets);
cfg.preset = presetNames.find((n) => /flexi|geiss|martin|aderrasi|organic/i.test(n)) || presetNames[0];
viz.loadPreset(presets[cfg.preset], 0.0);

function sizeCanvas() {
  const w = container.clientWidth, h = container.clientHeight;
  canvas.width = w; canvas.height = h;
  viz.setRendererSize(w, h);
}
window.addEventListener("resize", sizeCanvas);
sizeCanvas();

// --- Hybrid drive: bed from game-state severity, shock on damage delta ------
let shockStart = -Infinity;
let prevHealth = null, prevDeck = null;

function readSeverities() {
  const p = degradationParams(getState());
  return { health: p.health.severity, deck: p.deck.severity };
}

function shockEnv(now) {
  const t = (now - shockStart) / cfg.shockMs;
  if (t < 0 || t > 1) return 0;
  return Math.pow(1 - t, 2);
}

function fireShock(magnitude = 1) {
  shockStart = performance.now();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const peak = Math.min(1.0, 0.4 + 0.6 * magnitude);
  osc.type = "sine";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
  osc.connect(g); g.connect(shockBus);
  osc.start(now); osc.stop(now + 0.42);
}

// Watch health/deck for drops → shock (no discrete damage event exists).
function checkDamage() {
  const s = getState();
  const h = s?.player?.health?.current;
  const d = s?.player?.deckIntegrity?.current;
  if (prevHealth != null && h < prevHealth) {
    const drop = (prevHealth - h) / (s.player.health.max || 100);
    fireShock(Math.min(1, drop * 4));   // magnitude scales with how hard the hit was
    lastPool = "health";
  } else if (prevDeck != null && d < prevDeck) {
    const drop = (prevDeck - d) / (s.player.deckIntegrity.max || 100);
    fireShock(Math.min(1, drop * 4));
    lastPool = "deck";
  }
  prevHealth = h; prevDeck = d;
}
let lastPool = null;   // which pool last took damage (for future preset categorization)

function frame() {
  viz.render();
  checkDamage();
  const { health, deck } = readSeverities();
  const bed = cfg.bedWeight * Math.max(health, deck);
  const flare = cfg.flareGain * shockEnv(performance.now());
  canvas.style.opacity = String(Math.min(1, bed + flare));
  if (panel) updateReadout(health, deck);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Minimal control panel (tune live over real gameplay) ------------------
let panel = null, readout = null;
(function buildPanel() {
  panel = document.createElement("div");
  Object.assign(panel.style, {
    position: "fixed", top: "8px", right: "8px", zIndex: "9999",
    background: "rgba(10,10,15,0.92)", border: "1px solid #ff00aa", color: "#7CFC7C",
    font: "11px ui-monospace, Menlo, monospace", padding: "8px", display: "grid", gap: "6px",
    maxWidth: "260px",
  });
  const presetSel = document.createElement("select");
  for (const n of presetNames) {
    const o = document.createElement("option"); o.value = n; o.textContent = n;
    presetSel.appendChild(o);
  }
  presetSel.value = cfg.preset;
  presetSel.onchange = () => { cfg.preset = presetSel.value; viz.loadPreset(presets[cfg.preset], 2.0); };

  const blendSel = document.createElement("select");
  for (const b of ["screen", "lighten", "color-dodge", "overlay", "normal"]) {
    const o = document.createElement("option"); o.value = b; o.textContent = b;
    blendSel.appendChild(o);
  }
  blendSel.value = cfg.blend;
  blendSel.onchange = () => { cfg.blend = blendSel.value; canvas.style.mixBlendMode = cfg.blend; };

  const bed = document.createElement("input");
  bed.type = "range"; bed.min = "0"; bed.max = "1.5"; bed.step = "0.01"; bed.value = String(cfg.bedWeight);
  bed.oninput = () => { cfg.bedWeight = +bed.value; };

  const shockBtn = document.createElement("button");
  shockBtn.textContent = "⚡ test shock";
  Object.assign(shockBtn.style, { background: "#12121a", color: "#ff00aa", border: "1px solid #ff00aa", cursor: "pointer" });
  shockBtn.onclick = () => fireShock(1);

  readout = document.createElement("div");
  readout.style.color = "#888";

  const row = (label, el) => { const d = document.createElement("label");
    d.style.display = "flex"; d.style.gap = "6px"; d.style.justifyContent = "space-between";
    d.append(label, el); return d; };
  panel.append(
    Object.assign(document.createElement("div"), { textContent: "LAB B — butterchurn", style: "color:#ff00aa" }),
    row("preset", presetSel), row("blend", blendSel), row("bed×", bed), shockBtn, readout,
  );
  document.body.appendChild(panel);
})();
function updateReadout(h, d) {
  readout.textContent = `health sev ${h.toFixed(2)} · deck sev ${d.toFixed(2)} · lastHit ${lastPool ?? "—"}`;
}

// Remove the overlay + panel and restore the suppressed plasma (for a clean re-import).
function teardown() {
  canvas.remove();
  if (panel) panel.remove();
  if (plasma) plasma.style.display = plasmaPrevDisplay ?? "";
}

// Exposed for devtools poking.
window.__labB = { ctx, analyser, viz, canvas, cfg, fireShock, teardown };
export { ctx, analyser, viz, canvas, cfg, fireShock, teardown };

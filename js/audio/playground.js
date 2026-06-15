// @ts-nocheck
import { createAudioEngine } from "./engine.js";
import { LAYER_KEYS } from "./scores/corporate.js";
import { ALL_SCORES } from "./scores/index.js";
import { HUB_AMBIENT } from "./scores/hub.js";

// Hub is included so the drone+pad wander can be ear-checked here too (it isn't in ALL_SCORES).
const SCORES = [...ALL_SCORES, HUB_AMBIENT];

const engine = createAudioEngine();
engine.setScore(SCORES[0]);
/** @type {any} */ (window)._audio = engine;  // diagnostics handle

const status = document.getElementById("status");

// Score selector — switch among all scores; restart if currently playing.
const scoreSel = document.getElementById("score");
SCORES.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = s.name ?? s.biome ?? `score ${i}`;
  scoreSel.appendChild(opt);
});
scoreSel.onchange = async () => {
  // setScore rebuilds the live graph if already playing; await the rebuilt start.
  await engine.setScore(SCORES[+scoreSel.value]);
  status.textContent = engine.isStarted() ? "playing" : "stopped";
};

// Section-breakdown toggle — A/B the arrangement masking with vs without.
const secToggle = document.getElementById("sections");
secToggle.onchange = () => engine.setSectionsEnabled(secToggle.checked);
engine.setSectionsEnabled(secToggle.checked);

// Wander-now — force an immediate drone (+ hub pad) chord shift, with a readout.
const wanderBtn = document.getElementById("wander");
const wanderVal = document.getElementById("wanderVal");
wanderBtn.onclick = () => {
  const r = engine.forceWander();
  wanderVal.textContent = r
    ? `step ${r.step} — ` + Object.entries(r.layers).map(([k, n]) => `${k}: ${n.join("+")}`).join("  ")
    : "drone: (this score doesn't wander — press PLAY first)";
};

document.getElementById("play").onclick = async () => {
  try { await engine.start(); status.textContent = "playing"; }
  catch (e) { status.textContent = "ERROR: " + e.message; console.error(e); }
};
document.getElementById("stop").onclick = () => { engine.stop(); status.textContent = "stopped"; };

const tracks = document.getElementById("tracks");
for (const key of LAYER_KEYS) {
  const el = document.createElement("span");
  el.className = "track on";
  el.innerHTML = `<span class="dot"></span>${key}`;
  el.onclick = () => { const on = el.classList.toggle("on"); engine.setMuted(key, !on); };
  tracks.appendChild(el);
}

const prog = document.getElementById("progress"), progVal = document.getElementById("progressVal");
prog.oninput = () => { const v = +prog.value / 100; progVal.textContent = v.toFixed(2); engine.setProgress(v); };
const threat = document.getElementById("threat"), threatVal = document.getElementById("threatVal");
threat.oninput = () => { const v = +threat.value / 100; threatVal.textContent = v.toFixed(2); engine.setThreat(v); };

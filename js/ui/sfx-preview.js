// @ts-nocheck
// SFX + Drone Preview Harness — the permanent preview tool for the game's one-shot SFX cues and
// sustained action drones. The audio analog of preview.html (visual effects) and song-preview.html
// (reactive songs). Fire any cue, and start/sweep/stop any action drone through the game's own
// engine wiring — the exact createSfx() / createDroneVoice() paths main.js uses in-game.
//
// Browser-only. Unlike the song harness, this needs NEITHER the 32MB soundfont NOR the drum samples:
// the cues are pure synth waveforms (square/sawtooth/triangle) and the drones are raw Web Audio,
// so boot is just the runtime + AudioContext.
import { bootStrudel } from "../audio/strudel/runtime.js";
import { createSfx } from "../audio/strudel/sfx.js";
import { CUES } from "../audio/strudel/data/cues.js";
import { createDroneVoice } from "../audio/strudel/drones.js";
import { DRONES, DRONE_IDS } from "../audio/strudel/data/drones.js";

let _rt = null;
let _sfx = null;
const _voices = new Map();   // drone id → { voice, sweeping }

const $ = (id) => document.getElementById(id);
const setStatus = (t, ok = true) => { const el = $("sp-status"); el.textContent = t; el.style.color = ok ? "var(--green)" : "#ff5a5a"; };

async function boot() {
  setStatus("booting runtime…");
  _rt = await bootStrudel();
  await _rt.ctx.resume();
  _sfx = createSfx(_rt);
  _sfx.setEnabled(true);
  $("sp-boot").classList.add("hidden");
  $("sp-stop-all").classList.remove("hidden");
  $("sp-app").classList.remove("hidden");
  buildCues();
  buildDrones();
  setStatus(`ready — ${Object.keys(CUES).length} cues, ${DRONE_IDS.length} drones`);
}

// --- One-shot SFX cues: a fire button per cue -----------------------------------------------------
function buildCues() {
  const box = $("sp-cues");
  box.innerHTML = "";
  for (const id of Object.keys(CUES)) {
    const spec = CUES[id];
    const btn = document.createElement("button");
    btn.className = "btn cue";
    btn.innerHTML = `▶ ${id}<small>${spec.s} ${spec.note}</small>`;
    btn.onclick = () => { _sfx.play(spec); setStatus(`fired ${id}`); };
    box.appendChild(btn);
  }
}

// --- Sustained drones: start/stop toggle + a progress slider + a one-shot sweep --------------------
function buildDrones() {
  const box = $("sp-drones");
  box.innerHTML = "";
  for (const id of DRONE_IDS) {
    const spec = DRONES[id];
    const loop = !!spec.loop;
    const row = document.createElement("div");
    row.className = "drone";
    row.innerHTML =
      `<button class="btn toggle">START ▶</button>` +
      `<span class="dname">${id}<small>${spec.source}${loop ? " · loop" : ""}</small></span>` +
      `<button class="btn sweep"${loop ? " disabled title='loop drone — progress is ignored'" : ""}>SWEEP</button>` +
      `<input type="range" min="0" max="1" step="0.01" value="0"${loop ? " disabled" : ""}>` +
      `<b>0.00</b>`;
    const toggle = row.querySelector(".toggle");
    const sweepBtn = row.querySelector(".sweep");
    const slider = row.querySelector("input");
    const val = row.querySelector("b");

    const setVal = (p) => { slider.value = String(p); val.textContent = (+p).toFixed(2); };

    toggle.onclick = () => {
      const entry = _voices.get(id);
      if (entry) { stopDrone(id); toggle.textContent = "START ▶"; toggle.classList.remove("on"); }
      else {
        const voice = createDroneVoice(_rt.ctx, spec);
        voice.setProgress(parseFloat(slider.value));
        _voices.set(id, { voice });
        toggle.textContent = "STOP ■"; toggle.classList.add("on");
        setStatus(`drone ${id} started`);
      }
    };
    slider.oninput = () => { setVal(slider.value); _voices.get(id)?.voice.setProgress(parseFloat(slider.value)); };
    sweepBtn.onclick = () => {
      const entry = _voices.get(id);
      if (!entry) return;   // only sweeps a running voice
      // Ramp progress 0→1 over ~2.2s, mirroring the in-game action-duration sweep.
      const dur = 2200, t0 = performance.now();
      const step = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        setVal(p.toFixed(2)); entry.voice.setProgress(p);
        if (p < 1 && _voices.has(id)) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    box.appendChild(row);
  }
}

function stopDrone(id) { _voices.get(id)?.voice.stop(); _voices.delete(id); }
function stopAll() {
  for (const id of [..._voices.keys()]) stopDrone(id);
  document.querySelectorAll(".drone .toggle").forEach((b) => { b.textContent = "START ▶"; b.classList.remove("on"); });
  setStatus("all drones stopped");
}

export function initSfxPreview() {
  $("sp-boot").onclick = () => boot().catch((e) => setStatus("boot failed: " + (e && e.message || e), false));
  $("sp-stop-all").onclick = stopAll;
}

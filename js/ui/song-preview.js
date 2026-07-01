// @ts-nocheck
// Song Preview Harness — the permanent authoring/preview tool for reactive Strudel songs.
// The audio analog of preview.html (visual effects). Load a strudel.cc song, hear it through the
// game's own runtime + vendored gus_* instruments, drive the game signals (progress/threat/…) with
// sliders to hear reactivity, and lint the song against the kosher sound set.
//
// Browser-only. Wires the shipped engine pieces: runtime boot, game soundfont, signal bridge.
import { bootStrudel } from "../audio/strudel/runtime.js";
import { loadGameSoundfont, soundfontNames } from "../audio/strudel/soundfont.js";
import { installGameSignals } from "../audio/strudel/signal-bridge.js";
import { signalNames } from "../audio/signal-registry.js";

// Drum sample names currently loaded from the dirt-samples set (NOT yet vendored/offline — a
// follow-up; the linter treats these as allowed for now). Synth waveforms are always allowed.
const WAVEFORMS = ["sawtooth", "square", "triangle", "sine", "white", "pink", "brown"];
const DRUMS = ["bd", "sd", "hh", "oh", "cp", "rim", "lt", "mt", "ht", "cr", "rd", "sh", "cb", "perc", "misc"];

const DEMO = `// Song Preview demo — game-signal reactivity + vendored gus_* instruments.
// Drag the PROGRESS / THREAT sliders to hear the song respond.
setcpm(60/4)

$: note("<c2 c2 g1 c2>").s("gus_synth_bass_1")
     .lpf(threat.range(300, 3000))          // filter opens as THREAT climbs
     .gain(0.6)

$: note("c4 eb4 g4 bb4").s("gus_warm_pad")
     .gain(progress.range(0.1, 0.6))        // pad swells as you own more of the LAN
     .room(0.5)

$: sound("bd sd").gain(threat.range(0, 0.85))  // beat drops in under threat
`;

let _rt = null;
let _signals = null;
let _allowed = new Set();

const $ = (id) => document.getElementById(id);
const setStatus = (t, ok = true) => { const el = $("sp-status"); el.textContent = t; el.style.color = ok ? "var(--green)" : "#ff5a5a"; };

async function boot() {
  setStatus("booting runtime…");
  _rt = await bootStrudel();
  await _rt.ctx.resume();
  setStatus("loading instruments (32MB soundfont)…");
  const names = await loadGameSoundfont();
  setStatus("loading drums…");
  try { await _rt.samples("github:tidalcycles/dirt-samples"); } catch (_) { /* offline: drums silent */ }
  _signals = installGameSignals(_rt);
  _allowed = new Set([...names, ...WAVEFORMS, ...DRUMS]);
  $("sp-boot").classList.add("hidden");
  $("sp-app").classList.remove("hidden");
  buildSignalSliders();
  buildPalette(names);
  $("sp-code").value = DEMO;
  setStatus(`ready — ${names.length} gus_ instruments loaded`);
}

function buildSignalSliders() {
  const box = $("sp-signals");
  box.innerHTML = "";
  for (const name of signalNames()) {
    const row = document.createElement("div");
    row.className = "sp-sig";
    row.innerHTML = `<label>${name}</label><input type="range" min="0" max="1" step="0.01" value="0"><b>0.00</b>`;
    const [slider, val] = [row.querySelector("input"), row.querySelector("b")];
    slider.addEventListener("input", () => { _signals.setLive(name, parseFloat(slider.value)); val.textContent = (+slider.value).toFixed(2); });
    box.appendChild(row);
  }
}

function buildPalette(names) {
  const list = $("sp-palette");
  const render = (filter) => {
    const f = filter.toLowerCase();
    list.innerHTML = names.filter((n) => n.includes(f)).map((n) => `<span class="sp-inst" title="click to copy .s(&quot;${n}&quot;)">${n}</span>`).join("");
    list.querySelectorAll(".sp-inst").forEach((el) => el.onclick = () => navigator.clipboard?.writeText(`.s("${el.textContent}")`));
  };
  $("sp-filter").addEventListener("input", (e) => render(e.target.value));
  $("sp-count").textContent = names.length;
  render("");
}

/** Lint a song: warn about sound names not in the kosher set (so it carries to the game). */
function lint(code) {
  const refs = new Set();
  for (const m of code.matchAll(/\b(?:s|sound)\(\s*[`"']([^`"']+)[`"']/g)) {
    // a sound arg can be a mini-notation pattern ("bd sd", "gus_pad*2") — split into tokens
    for (const tok of m[1].split(/[\s<>\[\]()*!/,~.]+/).filter(Boolean)) {
      if (!/^[a-z]/i.test(tok)) continue; // skip numbers/mult factors
      refs.add(tok);
    }
  }
  const unknown = [...refs].filter((r) => !_allowed.has(r));
  return unknown;
}

function play() {
  const code = $("sp-code").value;
  const unknown = lint(code);
  const warn = $("sp-lint");
  if (unknown.length) {
    warn.textContent = `⚠ not in the kosher set (won't carry to the game): ${unknown.join(", ")}`;
    warn.style.color = "#ffb400";
  } else {
    warn.textContent = "✓ all sounds in the kosher set";
    warn.style.color = "var(--green)";
  }
  try { window.hush(); window.evaluate(code); setStatus("playing ▶"); }
  catch (e) { setStatus("error: " + (e && e.message || e), false); }
}

function stop() { window.hush(); setStatus("stopped ■"); }

export function initSongPreview() {
  $("sp-boot").onclick = () => boot().catch((e) => setStatus("boot failed: " + (e && e.message || e), false));
  $("sp-play").onclick = play;
  $("sp-stop").onclick = stop;
}

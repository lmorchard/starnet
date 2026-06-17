// Browser harness: load a docs/<slug>.json artifact and play its score_spec with Tone.js.
// No eval — only known Tone constructors from PALETTE, with plain-data options.

const PALETTE = new Set([
  "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
  "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
]);
const UNPITCHED = new Set(["NoiseSynth"]);
// One-shot percussion: kept short + trimmed so hats tick instead of ringing/dominating.
const PERC = new Set(["MetalSynth", "NoiseSynth"]);
const PERC_DUR = "32n";   // fixed short trigger length regardless of the step grid
// Inherently-hot sources get a default output trim (dB) so they don't dominate the bus
// compressor — loud hats were pumping the whole mix down. A model-set `volume` still wins.
const DEFAULT_TRIM = { MetalSynth: -22, NoiseSynth: -14 };

const $ = (id) => document.getElementById(id);
const warnings = [];
let built = null; // { rows, fx, bus, reverb, recycleId, retiring }

// Flat option scalars -> nested Tone constructor options. Only set what's provided.
function expandOptions(o = {}) {
  const out = {};
  if (o.oscillatorType || o.count != null || o.spread != null) {
    out.oscillator = {};
    if (o.oscillatorType) out.oscillator.type = o.oscillatorType;
    if (o.count != null) out.oscillator.count = o.count;
    if (o.spread != null) out.oscillator.spread = o.spread;
  }
  if (o.attack != null || o.decay != null || o.sustain != null || o.release != null) {
    out.envelope = {};
    if (o.attack != null) out.envelope.attack = o.attack;
    if (o.decay != null) out.envelope.decay = o.decay;
    if (o.sustain != null) out.envelope.sustain = o.sustain;
    if (o.release != null) out.envelope.release = o.release;
  }
  if (o.filterType || o.filterQ != null) {
    out.filter = {};
    if (o.filterType) out.filter.type = o.filterType;
    if (o.filterQ != null) out.filter.Q = o.filterQ;
  }
  if (o.filterFrequency != null) out.filterEnvelope = { baseFrequency: o.filterFrequency };
  if (o.harmonicity != null) out.harmonicity = o.harmonicity;
  if (o.modulationIndex != null) out.modulationIndex = o.modulationIndex;
  if (o.volume != null) out.volume = o.volume;
  return out;
}

function makeSynth(type, opts) {
  const options = expandOptions(opts);
  try {
    if (type === "PolySynth") {
      // In Tone v15 the 2nd PolySynth arg is wrapper options, not voice options —
      // forward the voice settings via .set() instead.
      const ps = new Tone.PolySynth(Tone.Synth);
      if (Object.keys(options).length) ps.set(options);
      return ps;
    }
    return new Tone[type](options);
  } catch (e) {
    // Options didn't fit this source — fall back to a bare instance so it still sounds.
    warnings.push(`options rejected for ${type}; using defaults (${e.message})`);
    if (type === "PolySynth") return new Tone.PolySynth(Tone.Synth);
    return new Tone[type]();
  }
}

// Trigger one step token on a synth, honoring per-type signatures.
function triggerStep(synth, type, token, dur, time) {
  if (!token) return;                        // "" -> rest
  const d = PERC.has(type) ? PERC_DUR : dur; // percussion stays short regardless of grid
  // A chord ("A+C+E") can only sound on a PolySynth; a mono synth gets the root note.
  let note;
  if (token === "x") note = "C3";            // unpitched-hit token on a pitched synth
  else if (token.includes("+")) note = type === "PolySynth" ? token.split("+") : token.split("+")[0];
  else note = token;
  // Tone throws "start time must be strictly greater than previous" on scheduler/timing
  // collisions; swallow it so one dropped note never spams the console or wedges playback.
  try {
    if (UNPITCHED.has(type)) synth.triggerAttackRelease(d, time);
    else synth.triggerAttackRelease(note, d, time);
  } catch { /* dropped note on a timing collision */ }
}

const safeDispose = (n) => { try { if (n && n.dispose) n.dispose(); } catch { /* already gone */ } };

function disposeBuilt() {
  if (!built) return;
  const old = built;
  built = null;
  // Stop scheduling new notes immediately, and release any held/one-shot voices.
  old.rows.forEach((r) => { if (r.skipped) return; safeDispose(r.seq); try { r.synth.releaseAll?.(); r.synth.triggerRelease?.(); } catch { /* ok */ } });
  // Defer node disposal: disposing a synth while one of its one-shot sources still has a
  // pending `onended` cleanup throws a benign-but-noisy InvalidAccessError (it disconnects
  // from an already-disposed neighbor). Letting tails settle first avoids it; the old graph
  // also fades out instead of cutting hard on a track switch.
  setTimeout(() => {
    old.rows.forEach((r) => { if (!r.skipped) safeDispose(r.synth); });
    old.fx.forEach(safeDispose);
    safeDispose(old.reverb);   // before the masterGain it feeds
    old.bus.forEach(safeDispose);
  }, 400);
}

async function build(spec) {
  disposeBuilt();
  warnings.length = 0;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = spec.bpm || 120;

  // Master glue bus: everything -> masterGain -> EQ3 -> Compressor -> Limiter -> out.
  // This is where cohesion, loudness, and a bit of body come from.
  const masterGain = new Tone.Gain(0.9);
  const eq = new Tone.EQ3({ low: 2, mid: -1, high: 0 });   // body, neutral highs (hats stay tame)
  // Gentle glue with a slow-ish attack so percussive transients pass through instead of
  // ducking the whole mix on every hit.
  const comp = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.025, release: 0.18 });
  const limiter = new Tone.Limiter(-1);
  masterGain.connect(eq); eq.connect(comp); comp.connect(limiter); limiter.toDestination();

  // Shared reverb fed by per-track sends — runs 100% wet; the send gain sets the amount.
  // (Reverb's impulse response is generated async; await before wiring it in.)
  const reverb = new Tone.Reverb({ decay: 2.4, wet: 1 });
  await reverb.generate();
  reverb.connect(masterGain);

  const fx = [];            // per-track aux nodes (distortion / chorus / gain / reverb-send)
  const rows = [];
  (spec.tracks || []).forEach((t) => {
    const type = t.synth?.type;
    if (!type || !PALETTE.has(type)) {
      warnings.push(`track "${t.name}" skipped: unsupported synth type ${JSON.stringify(type)}`);
      rows.push({ t, type, muted: true, skipped: true });
      return;
    }
    const o = { ...(t.synth.options || {}) };
    if (o.volume == null && DEFAULT_TRIM[type] != null) o.volume = DEFAULT_TRIM[type];
    if (PERC.has(type)) {
      // Force a one-shot envelope so hats don't sustain/ring (model values were too long).
      o.sustain = 0;
      o.release = Math.min(o.release ?? 0.06, 0.1);
      if (o.decay != null) o.decay = Math.min(o.decay, 0.2);
    }

    // Post-synth insert chain: synth -> [Distortion] -> [Chorus] -> gain -> bus (+ reverb send).
    const gain = new Tone.Gain(1);    // per-track level for mute/solo
    const inserts = [];
    if (o.drive > 0) inserts.push(new Tone.Distortion(Math.min(1, o.drive)));
    if (o.chorus > 0) inserts.push(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: Math.min(1, o.chorus) }).start());
    const chain = [...inserts, gain];
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
    gain.connect(masterGain);         // dry path through the bus
    fx.push(...inserts, gain);
    const send = o.reverbSend != null ? o.reverbSend : 0.15;   // default a little space
    if (send > 0) {
      const sendGain = new Tone.Gain(Math.min(1, send));
      gain.connect(sendGain); sendGain.connect(reverb); fx.push(sendGain);
    }

    const synth = makeSynth(type, o);
    synth.connect(chain[0]);
    const grid = t.steps?.grid || "8n";
    const notes = t.steps?.notes || [];
    let last = -1;                    // last trigger time on this voice (monotonic guard)
    const seq = new Tone.Sequence((time, tok) => {
      if (time <= last) return;       // skip non-increasing times (scheduler/loop collisions)
      last = time;
      triggerStep(synth, type, tok, grid, time);
    }, notes, grid);
    seq.start(0);
    rows.push({ t, type, gain, synth, seq, muted: false, skipped: false });
  });

  built = { rows, fx, bus: [masterGain, eq, comp, limiter], reverb };
  return rows;
}

// --- mute / solo ---
function applyMuteSolo(rows) {
  const anySolo = rows.some((r) => r.solo);
  rows.forEach((r) => {
    if (r.skipped) return;
    const audible = anySolo ? r.solo : !r.muted;
    r.gain.gain.rampTo(audible ? 1 : 0, 0.05);
  });
}

function renderTracks(rows) {
  const tbody = $("tracks").querySelector("tbody");
  tbody.innerHTML = "";
  const header = document.createElement("tr");
  header.innerHTML = "<th>Track</th><th>Instrument</th><th>Grid</th><th>Mute</th><th>Solo</th>";
  tbody.appendChild(header);
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.skipped) tr.className = "muted";
    tr.innerHTML =
      `<td>${r.t.name ?? ""}</td><td>${r.type ?? "—"}</td>` +
      `<td>${r.t.steps?.grid ?? ""}</td>` +
      `<td>${r.skipped ? "—" : '<input type="checkbox" class="mute">'}</td>` +
      `<td>${r.skipped ? "—" : '<input type="checkbox" class="solo">'}</td>`;
    if (!r.skipped) {
      tr.querySelector(".mute").addEventListener("change", (e) => { r.muted = e.target.checked; applyMuteSolo(rows); });
      tr.querySelector(".solo").addEventListener("change", (e) => { r.solo = e.target.checked; applyMuteSolo(rows); });
    }
    tbody.appendChild(tr);
  });
  $("warnings").textContent = warnings.join("\n");
}

// Build + display a score from a parsed sidecar (or bare score_spec), with an optional label.
async function loadSpecFromJson(json, label) {
  const spec = json.score_spec || json;
  const rows = await build(spec);
  const head = label ? `${label} · ` : "";
  $("meta").textContent = `${head}${spec.root ?? "?"} ${spec.mode ?? ""} · ${Math.round(spec.bpm ?? 0)} BPM · ${(spec.tracks || []).length} tracks`;
  renderTracks(rows);
  $("play").disabled = false;
  $("stop").disabled = false;
}

// --- file load + transport controls ---
$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); }
  catch (err) { $("warnings").textContent = `could not parse JSON: ${err.message}`; return; }
  await loadSpecFromJson(json, file.name);
});

// --- library list (served mode): fetch the manifest and render clickable tracks ---
async function initLibrary() {
  let idx;
  try {
    const res = await fetch("../docs/index.json", { cache: "no-store" });
    if (!res.ok) return;                 // no manifest → file-picker only
    idx = await res.json();
  } catch { return; }                    // file:// or fetch blocked → file-picker only
  const ul = $("library");
  let playingBtn = null;
  idx.forEach((e) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = `${e.artist} — ${e.title}  ·  ${e.root} ${e.mode} · ${Math.round(e.bpm || 0)} BPM · ${e.tracks} trk`;
    btn.addEventListener("click", async () => {
      try {
        const r = await fetch(`../docs/${e.slug}.json`, { cache: "no-store" });
        await loadSpecFromJson(await r.json(), `${e.artist} — ${e.title}`);
        if (playingBtn) playingBtn.classList.remove("playing");
        btn.classList.add("playing"); playingBtn = btn;
      } catch (err) { $("warnings").textContent = `could not load ${e.slug}: ${err.message}`; }
    });
    li.appendChild(btn); ul.appendChild(li);
  });
  if (idx.length) $("library-section").style.display = "";
}
initLibrary();

$("play").addEventListener("click", async () => {
  await Tone.start();          // unlock audio on user gesture
  Tone.getContext().lookAhead = 0.2;   // larger lookahead on the live context: fewer dropouts
  Tone.Transport.start();
});
$("stop").addEventListener("click", () => { Tone.Transport.stop(); Tone.Transport.position = 0; });

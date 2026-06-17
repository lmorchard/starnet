// Browser harness: load a docs/<slug>.json artifact and play its score_spec with Tone.js.
// No eval — only known Tone constructors from PALETTE, with plain-data options.

const PALETTE = new Set([
  "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
  "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
]);
const UNPITCHED = new Set(["NoiseSynth"]);

const $ = (id) => document.getElementById(id);
const warnings = [];
let built = null; // { sequences:[], synths:[], gains:[], reverb, master, rows }

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
  if (!token) return;                       // "" -> rest
  if (UNPITCHED.has(type)) { synth.triggerAttackRelease(dur, time); return; }
  const note = token === "x" ? "C3" : (token.includes("+") ? token.split("+") : token);
  synth.triggerAttackRelease(note, dur, time);
}

function disposeBuilt() {
  if (!built) return;
  built.sequences.forEach((s) => s.dispose());
  built.synths.forEach((s) => s.dispose());
  built.gains.forEach((g) => g.dispose());
  built.reverb?.dispose();
  built.master?.dispose();
  built = null;
}

async function build(spec) {
  disposeBuilt();
  warnings.length = 0;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = spec.bpm || 120;

  const master = new Tone.Gain(0.9).toDestination();
  // Tone.Reverb generates its impulse response asynchronously — connecting before it's
  // ready drops the wet signal, so await generate() before wiring it up.
  const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.15 });
  await reverb.generate();
  reverb.connect(master);

  const gains = [];
  const synths = [];
  const sequences = [];
  const rows = [];
  (spec.tracks || []).forEach((t, i) => {
    const type = t.synth?.type;
    if (!type || !PALETTE.has(type)) {
      warnings.push(`track "${t.name}" skipped: unsupported synth type ${JSON.stringify(type)}`);
      rows.push({ t, type, muted: true, skipped: true });
      return;
    }
    const gain = new Tone.Gain(1).connect(reverb);
    const synth = makeSynth(type, t.synth.options || {});
    synth.connect(gain);
    const grid = t.steps?.grid || "8n";
    const notes = t.steps?.notes || [];
    const seq = new Tone.Sequence((time, tok) => triggerStep(synth, type, tok, grid, time), notes, grid);
    seq.start(0);
    gains.push(gain);
    synths.push(synth);
    sequences.push(seq);
    rows.push({ t, type, gain, muted: false, skipped: false });
  });

  built = { sequences, synths, gains, reverb, master, rows };
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

// --- file load + transport controls ---
$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); }
  catch (err) { $("warnings").textContent = `could not parse JSON: ${err.message}`; return; }
  const spec = json.score_spec || json; // accept a full sidecar or a bare score_spec
  const rows = await build(spec);
  $("meta").textContent = `${spec.root ?? "?"} ${spec.mode ?? ""} · ${Math.round(spec.bpm ?? 0)} BPM · ${(spec.tracks || []).length} tracks`;
  renderTracks(rows);
  $("play").disabled = false;
  $("stop").disabled = false;
});

$("play").addEventListener("click", async () => {
  await Tone.start();          // unlock audio on user gesture
  Tone.Transport.start();
});
$("stop").addEventListener("click", () => { Tone.Transport.stop(); Tone.Transport.position = 0; });

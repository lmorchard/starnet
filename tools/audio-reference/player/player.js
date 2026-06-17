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

// A synth triggered thousands of times accumulates un-prunable AudioParam automation, which
// compounds into rising CPU and crackle over a long run. Mirror the Starnet engine's fix:
// a larger lookahead (set on the live context in the play handler, after Tone.start()) +
// periodically recreate each sequenced synth (retiring the old after its release tail) so no
// instance is triggered unboundedly.
const RECYCLE_BARS = 8;     // recreate sequenced synths every N bars
const RETIRE_SEC = 2.5;     // dispose a retired synth this long after swap (let its tail ring)

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
  if (!token) return;                       // "" -> rest
  const d = PERC.has(type) ? PERC_DUR : dur; // percussion stays short regardless of grid
  if (UNPITCHED.has(type)) { synth.triggerAttackRelease(d, time); return; }
  if (token === "x") { synth.triggerAttackRelease("C3", d, time); return; }
  if (token.includes("+")) {
    // A chord. Only PolySynth can sound simultaneous notes; handing an array to a
    // monophonic synth throws ("start time must be strictly greater...") mid-trigger and
    // leaves a stuck, never-released note. Collapse to the root for mono synths.
    const notes = token.split("+");
    synth.triggerAttackRelease(type === "PolySynth" ? notes : notes[0], d, time);
    return;
  }
  synth.triggerAttackRelease(token, d, time);
}

function disposeBuilt() {
  if (!built) return;
  if (built.recycleId != null) Tone.Transport.clear(built.recycleId);
  built.retiring.forEach((rec) => { clearTimeout(rec.id); try { rec.synth.dispose(); } catch { /* gone */ } });
  built.rows.forEach((r) => {
    if (r.skipped) return;
    try { r.seq.dispose(); } catch { /* gone */ }
    try { r.voice.synth.dispose(); } catch { /* gone */ }
  });
  built.fx.forEach((n) => { try { n.dispose(); } catch { /* gone */ } });
  built.bus.forEach((n) => { try { n.dispose(); } catch { /* gone */ } });
  built.reverb?.dispose();
  built = null;
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

    // Build the post-synth insert chain ([Distortion] -> [Chorus] -> gain) FIRST, so the
    // synth has a stable target node to feed — the recycler reconnects fresh synths here.
    const gain = new Tone.Gain(1);    // per-track level for mute/solo (never recycled)
    const inserts = [];
    if (o.drive > 0) inserts.push(new Tone.Distortion(Math.min(1, o.drive)));
    if (o.chorus > 0) inserts.push(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: Math.min(1, o.chorus) }).start());
    const chain = [...inserts, gain];
    for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
    const synthTarget = chain[0];     // the node a (recyclable) synth connects into
    gain.connect(masterGain);         // dry path through the bus
    fx.push(...inserts, gain);
    const send = o.reverbSend != null ? o.reverbSend : 0.15;   // default a little space
    if (send > 0) {
      const sendGain = new Tone.Gain(Math.min(1, send));
      gain.connect(sendGain); sendGain.connect(reverb); fx.push(sendGain);
    }

    const synth = makeSynth(type, o);
    synth.connect(synthTarget);
    const voice = { synth, last: -1 }; // mutable holder (recycler swaps synth); last = last trigger time
    const grid = t.steps?.grid || "8n";
    const notes = t.steps?.notes || [];
    const seq = new Tone.Sequence((time, tok) => {
      // A monophonic synth throws "start time must be strictly greater than previous" if
      // retriggered at a non-increasing time (scheduler collisions, loop-boundary doubling),
      // and the throw aborts mid-trigger leaving a stuck, never-released note. Guard it.
      if (time <= voice.last) return;
      voice.last = time;
      triggerStep(voice.synth, type, tok, grid, time);
    }, notes, grid);
    seq.start(0);
    rows.push({ t, type, opts: o, gain, voice, synthTarget, seq, muted: false, skipped: false });
  });

  // Recycler: every RECYCLE_BARS, mint a fresh synth per track (flushing accumulated
  // automation), point the sequence at it, and retire the old one after its tail rings out.
  const retiring = new Set();
  const retire = (synth) => {
    const rec = { synth };
    rec.id = setTimeout(() => {
      try { synth.releaseAll?.(); synth.dispose(); } catch { /* gone */ }
      retiring.delete(rec);
    }, RETIRE_SEC * 1000);
    retiring.add(rec);
  };
  const recycleId = Tone.Transport.scheduleRepeat(() => {
    for (const r of rows) {
      if (r.skipped) continue;
      const fresh = makeSynth(r.type, r.opts);
      fresh.connect(r.synthTarget);
      const old = r.voice.synth;
      r.voice.synth = fresh;          // new notes hit the fresh synth; old rings out then disposes
      retire(old);
    }
  }, `${RECYCLE_BARS}m`, `${RECYCLE_BARS}m`);

  built = { rows, fx, bus: [masterGain, eq, comp, limiter], reverb, recycleId, retiring };
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
  Tone.getContext().lookAhead = 0.2;   // larger lookahead on the live context: fewer dropouts
  Tone.Transport.start();
});
$("stop").addEventListener("click", () => { Tone.Transport.stop(); Tone.Transport.position = 0; });

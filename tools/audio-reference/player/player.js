// Browser harness: load a docs/<slug>.json artifact, play its score_spec with Tone.js, and
// tweak each track's instrument live. No eval — only known Tone constructors from PALETTE.

const PALETTE = [
  "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
  "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
];
const PALETTE_SET = new Set(PALETTE);
const UNPITCHED = new Set(["NoiseSynth"]);
const PERC = new Set(["MetalSynth", "NoiseSynth"]);   // one-shot: tight + trimmed
const PERC_DUR = "32n";
const DEFAULT_TRIM = { MetalSynth: -22, NoiseSynth: -14 };   // dB; a model-set volume still wins

// Control vocabulary exposed in the tweaker (matches the flat synth.options the model emits).
const OSC_TYPES = ["", "sawtooth", "square", "fatsawtooth", "fatsquare", "triangle", "sine", "pwm", "pulse"];
const FILTER_TYPES = ["", "lowpass", "highpass", "bandpass", "notch"];
const NUM_FIELDS = ["attack", "decay", "sustain", "release", "filterFrequency", "filterQ",
                    "drive", "chorus", "reverbSend", "volume", "harmonicity", "modulationIndex",
                    "count", "spread"];
const SHORT = { filterFrequency: "freq", filterQ: "Q", reverbSend: "rev", modulationIndex: "mod",
                oscillatorType: "osc", filterType: "filt" };

const $ = (id) => document.getElementById(id);
const warnings = [];
let built = null;        // { rows, masterGain, reverb }
let currentSlug = null;  // set when loaded from the library; enables Save
let currentSpec = null;  // {root, mode, bpm} of the loaded track

// ---- pure-ish helpers ----------------------------------------------------------------

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

// Apply harness defaults (hot-percussion trim, one-shot perc envelope) — not saved to the spec.
function effectiveOpts(type, o) {
  const e = { ...o };
  if (e.volume == null && DEFAULT_TRIM[type] != null) e.volume = DEFAULT_TRIM[type];
  if (PERC.has(type)) {
    e.sustain = 0;
    e.release = Math.min(e.release ?? 0.06, 0.1);
    if (e.decay != null) e.decay = Math.min(e.decay, 0.2);
  }
  return e;
}

function makeSynth(type, opts) {
  const options = expandOptions(effectiveOpts(type, opts));
  try {
    if (type === "PolySynth") {
      const ps = new Tone.PolySynth(Tone.Synth);
      if (Object.keys(options).length) ps.set(options);
      return ps;
    }
    return new Tone[type](options);
  } catch (e) {
    warnings.push(`options rejected for ${type}; using defaults (${e.message})`);
    if (type === "PolySynth") return new Tone.PolySynth(Tone.Synth);
    return new Tone[type]();
  }
}

function triggerStep(synth, type, token, dur, time) {
  if (!token) return;                        // "" -> rest
  const d = PERC.has(type) ? PERC_DUR : dur;
  let note;
  if (token === "x") note = "C3";
  else if (token.includes("+")) note = type === "PolySynth" ? token.split("+") : token.split("+")[0];
  else note = token;
  // Tone throws "start time must be strictly greater than previous" on timing collisions;
  // swallow so one dropped note never spams the console or wedges playback.
  try {
    if (UNPITCHED.has(type)) synth.triggerAttackRelease(d, time);
    else synth.triggerAttackRelease(note, d, time);
  } catch { /* dropped note */ }
}

// ---- graph build / teardown ----------------------------------------------------------

const safeDispose = (n) => { try { if (n && n.dispose) n.dispose(); } catch { /* already gone */ } };

// Release voices now, dispose nodes after their tails settle (disposing a synth with a pending
// one-shot onended throws a benign InvalidAccessError).
function retire(synths, nodes) {
  synths.forEach((s) => { try { s.releaseAll?.(); s.triggerRelease?.(); } catch { /* ok */ } });
  setTimeout(() => { synths.forEach(safeDispose); nodes.forEach(safeDispose); }, 400);
}

function disposeBuilt() {
  if (!built) return;
  const old = built;
  built = null;
  const synths = [], nodes = [];
  old.rows.forEach((r) => {
    if (r.skipped) return;
    safeDispose(r.seq);
    synths.push(r.voice.synth);
    nodes.push(...r.inserts, r.gain, r.sendGain);
  });
  nodes.push(old.reverb, old.masterGain, old.eq, old.comp, old.limiter);
  retire(synths, nodes);
}

// Build a track's instrument + inserts and wire synth -> [drive] -> [chorus] -> gain.
// Returns { synth, inserts }. (gain, sendGain are stable across rebuilds.)
function buildInstrument(row) {
  const o = row.opts;
  const inserts = [];
  if (o.drive > 0) inserts.push(new Tone.Distortion(Math.min(1, o.drive)));
  if (o.chorus > 0) inserts.push(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: Math.min(1, o.chorus) }).start());
  const chain = [...inserts, row.gain];
  for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
  const synth = makeSynth(row.type, o);
  synth.connect(chain[0]);
  return { synth, inserts };
}

// Live-rebuild one track from its (edited) opts: new instrument in, old one retired.
function rebuildTrack(row) {
  if (row.skipped) return;
  const oldSynth = row.voice.synth, oldInserts = row.inserts;
  const { synth, inserts } = buildInstrument(row);
  row.voice.synth = synth;          // the sequence reads row.voice.synth, so it follows the swap
  row.inserts = inserts;
  const sendLevel = row.opts.reverbSend != null ? Math.min(1, row.opts.reverbSend) : 0.15;
  row.sendGain.gain.rampTo(sendLevel, 0.05);
  retire([oldSynth], oldInserts);
}

async function build(spec) {
  disposeBuilt();
  warnings.length = 0;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = spec.bpm || 120;

  const masterGain = new Tone.Gain(0.9);
  const eq = new Tone.EQ3({ low: 2, mid: -1, high: 0 });
  const comp = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.025, release: 0.18 });
  const limiter = new Tone.Limiter(-1);
  masterGain.connect(eq); eq.connect(comp); comp.connect(limiter); limiter.toDestination();

  const reverb = new Tone.Reverb({ decay: 2.4, wet: 1 });
  await reverb.generate();
  reverb.connect(masterGain);

  const rows = [];
  (spec.tracks || []).forEach((t) => {
    const type = t.synth?.type;
    if (!type || !PALETTE_SET.has(type)) {
      warnings.push(`track "${t.name}" skipped: unsupported synth type ${JSON.stringify(type)}`);
      rows.push({ t, type, muted: true, skipped: true });
      return;
    }
    const gain = new Tone.Gain(1).connect(masterGain);   // per-track level (mute/solo)
    const sendGain = new Tone.Gain(t.synth.options?.reverbSend != null ? Math.min(1, t.synth.options.reverbSend) : 0.15);
    gain.connect(sendGain); sendGain.connect(reverb);
    const row = {
      t, type, opts: { ...(t.synth.options || {}) }, gain, sendGain,
      voice: { synth: null }, inserts: [], muted: false, skipped: false,
      grid: t.steps?.grid || "8n", notes: t.steps?.notes || [],
    };
    const inst = buildInstrument(row);
    row.voice.synth = inst.synth; row.inserts = inst.inserts;
    let last = -1;
    row.seq = new Tone.Sequence((time, tok) => {
      if (time <= last) return;        // skip non-increasing times (scheduler/loop collisions)
      last = time;
      triggerStep(row.voice.synth, row.type, tok, row.grid, time);
    }, row.notes, row.grid).start(0);
    rows.push(row);
  });

  built = { rows, masterGain, eq, comp, limiter, reverb };
  return rows;
}

// ---- mute / solo ----------------------------------------------------------------------

function applyMuteSolo() {
  if (!built) return;
  const anySolo = built.rows.some((r) => r.solo);
  built.rows.forEach((r) => {
    if (r.skipped) return;
    const audible = anySolo ? r.solo : !r.muted;
    r.gain.gain.rampTo(audible ? 1 : 0, 0.05);
  });
}

// ---- track cards + instrument controls ------------------------------------------------

function selectCtl(label, options, value, onChange) {
  const wrap = document.createElement("label"); wrap.className = "ctl"; wrap.append(label + " ");
  const sel = document.createElement("select");
  options.forEach((opt) => {
    const o = document.createElement("option"); o.value = opt; o.textContent = opt || "—";
    if (opt === (value ?? "")) o.selected = true;
    sel.append(o);
  });
  sel.addEventListener("change", () => onChange(sel.value));
  wrap.append(sel); return wrap;
}

function numCtl(label, value, onChange) {
  const wrap = document.createElement("label"); wrap.className = "ctl"; wrap.append(label + " ");
  const inp = document.createElement("input"); inp.type = "number"; inp.step = "any";
  inp.value = value ?? "";
  inp.addEventListener("change", () => onChange(inp.value.trim()));   // commit on blur/enter, not per keystroke
  wrap.append(inp); return wrap;
}

function renderTracks() {
  const host = $("tracks"); host.innerHTML = "";
  if (!built) return;
  built.rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "track" + (row.skipped ? " skipped" : "");
    const head = document.createElement("div"); head.className = "track-head";
    const name = document.createElement("span"); name.className = "track-name"; name.textContent = row.t.name ?? "";
    head.append(name);

    if (row.skipped) {
      const note = document.createElement("span"); note.textContent = `(unsupported: ${row.type ?? "—"})`;
      head.append(note); card.append(head); host.append(card); return;
    }

    head.append(selectCtl("synth", PALETTE, row.type, (v) => { row.type = v; rebuildTrack(row); }));
    ["mute", "solo"].forEach((k) => {
      const l = document.createElement("label"); l.className = "ctl";
      const cb = document.createElement("input"); cb.type = "checkbox";
      cb.addEventListener("change", () => { row[k] = cb.checked; applyMuteSolo(); });
      l.append(cb, k); head.append(l);
    });
    card.append(head);

    const ctls = document.createElement("div"); ctls.className = "ctls";
    const setOpt = (field, raw) => {
      if (raw === "" || raw == null) delete row.opts[field];
      else row.opts[field] = field === "oscillatorType" || field === "filterType" ? raw : Number(raw);
      rebuildTrack(row);
    };
    ctls.append(selectCtl(SHORT.oscillatorType, OSC_TYPES, row.opts.oscillatorType, (v) => setOpt("oscillatorType", v)));
    ctls.append(selectCtl(SHORT.filterType, FILTER_TYPES, row.opts.filterType, (v) => setOpt("filterType", v)));
    NUM_FIELDS.forEach((f) => ctls.append(numCtl(SHORT[f] || f, row.opts[f], (v) => setOpt(f, v))));
    card.append(ctls);
    host.append(card);
  });
}

// ---- load / save / transport ----------------------------------------------------------

async function loadSpecFromJson(json, label, slug) {
  const spec = json.score_spec || json;
  currentSpec = { root: spec.root, mode: spec.mode, bpm: spec.bpm };
  currentSlug = slug || null;
  await build(spec);
  renderTracks();
  const head = label ? `${label} · ` : "";
  $("meta").textContent = `${head}${spec.root ?? "?"} ${spec.mode ?? ""} · ${Math.round(spec.bpm ?? 0)} BPM · ${(spec.tracks || []).length} tracks`;
  $("warnings").textContent = warnings.join("\n");
  $("status").textContent = "";
  $("play").disabled = false; $("stop").disabled = false;
  $("save").disabled = !currentSlug;   // Save only for library tracks (served, has a slug)
}

// Reassemble the (edited) score_spec for saving: original tracks with tweaked synth/options.
function currentScoreSpec() {
  return {
    ...currentSpec,
    tracks: built.rows.map((r) => ({ ...r.t, synth: { type: r.type, options: r.opts } })),
  };
}

$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); }
  catch (err) { $("warnings").textContent = `could not parse JSON: ${err.message}`; return; }
  await loadSpecFromJson(json, file.name, null);
});

$("save").addEventListener("click", async () => {
  if (!currentSlug || !built) return;
  $("status").textContent = "saving…";
  try {
    const res = await fetch(`/save/${currentSlug}`, { method: "POST", body: JSON.stringify(currentScoreSpec()) });
    $("status").textContent = res.ok ? "saved ✓" : `save failed (${res.status})`;
  } catch (err) { $("status").textContent = `save failed: ${err.message}`; }
});

async function initLibrary() {
  let idx;
  try {
    const res = await fetch("../docs/index.json", { cache: "no-store" });
    if (!res.ok) return;
    idx = await res.json();
  } catch { return; }   // file:// or no manifest → file-picker only
  const ul = $("library");
  let playingBtn = null;
  idx.forEach((e) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = `${e.artist} — ${e.title}  ·  ${e.root} ${e.mode} · ${Math.round(e.bpm || 0)} BPM · ${e.tracks} trk`;
    btn.addEventListener("click", async () => {
      try {
        const r = await fetch(`../docs/${e.slug}.json`, { cache: "no-store" });
        await loadSpecFromJson(await r.json(), `${e.artist} — ${e.title}`, e.slug);
        if (playingBtn) playingBtn.classList.remove("playing");
        btn.classList.add("playing"); playingBtn = btn;
      } catch (err) { $("warnings").textContent = `could not load ${e.slug}: ${err.message}`; }
    });
    li.append(btn); ul.append(li);
  });
  if (idx.length) $("library-section").style.display = "";
}
initLibrary();

$("play").addEventListener("click", async () => {
  await Tone.start();
  Tone.getContext().lookAhead = 0.2;
  Tone.Transport.start();
});
$("stop").addEventListener("click", () => { Tone.Transport.stop(); Tone.Transport.position = 0; });

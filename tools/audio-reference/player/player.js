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
                    "count", "spread", "octaves", "pitchDecay", "pan",
                    "modAttack", "modDecay", "modSustain", "delay"];
const NOISE_TYPES = ["", "white", "pink", "brown"];
const SHORT = { filterFrequency: "freq", filterQ: "Q", reverbSend: "rev", modulationIndex: "mod",
                oscillatorType: "osc", filterType: "filt", pitchDecay: "pdec", octaves: "oct" };

const $ = (id) => document.getElementById(id);
const warnings = [];
let built = null;        // { rows } — per-track nodes for the CURRENT track; rebuilt every switch
let bus = null;          // { masterGain, eq, comp, limiter, reverb } — built ONCE, reused across switches
let busPromise = null;   // dedupes concurrent first-build ensureBus() calls
let currentSlug = null;  // set when loaded from the library; enables Save
let currentSpec = null;  // {root, mode, bpm} of the loaded track
// Two pools, separate caps. Sustained/melodic synths are the costly DSP (tight cap); percussion is
// cheap one-shots and a drum score needs several (kick+snare+hats+…), so it gets its own headroom.
const PERCUSSION_TYPES = new Set(["MembraneSynth", "MetalSynth", "NoiseSynth"]);
const TRACK_CAPS = { melodic: 4, perc: 6 };
// "Chiptune" simplification: the analyses lean on fat oscillators (count 3–8 detuned voices per
// note) — the biggest per-note DSP cost. Clamp the voice count toward a single oscillator for a
// leaner, more chip-like sound and far less load. 1 = pure chiptune; 2 keeps a hair of width.
const MAX_OSC_VOICES = 3;
const MIX_TARGET = 0.8;   // target combined level; per-track gain = MIX_TARGET/sqrt(active) for headroom
const poolOf = (row) => (PERCUSSION_TYPES.has(row.type) ? "perc" : "melodic");
let activateSeq = 0;     // monotonic enable counter; oldest-enabled in a pool is evicted past its cap
let baseMeta = "";       // meta line text without the live active-count suffix

// Disposing a synth while one of its one-shot sources still has a pending `onended` cleanup
// throws a benign InvalidAccessError (it disconnects from an already-disposed node), asynchronously.
// We dispose synchronously on a track switch (so graphs never overlap and pile up CPU), which can
// trigger that race — swallow only that specific error so it doesn't spam the console.
window.addEventListener("error", (e) => {
  const name = e.error && e.error.name;
  if (name === "InvalidAccessError" || /InvalidAccessError/.test(e.message || "")) e.preventDefault();
});

// ---- pure-ish helpers ----------------------------------------------------------------

// Flat option scalars -> nested Tone constructor options. Only set what's provided.
function expandOptions(o = {}) {
  const out = {};
  if (o.oscillatorType || o.count != null || o.spread != null) {
    out.oscillator = {};
    if (o.oscillatorType) out.oscillator.type = o.oscillatorType;
    if (o.count != null) out.oscillator.count = Math.min(o.count, MAX_OSC_VOICES);   // chiptune clamp
    if (o.spread != null) out.oscillator.spread = o.spread;
  }
  if (o.noiseType) out.noise = { type: o.noiseType };   // NoiseSynth color: white(hiss)/pink/brown(dark)
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
  // MembraneSynth pitch-sweep shape: octaves = how far the pitch chirps down on each hit (low =
  // straight thump, less "thwip"); pitchDecay = how fast that sweep happens.
  if (o.octaves != null) out.octaves = o.octaves;
  if (o.pitchDecay != null) out.pitchDecay = o.pitchDecay;
  // FM modulation envelope (shapes the brightness/tine over time). Tone's default has a slow
  // attack, so the FM "swells in" -> a reverse-y "mwoop"; a fast modAttack strikes bright = "dunng".
  if (o.modAttack != null || o.modDecay != null || o.modSustain != null) {
    out.modulationEnvelope = {};
    if (o.modAttack != null) out.modulationEnvelope.attack = o.modAttack;
    if (o.modDecay != null) out.modulationEnvelope.decay = o.modDecay;
    if (o.modSustain != null) out.modulationEnvelope.sustain = o.modSustain;
  }
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

const MAX_POLYPHONY = 16;   // per-PolySynth voice ceiling (Tone default 32) — bounds runaway voice
                            // stacking without dropping notes in normal use (8 was too low: dense
                            // chord/pad tracks with long release tails exceeded it -> "note dropped")

function makeSynth(type, opts) {
  const options = expandOptions(effectiveOpts(type, opts));
  try {
    if (type === "PolySynth") {
      const ps = new Tone.PolySynth(Tone.Synth);
      ps.maxPolyphony = MAX_POLYPHONY;   // default 32 is absurd for a many-track preview mix; long
      if (Object.keys(options).length) ps.set(options);   // release tails stack voices without it
      return ps;
    }
    return new Tone[type](options);
  } catch (e) {
    warnings.push(`options rejected for ${type}; using defaults (${e.message})`);
    if (type === "PolySynth") { const ps = new Tone.PolySynth(Tone.Synth); ps.maxPolyphony = MAX_POLYPHONY; return ps; }
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

// Release voices now, dispose a single track's nodes after its tail settles. Used for the
// in-place tweaker rebuild and the recycler (one synth — no stacking risk), NOT for whole-graph
// teardown. delayMs should cover the synth's release tail so the swap is click-free.
function retire(synths, nodes, delayMs = 400) {
  synths.forEach((s) => { try { s.releaseAll?.(); s.triggerRelease?.(); } catch { /* ok */ } });
  setTimeout(() => { synths.forEach(safeDispose); nodes.forEach(safeDispose); }, delayMs);
}

function disposeBuilt() {
  if (!built) return;
  const old = built;
  built = null;
  // Dispose only the per-track nodes immediately so only one track graph is ever live. The master
  // bus + reverb are PERSISTENT (see ensureBus) and deliberately NOT torn down here: rebuilding a
  // convolver-with-rendered-IR on every switch was the accumulating leak — the browser reclaims
  // those heavyweight audio-thread objects lazily, so churning them piled up into worsening crackle.
  // Disposing each sendGain disconnects it from the reverb, so the reverb's input count returns to
  // baseline every switch (no dangling connections accumulate). A pending one-shot onended may throw
  // a benign InvalidAccessError — swallowed by the window handler at the top of this file.
  old.rows.forEach((r) => {
    if (r.skipped) return;
    safeDispose(r.seq);
    try { r.voice.synth.releaseAll?.(); r.voice.synth.triggerRelease?.(); } catch { /* ok */ }
    safeDispose(r.voice.synth);
    r.inserts.forEach(safeDispose);
    safeDispose(r.gain);
    safeDispose(r.sendGain);
  });
}

// Build the master bus + reverb ONCE and keep them for the life of the page. The reverb's impulse
// response (rendered via an OfflineAudioContext) and the EQ/comp/limiter are identical for every
// track, so there's no reason to rebuild — and rebuilding the convolver per switch was the leak.
function ensureBus() {
  if (busPromise) return busPromise;
  busPromise = (async () => {
    const masterGain = new Tone.Gain(0.9);
    const eq = new Tone.EQ3({ low: 2, mid: -1, high: 0 });
    const comp = new Tone.Compressor({ threshold: -18, ratio: 2.5, attack: 0.025, release: 0.18 });
    const limiter = new Tone.Limiter(-1);
    masterGain.connect(eq); eq.connect(comp); comp.connect(limiter); limiter.toDestination();
    const reverb = new Tone.Reverb({ decay: 4.5, wet: 1 });   // long cathedral tail
    await reverb.generate();
    reverb.connect(masterGain);
    bus = { masterGain, eq, comp, limiter, reverb };
    return bus;
  })();
  return busPromise;
}

// Build a track's instrument + inserts and wire synth -> [drive] -> [chorus] -> gain.
// Returns { synth, inserts }. (gain, sendGain are stable across rebuilds.)
// A PolySynth allocates (and later GCs) a voice PER NOTE; several firing at once stutters the main
// thread. Like the game engine, render a PolySynth track as a cheap mono Synth UNLESS its pattern
// actually contains chords ("+"-joined tokens). renderType is what we build + trigger; row.type
// stays as authored (UI + Save). Recomputed here so a live synth-type change re-evaluates it.
const hasChords = (notes) => (notes || []).some((tok) => typeof tok === "string" && tok.includes("+"));
function effectiveType(row) {
  return (row.type === "PolySynth" && !hasChords(row.notes)) ? "Synth" : row.type;
}

function buildInstrument(row) {
  const o = row.opts;
  row.renderType = effectiveType(row);
  const inserts = [];
  if (o.drive > 0) inserts.push(new Tone.Distortion(Math.min(1, o.drive)));
  if (o.chorus > 0) inserts.push(new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: Math.min(1, o.chorus) }).start());
  if (o.pan != null) inserts.push(new Tone.Panner(Math.max(-1, Math.min(1, o.pan))));   // static L/R position (-1..1)
  if (o.delay > 0) inserts.push(new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.35, wet: Math.min(1, o.delay) }));   // rhythmic echo
  const chain = [...inserts, row.gain];
  for (let i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
  const synth = makeSynth(row.renderType, o);
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
  // Let the old synth ring out its release tail before disposal so the swap is click-free.
  const tailMs = Math.round((Math.min(Number(row.opts.release) || 0.5, 4) + 0.3) * 1000);
  retire([oldSynth], oldInserts, Math.max(400, tailMs));
}

// Param-timeline recycler. Web Audio never prunes past AudioParam automation, so a sequenced
// synth's frequency timeline grows unbounded as it plays (measured ~4 events/sec → audio-thread
// cost that compounds into worsening crackle within a minute or two). The cure (as in the game's
// own engine) is recreating the synth: rebuildTrack swaps in a fresh one with an empty timeline
// and rings the old out. We do it on a slow rotation — each audible, playing track is pruned
// ~every RECYCLE_AGE_S — capping swaps per tick so overlaps never bunch up.
const RECYCLE_CHECK_S = 4;        // recycler tick interval (seconds)
const RECYCLE_AGE_S = 25;         // recycle a playing track this long after its last recycle
const MAX_RECYCLE_PER_TICK = 2;   // stagger swaps across ticks
let recycleTimer = null;

function recycleTick() {
  if (!built || Tone.Transport.state !== "started") return;
  const now = Tone.now();
  let done = 0;
  for (const row of built.rows) {
    if (done >= MAX_RECYCLE_PER_TICK) break;
    if (row.skipped || row.audible === false || !row.dirty) continue;
    if (row.lastRecycle == null) { row.lastRecycle = now; continue; }  // start this row's clock
    if (now - row.lastRecycle < RECYCLE_AGE_S) continue;
    rebuildTrack(row);            // fresh synth → frequency timeline reset to ~0
    row.dirty = false;
    row.lastRecycle = now;
    done++;
  }
}

function startRecycler() {
  if (recycleTimer == null) recycleTimer = setInterval(recycleTick, RECYCLE_CHECK_S * 1000);
}

let buildGen = 0;   // bumped per build; a build superseded during its async generate() bails

async function build(spec) {
  const gen = ++buildGen;
  disposeBuilt();
  warnings.length = 0;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = spec.bpm || 120;

  const { masterGain, reverb } = await ensureBus();   // built once, reused; awaited only on first build
  // If another build started while we awaited the (first-build) IR render, abandon this one and bail
  // WITHOUT setting `built`, so its graph can't be orphaned. The bus is persistent, so nothing to tear
  // down here — no per-track nodes exist yet at this point.
  if (gen !== buildGen) return null;

  const rows = [];
  const poolCounts = { melodic: 0, perc: 0 };   // fill each pool to its cap by default; rest start muted
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
    const pool = PERCUSSION_TYPES.has(type) ? "perc" : "melodic";
    const active = poolCounts[pool] < TRACK_CAPS[pool];
    if (active) poolCounts[pool]++;
    const row = {
      t, type, opts: { ...(t.synth.options || {}) }, gain, sendGain,
      voice: { synth: null }, inserts: [], muted: !active, skipped: false,
      _activatedSeq: active ? ++activateSeq : 0,
      grid: t.steps?.grid || "8n", notes: t.steps?.notes || [],
    };
    const inst = buildInstrument(row);
    row.voice.synth = inst.synth; row.inserts = inst.inserts;
    let last = -1;
    row.seq = new Tone.Sequence((time, tok) => {
      if (row.audible === false) return;   // muted/un-soloed — skip trigger so the track costs ~nothing
      if (time <= last) return;        // skip non-increasing times (scheduler/loop collisions)
      last = time;
      if (tok) row.dirty = true;       // played a real note → its param timeline grows → recycler eligible
      triggerStep(row.voice.synth, row.renderType, tok, row.grid, time);
    }, row.notes, row.grid).start(0);
    rows.push(row);
  });

  built = { rows };
  return rows;
}

// ---- mute / solo ----------------------------------------------------------------------

function applyMuteSolo() {
  if (!built) return;
  const anySolo = built.rows.some((r) => r.solo);
  const isAudible = (r) => !r.skipped && (anySolo ? r.solo : !r.muted);
  // Equal-power level: scale each audible track by 1/sqrt(N) so the summed mix stays ~constant as
  // tracks are added, instead of piling up and slamming the limiter into distortion ("clipping when
  // complex"). N audible tracks each at MIX_TARGET/sqrt(N) → combined level ≈ MIX_TARGET.
  const n = Math.max(1, built.rows.filter(isAudible).length);
  const level = MIX_TARGET / Math.sqrt(n);
  built.rows.forEach((r) => {
    if (r.skipped) return;
    const audible = isAudible(r);
    r.audible = audible;   // the sequence callback reads this and SKIPS triggering when false, so a
                           // muted/un-soloed track stops allocating voices + scheduling automation
                           // (costs ~nothing) instead of computing silently. Gain ramp still fades
                           // any currently-ringing voices.
    r.gain.gain.rampTo(audible ? level : 0, 0.05);
  });
}

// ---- active-track cap -----------------------------------------------------------------
// Many sustained synths through one ConvolverNode reverb overruns the audio render thread
// (crackle that worsens with density). Keep every track loaded + tweakable, but only ever PLAY up
// to each pool's TRACK_CAPS; the gate makes the rest cost ~0. Enabling one past a pool's cap evicts
// the oldest-enabled in that pool (FIFO), so you only ever hear that-size combination at once.
function activeRows() { return built ? built.rows.filter((r) => !r.skipped && !r.muted) : []; }

function enforceCap() {
  for (const pool of ["melodic", "perc"]) {
    let active = activeRows().filter((r) => poolOf(r) === pool);
    if (active.length <= TRACK_CAPS[pool]) continue;
    active.sort((a, b) => (a._activatedSeq || 0) - (b._activatedSeq || 0));   // oldest enabled first
    while (active.length > TRACK_CAPS[pool]) active.shift().muted = true;     // evict oldest in this pool
  }
}

function syncTrackCheckboxes() {
  if (!built) return;
  built.rows.forEach((r) => { if (r._muteCb) r._muteCb.checked = !!r.muted; });
}

function updateActiveHint() {
  if (!built) { $("meta").textContent = baseMeta; return; }
  const a = activeRows();
  const mel = a.filter((r) => poolOf(r) === "melodic").length;
  const per = a.filter((r) => poolOf(r) === "perc").length;
  $("meta").textContent = baseMeta + `  ·  ▶ ${mel} synth (max ${TRACK_CAPS.melodic}) + ${per} perc (max ${TRACK_CAPS.perc}) playing`;
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

// Keep clicks on header controls from toggling the parent <details>.
const noToggle = (el) => { el.addEventListener("click", (e) => e.stopPropagation()); return el; };

function renderTracks() {
  const host = $("tracks"); host.innerHTML = "";
  if (!built) return;
  built.rows.forEach((row) => {
    if (row.skipped) {
      const card = document.createElement("div");
      card.className = "track skipped";
      card.textContent = `${row.t.name ?? ""}  (unsupported: ${row.type ?? "—"})`;
      host.append(card);
      return;
    }

    // Each track is a collapsed <details>; the header row is the <summary> (click to expand).
    const card = document.createElement("details");
    card.className = "track";                 // closed by default — no `open` attribute
    const head = document.createElement("summary"); head.className = "track-head";
    const name = document.createElement("span"); name.className = "track-name"; name.textContent = row.t.name ?? "";
    head.append(name);
    // A monophonic PolySynth track is rendered as a mono Synth (no chords) — show that so the
    // "PolySynth" dropdown value isn't misleading. Badge refreshes when the type/render changes.
    const modeBadge = document.createElement("span"); modeBadge.className = "ctl"; modeBadge.style.opacity = ".55";
    const refreshBadge = () => { modeBadge.textContent = (row.renderType && row.renderType !== row.type) ? `→ ${row.renderType} (mono)` : ""; };
    head.append(noToggle(selectCtl("synth", PALETTE, row.type, (v) => { row.type = v; rebuildTrack(row); refreshBadge(); })));
    refreshBadge();
    head.append(noToggle(modeBadge));
    // label text -> state field. The mute box must write `row.muted` (what applyMuteSolo reads);
    // a prior `row[k]` wrote `row.mute`, which nothing read, so mute silently did nothing.
    [["mute", "muted"], ["solo", "solo"]].forEach(([label, key]) => {
      const l = document.createElement("label"); l.className = "ctl";
      const cb = document.createElement("input"); cb.type = "checkbox";
      cb.checked = !!row[key];                 // reflect default state (tracks past the cap start muted)
      if (key === "muted") row._muteCb = cb;   // ref so cap-eviction can re-check the box
      cb.addEventListener("change", () => {
        row[key] = cb.checked;
        if (key === "muted" && !cb.checked) row._activatedSeq = ++activateSeq;   // newly enabled → newest
        if (key === "muted") enforceCap();      // may evict the oldest-enabled track
        applyMuteSolo(); syncTrackCheckboxes(); updateActiveHint();
      });
      l.append(cb, label); head.append(noToggle(l));
    });
    card.append(head);

    const ctls = document.createElement("div"); ctls.className = "ctls";
    const setOpt = (field, raw) => {
      if (raw === "" || raw == null) delete row.opts[field];
      else row.opts[field] = ["oscillatorType", "filterType", "noiseType"].includes(field) ? raw : Number(raw);
      rebuildTrack(row);
    };
    ctls.append(selectCtl(SHORT.oscillatorType, OSC_TYPES, row.opts.oscillatorType, (v) => setOpt("oscillatorType", v)));
    ctls.append(selectCtl(SHORT.filterType, FILTER_TYPES, row.opts.filterType, (v) => setOpt("filterType", v)));
    ctls.append(selectCtl("noise", NOISE_TYPES, row.opts.noiseType, (v) => setOpt("noiseType", v)));
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
  if ((await build(spec)) === null) return;   // superseded by a newer load — leave the UI to it
  renderTracks();
  applyMuteSolo();   // set audible/gain from the default active set (each pool filled to its cap)
  const head = label ? `${label} · ` : "";
  baseMeta = `${head}${spec.root ?? "?"} ${spec.mode ?? ""} · ${Math.round(spec.bpm ?? 0)} BPM · ${(spec.tracks || []).length} tracks`;
  updateActiveHint();
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

// Auto-pause when the window/tab loses focus. Browsers throttle background-tab timers, which
// starves Tone's main-thread scheduler → glitches. Rather than fight that, pause cleanly and
// resume on return. pause() preserves Transport position so playback continues where it left off.
let userWantsPlay = false;   // intent: did the user hit Play (and not Stop)?
let autoPaused = false;      // we paused due to lost focus (vs. the user stopping)
let windowFocused = document.hasFocus();   // tracked via focus/blur events (not polled)

function syncPlayback() {
  if (!userWantsPlay) return;
  const activeNow = windowFocused && !document.hidden;
  if (activeNow && autoPaused) {
    Tone.getContext().resume();           // context may have been suspended while hidden
    Tone.Transport.start(); autoPaused = false; $("status").textContent = "";
  } else if (!activeNow && !autoPaused && Tone.Transport.state === "started") {
    Tone.Transport.pause(); autoPaused = true; $("status").textContent = "⏸ paused — window not focused";
  }
}
window.addEventListener("blur", () => { windowFocused = false; syncPlayback(); });
window.addEventListener("focus", () => { windowFocused = true; syncPlayback(); });
document.addEventListener("visibilitychange", syncPlayback);   // tab hidden/minimized

$("play").addEventListener("click", async () => {
  await Tone.start();
  Tone.getContext().lookAhead = 0.2;   // modest runway; the persistent bus removed the build jank this compensated for
  userWantsPlay = true; autoPaused = false;
  Tone.Transport.start();
  startRecycler();                      // prune accumulating synth param timelines during sustained play
});
$("stop").addEventListener("click", () => {
  userWantsPlay = false; autoPaused = false;
  Tone.Transport.stop(); Tone.Transport.position = 0;
});

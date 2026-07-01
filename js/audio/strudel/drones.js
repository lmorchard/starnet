// @ts-nocheck
// Sustained action drones, raw Web Audio. superdough is a one-shot trigger engine and can't do
// live mid-voice param sweeps, so action drones are built directly against the shared
// AudioContext (getAudioContext()) — a faithful port of the Tone drone engine (js/audio/sfx/
// engine.js startDrone). Chain: source(s) → filter → ampGain (progress / amp-LFO) → fadeGain
// (click-free in/out) → destination. setProgress(p) reshapes cutoff/detune/gain (no-op if loop).

const NOTE_INDEX = { c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4, f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9, "a#": 10, bb: 10, b: 11 };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Convert a note name ("A2", "c#3") to a frequency in Hz (A4 = 440). */
export function noteToFreq(note) {
  const m = String(note).trim().toLowerCase().match(/^([a-g][#b]?)(-?\d+)$/);
  if (!m) return 110;
  const semis = NOTE_INDEX[m[1]] ?? 0;
  const octave = parseInt(m[2], 10);
  const midi = (octave + 1) * 12 + semis;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Interpolate a {from,to} range by progress (clamped), or pass a plain number through. */
export function droneRange(v, p) {
  if (v && typeof v === "object") return v.from + (v.to - v.from) * clamp01(p);
  return v;
}

const dbToGain = (db) => Math.pow(10, db / 20);

/** Build a looping noise buffer (white or brown). */
function makeNoiseBuffer(ctx, type) {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (type === "brown") {
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  } else {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Smoothly ramp an AudioParam toward a target over `dur` seconds from now. */
function rampParam(param, target, ctx, dur = 0.12) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(target, now + dur);
}

/**
 * Start a sustained drone voice. Returns { setProgress(p), stop() }.
 * @param {AudioContext} ctx
 * @param {object} spec  a DRONES entry
 */
export function createDroneVoice(ctx, spec) {
  if (!spec) return { setProgress() {}, stop() {} };
  const t = ctx.currentTime;
  const fade = spec.fade ?? 0.15;
  const level = dbToGain(spec.volume ?? -18);
  const freq = noteToFreq(spec.note ?? "C2");

  const sources = [];   // nodes to start()/stop()
  const extra = [];     // helper nodes to disconnect on teardown
  let detuneParam = null;

  if (spec.source === "noise") {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(ctx, spec.type || "brown");
    src.loop = true;
    sources.push(src);
  } else if (spec.source === "fm") {
    const carrier = ctx.createOscillator();
    carrier.type = spec.osc || "sine";
    carrier.frequency.value = freq;
    carrier.detune.value = droneRange(spec.detune, 0) || 0;
    const modFreq = freq * (spec.harmonicity ?? 2);
    const mod = ctx.createOscillator();
    mod.type = "sine";
    mod.frequency.value = modFreq;
    const modGain = ctx.createGain();
    modGain.gain.value = modFreq * (spec.modIndex ?? 8); // peak deviation = index * modFreq
    mod.connect(modGain);
    modGain.connect(carrier.frequency);
    detuneParam = carrier.detune;
    sources.push(carrier, mod);
    extra.push(modGain);
  } else if (spec.source === "dual") {
    const osc1 = ctx.createOscillator(); osc1.type = spec.osc || "sawtooth"; osc1.frequency.value = freq;
    const osc2 = ctx.createOscillator(); osc2.type = spec.osc || "sawtooth"; osc2.frequency.value = freq;
    osc2.detune.value = droneRange(spec.detune, 0) || 0;
    detuneParam = osc2.detune;
    sources.push(osc1, osc2);
  } else {
    const s = ctx.createOscillator(); s.type = spec.source || "sawtooth"; s.frequency.value = freq;
    s.detune.value = droneRange(spec.detune, 0) || 0;
    detuneParam = s.detune;
    sources.push(s);
  }

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = droneRange(spec.cutoff, 0) || 1200;
  filter.Q.value = spec.q ?? 2;

  const ampGain = ctx.createGain();
  ampGain.gain.value = droneRange(spec.gain, 0) ?? 1;
  const fadeGain = ctx.createGain();
  fadeGain.gain.value = 0;

  // The FM carrier (sources[0]) feeds the filter; the modulator feeds carrier.frequency (not the
  // filter). Non-FM sources all feed the filter.
  for (const s of (spec.source === "fm" ? [sources[0]] : sources)) s.connect(filter);
  filter.connect(ampGain);
  ampGain.connect(fadeGain);
  fadeGain.connect(ctx.destination);

  // Optional LFO (amp tremolo, cutoff wobble). Web Audio param connections ADD to the param's
  // intrinsic value, so we seat the offset on the param and connect the scaled LFO osc.
  let lfoOsc = null;
  let lfoStart = t;
  if (spec.lfo) {
    const { rate = 4, depth = 0.5, target = "amp" } = spec.lfo;
    lfoOsc = ctx.createOscillator();
    lfoOsc.type = "sine";
    lfoOsc.frequency.value = rate;
    const lfoGain = ctx.createGain();
    if (target === "amp") {
      const min = Math.max(0, 1 - depth);
      ampGain.gain.value = (min + 1) / 2;       // mean
      lfoGain.gain.value = (1 - min) / 2;        // amplitude
      lfoOsc.connect(lfoGain); lfoGain.connect(ampGain.gain);
      lfoStart = t + fade;                        // delay tremolo until fade completes (no onset spike)
    } else {
      const base = droneRange(spec.cutoff, 0) || 1200;
      filter.frequency.value = (base * (1 - depth) + base) / 2;
      lfoGain.gain.value = (base - base * (1 - depth)) / 2;
      lfoOsc.connect(lfoGain); lfoGain.connect(filter.frequency);
    }
    extra.push(lfoGain);
  }

  for (const s of sources) { try { s.start(t); } catch (_) {} }
  if (lfoOsc) { try { lfoOsc.start(lfoStart); } catch (_) {} }
  fadeGain.gain.setValueAtTime(0, t);
  fadeGain.gain.linearRampToValueAtTime(level, t + fade);

  let stopped = false;
  return {
    setProgress(p) {
      if (stopped || spec.loop) return;
      if (spec.cutoff && typeof spec.cutoff === "object") rampParam(filter.frequency, droneRange(spec.cutoff, p), ctx);
      if (spec.detune && typeof spec.detune === "object" && detuneParam) rampParam(detuneParam, droneRange(spec.detune, p), ctx);
      // Progress gain only when no amp-LFO owns ampGain.gain.
      if (spec.gain && typeof spec.gain === "object" && !(spec.lfo && (spec.lfo.target ?? "amp") === "amp")) {
        rampParam(ampGain.gain, droneRange(spec.gain, p), ctx);
      }
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const tt = ctx.currentTime;
      fadeGain.gain.cancelScheduledValues(tt);
      fadeGain.gain.setValueAtTime(fadeGain.gain.value, tt);
      fadeGain.gain.linearRampToValueAtTime(0, tt + fade);
      setTimeout(() => {
        for (const s of [...sources, lfoOsc]) { try { s?.stop?.(); } catch (_) {} }
        for (const n of [...sources, ...extra, filter, ampGain, fadeGain, lfoOsc]) { try { n?.disconnect?.(); } catch (_) {} }
      }, (fade + 0.1) * 1000);
    },
  };
}

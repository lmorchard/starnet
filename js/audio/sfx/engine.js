// @ts-nocheck
// SFX engine — the only Web Audio boundary for sound effects. Interprets cue specs
// (sfx/defs.js) into synthesized one-shots, and drone specs (sfx/drones.js) into sustained
// "action in progress" voices. One-shot voices are disposed after they finish; drones are held
// until stop() and disposed after their fade-out — so SFX add no long-lived AudioParam
// accumulation. Cues schedule at currentTime + a small offset (NOT Tone.now()) so they aren't
// delayed by the music engine's lookahead.
import * as Tone from "tone";

const MAX_VOICES = 12;
const OFFSET = 0.02;

// dB → linear gain. Levels are applied with plain Gain nodes, never Tone's `.volume` (a dB-mapped
// signal whose ~100-200ms realtime startup transient made short cues play full-blast then settle).
const dbToGain = (db) => Math.pow(10, db / 20);

export function createSfx() {
  let enabled = true;
  let master = null, reverb = null;
  let voices = 0;

  function build() {
    if (master) return;
    master = new Tone.Gain(0.9).toDestination();
    // Reverb is opt-in per cue (spec.reverb) — most cold telemetry cues run dry. The node passes
    // a dry+wet blend, so opted-in cues keep their direct attack plus a tail.
    reverb = new Tone.Reverb({ decay: 1.4, wet: 0.3 }).connect(master);
  }

  // Where a voice connects: dry to master by default, or through the shared reverb if requested.
  function outFor(spec) { return spec.reverb ? reverb : master; }

  // Dispose the voice's node(s) after lifeSec; keep the live one-shot count bounded.
  function track(nodes, lifeSec) {
    voices++;
    const arr = Array.isArray(nodes) ? nodes : [nodes];
    setTimeout(() => {
      for (const n of arr) { try { n.dispose?.(); } catch { /* already gone */ } }
      voices = Math.max(0, voices - 1);
    }, lifeSec * 1000);
  }

  function play(spec) {
    if (!enabled || !spec) return;
    build();
    if (voices >= MAX_VOICES) return;
    const t = Tone.getContext().currentTime + OFFSET;
    const dest = outFor(spec);
    // Level via a linear gain (not synth.volume — see dbToGain note). Short one-shots otherwise
    // played near full-blast, ignoring their volume spec.
    const lvl = new Tone.Gain(dbToGain(spec.volume ?? -14)).connect(dest);

    switch (spec.kind) {
      case "blip": {
        const decay = spec.decay ?? 0.12;
        const s = new Tone.Synth({
          oscillator: { type: spec.osc || "triangle", detune: spec.detune ?? 0 },
          envelope: { attack: 0.001, decay, sustain: 0, release: 0.05 },
        }).connect(lvl);
        s.triggerAttackRelease(spec.note, decay, t);
        track([s, lvl], decay + 0.2);
        break;
      }
      case "sweep": {
        const dur = spec.dur ?? 0.18;
        const s = new Tone.Synth({
          oscillator: { type: spec.osc || "sawtooth", detune: spec.detune ?? 0 },
          envelope: { attack: 0.005, decay: dur, sustain: 0.2, release: 0.08 },
        }).connect(lvl);
        s.triggerAttack(spec.from, t);
        s.frequency.rampTo(spec.to, dur, t);
        s.triggerRelease(t + dur);
        track([s, lvl], dur + 0.3);
        break;
      }
      case "chord": {
        const decay = spec.decay ?? 0.35;
        const strum = spec.strum ?? 0;
        const notes = spec.notes || [];
        const hits = Math.max(1, spec.hits ?? 1);   // strike the chord N times (motif)
        const hitGap = spec.hitGap ?? 0.09;
        const s = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: spec.osc || "triangle", detune: spec.detune ?? 0 },
          envelope: { attack: 0.005, decay, sustain: 0, release: 0.1 },
        }).connect(lvl);
        for (let h = 0; h < hits; h++) {
          const ht = t + h * hitGap;
          notes.forEach((n, i) => s.triggerAttackRelease(n, decay, ht + i * strum));
        }
        track([s, lvl], (hits - 1) * hitGap + decay + notes.length * strum + 0.3);
        break;
      }
      case "noise": {
        const dur = spec.dur ?? 0.15;
        const n = new Tone.NoiseSynth({
          noise: { type: spec.type || "white" },
          envelope: { attack: 0.001, decay: dur, sustain: 0, release: 0.05 },
        });
        const f = new Tone.Filter({ frequency: spec.cutoff ?? 4000, type: spec.hp ? "highpass" : "lowpass" }).connect(lvl);
        n.connect(f);
        n.triggerAttackRelease(dur, t);
        track([n, f, lvl], dur + 0.2);
        break;
      }
      case "fm": {
        const decay = spec.decay ?? 0.2;
        const s = new Tone.FMSynth({
          harmonicity: spec.harmonicity ?? 3,
          modulationIndex: spec.modIndex ?? 12,
          detune: spec.detune ?? 0,
          envelope: { attack: 0.001, decay, sustain: 0, release: 0.08 },
        }).connect(lvl);
        s.triggerAttackRelease(spec.note, decay, t);
        track([s, lvl], decay + 0.3);
        break;
      }
      default: lvl.dispose(); break;
    }
  }

  // ── Sustained "action in progress" drones ───────────────────────────────────
  // Build a held voice from a drone spec and return a small handle. The chain is:
  //   source → filter → ampGain (progress / amp-LFO) → fadeGain (click-free in/out) → out
  // setProgress(p) re-shapes cutoff / detune / gain toward their `to` value (no-op if `loop`).
  // stop() fades out and disposes everything.
  const lerp = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));
  const range = (v, p) => (v && typeof v === "object" ? lerp(v.from, v.to, p) : v);

  function startDrone(spec) {
    if (!enabled || !spec) return { setProgress() {}, stop() {} };
    build();
    const t = Tone.getContext().currentTime + OFFSET;
    const fade = spec.fade ?? 0.15;
    const dest = outFor(spec);
    // Level is applied as a LINEAR gain on the fade stage — NOT via source.volume. Tone's
    // `.volume` is a dB-mapped signal that starts at 0 dB and only settles to the target after
    // ~100-200ms in realtime, so a held source played full-blast then dropped — an onset volume
    // spike on every drone. A plain gain has no such startup transient. (Offline pre-resolves the
    // volume signal, which is why this never surfaced in offline analysis.)
    const level = dbToGain(spec.volume ?? -18);

    // Source node(s). `detuneParam` is the AudioParam that setProgress ramps for a detune sweep
    // (null for noise, which has no detune). "dual" sums two oscillators a beat apart — the second
    // oscillator's detune sweeps so the beat can slow to zero (lock-on).
    const sources = [];
    let detuneParam = null;
    if (spec.source === "noise") {
      sources.push(new Tone.Noise({ type: spec.type || "brown" }));
    } else if (spec.source === "fm") {
      const s = new Tone.FMOscillator({
        frequency: spec.note ?? "C2", type: spec.osc || "sine",
        harmonicity: spec.harmonicity ?? 2, modulationIndex: spec.modIndex ?? 8,
        detune: range(spec.detune, 0) || 0,
      });
      detuneParam = s.detune;
      sources.push(s);
    } else if (spec.source === "dual") {
      const osc1 = new Tone.Oscillator({ frequency: spec.note ?? "C2", type: spec.osc || "sawtooth" });
      const osc2 = new Tone.Oscillator({ frequency: spec.note ?? "C2", type: spec.osc || "sawtooth", detune: range(spec.detune, 0) || 0 });
      detuneParam = osc2.detune;
      sources.push(osc1, osc2);
    } else {
      const s = new Tone.Oscillator({ frequency: spec.note ?? "C2", type: spec.source || "sawtooth", detune: range(spec.detune, 0) || 0 });
      detuneParam = s.detune;
      sources.push(s);
    }

    const filter = new Tone.Filter({
      frequency: range(spec.cutoff, 0) || 1200,
      type: "lowpass",
      Q: spec.q ?? 2,
    });
    const ampGain = new Tone.Gain(range(spec.gain, 0) ?? 1);
    const fadeGain = new Tone.Gain(0);
    for (const s of sources) s.connect(filter);
    filter.connect(ampGain);
    ampGain.connect(fadeGain);
    fadeGain.connect(dest);

    // Optional LFO on amplitude or cutoff (scanning pulse, reboot pulse, lie-low tick).
    let lfo = null;
    let lfoStart = t;
    if (spec.lfo) {
      const { rate = 4, depth = 0.5, target = "amp" } = spec.lfo;
      if (target === "amp") {
        const min = Math.max(0, 1 - depth);
        // Seat the body at the LFO's mean and DELAY the tremolo until the fade completes. Starting
        // the LFO at t would let its first peak coincide with the fade reaching unity — an audible
        // onset volume spike. Fading to the mean first, then modulating, removes that spike.
        ampGain.gain.value = (min + 1) / 2;
        lfo = new Tone.LFO({ frequency: rate, min, max: 1 });
        lfo.connect(ampGain.gain);
        lfoStart = t + fade;
      } else {
        const base = range(spec.cutoff, 0) || 1200;
        lfo = new Tone.LFO({ frequency: rate, min: base * (1 - depth), max: base });
        lfo.connect(filter.frequency);
      }
    }

    for (const s of sources) s.start(t);
    lfo?.start(lfoStart);
    fadeGain.gain.rampTo(level, fade, t);

    let stopped = false;
    return {
      setProgress(p) {
        if (stopped || spec.loop) return;
        const tt = Tone.getContext().currentTime;
        if (spec.cutoff && typeof spec.cutoff === "object") filter.frequency.rampTo(range(spec.cutoff, p), 0.12, tt);
        if (spec.detune && typeof spec.detune === "object" && detuneParam) detuneParam.rampTo(range(spec.detune, p), 0.12, tt);
        // Progress-driven gain only when no amp-LFO owns that param.
        if (spec.gain && typeof spec.gain === "object" && !(spec.lfo && (spec.lfo.target ?? "amp") === "amp")) {
          ampGain.gain.rampTo(range(spec.gain, p), 0.12, tt);
        }
      },
      stop() {
        if (stopped) return;
        stopped = true;
        const tt = Tone.getContext().currentTime;
        fadeGain.gain.rampTo(0, fade, tt);
        setTimeout(() => {
          for (const n of [lfo, ...sources, filter, ampGain, fadeGain]) { try { n?.dispose?.(); } catch { /* gone */ } }
        }, (fade + 0.1) * 1000);
      },
    };
  }

  return {
    /** Resume the AudioContext (needs a user gesture) without playing anything. */
    async unlock() { await Tone.start(); },
    setEnabled(on) { enabled = !!on; },
    isEnabled() { return enabled; },
    play,
    startDrone,
    /** Exposed for future routing (e.g. vocal one-shots); null until the first play()/startDrone() builds the bus (unlock() alone does not). */
    getMasterInput() { return reverb; },
  };
}

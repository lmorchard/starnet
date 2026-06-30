// @ts-nocheck
// Score-DATA interpreter → a reactive Strudel pattern. The score is plain data (see
// data/corporate.js); this module turns it into a live `stack()` whose params are driven by the
// game's progress/threat signals via signal() (re-sampled each cycle — no re-eval on update).
//
// Layer param convention:
//   number   → constant  (.gain(0.3), .lpf(800), .room(0.6), .fast(2))
//   [lo,hi]  → axis-driven via signal().range(lo,hi); the layer's `axis` selects which signal
//              ("progress" or "threat"; anything else uses the progress signal as a neutral base)
//   addNote  → .add(note(axisSignal.range(lo,hi)))  (semitone transposition that climbs with the axis)

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Build a Strudel program (a stacked, tempo-set pattern) from score DATA.
 * `ctx` supplies the strudel builders + the two reactive signals (injected for testability).
 * @param {object} score  { bpm, layers: [{ sound, note, axis, gain?, lpf?, hpf?, room?, fast?, addNote? }] }
 * @param {{ note:Function, stack:Function, progressSignal:object, threatSignal:object }} ctx
 */
export function buildProgram(score, ctx) {
  const { note, stack, progressSignal, threatSignal } = ctx;
  const layers = score.layers.map((L) => {
    const sig = L.axis === "threat" ? threatSignal : progressSignal;
    const ranged = (v) => (Array.isArray(v) ? sig.range(v[0], v[1]) : v);
    let p = note(L.note);
    if (L.sound != null) p = p.s(L.sound);
    if (L.addNote != null) p = p.add(note(ranged(L.addNote)));
    if (L.fast != null) p = p.fast(ranged(L.fast));
    if (L.gain != null) p = p.gain(ranged(L.gain));
    if (L.lpf != null) p = p.lpf(ranged(L.lpf));
    if (L.hpf != null) p = p.hpf(ranged(L.hpf));
    if (L.room != null) p = p.room(ranged(L.room));
    return p;
  });
  return stack(...layers).cpm(score.bpm / 4); // 1 cycle = 1 bar (4/4)
}

/**
 * Create a music controller bound to the live runtime. Holds the current progress/threat values;
 * the signals re-sample them every cycle, so set* needs no re-eval.
 * @param {object} rt  the runtime handle from bootStrudel() (note/stack/signal/hush)
 */
export function createMusic(rt) {
  let gProgress = 0;
  let gThreat = 0;
  let started = false;
  const progressSignal = rt.signal(() => gProgress);
  const threatSignal = rt.signal(() => gThreat);

  return {
    start(score) {
      const program = buildProgram(score, { note: rt.note, stack: rt.stack, progressSignal, threatSignal });
      rt.hush();
      program.play();
      started = true;
    },
    stop() { if (typeof rt.hush === "function") rt.hush(); started = false; },
    setProgress(p) { gProgress = clamp01(p); },
    setThreat(t) { gThreat = clamp01(t); },
    isStarted() { return started; },
  };
}

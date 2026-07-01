// @ts-check
// Sustained "action in progress" drone DATA — one per timed action, played for the action's
// duration and reshaped by progress 0→1 (see drones.js, the raw-Web-Audio voice). Keyed by the
// ACTION_FEEDBACK `action` string. `loop:true` ignores progress (reboot — a system state, not a
// player sweep). Ported from the Tone drone specs (js/audio/sfx/drones.js); same character.
//
// Spec shape (interpreted in drones.js): {
//   source: "sawtooth"|"sine"|"square"|"triangle"|"noise"|"fm"|"dual",
//   note, osc?, harmonicity?/modIndex? (fm), type? (noise),
//   detune?: cents | {from,to},  cutoff?: Hz | {from,to},  gain?: 0..1 | {from,to},  q?,
//   lfo?: { rate, depth, target:"amp"|"cutoff" },  fade?, volume? (dB), loop?
// }
// {from,to} values sweep with progress; amp-LFO and progress-gain are mutually exclusive.

export const DRONES = {
  // probe — radar sweep: thin scanning pulse, filter brightens as the ring fills.
  probe:    { source: "sawtooth", note: "A2", cutoff: { from: 300, to: 1500 }, q: 3,
              lfo: { rate: 3, depth: 0.3, target: "amp" }, volume: -23, fade: 0.16 },
  // xploit — converging brackets: grinding low FM that tightens (filter opens, detune resolves).
  xploit:   { source: "fm", note: "C2", osc: "square", harmonicity: 1.5, modIndex: 12,
              cutoff: { from: 450, to: 1700 }, detune: { from: -25, to: 8 }, q: 4, volume: -18, fade: 0.08 },
  // dump — facets read in chunks: low data-churn with a fast amp gate.
  dump:     { source: "square", note: "D2", cutoff: { from: 380, to: 760 }, q: 2,
              lfo: { rate: 9, depth: 0.4, target: "amp" }, volume: -21, fade: 0.14 },
  // fetch — ripple rings draining: flowing filtered noise that thins (gain + cutoff fall).
  fetch:    { source: "noise", type: "brown", cutoff: { from: 1900, to: 550 }, gain: { from: 0.9, to: 0.15 },
              q: 1, volume: -19, fade: 0.12 },
  // mine — crosshair locking on: two detuned tones beating, the beat slowing to zero (lock-on).
  mine:     { source: "dual", note: "E2", osc: "sawtooth", detune: { from: 42, to: 0 }, cutoff: 600, q: 3,
              volume: -22, fade: 0.12 },
  // lie-low — clock fast-forward: hushed sub hum + soft tick.
  "lie-low":{ source: "sine", note: "A1", cutoff: 320, q: 1,
              lfo: { rate: 2.5, depth: 0.25, target: "amp" }, volume: -26, fade: 0.22 },
  // reboot — offline pulse: adversarial slow-pulsing sour drone, loops (no progress sweep).
  reboot:   { source: "sawtooth", note: "C2", detune: -25, cutoff: 520, q: 5,
              lfo: { rate: 0.5, depth: 0.5, target: "amp" }, volume: -19, fade: 0.35, loop: true },
};

export const DRONE_IDS = Object.freeze(Object.keys(DRONES));

/**
 * Map a timed-action id (the ACTION_FEEDBACK `action` field) to a drone id.
 * @param {string} [action]
 * @returns {string|null}
 */
export function resolveDrone(action) {
  return action && Object.prototype.hasOwnProperty.call(DRONES, action) ? action : null;
}

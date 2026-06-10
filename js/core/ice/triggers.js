// @ts-check
// Trigger atom definitions. Imported for side-effect registration.
//
// One trigger is live this session: on-dwell-grade (preserves pre-reinvention
// dwell-time gating per ICE grade). The rest are dormant stubs whose home
// session lands the implementation.

import { registerTrigger } from "./atoms.js";

// ── Live trigger ─────────────────────────────────────────

registerTrigger({
  id: "on-dwell-grade",
  schema: {},
  /**
   * Fires when the ICE has dwelled on its attention node long enough.
   * The dwell time is grade-keyed (preserves pre-reinvention tuning).
   *
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ hasDwellExpired: (instance: import('../types.js').IceInstance) => boolean }} ctx
   * @returns {boolean}
   */
  test(instance, state, ctx) {
    return ctx.hasDwellExpired(instance);
  },
});

// ── Dormant triggers ─────────────────────────────────────

const DORMANT = [
  { id: "on-select",                session: 2, schema: {} },
  { id: "on-probe",                 session: 2, schema: {} },
  { id: "on-exploit",               session: 2, schema: {} },
  { id: "on-exploit-fail",          session: 2, schema: {} },
  { id: "on-dump",                  session: 2, schema: {} },
  { id: "on-fetch",                 session: 2, schema: {} },
  { id: "on-dwell-N-ticks",         session: 2, schema: { ticks: "number" } },
  { id: "on-detect-presence",       session: 2, schema: {} },
];

for (const d of DORMANT) {
  registerTrigger({
    id: d.id,
    schema: d.schema,
    test() {
      throw new Error(`trigger atom '${d.id}' not yet implemented — wired in session ${d.session}`);
    },
  });
}

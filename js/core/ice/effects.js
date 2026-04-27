// @ts-check
// Effect atom definitions. Imported for side-effect registration.
//
// Three atoms are fully wired this session: raise-alert, damage-health,
// damage-deck. The rest are registered with id + schema + a throwing
// apply() so they can be referenced by name without yet being implemented.
// Each dormant atom names its home session, where the body lands.

import { registerEffect } from "./atoms.js";

// ── Live atoms ──────────────────────────────────────────

registerEffect({
  id: "raise-alert",
  schema: {},
  /**
   * Preserves pre-reinvention behavior: alert propagates from the ICE's
   * current attention node (where it would have detected the player).
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ propagateAlertEvent: (nodeId: string) => void }} ctx
   */
  apply(instance, state, ctx) {
    ctx.propagateAlertEvent(instance.attentionNodeId);
  },
});

registerEffect({
  id: "damage-health",
  schema: { amount: "number" },
  /**
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ damagePlayerHealth: (n: number) => void }} ctx
   * @param {{ amount: number }} params
   */
  apply(instance, state, ctx, params) {
    ctx.damagePlayerHealth(params.amount);
  },
});

registerEffect({
  id: "damage-deck",
  schema: { amount: "number" },
  /**
   * @param {import('../types.js').IceInstance} instance
   * @param {import('../types.js').GameState} state
   * @param {{ damagePlayerDeck: (n: number) => void }} ctx
   * @param {{ amount: number }} params
   */
  apply(instance, state, ctx, params) {
    ctx.damagePlayerDeck(params.amount);
  },
});

// ── Dormant atoms ───────────────────────────────────────
// Registered for discoverability; apply() throws. Each entry names
// its home session (see docs/dev-sessions/2026-04-24-1243-ice-reinvention/spec.md §10).

const DORMANT = [
  { id: "start-trace",                 session: 4, schema: {} },
  { id: "steal-cash",                  session: 3, schema: { amount: "number", stashSelector: "string" } },
  { id: "destroy-macguffin",           session: 4, schema: { selector: "string" } },
  { id: "relocate-macguffin",          session: 4, schema: { selector: "string", toSelector: "string" } },
  { id: "shred-card",                  session: 3, schema: { selector: "string" } },
  { id: "degrade-card",                session: 3, schema: { selector: "string", steps: "number" } },
  { id: "steal-card",                  session: 3, schema: { selector: "string", stashSelector: "string" } },
  { id: "lock-node",                   session: 4, schema: { target: "string" } },
  { id: "patch-vulns",                 session: 4, schema: { target: "string" } },
  { id: "force-reboot",                session: 4, schema: { target: "string" } },
  { id: "deselect-player",             session: 4, schema: {} },
  { id: "cancel-action",               session: 4, schema: { kind: "string?" } },
  { id: "accelerate",                  session: 5, schema: { factor: "number", duration: "number" } },
  { id: "broadcast-alert-adjacent",    session: 5, schema: { amount: "number" } },
];

for (const d of DORMANT) {
  registerEffect({
    id: d.id,
    schema: d.schema,
    apply() {
      throw new Error(`effect atom '${d.id}' not yet implemented — wired in session ${d.session}`);
    },
  });
}

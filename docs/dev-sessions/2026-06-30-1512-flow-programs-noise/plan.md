# Flow Programs + Noise Economy (Session 1) Implementation Plan

**Goal:** Ship `SNIFF` + `REPLAY` (credential replay) as a complete finesse-access loop, with a
third "program noise" alert sensor feeding the existing trace clock, on the `corporate-exchange`
demo.

**Approach:** Programs are a fixed always-available kit injected as node-contextual actions (not
node traits), aimed via a node-anchored flow picker mirroring the XPLOIT picker. Noise is a third
sensor (`recordProgramNoise`) accumulating `state.programNoise` and climbing the same
`green->yellow->red->trace` ladder. One hand-authored finesse-only node (`fw-1`) is brute-immune
and unlocked by replaying a sniffed credential. Old smash loop untouched.

**Tech stack:** Vanilla ES modules, JSDoc `@ts-check`, Lit components, node:test.

**Naming note:** the spec says "SPOOF", but `A.SPOOF` ("spoof") is already the security-monitor
recalibrate / a trap action (`action-ids.js:30`, `data/biomes/corporate-pieces/traps.js:43`). The
credential-replay program is therefore **`REPLAY`** (`A.REPLAY = "replay"`) — the design doc lists
"SPOOF/REPLAY" as synonyms. Player-facing label may read "REPLAY".

---

## Phase 1: Flow/player/noise data + noise sensor (foundation, no UI)

Extend the serializable data shapes and add the third alert sensor so the noise economy works
end-to-end at the state layer. No verbs/UI yet.

**Files:**
- Modify: `js/core/types.js` — extend `Flow`, `PlayerState`, `GameState` typedefs.
- Modify: `js/core/state/index.js` — init `capturedCredentials`/`programNoise`; heal on load.
- Create: `js/core/state/flow.js` — flow mutations (`setFlowRevealed`).
- Modify: `js/core/state/player.js` — `addCapturedCredential(key)`.
- Modify: `js/core/state.js` — re-export the new setters.
- Modify: `js/core/balance.js` — `PROGRAM_NOISE_THRESHOLD`, `PROGRAM_NOISE_COST`.
- Modify: `js/core/alert.js` — `recordProgramNoise(amount)`.
- Modify: `js/core/events.js` — `E.PROGRAM_NOISE`, `E.FLOW_SNIFFED`, `E.CREDENTIAL_CAPTURED`,
  `E.CREDENTIAL_REPLAYED`.
- Test: `tests/flow-programs.test.js` (new) — serialization + noise sensor.

**Key changes:**
- `Flow` gains `key?: string` (credential token) and `revealed?: boolean`.
- `PlayerState` gains `capturedCredentials: string[]`.
- `GameState` gains `programNoise: number`.
- Init (`state/index.js`, in the player block ~:168 and top-level ~:166):
  ```js
  player: { ..., capturedCredentials: [...(meta.startCredentials ?? [])] },
  // top-level, beside flows:
  programNoise: 0,
  ```
- Heal (`state/index.js` ~:388):
  ```js
  if (!ctx.state.flows) ctx.state.flows = [];
  if (!ctx.state.player.capturedCredentials) ctx.state.player.capturedCredentials = [];
  if (typeof ctx.state.programNoise !== "number") ctx.state.programNoise = 0;
  ```
- `state/flow.js` — defines the canonical flow-id helper (single source; Phase 2 imports it) +
  the reveal mutation:
  ```js
  import { mutate } from "./index.js";
  /** Stable per-run address for a flow. The ONE definition of the scheme. */
  export const flowId = (f) => `${f.from}>${f.to}#${f.type}`;
  /** Marks the flow with this id as revealed (decrypts its render). */
  export function setFlowRevealed(id) {
    mutate((s) => { const f = s.flows.find((fl) => flowId(fl) === id); if (f) f.revealed = true; });
  }
  ```
- `state/player.js` `addCapturedCredential(key)`:
  ```js
  export function addCapturedCredential(key) {
    mutate((s) => { if (key && !s.player.capturedCredentials.includes(key)) s.player.capturedCredentials.push(key); });
  }
  ```
- `balance.js` (placeholder values, feel-tuned in Phase 5):
  ```js
  // Program noise: each program play adds heat; crossing thresholds steps the shared alert
  // ladder; the trace threshold starts the same trace clock. Tuned by feel (Phase 5).
  export const PROGRAM_NOISE_COST = { sniff: 1, replay: 3 };
  // Cumulative noise at which the ladder reaches yellow / red / trace.
  export const PROGRAM_NOISE_THRESHOLD = { yellow: 2, red: 4, trace: 6 };
  ```
- `alert.js` `recordProgramNoise(amount)` — mirrors `recordMonitorAlert` (`alert.js:138-160`):
  ```js
  import { PROGRAM_NOISE_THRESHOLD } from "./balance.js";
  import { addProgramNoise } from "./state/index.js"; // mutate-wrapped, added here or in state
  /**
   * Third alert sensor: program plays add heat that climbs the SAME ladder + trace clock.
   * @param {number} amount
   */
  export function recordProgramNoise(amount) {
    const total = addProgramNoise(amount); // returns new state.programNoise
    emitEvent(E.PROGRAM_NOISE, { amount, total });
    const t = PROGRAM_NOISE_THRESHOLD;
    if (total >= t.trace) { if (getState().traceSecondsRemaining === null) startTraceCountdown(); return; }
    // Step the ladder to the highest level the accumulated noise has crossed (capped below trace).
    const target = total >= t.red ? "red" : total >= t.yellow ? "yellow" : "green";
    const order = ["green","yellow","red","trace"];
    const cur = getState().globalAlert;
    if (order.indexOf(target) > order.indexOf(cur)) {
      setGlobalAlert(target); emitEvent(E.ALERT_GLOBAL_RAISED, { prev: cur, next: target });
    }
  }
  ```
  (`addProgramNoise` is a small `mutate`-wrapped setter returning the new total; add to
  `state/index.js` or `state/game.js` and re-export.)

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] New test: `Flow.key`/`revealed`, `capturedCredentials`, `programNoise` survive
      serialize -> deserialize unchanged; a pre-field save heals to defaults.
- [ ] New test: `recordProgramNoise` steps green->yellow->red by accumulated total and starts the
      trace exactly at the `trace` threshold (assert `traceSecondsRemaining !== null`).
- [ ] `make check` passes

**Verification — manual:**
- [ ] None (no UI in this phase).

---

## Phase 2: SNIFF program (reveal + capture) — picker, console, playtest

Add the SNIFF verb end-to-end: a node-contextual program (injected, not a trait), a flow picker,
console + playtest commands, log events. Acts on the demo's existing flows.

**Files:**
- Modify: `js/core/action-ids.js` — `SNIFF: "sniff"`.
- Create: `js/core/programs.js` — pure program logic (`sniffFlow`).
- Create: `js/core/actions/program-actions.js` — SNIFF ActionDef + `getFlowChoices`/`getFlowEmptyReason` + injector.
- Modify: `js/ui/flow-glyphs.js` — export raw glyph geometry (`flowGlyphGeom(type) -> {color,pts,closed}`) so the picker can render a lit `<svg>` without a string-injection directive (`unsafeSVG` is NOT in the lit bundle). Keep the module lit-free/pure.
- Modify: `js/core/actions/node-actions.js` — inject program actions in `getAvailableActions`.
- Modify: `js/core/actions/action-context.js` — wire `ctx.sniffFlow`; thread followup payload to program `execute`.
- Modify: `js/ui/components/starnet-action-choices.js` — add `render: "flow-packet"` case (uses `flowSvg`).
- Modify: `js/core/console-commands/commands.js` — `sniff <node> [flowId|index]`.
- Modify: `scripts/playtest.js` — `sniff` command.
- Modify: `js/ui/log-renderer.js` — log `E.FLOW_SNIFFED` / `E.CREDENTIAL_CAPTURED` / `E.PROGRAM_NOISE`.
- Test: `tests/flow-programs.test.js` — SNIFF behavior + GUI/console parity.

**Key changes:**
- Flow id helper (shared): `flowId(f) => `${f.from}>${f.to}#${f.type}`` — export from `programs.js`.
- `programs.js`:
  ```js
  import { setFlowRevealed, flowId } from "./state/flow.js"; // flowId single-sourced in flow.js
  import { addCapturedCredential } from "./state/player.js";
  import { recordProgramNoise } from "./alert.js";
  import { PROGRAM_NOISE_COST } from "./balance.js";
  import { emitEvent, E } from "./events.js";
  /** Find flows incident to nodeId. */
  export const incidentFlows = (state, nodeId) => state.flows.filter((f) => f.from === nodeId || f.to === nodeId);
  /** SNIFF a flow: reveal its render; capture a credential token if it carries one. */
  export function sniffFlow(state, nodeId, id) {
    const f = state.flows.find((fl) => flowId(fl) === id);
    if (!f) return;
    setFlowRevealed(id);
    emitEvent(E.FLOW_SNIFFED, { nodeId, flowId: id, type: f.type });
    if (f.type === "credential" && f.key) {
      addCapturedCredential(f.key);
      emitEvent(E.CREDENTIAL_CAPTURED, { nodeId, key: f.key });
    }
    recordProgramNoise(PROGRAM_NOISE_COST.sniff);
  }
  ```
- `program-actions.js`:
  ```js
  import { A } from "../action-ids.js";
  import { incidentFlows, flowId } from "../programs.js";
  // No glyph import here: getFlowChoices builds plain choice DATA (core stays UI-free);
  // the picker component renders the glyph from flow-glyphs geometry (see flow-packet below).
  export function getFlowChoices(node, state) {
    return incidentFlows(state, node.id).map((f) => ({
      id: flowId(f), payloadKey: "flowId", render: "flow-packet",
      data: { type: f.type, encrypted: f.encrypted && !f.revealed, revealed: f.revealed, dir: f.from === node.id ? "out" : "in" },
    }));
  }
  export const getFlowEmptyReason = () => "No flows on this node.";
  /** @type {import('../types.js').ActionDef} */
  export const SNIFF_ACTION = {
    id: A.SNIFF, label: "SNIFF",
    desc: "Read a data flow on this node; capture a credential if it carries one.",
    hasFollowup: true,
    followup: { title: (n) => `SNIFF ${n.id}`, choices: getFlowChoices, empty: getFlowEmptyReason },
    execute: (node, state, ctx, payload) => ctx.sniffFlow(node.id, payload.flowId),
  };
  /** Programs available on this node, given player kit + flow/credential context. */
  export function getProgramActions(node, state) {
    const out = [];
    if (node.visibility === "accessible" && incidentFlows(state, node.id).length > 0) out.push(SNIFF_ACTION);
    return out; // REPLAY added in Phase 3
  }
  ```
- `node-actions.js` `getAvailableActions` — after building `wrapped`, before EXEC grouping:
  ```js
  import { getProgramActions } from "./program-actions.js";
  const programs = getProgramActions(node, state);
  const result = [...global, ...wrapped, ...programs];
  ```
  (Programs are scripts by `isScriptAction` since their ids aren't in `CORE_NODE_VERBS`, so they
  group under EXEC automatically — acceptable for S1; revisit surfacing in S3.)
- `action-context.js` — add `sniffFlow` to the ctx object and ensure followup payload reaches
  `execute`. The dispatcher already calls `action.execute(node, state, ctx, { nodeId, ...payload })`
  for actions carrying an `execute` fn (global actions); program actions define `execute`, so
  `payload.flowId` threads through with no special-casing (unlike XPLOIT, which is timed and
  bypasses). Wire:
  ```js
  import { sniffFlow } from "../programs.js";
  // in the ctx object:
  sniffFlow: (nodeId, id) => sniffFlow(getState(), nodeId, id),
  ```
- `starnet-action-choices.js` `_renderChoice` — new case. Render the glyph with lit's `svg`
  template from exported geometry (NOT `unsafeSVG` — it isn't bundled). Add `import { svg } from "lit"`
  and `import { flowGlyphGeom, ENCRYPTED_COLOR } from "../flow-glyphs.js"`:
  ```js
  if (choice.render === "flow-packet") {
    const d = choice.data;
    const g = flowGlyphGeom(d.type);
    const pts = g.pts.map(([x, y]) => `${x + 6},${y + 6}`).join(" ");
    const stroke = d.encrypted ? ENCRYPTED_COLOR : g.color;
    const shape = d.encrypted
      ? svg`<text x="6" y="9" font-size="9" text-anchor="middle" fill=${stroke}>?</text>`
      : g.closed
        ? svg`<polygon points=${pts} fill="none" stroke=${stroke} stroke-width="0.7"/>`
        : svg`<polyline points=${pts} fill="none" stroke=${stroke} stroke-width="0.7"/>`;
    return html`<button class="ctx-item flow-choice" @click=${() => this._pick(choice)}>
      <svg viewBox="0 0 12 12" class="flow-glyph" width="14" height="14">${shape}</svg>
      ${d.encrypted ? "ENCRYPTED" : d.type.toUpperCase()} ${d.dir === "in" ? "←" : "→"}
    </button>`;
  }
  ```
  (Geometry is single-sourced in `flow-glyphs.js`; the component only draws it. Stroke-only +
  glow via the existing HUD `--glow-*` tokens — no fills, per the vector-UI rule.)
- `commands.js` `sniff`: resolve node (targeted or arg), list incident flows if no flow arg,
  else dispatch `starnet:action {actionId:"sniff", nodeId, flowId}`. Mirror existing `xploit`
  command resolution.
- `playtest.js`: add `sniff` to the inline dispatch; `sniff <node> <flowId|index>` -> dispatch.

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] New test: SNIFF the encrypted `switch-2>fw-1#credential` flow -> that flow's `revealed===true`,
      `player.capturedCredentials` contains its key, `programNoise` increased by `PROGRAM_NOISE_COST.sniff`.
- [ ] New test: SNIFF a non-credential flow -> `revealed===true`, no credential captured, noise added.
- [ ] New test (GUI/console parity): dispatching `{actionId:"sniff", nodeId, flowId}` and the
      console `sniff` path produce identical `state.flows`/`capturedCredentials`.
- [ ] `make check` passes

**Verification — manual:**
- [ ] `make serve` + `?network=corporate-exchange`: reveal switch-2/fw-1, SNIFF picker lists the
      incident flows with correct glyphs; sniffing the encrypted credential flow reveals it and
      logs a capture entry.

---

## Phase 3: Finesse node + REPLAY program (loop closes)

Make `fw-1` brute-immune and unlockable only by replaying the captured credential.

**Files:**
- Modify: `js/core/action-ids.js` — `REPLAY: "replay"`.
- Modify: `js/core/node-graph/traits.js` — register `finesse-access` trait.
- Modify: `js/core/node-graph/action-templates.js` — add `not finesseLocked` to `EXPLOIT_ACTION.requires`.
- Modify: `js/core/programs.js` — `replayCredential(state, nodeId)`.
- Modify: `js/core/actions/program-actions.js` — `REPLAY_ACTION` + inject when finesse + holds key.
- Modify: `js/core/actions/action-context.js` — wire `ctx.replayCredential`.
- Modify: `js/core/node-graph/node-factories.js` — `createFirewall` accepts a `finesse` option that adds the trait + attrs.
- Modify: `data/networks/corporate-exchange.js` — make `fw-1` finesse-only; give the `switch-2>fw-1` credential flow a `key`.
- Modify: `js/core/console-commands/commands.js` + `scripts/playtest.js` — `replay <node>`.
- Test: `tests/flow-programs.test.js` — finesse gating + full loop.

**Key changes:**
- `traits.js`:
  ```js
  registerTrait("finesse-access", {
    attributes: { finesseLocked: true, trustsCredential: null },
    operators: [],
    actions: [], // REPLAY is injected as a program, not a trait action
  });
  ```
- `action-templates.js` `EXPLOIT_ACTION.requires` — append:
  ```js
  { type: "not", condition: { type: "node-attr", attr: "finesseLocked", eq: true } },
  ```
  (Harmless on every non-finesse node — `finesseLocked` is undefined there, reads as not-true.)
- `programs.js` — REPLAY must replicate the **access-gain side-effects** that
  `applyCombatResult` performs (`combat.js:250-277`), or fw-1 goes "owned" without revealing the
  vault beyond it. Reuse the same node-state setters combat imports
  (`setNodeAccessLevel`, `setNodeAlertState`, `setNodeVisible`, `setNodeProbed`, `revealNeighbors`):
  ```js
  import { setNodeAccessLevel, setNodeAlertState, setNodeVisible, setNodeProbed } from "./state/node.js";
  import { revealNeighbors } from "./state.js"; // exported from state/index.js:276; combat.js imports it the same way
  export function replayCredential(state, nodeId) {
    const node = state.nodes[nodeId];
    const key = node?.trustsCredential;
    if (!key || !state.player.capturedCredentials.includes(key)) return;
    if (node.accessLevel === "owned") return;
    const prev = node.accessLevel;
    setNodeAccessLevel(nodeId, "owned");
    setNodeAlertState(nodeId, "green");
    setNodeVisible(nodeId, "accessible");
    setNodeProbed(nodeId);
    revealNeighbors(nodeId);            // owned reveals what the firewall gated
    emitEvent(E.CREDENTIAL_REPLAYED, { nodeId, key });
    emitEvent(E.NODE_ACCESSED, { nodeId, label: node.label, prev, next: "owned" });
    recordProgramNoise(PROGRAM_NOISE_COST.replay);
  }
  ```
  (During execute, confirm `revealNeighbors`/`setNodeVisible` import paths against `combat.js`'s
  import block; if combat sources `revealNeighbors` elsewhere, match that source. Consider
  extracting a shared `grantOwnedAccess(nodeId)` helper if duplication feels fragile — but keep it
  minimal: this is the only second caller.)
- `program-actions.js`:
  ```js
  export const REPLAY_ACTION = {
    id: A.REPLAY, label: "REPLAY",
    desc: "Replay a captured credential to gain trusted access.",
    execute: (node, state, ctx) => ctx.replayCredential(node.id),
  };
  // in getProgramActions, after SNIFF:
  const key = node.trustsCredential;
  if (node.finesseLocked && key && state.player.capturedCredentials.includes(key)
      && node.accessLevel !== "owned") out.push(REPLAY_ACTION);
  ```
  (Mirrors the KICK global-state filter in `node-actions.js:37-40`: availability that the graph's
  `requires` can't express — here, player-held credentials — is filtered at the action-query layer.)
- `node-factories.js` `createFirewall(id, config)` — when `config.finesse` is set:
  ```js
  const traits = ["graded", "hackable", "rebootable", "gate"];
  if (config.finesse) traits.push("finesse-access");
  // ...and set attributes.trustsCredential = config.finesse.key, finesseLocked stays true.
  ```
- `corporate-exchange.js`:
  ```js
  const fw = createFirewall("fw-1", { grade: "A", finesse: { key: "fw-root-key" } });
  // and in meta.flows, the credential flow gains the matching key:
  { from: "switch-2", to: "fw-1", type: "credential", rate: 0.25, encrypted: true, key: "fw-root-key" },
  ```
- `commands.js`/`playtest.js`: `replay <node>` -> dispatch `starnet:action {actionId:"replay", nodeId}`.

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] New test: on a `finesseLocked` node, `getAvailableActions` does NOT include `xploit`.
- [ ] New test: REPLAY is absent until the matching credential is captured; present after.
- [ ] New test (full loop): SNIFF `switch-2>fw-1#credential` -> capture `fw-root-key` -> REPLAY on
      `fw-1` -> `fw-1.accessLevel === "owned"`; assert `programNoise` == sniff+replay cost.
- [ ] New test: REPLAY without the credential is a no-op (access unchanged, no noise).
- [ ] `make check` passes

**Verification — manual:**
- [ ] `?network=corporate-exchange`: probe `fw-1` shows it offers no XPLOIT and states the
      credential requirement; after sniff+replay it becomes owned and the vault beyond reveals.

---

## Phase 4: HUD numeric noise readout

Surface accumulated program noise as a numeric readout beside the alert.

**Files:**
- Modify: `js/ui/visual-renderer.js` — feed `programNoise` to the HUD component.
- Modify: `js/ui/components/starnet-hud.js` — render `NOISE: N` beside the alert (`:88-99` region).
- Modify: `css/style.css` — minimal style for the noise readout (reuse `--glow-*` tokens; stroke/text only, no fill).
- Test: HUD prop wiring (light) — assert the renderer passes `programNoise`.

**Key changes:**
- `visual-renderer.js`: where it sets HUD props from state, add `hud.programNoise = state.programNoise`.
- `starnet-hud.js`: add a `programNoise: Number` property and render (only when `phase==="playing"`):
  ```js
  html`<span id="noise-readout" class="noise">NOISE: ${this.programNoise ?? 0}</span>`
  ```
  Placed beside `#alert-level`. Text + glow only (vector-UI rule: no fills/lamps).

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] `make check` passes

**Verification — manual:**
- [ ] `?network=corporate-exchange`: NOISE reads 0 at start, increments on each SNIFF/REPLAY, and
      the alert lamp climbs as noise crosses thresholds (and reaches TRACE if pushed past `trace`).

---

## Phase 5: Preview demo, docs, census, feel-tuning checkpoint

Add the new visual states to the preview harness, update the manual + bot docs, confirm no
balance regression, and feel-tune the noise numbers WITH Les (not autonomously).

**Files:**
- Modify: `js/ui/preview.js` / `preview.html` — add: a revealed/sniffed flow state toggle, a
  captured-credential indicator, and a finesse-node marker, in the existing "Flow Substrate" panel.
- Modify: `MANUAL.md` — new "Flow Programs" section (SNIFF/REPLAY), "Finesse access" under access
  levels, the noise sensor under "The Alert System", node-actions reference + console commands rows.
- Modify: `docs/BOT-PLAYER.md` — "What the bot does NOT do": flow programs (SNIFF/REPLAY); census
  validates no-regression of the existing loop only.
- Modify: `js/ui/console.js` (if needed) — register `sniff`/`replay` tab-completion alongside other verbs.

**Key changes:**
- Preview: reuse `flowSvg(type, { encrypted })` for the sniffed-vs-encrypted A/B; a small stroked
  hexagon "credential captured" indicator; a stroked marker badge on the finesse node demo.
- MANUAL.md: describe noise as the third sensor feeding the same trace clock; document that quiet
  solutions are the skill; document the fixed kit (no loadout yet).

**Verification — automated:**
- [ ] `make lint` passes
- [ ] `make test` passes
- [ ] `make check` passes
- [ ] `make census SEEDS=10` then a same-seed run on `origin/main`: `successRate`/`traceFiredRate`
      unchanged within noise (bot doesn't use programs, so the existing loop must be unaffected).

**Verification — manual:**
- [ ] Preview harness shows the sniffed/encrypted flow A/B, the captured-credential indicator, and
      the finesse-node marker; all stroke-only/glow (vector-UI rule).
- [ ] MANUAL.md re-read: programs, finesse access, noise sensor, console commands all match behavior.
- [ ] **Feel-tuning checkpoint with Les:** play the loop on `?network=corporate-exchange`; tune
      `PROGRAM_NOISE_COST` / `PROGRAM_NOISE_THRESHOLD` in `balance.js` by feel so the intended quiet
      solution stays below trace and loud over-use reaches it. (Numbers are NOT locked autonomously.)

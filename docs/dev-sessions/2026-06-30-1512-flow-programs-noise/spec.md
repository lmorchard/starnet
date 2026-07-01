# Flow Programs + Noise Economy (Flow Subversion Session 1) Spec

**Goal:** Turn the declarative flow substrate (Session 0) into gameplay: ship the first
two flow-acting programs — `SNIFF` and `SPOOF` — as a complete **finesse-access loop**,
with a **noise-feeds-the-trace** economy, so a player can own a node that can't be brute-forced
by capturing a credential off a flow and replaying it.

**Source:** User request 2026-06-30 (brainstorm with Les). North star: `docs/design/flow-subversion.md`
(roadmap row "Session 1"). Builds on Session 0 (`docs/dev-sessions/2026-06-29-1211-flow-substrate/`).

## Current state

See `research.md` for `file:line` detail. Load-bearing facts:

- **Flows are declarative, serializable state** (`Flow` typedef `js/core/types.js:308-319`;
  init `js/core/state/index.js:166`; heal `:388-389`). No program acts on them yet.
  `corporate-exchange` already authors an **encrypted credential flow** `switch-2 -> fw-1`
  (`data/networks/corporate-exchange.js:126`).
- **Actions are declarative ActionDefs** on node traits, dispatched via `starnet:action`
  (`action-context.js:61-91`). `exec` scripts (corrupt/scrub-logs/lie-low) are the model for
  new node verbs; timed actions follow the `LIE_LOW_OPERATOR` pattern
  (`action-templates.js:298-305`). Multi-step actions use `followup` (XPLOIT picker,
  `action-templates.js:101-105`) rendered by `starnet-context-menu.js:52-66`.
- **Alert is two sensors, one ladder** (`js/core/alert.js`): `recordMonitorAlert` and
  `recordIceDetection` each accumulate a count, step `green->yellow->red->trace`, and start the
  shared trace clock at a grade-scaled threshold (`balance.js:62-71`). HUD renders the ladder +
  `TRACE: Ns` (`starnet-hud.js:88-99`).
- **Player state** = `{cash, hand, health, deckIntegrity}` (`types.js:145-152`), mutated via
  `mutate()` setters in `state/player.js`.
- **Three engine entry points** share dispatch: `js/ui/main.js`, `scripts/playtest.js`,
  `scripts/bot/`.

## Desired end state

A player on the `corporate-exchange` demo (`?network=corporate-exchange`) can:

1. Reveal `switch-2` and `fw-1` so the encrypted `switch-2 -> fw-1` credential flow renders.
2. `SNIFF` that flow: it **reveals** (decrypts the render) and **captures the credential** into
   the player's kit. A small amount of noise is added.
3. Probe `fw-1` (or read its panel): it is **finesse-only** — XPLOIT is not offered; the panel
   states it **trusts credential `<key>`**.
4. `SPOOF` the captured credential into `fw-1` -> `fw-1` becomes **owned** (gaining the vault
   beyond it through the existing smash/loot loop). More noise than SNIFF.
5. The accumulated **program noise** climbs the existing alert ladder; enough loud play on its
   own reaches TRACE. A **numeric NOISE readout** sits beside the alert in the HUD.

`SNIFF`/`SPOOF` are usable from a **fixed always-available kit** (no acquisition economy this
session), via GUI (node-anchored flow picker) and console (`sniff`/`spoof`), with identical
outcomes and log entries. Everything survives a serialize -> deserialize round-trip.

### Data shape

- `Flow` gains: `key?: string` (credential token a `credential` flow carries) and
  `revealed?: boolean` (set true once SNIFFed; persists/serializes). Encrypted flows start
  concealed; SNIFF flips `revealed`.
- `PlayerState` gains: `capturedCredentials: string[]` (serializable; healed on load).
- Global noise: `state.programNoise: number` (serializable; healed on load), plus the new
  third sensor.
- Finesse node: a `finesse-access` trait/attrs — `finesseLocked: true` (suppresses XPLOIT) and
  `trustsCredential: <key>`; probe surfaces the requirement; SPOOF action appears when the
  player holds a matching captured credential.

## Design decisions

- **Decision:** Spine = the **SNIFF + SPOOF finesse-access loop**; defer TAP/SPLICE entirely
  to Session 2.
  - **Why:** finesse-access is complete and testable using the *existing* node-access scoring;
    it needs neither skim payout (S2) nor the loadout/store (S3). TAP/SPLICE on a money flow
    bank nothing until scoring exists — shipping them inert would violate the project's "no dead
    mechanics / every visual event logged / test-honesty" rules.
  - **Rejected:** all-four-programs-shallow (two would be hollow); read-only-only (no acting
    verb to demonstrate the combo).
- **Decision:** Programs come from a **fixed, always-available kit**; no RAM/loadout/store yet.
  - **Why:** lets us tune the verbs in isolation and cleanly defers the acquisition economy to
    Session 3. - **Rejected:** authored-per-network grant and mini-loadout — both pre-build S3
    surface we'd partly redo.
- **Decision:** Aim programs via a **node-anchored flow picker** mirroring the XPLOIT card picker.
  - **Why:** zero new graph-interaction plumbing (Session 0 shipped no edge-level interaction);
    keeps GUI/console symmetric. - **Rejected:** direct edge selection (new UI surface, risk);
    global program panel (new surface).
- **Decision:** Noise is a **third alert sensor** — `recordProgramNoise(amount)` in `alert.js`
  accumulating `state.programNoise`, crossing tunable thresholds (`balance.js`) to step the
  SAME `green->yellow->red->trace` ladder and start the SAME trace clock. Noise can reach trace
  on its own (a real stealth budget). Per-program noise cost in `balance.js` (SNIFF cheap, SPOOF
  dearer). - **Why:** the design doc demands noise feed the existing clock, not a parallel
  resource; this is architecturally identical to the two existing sensors and fully serializable.
  - **Rejected:** one-ladder-step-per-play (too coarse — traces a 2-3 step combo instantly);
    noise-caps-below-trace (weak stealth-budget pressure).
- **Decision:** Finesse appears only on **hand-authored finesse-only nodes** (here, `fw-1` in
  `corporate-exchange`, which already receives the credential flow). Brute-immunity is hard:
  XPLOIT is not offered. Every other node keeps the existing smash loop untouched.
  - **Why:** lowest blast radius; demonstrates the loop on authored content; honors "old loop
    stays fully playable." - **Rejected:** universal access-path on all nodes (touches all
    authoring + procgen now); finesse-as-better-odds (blurs the "can't smash this" clarity the
    combo depends on).
- **Decision:** A **numeric NOISE readout** beside the alert in the HUD now; a richer
  graph/vital-waveform treatment is a noted future hook, not built this session.
  - **Why:** Les wants noise legible immediately without committing to a waveform design yet.

## Patterns to follow

- **New verb (timed or immediate) as an ActionDef + ctx-call:** mirror `SCRUB_LOGS_ACTION` /
  `LIE_LOW_ACTION` + `LIE_LOW_OPERATOR` (`action-templates.js:258-305`); register in
  `ACTION_TEMPLATES` (`:309-324`); add ids to `js/core/action-ids.js`. Decide SNIFF/SPOOF
  immediate vs timed during planning (default: immediate, like CORRUPT/SCRUB).
- **Followup flow picker:** mirror `EXPLOIT_ACTION.followup` (`action-templates.js:101-105`) +
  `starnet-context-menu.js:52-66`. `choices` = flows incident to the node; selecting one
  re-dispatches `starnet:action` with `{flowId|flowKey, nodeId}`.
- **Third alert sensor:** mirror `recordMonitorAlert` (`js/core/alert.js:138-160`) exactly —
  accumulate, step ladder capped below trace, start trace at threshold. Emit a typed event
  (e.g. `E.PROGRAM_NOISE` / reuse `ALERT_GLOBAL_RAISED`) so the log + HUD update.
- **New serializable player field:** typedef (`types.js:145-152`) + init
  (`state/index.js:168-178`) + `mutate()` setter (`state/player.js`) + heal-on-load
  (`state/index.js:388-389` neighborhood) + re-export shim.
- **Finesse trait:** register via `registerTrait` (`traits.js:38-51`); gate XPLOIT off with a
  `requires` condition on `finesseLocked` (or by omitting the exploit trait on that node — pick
  the smaller change in planning).
- **Preview demo:** add the revealed/sniffed flow state, captured-credential indicator, and
  finesse-node marker to `js/ui/preview.js` / `preview.html` (project Design Principle).
- **Three entry points:** add `sniff`/`spoof` to `scripts/playtest.js` inline dispatch; document
  the bot's non-use in `docs/BOT-PLAYER.md`.

## What we're NOT doing

- **No TAP / SPLICE / REROUTE / THROTTLE / CUT / JAM / CORRUPT-flow / INJECT / DECRYPT-as-separate-verb.**
  (SNIFF subsumes reveal/decrypt.)
- **No skim / scoring / payout** of any kind (Session 2).
- **No RAM loadout UI, RAM capacity, or store reframe** (Session 3).
- **No procedural generation of finesse nodes or flows** — one hand-authored demo node only.
- **No credential expiry / rotation / multi-hop key chains** (later finesse-depth).
- **No ICE-damages-programs** threat axis (later).
- **No noise vital-waveform / graph** — numeric readout only this session.
- **No change to the existing smash/extraction loop, ICE, or the two existing alert sensors'
  numbers.** The bot does not learn programs (census confirms no-regression only).
- **No edge-selection UI** — flows are reached through the node-anchored picker.

## Open questions

- **SNIFF/SPOOF immediate vs timed action?** Default: **immediate** (like CORRUPT/SCRUB-LOGS) for
  S1 simplicity; revisit timing/feel later. Plan proceeds under "immediate". (If timed, follow the
  LIE_LOW operator pattern.)
- **How to address a flow in payload/console?** Default: flows get a stable per-run **id** derived
  at init (e.g. `from>to#type`); picker passes the id, console accepts `sniff <node> <id|index>`.
  Plan pins the exact scheme.
- **XPLOIT suppression mechanism on finesse nodes:** Default: add a `not finesseLocked` condition
  to `EXPLOIT_ACTION.requires` (one-line, global, harmless to non-finesse nodes). Plan confirms vs
  trait-omission.
- **Noise threshold values + per-program costs:** Default: author placeholder values in
  `balance.js` tuned so SNIFF+SPOOF+a probe stays below trace but a few loud plays reach it; these
  are **feel-tuned** with Les after the loop works (do NOT lock in autonomous execution).

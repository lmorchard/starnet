# ICE Reinvention — Vision Spec

**Status:** vision / multi-session roadmap
**Date:** 2026-04-24
**Related issues:** closes/supersedes #36, #40, #42; partially covers #49

---

## 1. Motivation

Today's ICE is a singleton. One entity per run, grade-tiered (F–S), with a single
effect: raise the global alert until the trace countdown fires. Counter-play is
three verbs (eject, reboot, disable-via-owning-resident). It has been useful as
a prototype but is too narrow to carry long-term gameplay interest.

The reinvented model makes ICE a first-class, data-driven, multi-instance system:

- Multiple concurrent ICE instances per LAN, each *installed* at a host node
- Two focus classes — **stationary** (trap) and **roaming** (patroller)
- A catalog of named types composed from **trigger atoms**, **behavior-pattern
  atoms**, and **effect atoms**
- Effects well beyond raise-alert: damage player HP / deck integrity, steal cash
  or cards into stash nodes the player must hunt down, sabotage owned nodes, etc.
- New player resources (health, deck integrity) as additional loss clocks
  alongside the existing trace
- A **hack / reprogram** layer — once the host is owned, ICE can be uninstalled,
  temporarily disabled, have its behavior pattern swapped, or its effects
  reprogrammed (e.g. redirect a Thief ICE to deposit into the player's wallet)

This spec is the multi-session **vision**. It decomposes into a sequence of
implementation sessions, each filed as its own issue.

---

## 2. Taxonomy and composition model

ICE becomes a first-class entity composed from named atoms. Each instance:

```
IceInstance {
  id                      // runtime id
  typeId                  // catalog entry, e.g. "thief-C", "trapwire-S", "defender-B"
  hostNodeId              // install node
  active, enabled         // lifecycle flags
  focus: "stationary" | "roaming"
  behaviorPattern         // name: "trap" | "patrol-random" | "patrol-route" |
                          // "disturbance-tracker" | "player-hunter" |
                          // "sentry-radius" | "relocate-on-activate" |
                          // "player-avoid" | "freeze" | ...
  triggers                // list of trigger atoms
  effects                 // list of effect atoms
  detectionConfig         // dwell time, per-instance alert ladder, etc.
  repeat                  // "one-shot" | { mode: "cooldown", ticks: N }
  revealed                // false until probed, dumped, or activated
  grade                   // retained for procgen + tuning, not dictating movement
}
```

**Three composition axes, all data:**

- **Focus** — stationary vs. roaming. Selects which runtime dispatcher handles
  ticks.
- **Triggers** — what makes the ICE act. Stationary ICE can bind any node action
  (`on-select`, `on-probe`, `on-exploit`, `on-exploit-fail`, `on-dump`,
  `on-fetch`, etc.). Roaming ICE adds movement-based triggers
  (`on-dwell-N-ticks`, `on-detect-player-presence`).
- **Effects** — what it does when it acts. Effects stack; a single ICE may
  `steal-cash` and `damage-deck` on the same activation.

**Behavior pattern** is its own atom type owning movement / scheduling logic.
`trap` is the stationary pattern; everything else is a roaming variant. Behavior
patterns can read instance config and mutate their own state (e.g.
`relocate-on-activate` moves the ICE after an effect fires).

**Why atoms rather than inheritance:** mirrors the existing
`js/core/node-graph/` trait system, so tooling, mental model, and tests carry
over. Hack verbs become literal atom-list mutations on the instance.

**Catalog** — named presets combining all axes, authored in a registry file.
Example:

```js
Thief-C = {
  focus:   "roaming",
  pattern: "disturbance-tracker",
  triggers: ["on-dwell-short"],
  effects: [
    { atom: "steal-cash",   params: { amount: 50, stashSelector: "stash-tagged" } },
    { atom: "damage-deck",  params: { amount: 5 } }
  ],
  repeat: { mode: "cooldown", ticks: 300 }
}
```

Procgen picks from the catalog weighted by LAN grade and host node type.

---

## 3. Effect atom catalog

Each effect is a single-purpose atom with a stable name, a parameter schema,
and a pure `apply(iceInstance, state, ctx)` function returning events. Catalog
is declarative so hack/reprogram can swap entries at runtime.

| Category | Atom id | Parameters | Effect |
|---|---|---|---|
| Trace | `raise-alert` | `{ amount }` | Preserves current behavior — reports through host's IDS chain |
| Trace | `start-trace` | — | Direct trace start, bypasses escalation |
| Resources | `damage-health` | `{ amount }` | Subtract from player HP |
| Resources | `damage-deck` | `{ amount }` | Subtract from deck HP |
| Cash | `steal-cash` | `{ amount, stashSelector }` | Remove cash, deposit to stash-tagged node |
| Loot | `destroy-macguffin` | `{ selector }` | Mark a macguffin destroyed |
| Loot | `relocate-macguffin` | `{ selector, toSelector }` | Move a macguffin between nodes |
| Hand | `shred-card` | `{ selector }` | Remove a card from hand |
| Hand | `degrade-card` | `{ selector, steps }` | `fresh → worn → disclosed` |
| Hand | `steal-card` | `{ selector, stashSelector }` | Remove card, deposit to stash |
| Sabotage | `lock-node` | `{ target }` | Revert access level — Defender ICE from #42 |
| Sabotage | `patch-vulns` | `{ target }` | Re-patch vulnerabilities |
| Sabotage | `force-reboot` | `{ target }` | Force target node into reboot |
| Positional | `deselect-player` | — | Forces untarget; breaks in-progress exploit |
| Positional | `cancel-action` | `{ kind? }` | Cancels in-flight probe/exploit/dump/fetch |
| Self-buff | `accelerate` | `{ factor, duration }` | Speeds own move interval |
| Self-buff | `broadcast-alert-adjacent` | `{ amount }` | Raises alert on adjacent nodes too |

### Selector grammar

Most effects need to pick *what* they act on. A small selector DSL covers ~90%
of cases:

`self-host`, `player-selected`, `random-owned`, `random-compromised`,
`random-revealed`, `adjacent-to-self`, `farthest-from-player`, `stash-tagged`.

Stash nodes are just nodes with a `stash: true` attribute — selectors resolve
against that.

### Session 1 scope

Every atom above exists as a named function with a unit test. Initial ICE types
in the catalog use only `raise-alert`, `damage-health`, `damage-deck`.
Everything else is dormant until a later session wires it into a concrete ICE
type.

---

## 4. Player resources and loss conditions

`PlayerState` gains two integer pools:

```js
PlayerState {
  cash,                  // existing
  hand,                  // existing
  health:    { current, max },      // NEW
  deckIntegrity: { current, max },  // NEW
}
```

**Starting values** — set in network meta alongside `startCash` / `startHand`:
`startHealth`, `startDeckIntegrity`. Default `100/100` each; tunable per LAN in
procgen.

**No mid-run healing or repair in MVP.** Damage is monotonic within a run;
jack-out resets both pools. Deliberate choice so attritional ICE creates
decision pressure rather than a treadmill.

**Unified loss conditions:**

| Clock | Trigger | Outcome |
|---|---|---|
| TRACE (existing) | Global / per-zone alert → trace timer expires | Run ends — `caught` |
| HEALTH | `health.current <= 0` | Run ends — new outcome `burned` |
| DECK INTEGRITY | `deckIntegrity.current <= 0` | Run ends — new outcome `bricked` |
| JACK OUT (existing) | Player action | Run ends — `success` / `escaped` |

Each loss reports its cause in the end screen.

**HUD** — two new readouts next to alert/trace. Bars (not numbers) for feel,
numeric tooltip on hover. Flash-damage feedback on drops.

**Deferred to backlog:**
- Textured health model (wounds / debuffs impairing specific actions)
- Deck-systems inventory with named subsystems (targeting, render,
  card-resolution, action-execution) and glitch effects — visual flicker,
  action segfaults, retries
- Mid-run healing via medical / augment systems
- Persistent cross-run consequences for `burned` / `bricked`

---

## 5. Discovery, counter-play, and visibility

**Discovery rules.** ICE installed on a node is hidden by default
(`revealed: false`). Revealed when any of:

- Player **probes** the host — probe report enumerates installed ICE (typeId,
  grade, `dormant` flag if not yet triggered)
- Player **dumps** the host — dump listing shows ICE alongside macguffins
- Stationary ICE **activates** (trap springs) — revealed on that node for the
  rest of the run
- Roaming ICE **detects** the player or **enters a node the player owns** —
  revealed globally for the rest of the run (matches today's "visible in owned
  territory" rule)

Once revealed, the graph shows an ICE marker on the host — visually distinct
from the roaming-ICE attention cursor.

**Graph markers:**

- **Host badge** — "ICE installed here." Appears on revealed hosts. Stationary
  ICE has only this marker.
- **Attention cursor** (today's red diamond) — roaming ICE's current patrol
  location; follows the ICE.

**Counter-play — `scan-for-ice`.** New action on owned / compromised nodes:
reveals installed ICE without triggering stationary triggers. Shows typeId,
focus, and behavior pattern but **not** effects. Adjacent-scan is backlog.

**Log entries** — every reveal, activation, trigger, and effect emits a log
entry. Trap springs get prominent formatting (`!TRAP!` prefix or similar).

---

## 6. Hack / reprogram layer

All hack verbs are actions on the host node, gated by access level. Owning the
host adds a sidebar group listing installed ICE with per-ICE action menus.

### MVP verbs

| Verb | Availability | Effect | Notes |
|---|---|---|---|
| `uninstall-ice` | Owned host | Removes ICE instance | Table stakes |
| `disable-ice` | Compromised host, type-gated | Sets `enabled: false` for 30–90s | Only on ICE flagged `canTempDisable: true`; weighted toward lower-grade LANs |
| `swap-pattern` | Owned host, type-gated | Swap `behaviorPattern` from allowed set | Set may include *degenerate* patterns (`player-avoid`, `freeze`) |
| `reprogram-effects` | Owned host, type-gated | Swap one or more effect atoms from allowed set | The "thief → mule" flow: redirect `steal-cash` stash selector to `player-wallet` |

**Reprogram allowlists** — each catalog type declares what's legal to
reprogram. `Trapwire` can't become a thief; `Thief-B` can have its stash
selector redirected. Prevents "every ICE becomes a Recruited ally" abuse.

### Cost and risk

Hack verbs must not be free:

- **Backfire** — each verb has a chance to fail, triggering the ICE hostilely
  once as punishment. Probability inverse to ICE grade.
- **Alert bump** on every hack attempt (same as failed exploit).
- **Timed action** (~3–8 s) during which roaming ICE can still detect you.

### Deferred to backlog
- `retarget` verb (change trigger list or target selectors on installed ICE)
- `recruit` verb (turn ICE into a pet that autonomously exploits nodes)
- Custom atom-list editing UI (MVP is presets only)

---

## 7. Alert, IDS, and reporting

### MVP (session 1 migration path)

- Global alert and global trace persist unchanged.
- Every ICE instance reports `raise-alert` events through the host node's
  existing IDS chain, as today's singleton does. Multiple ICE in different
  zones simply feed the same monitor. IDS subversion still severs chains for
  ICE whose path runs through them.
- Detection thresholds and trace countdown constants stay identical. Bot
  census should show near-zero regression for carried-over networks.

### North-star (separate session)

- Alert becomes a per-zone computed value. A zone = subgraph of nodes feeding a
  given security monitor.
- Each ICE reports through a *designated* IDS in its zone (usually nearest by
  graph distance). Reconfiguring that IDS blinds only its ICE.
- Multiple concurrent traces possible — first to complete ends the run.
- Security-monitor ownership cancels an active trace in its zone.

### Non-alert effects

Effects that aren't `raise-alert` / `start-trace` do **not** route through IDS.
A Thief stealing cash is not an alert-raising event — it's a direct resource
mutation with its own log entry. Keeps alert reserved for detection/surveillance
fiction.

`start-trace` skips IDS entirely — rare, reserved for apex ICE.

### Explicit non-goals for this roadmap

"Rethink/rebuild the alert system broadly" — Les's words, his call, filed as
its own issue. Likely a prerequisite for session 7 (per-zone alert).

---

## 8. Architecture

### State shape

```js
GameState {
  ...
  ice: {
    instances: { [id]: IceInstance },   // was: single object
    // global fields remain for MVP (disturbance tracking, etc.)
    // migrate to per-instance in per-zone session
  }
}
```

A `getPrimaryIce()` compat shim returning the first active instance smooths
migration for read-only sites not yet iterated. Used sparingly; removed as each
site is converted.

### Module split

Three new modules under `js/core/ice/`:

- `js/core/ice/registry.js` — catalog of ICE types (named presets: triggers +
  pattern + effects + reprogram allowlists + `canTempDisable` + grade weights).
  Pure data + selector helpers.
- `js/core/ice/atoms.js` — effect and trigger atom registries. Each atom:
  `{ id, schema, apply(iceInstance, state, ctx) }`. Pure, no renderer imports.
- `js/core/ice/runtime.js` — per-tick dispatcher. Iterates
  `s.ice.instances`, invokes each instance's behavior pattern, which fires
  triggers and invokes effect atoms. Replaces current `js/core/ice.js`
  monolith.

Behavior patterns in `js/core/ice/patterns/` — one file per pattern (`trap.js`,
`patrol-random.js`, `disturbance-tracker.js`, `player-hunter.js`,
`relocate-on-activate.js`, `player-avoid.js`, `freeze.js`, `sentry-radius.js`,
`patrol-route.js`). Each exports
`{ id, onTick(instance, state, ctx), onTriggerFired(instance, state, ctx, triggerResult) }`.
Pure — no DOM, no Cytoscape.

### Event surface

New events on `js/core/events.js`:

- `ICE_INSTALLED` `{ iceId, hostNodeId, typeId }`
- `ICE_REVEALED` `{ iceId, reason: "probe"|"dump"|"activate"|"detect" }`
- `ICE_ACTIVATED` `{ iceId, trigger, hostNodeId }`
- `ICE_EFFECT_APPLIED` `{ iceId, effect, result }`
- `ICE_HACKED` `{ iceId, verb, success }`
- `ICE_STASH_DEPOSITED` `{ nodeId, kind: "cash"|"card"|"macguffin", amount }` —
  drives the recovery gameplay loop

Existing events (`ICE_MOVED`, `ICE_EJECTED`, `ICE_REBOOTED`, `ICE_DETECTED`,
`ICE_DETECT_PENDING`, `ICE_DISABLED`) gain `iceId` in their payloads.
Breaking change; listeners updated in the same session as the state shape.

### Determinism

Every atom that rolls randomness uses a named RNG stream. New stream
`RNG.ICE_EFFECT` for stash selection, backfire rolls, probabilistic triggers.
Bot census seeds reproduce exactly.

### Serialization

Collection + per-instance structure must round-trip through save/load. Covered
by `tests/integration/ice-serialization.test.js` — install three instances
(stationary, roaming, disabled), serialize, deserialize, compare.

### Three parallel entry points

Per CLAUDE.md, `js/ui/main.js`, `scripts/playtest.js`, and
`scripts/bot-player.js` share timer wiring and action dispatch. All three read
`s.ice` today. All three need updating in session 1.

### Test strategy for session 1

- Per-atom unit tests (pure functions — cheap and thorough)
- Pattern-handler tests (each pattern against a tiny 3-node fixture)
- Integration test: probe reveals ICE → trigger fires → effect applies →
  alert rises
- Bot census regression run with default content (unchanged gameplay)

---

## 9. Network generation

ICE placement becomes a content + procgen concern.

### Meta format

Today:
```js
meta: { ice: { grade: "B", startNode: "sec/monitor" } }
```
Becomes:
```js
meta: {
  ice: [
    { typeId: "patrol-B", hostNodeId: "sec/monitor" },
    // more entries optional
  ]
}
```

Empty array = ICE-free network (useful for tutorials). Session 1 keeps a shim
translating singleton declaration → one-element instances array so hand-crafted
networks don't break.

### Procgen weighting

A small catalog query layer picks types by LAN grade and host node type:

- **LAN grade** caps and skews the pool. F/D LANs pull from grade-F/D types;
  C/B from F–B; A/S from the full catalog.
- **Host node type** filters by compatibility. Roaming ICE: compatible with
  `security-monitor`, `router`, `switch`. Stationary trap ICE: compatible with
  `workstation`, `vault`, `cryptowallet`, macguffin-bearing types. Each catalog
  entry declares its compatibility list.
- **Density** — per-LAN ICE-point budget drawn from LAN grade, preventing
  procgen dumping 15 apex ICE in one map.

### Stash placement

The `stash: true` attribute is set by procgen on a small number of nodes per
map that are compatible hosts (deep leaf nodes, nodes behind multiple IDS,
unusual types). Thief effects target stash-tagged nodes via selector. Stash
tagging does not make the node look special — discovery is diegetic via dump.

### Cryptowallet node type

Small new type with one behavior: valid stash target; dump reveals deposited
contents like macguffins. Added in the session introducing `steal-cash`, not
session 1.

### Tutorial / progression implications

- F-grade LANs in `data/networks/` should get 0–1 ICE (gentle onboarding)
- Higher-grade LANs get mixed stationary + roaming, occasional stacks
- Session 1 only changes state shape; actual procgen selection lands later

---

## 10. Session decomposition and issue roadmap

### New issues to file

| # | Session | Scope |
|---|---|---|
| 1 | ICE architecture rebuild | State shape, `js/core/ice/` module split, atom/pattern/registry scaffolding, full atom catalog (tested but mostly dormant), HP + deckIntegrity pools, iceId-threaded events, bot census regression gate. One concrete ICE type ported from today's singleton so gameplay is unchanged. |
| 2 | Stationary trap ICE + trigger system | First new real ICE type (Trapwire), configurable trigger list, host-badge reveal, `uninstall-ice` verb, MANUAL.md + docs/ICE.md updates. |
| 3 | Thief ICE + stash + recovery loop | Thief roaming type, `stash` attribute + selector, cryptowallet node type, `steal-cash`/`shred-card`/`steal-card` wired, `ICE_STASH_DEPOSITED` log-driven discovery. |
| 4 | Defender ICE + sabotage effects | `lock-node` wired (closes #42), `patch-vulns`, `force-reboot`, node-repair counter-play. |
| 5 | Hack / reprogram verbs | `disable-ice` (timer), `swap-pattern`, `reprogram-effects`, reprogram allowlists, backfire rolls, installed-ICE management sidebar. |
| 6 | Counter-play scan refinement | `scan-for-ice` deeper output, adjacent-scan exploration. |
| 7 | Per-zone alert system | Per-zone alert computation, concurrent traces, IDS-per-ICE routing. Depends on broader alert-rethink conversation first. |
| 8 | Procgen population & tuning | Catalog weighting, density budgets, stash placement, bot-census-driven tuning pass. |

### Deferred backlog issues (not in sequence, parked)

- Recruit ICE verb — autonomous pet ICE that exploits nodes for the player;
  powerful, needs its own design pass
- Retarget verb — change trigger list or target selectors on installed ICE;
  subtle, needs design
- Deck subsystems inventory + glitch effects (deeper deck integrity model)
- Textured health model (wounds / debuffs impairing actions)
- Mid-run healing / medical-aug system
- Persistent cross-run consequences for `burned` / `bricked`
- Alert system broad rethink (prerequisite for session 7)

### Existing issues to update / close

- **#36** (ICE system overhaul — multiple instances) — umbrella; link to
  sessions 1 + 7; close when both merge.
- **#40** (ICE resident node relocation) — superseded by "ICE installed in host
  node." Close when session 1 merges.
- **#42** (Defender ICE — reverse-access) — superseded by effect-atom model
  (`lock-node`). Close when session 4 merges.
- **#49** (Countermeasures beyond ICE — firewalls, honeypots) — partially
  covered. Leave open with comment: ICE now handles effect variety;
  firewalls-degrade-cards and honeypots remain distinct concepts that could
  either become ICE catalog entries or stay separate countermeasure entities.
  Revisit post-session-5.

### Deliverables from this conversation

1. This vision spec (`docs/dev-sessions/2026-04-24-1243-ice-reinvention/spec.md`)
2. Paradigm doc (`docs/ICE.md`) — shorter, evergreen, sits alongside SPEC.md /
   PROCGEN.md / BOT-PLAYER.md
3. Filed issues per the table above
4. Updated / closed existing issues per the table above

---

## Open questions / risks

- **Session 1 anticlimax risk.** A lot of structural work with minimal visible
  gameplay change. Mitigation: make the bot-census regression check the
  definition of done; the visible change for players is "none," and that's the
  correct outcome for a foundation session.
- **Alert rethink sequencing.** Session 7 (per-zone alert) depends on the
  broader alert-system rethink that Les flagged wanting. That rethink is its
  own brainstorm conversation; don't start session 7 until it happens.
- **Bot player maintenance.** The bot reads `s.ice.attentionNodeId` directly.
  Session 1 must update it to iterate instances or the bot breaks silently on
  the census. Covered in session 1 scope (see §8 "Three parallel entry
  points").
- **Save/load format change.** State shape change is a breaking save-format
  change. If save files in the wild matter, a one-way migration is needed.
  Current assumption: prototype stage, no migration burden.

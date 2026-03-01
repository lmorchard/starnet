# Starnet — Deferred Ideas Backlog

_Compiled from all dev session notes. Not a prioritized roadmap — just a living inventory._

---

## Gameplay Systems

### Exploit Economy / Card Acquisition
- **Card restock mid-run** — ~~player has no way to get new cards except cheats~~ darknet store at WAN node is now in. Remaining: loot drops from owned nodes, additional store nodes deeper in a network, or mid-run card crafting
- **Persistent inventory between runs** — in the overworld context, exploit loadout carries across LANs; crafting/acquiring a better kit is part of the meta-loop
- **Balance: starting hand vs. network vulnerability mix** — current hand frequently doesn't match early node vulns; in the overworld context this is solved by pre-run preparation, not hand seeding _(deferred pending overworld design)_

### Mission / Objectives
- **Mission conditions** — secondary objectives like "never exceed yellow alert" or "don't trigger trace"; adds replayability and run variety
- **Node flavor text** — when you `read` a node, give it cyberpunk lore flavor beyond "X item(s) found"
- **Alert consequence tuning** — trace countdown (60s) may feel long; consider tightening or making it configurable per network

### ICE System Overhaul (Future)
The current ICE implementation assumes a single ICE entity with a fixed grade and behavior
tier. A full overhaul will be needed to support:
- **Multiple concurrent ICE instances** — different entities patrolling different zones of the LAN
- **Variant ICE types** — each with distinct behaviors (patrol routes, detection radii, response
  patterns) beyond the current grade-tier model; Defender ICE (reverse-access) would be one type
- **Per-instance state** — each ICE entity needs its own attention node, detection state, dwell
  timer, and behavioral flags
- The current `s.ice` singleton and `ice.js` module will need to become a collection + behavior
  dispatch system. This is a significant architectural change — defer until the single-ICE
  prototype is fully playtested and the design is stable.

### Adversarial / ICE
- **Defender ICE** — instead of detecting and triggering alert, this ICE variant reverses access levels (owned → compromised → locked) as it dwells on a node; creates territory-holding pressure that complements the existing detection model. Would need new ICE behavior type, reverse-access state mutation, and visual feedback distinct from current ICE presence indicator.
- **`cheat ice-move <node>`** — cheat command to teleport ICE directly to a node for testing detection scenarios without waiting for ticks
- **ICE path tracing via traffic analysis daemon** — ICE movements currently invisible until dwell fires; a "traffic analysis daemon" installed on a compromised node could reveal ICE movement logs as events _(part of the log-verbosity-as-mechanic idea below)_
- **ICE status readout on owned-node crossings** — when ICE moves through a node you own, the log reports its path but not its behavioral state. A brief status tag (e.g. `[PATROLLING]`, `[ALERTED]`, `[HUNTING]`) in the movement log entry would let the player read ICE intent at a glance — useful for deciding whether to deselect and go dark or commit to an action. Status maps naturally to the existing grade-behavior tiers: D/F = patrolling, B/C with a disturbance target = alerted, A/S or B/C chasing player = hunting.

### Information Asymmetry (Log Verbosity as Game Mechanic)
From session-5 design discussion — reframe log verbosity as something the player *earns*:
- **Traffic analysis daemon** — installed on a compromised node; reveals ICE movements through visible territory in the log
- **Alert propagation logs** — requires subverting/compromising an IDS; once owned, you see alert events as they propagate to monitors
- **Deep network telemetry** — high-tier readable nodes contain network maps, revealing hidden nodes or edges without traversal
- This reframes information asymmetry as diegetic and earned, not a UI toggle

### Exploit Mechanics (Depth)
- **Chaining exploits** — sequential exploitation requiring specific steps; privilege escalation as a multi-step sequence
- **Countermeasures** — active defenses beyond ICE (firewalls that degrade card quality, honeypots, etc.)
- **Visual feedback for staged vuln reveal** — log message on deeper attack surface unlock is subtle; a pulse/flash on the node would be more satisfying (currently only a log entry)
- **ICE noise saving throw** — current exploit noise detection uses a static per-grade threshold (tick N = respond). A probabilistic variant would roll a detection chance each tick, scaled by ICE grade, giving more variance in ICE response timing. Adds texture to repeated runs without changing the average behavior much. Defer until static table has been playtested enough to know if variance is actually wanted.

---

## World / Structure

### Overworld / Meta-loop
- **Overworld linking LANs** — the dungeon run takes place in a larger world context; structure connecting LAN to LAN (planet internets, star systems, ansible networks)
- **Procedural or semi-procedural network generation** — random LAN topologies with seeded RNG for reproducibility (roguelike runs); currently static hand-crafted network
- **Inter-run progression** — player skills, reputation, contacts, persistent exploit inventory carry between runs

### Worldbuilding (from SPEC.md)
- Sprites, daemons, machine elves as in-network entities / power-ups (semi-autonomous AI anomalies)
- Psychic bleed / neuraldeck direct neural interface flavor
- Sidebands — parallel hidden networks harboring hackers and alien artifacts
- Ansible network topology as overworld communication layer
- Finding Earth as a late-game quest thread

---

## Technical / Architecture

### ~~Seeded RNG~~ ✓ DONE
Implemented in `js/rng.js` — Mulberry32 PRNG with 5 named streams (exploit, combat,
ice, loot, world). String seeds hashed via djb2. All 26 gameplay `Math.random()` calls
replaced. Deterministic runs verified. Playtest harness supports `--seed`.

### Snapshot-Based Testing
With save/load implemented and seeded RNG (above), we can write tests that start from a
captured game state snapshot and replay a deterministic sequence of actions to reproduce
specific scenarios — especially hard-to-reproduce bugs like ICE detection firing on the
wrong node. The workflow: capture a snapshot during play when a bug occurs, write a test
that loads the snapshot, seeds the RNG, executes the triggering actions, and asserts the
correct outcome. Requires seeded RNG to be fully deterministic.

### Visual Preview Harness ("Storybook")
Extract and isolate the visual rendering subsystem (graph.js overlays, CSS animations,
SVG effects) into a standalone preview tool. Allows testing and refining visuals — probe
sweep, exploit brackets + zaps, ICE detection arc, read sectors, etc. — without going
through gameplay. Inspired by Storybook: render each effect in isolation with sliders for
progress, node size, and timing. Prerequisite: further decoupling visual renderers from
game state (currently tightly coupled via Cytoscape node positions).

### Tick Multiplier / Game Speed
`tick(n)` already supports multi-tick advances; just need HUD controls (0.5×/1×/2×/4×)
and to thread the multiplier through the `setInterval` callback. Most useful when AI bots
can play the network on the player's behalf and fast-forward is desirable.

**Diegetic tick speed as player mechanic:** The neuraldeck accelerates the user's brain
to compete with automated systems. Tick multiplier becomes an in-game stat rather than
just a dev control. Upgrades (better deck hardware, stimulants) speed the player up;
damage or countermeasures slow them down. At 0.5× the world feels faster — ICE moves
more aggressively, timers feel tighter. At 2× the player has breathing room to plan.
This reframes game speed as a resource the player manages, not a UI preference.

### LLM Playtest Harness
- **Typed event log** — replace ad-hoc log strings with structured `logEvent(type, payload)` that both renders human-readable and records machine-readable events
- **Formal log message conventions** — consistent prefixes per category (`ICE:`, `EXPLOIT:`, `ALERT:`, `NODE:`)
- **LLM playtest script** — feeds `status` output + log to an LLM, reads back console commands; validates game balance and text interface completeness
- **Playtest harness ActionContext wiring** — `scripts/playtest.js` dispatches actions by calling state functions directly, bypassing the unified `starnet:action` event bus. Wiring the harness through `ActionContext` would give full parity with browser behavior, including side-effects like log entries and event emissions.
- _Recommendation: don't formalize until actually building an LLM agent — requirements will clarify then_

### Module Refactoring
- ~~**`state.js` is large**~~ — Done. Split into `state/` directory with submodules (2026-02-28 emit-coalesce session).

### Surgical DOM Rendering
The current pattern of full `innerHTML` replacement in `visual-renderer.js` is simple but
causes bugs when animated or interactive elements (event listeners, CSS animations) need to
survive across state updates. The exploit cancel overlay flickering and click-reliability
issue (fixed by in-place progress updates) is a concrete example of this friction.

**Consider investigating:**
- **[lit-html](https://lit.dev/docs/libraries/standalone-templates/)** — template literal
  rendering that diffs the DOM surgically; zero-framework, ESM-native, fits the no-bundler
  constraint well
- **Web Components** — encapsulate cards, sidebar panels, etc. with their own internal
  DOM; state updates via attributes/properties rather than parent innerHTML replacement
- **Hybrid** — keep the event bus / state model as-is, adopt lit-html only for the
  rendering layer in `visual-renderer.js` and `log-renderer.js`

_Trigger: reach for one of these when the in-place workaround pattern recurs a second or
third time. One case is a data point; a pattern is a signal._

### Exploit Card IDs
- **Legible card IDs** — currently `exploit-1`, `exploit-2`, etc.; consider IDs derived from vuln type + suffix (e.g. `ssh-1`, `privesc-3`) for more diegetic log/console references

---

## UI / Visual Polish

### Context Menu / Pie Menu
The node context menu (floating, graph-anchored, from `getAvailableActions()`) landed in
2026-02-27-1211. A radial/pie menu was attempted (ctxmenu CDN library) but reverted — the
library's styling was too opinionated to fit the phosphene aesthetic cleanly.

The floating context menu satisfies the "spatially grounded" requirement for now. A custom
pie menu remains a possible direction if the action count grows or the visual direction
calls for it. Design questions remain: how many actions fit cleanly? How does it interact
with the console symmetric-input rule?

### Locked Accessible Node Fill Contrast
Locked nodes that are accessible show background fill `#080810`, nearly identical to the
container background `#0a0a0f`. On most monitors these are visually indistinguishable.
Consider increasing the fill lightness for locked/accessible nodes to make their presence
more readable on the graph — without losing the "dark and unowned" feel relative to
compromised/owned nodes.

### Effects (out of scope, recurring)
- Screenshake on jack-out
- Bloom / vector glitch on trace countdown or countermeasure hit
- Node flash on exploit success (currently implemented for some cases)
- Audio (explicitly out of scope until much later)

### Console / UX
- **`help` command improvements** — currently exists; could be richer with examples
- **Alert consequence tuning** — trace countdown length, alert escalation pacing
- **Playwright test reliability** — `node.emit('tap')` workaround for synthetic events is fragile; document in CLAUDE.md so it doesn't get rediscovered

---

## Design Questions (Unresolved)

- **Overworld structure** — what links LANs? Star system map? City districts? Planetary internets? Shape of this affects many in-run design decisions.
- **Mission briefing source** — in the overworld, missions come from somewhere (fixers, factions, bulletin boards). Does this affect run structure?
- **What the player *is*** — decker, netrunner, corp agent? Affects flavor, narrative framing, and what "winning" means across runs.
- **Economy scope** — is cash purely a score, or does it buy things between runs? Feeds back into the exploit inventory question.

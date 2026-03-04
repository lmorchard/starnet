# Starnet — Deferred Ideas Backlog

_Compiled from all dev session notes. Not a prioritized roadmap — just a living inventory._

---

## Gameplay Systems

### Exploit Economy / Card Acquisition
- **Card restock mid-run** — ~~player has no way to get new cards except cheats~~ darknet store at WAN node is now in. Remaining: loot drops from owned nodes, additional store nodes deeper in a network, or mid-run card crafting
- **Persistent inventory between runs** — in the overworld context, exploit loadout carries across LANs; crafting/acquiring a better kit is part of the meta-loop
- **Balance: starting hand vs. network vulnerability mix** — current hand frequently doesn't match early node vulns; in the overworld context this is solved by pre-run preparation, not hand seeding _(deferred pending overworld design)_

### Reward Scaling with Difficulty
- **Macguffin value scaling** — higher-difficulty networks cost more to crack (harder nodes, deeper paths, more ICE pressure) but don't contain more valuable loot. Macguffin `cashValue` should scale with `moneyCost` grade so players have incentive to tackle harder networks. This is a game state layer change (`loot.js`), not a generator change.
- **Risk/reward feedback loop** — the darknet store already costs cash; if harder networks pay more, the player's cash economy becomes meaningful (spend to crack, earn to profit). Currently all cash feels like pure score.
- _Identified during bot census session (2026-03-01): zero deficit at all difficulties, but no reward differential either._

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
- **Per-zone IDS reporting** — each ICE instance reports through the IDS in
  its zone. Reconfiguring one IDS only blinds the ICE that reports through it.
  Creates localized security domains the player can selectively subvert.
- The current `s.ice` singleton and `ice.js` module will need to become a collection + behavior
  dispatch system. This is a significant architectural change — defer until the single-ICE
  prototype is fully playtested and the design is stable.

### Large Network Generation
Current networks are 9-16 nodes. Larger networks (40-60+ nodes) would support
longer runs, multiple security domains, and multiple ICE instances. Design
considerations:

- **Zone/wing topology** — instead of one linear relay chain, the generator
  would compose multiple branches: research wing, finance department, server
  farm, executive subnet. Each zone has its own depth, grade profile, and
  security infrastructure (dedicated IDS + ICE per zone).
- **Sub-biome composition** — zones could be topology templates composed within
  a single biome. A corporate biome might have "office floor" zones (many
  workstations), "server room" zones (fileservers + cryptovault), and
  "security operations" zones (monitors + IDS). Different compositions per
  difficulty or seed.
- **Generator changes** — the layer-processor would need a concept of zone
  scoping: spawn a set of layers N times, each instance forming an
  independent sub-graph connected to the backbone. The relay layer already
  demonstrates chaining; zones would be a higher-level version of the same
  pattern.
- **Spatial gameplay** — larger networks make navigation itself a strategic
  decision. Which zone to enter first? Clear security in one wing before
  moving to the next? The player's position in the graph matters more when
  there are multiple ICE entities patrolling different regions.
- **Bot validation** — the bot census can test large networks immediately.
  Key question: does the bot's greedy BFS still work at 50 nodes, or does
  it need zone-aware planning? Performance is not a concern (6.5ms/run at
  current sizes; even 10x more nodes should be fine).
- **Layout** — Cytoscape can handle 50-60 nodes, but the depth-layered
  layout would need zone-aware positioning. Sub-graphs arranged spatially
  rather than one tall column.

### ICE Resident Node Relocation
Currently ICE starts at the security monitor. The fiction would be cleaner if
ICE started at a node on the far side of the IDS — patrolling the working
network, reporting back through the IDS chain. Benefits:
- ICE patrols where the player operates (routing/workstation layer)
- Detection reports travel through IDS → monitor (severable via reconfigure)
- Reboot sends ICE to its new resident node, not the monitor
- Security monitor remains valuable for cancel-trace, but isn't ICE home base
This is a topology/gen-rules change — the layer processor needs a new role for
the ICE resident node, and `iceResident` behavior needs to move from
security-monitor to the new node type.
_Identified during bot census session (2026-03-01)._

### Player Upgrades / Deck Hardware
The overworld progression system should give players tools that shift the
balance at higher difficulties. These are equipment/upgrades acquired between
runs, not in-run pickups.

- **Deck speed** — reduces exploit execution duration. A faster deck means
  shorter exposure windows during exploits, directly improving survivability
  against ICE. Could be a multiplier on `exploitDuration()`.
- **Signal masking / stealth** — increases ICE dwell time before detection.
  The player's presence is harder to detect, giving more time to complete
  actions before ICE triggers. Could add a flat bonus to DWELL_TIMES.
- **Chaff / decoys** — creates false disturbance signals at other nodes,
  drawing ICE away from the player. ICE investigates the decoy instead of
  the real exploit noise. Mechanically: set `lastDisturbedNodeId` to a
  decoy node on demand.
- **Bot partners (daemons)** — autonomous agents that hack alongside the
  player, potentially in parallel. Could probe nodes, create distractions,
  or exploit low-grade targets. Implementation may be simplified (not full
  bot-player instances) — e.g. a daemon "claims" a node and applies a
  timed state change without full exploit resolution. The fiction: the
  player deploys semi-autonomous programs into the network.
- **ICE scanner** — reveals ICE position and movement direction when the
  player owns a node ICE passes through. Reduces information asymmetry
  and enables timing-based play. See also: traffic analysis daemon in the
  information asymmetry section below.

These upgrades are the intended solution for A/A and S/S difficulty. The base
game mechanics (evasion, IDS reconfigure) handle C/B; player upgrades extend
viability to the hardest tiers. Bot census data (2026-03-01) confirms: the
dumb bot hits 0% at A/A without upgrades, but the mechanical levers (deck
speed, stealth) would directly address the exploit-duration vs ICE-dwell race.

### Adversarial / ICE
- **Defender ICE** — instead of detecting and triggering alert, this ICE variant reverses access levels (owned → compromised → locked) as it dwells on a node; creates territory-holding pressure that complements the existing detection model. Would need new ICE behavior type, reverse-access state mutation, and visual feedback distinct from current ICE presence indicator.
- **Bot player: eject and reboot** — the bot currently never uses eject (push
  ICE to adjacent node) or reboot (force ICE to resident, node goes offline).
  Eject is a simple reflex ("ICE is here, push it away") and worth adding —
  it buys time without cancelling the current exploit. Reboot is more strategic
  (requires planning about which node and when) and may be too complex for
  the dumb bot. Both require tracking ICE position (`iceCurrentNode`).
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
- **Procedural or semi-procedural network generation** — ~~random LAN topologies with seeded RNG for reproducibility (roguelike runs); currently static hand-crafted network~~ _in progress: 2026-03-01-1458-procedural-lan-gen_
- **Inter-run progression** — player skills, reputation, contacts, persistent exploit inventory carry between runs
- **Biome system** — node type palette, flavor text, and set piece pool selected by biome (corporate, military, black market, etc.); third axis for the procedural generator after timeCost/moneyCost are stable
- **LAN generator set pieces (future):**
  - **Workstation array** — multiple low-grade workstations behind a router for methodical looting
  - **Lucky break** — a low-grade firewall in front of a cryptovault (the corp cut corners on hardening)
  - **Security theater** — low-grade fileservers behind a high-grade firewall (counting on perimeter, soft inside)

### Worldbuilding (from SPEC.md)
- Sprites, daemons, machine elves as in-network entities / power-ups (semi-autonomous AI anomalies)
- Psychic bleed / neuraldeck direct neural interface flavor
- Sidebands — parallel hidden networks harboring hackers and alien artifacts
- Ansible network topology as overworld communication layer
- Finding Earth as a late-game quest thread

---

## ~~Node System Overhaul~~ ✓ SUBSTANTIALLY DONE

### ~~Reactive Node Graph Runtime~~ ✓ DONE (2026-03-03)

Integrated in the node-graph-integration session (63 commits, 86 files, +10,763/-4,342).
The NodeGraph runtime is now the authoritative source of node state and behavior.
NodeDef-based definitions with operators, actions, triggers, and set-piece circuits
are live. See `js/core/node-graph/` for the runtime and `data/networks/` for network
definitions.

**Remaining work from this design (now separate backlog items):**
- Composable traits system — see below
- Core mechanics migration into node-graph — see below
- Qualities system — deferred until traits are stable

The original design document below is retained for reference.

The original node implementation was a mix of hardcoded type behaviors, bespoke
per-feature logic (IDS → monitor alert chain, ICE resident, etc.), and scattered
`if (node.type === 'X')` special cases. The node-graph runtime replaced
this with a data-driven, composable system: nodes as attribute bags, behavior as
named composable atoms, state propagation via typed message-passing.

#### Design Precedents

Three games are direct inspirations:

- **Rocky's Boots (1982, The Learning Company)** — players build logic circuits by
  navigating a world of connectable gates. The key insights: signals should be
  *visually legible as they propagate* (rendered as "liquid orange fire through
  transparent pipes"); the player is *inside* the circuit, not an external operator
  (your actions *are* signals injected into the network); the game world and the
  reactive system are the same object, with no separate editor mode. Early stages
  teach gates one at a time before opening free composition.
- **Caves of Qud** — component/data composition. Entities are XML definitions that
  compose named components; component logic is code, composition is data. Nothing
  in the world needs special-case engine code. The atom system uses the same pattern.
- **Sunless Sea / Fallen London (StoryNexus)** — Qualities as the lingua franca for
  game state. Named counters aggregate signals from many sources; triggers fire when
  counters reach thresholds. This decouples individual event emitters from
  multi-source conditions — the "arrange switches just-so" pattern without cross-node
  wiring.

#### The Primitives

**Nodes as attribute bags.** Each node is schema-validated typed attributes: `grade`,
`accessLevel`, `alertState`, plus arbitrary extras (`rewardAmount`, `passwordHash`,
etc.). The node *type* is a human-readable shorthand for an atom bundle — behavior
comes entirely from the attached atoms, not the type name.

**Behavioral atoms.** Named, self-contained reactive functions that compose onto nodes.
Atoms in JS, composition in data (ECS-style: functions registered by name; node
definitions list atom names + configs). Core atoms:

- `relay(filter?)` — forward matching incoming messages to connected nodes; this is
  the entirety of what an IDS does
- `invert` — flip `signal.active` before forwarding (NOT gate)
- `any-of(inputs)` / `all-of(inputs)` / `exactly-one-of(inputs)` — OR / AND / XOR
  gate atoms; emit when condition over named inputs is satisfied
- `latch` — `set` / `reset` messages toggle persistent state (flip-flop)
- `clock(period)` — source atom; emits periodic pulses without an incoming trigger
- `delay(ticks)` — buffers a message and re-emits after N ticks (repeater)
- `counter(n, emits)` — after N incoming triggers, emits a different message
- `ice-resident` — spawn ICE here on init and after reboot
- `reward-on-loot(amount)` — call `ctx.giveReward(amount)` when looted

**Message-passing edges.** Connections are dumb pipes — no behavior, state, or
filtering logic. All routing, filtering, and rewriting lives in nodes. Every message
carries an envelope:

```
{ type, origin, path: [nodeId, ...], destinations: null | [nodeId, ...], payload }
```

- `origin` — first emitter; preserved through relays
- `path` — forwarding history; used for cycle detection and audit tracing
- `destinations` — null = broadcast; `[id,...]` = multicast or unicast

Because messages carry `origin`, gates can be source-selective — `all-of` can
require signals from specific named nodes, not just any input; strictly more
expressive than Redstone.

Core message vocabulary: `probe-noise`, `exploit-noise`, `alert`, `owned`, `unlock`,
`heartbeat` (periodic keep-alive; absence triggers deadman conditions), `signal`
(generic on/off for gate use).

**Qualities.** Named integer counters in a network-scoped namespace. Atoms and
player actions can read and write them. `quality("X") >= N` is a first-class
predicate. From Fallen London: individual events increment a shared counter; a
trigger fires at a threshold. Neither the emitter nor the target needs to know
about the other. Examples: `routing-panels-aligned` (inc/dec by switch actions),
`auth-tokens-collected` (inc on loot), `security-compromised` (flag on IDS
subversion).

**Triggers.** Named condition + effects pairs, evaluated after every state change,
firing once when condition transitions false → true:

```
{ when: all-of [ node("A").accessLevel == "owned",
                 node("B").accessLevel == "owned" ],
  then: [ reveal-node("hidden-vault"), place-macguffin("vault", "corp-secrets") ] }

{ when: quality("routing-panels-aligned") >= 3,
  then: [ enable-node("deep-subnet"), log("Routing path established.") ] }
```

**Player actions as data.** Actions are data definitions with preconditions and
effects, not bespoke handlers — a generalization of what `node-types.js` already
does:

```
{ id: "flip-route", label: "Reroute",
  requires: { accessLevel: "owned" },
  effects: [ toggle-attr("aligned"), emit-message("route-changed"),
             quality-delta("routing-panels-aligned", +1 if aligned else -1) ] }
```

**Game API context.** The boundary between node graph and engine — the finite,
auditable surface of what atoms can affect: `ctx.startTrace()`,
`ctx.cancelTrace()`, `ctx.giveReward(amount)`, `ctx.spawnICE(nodeId)`,
`ctx.setGlobalAlert(level)`, `ctx.enableNode(nodeId)`, `ctx.disableNode(nodeId)`,
`ctx.revealNode(nodeId)`.

#### Expressive Power

The gate atoms are equivalent to digital logic — if the system can express
Redstone-equivalent circuits, it can express essentially any cause-and-effect
puzzle without new engine code. The security monitor is already an OR gate
(`any-of` IDS inputs → high-alert).

| Redstone | Atom |
|---|---|
| Wire / repeater | `relay` / `delay(ticks)` |
| NOT | `invert` |
| OR / AND / XOR | `any-of` / `all-of` / `exactly-one-of` |
| Latch / flip-flop | `latch` |
| Clock | `clock(period)` |
| Comparator | `compare(threshold)` |

Gate state lives in the attribute bag (`all-of` tracks per-source signal state).
Timing requires explicit `delay` atoms rather than emerging from propagation
distance — less implicit, more intentional.

Puzzle patterns enabled, roughly ordered by complexity:

- **Tripwire** — hidden node; trigger fires `ctx.startTrace()` when node A is owned
- **Decoy** — lootable node with low reward and `raises-alert-on-loot`; corporate bait
- **Deadman circuit** — `clock → NOT(heartbeat) → trace-start`; blocking the
  heartbeat relay fires trace rather than silencing it
- **ICE visibility tradeoff** — subverting the relay that carries `owned` messages
  lets you own nodes silently, but if it also carries your log feedback the zone
  goes dark both ways
- **N-th access alarm** — `counter(3, emits:alert)`; probing 3 times starts trace
  regardless of per-probe outcomes
- **Password gate** — own node A (readable password) to send `unlock` to node B
- **Progressive unlock chain** — each node's `owned` transition is a trigger
  condition for the next becoming accessible
- **Switch arrangement** — switch actions write a quality; trigger reveals hidden
  subnet when quality reaches target value
- **Multi-key vault** — loot requires `quality("auth-tokens") >= 2`; tokens from
  two separate nodes
- **Combination lock** — `all-of([switch-A, switch-B, switch-C])`; only the correct
  simultaneous state produces the output signal
- **Ordered sequence lock** — chain of latches; only correct activation order
  produces the final signal
- **Automated defense** — `clock AND compromised-flag → ICE-spawn`; ICE spawns
  periodically only during active intrusion
- **Self-resetting trap** — `tripwire → latch → delay(30) → latch-reset`

#### Composition Levels: Atoms, ICs, and Set-Piece PCBs

Three levels of composition, from primitive to prefab:

**Complex ICs** are nodes that encapsulate an internal circuit but present a simple
external interface — inputs, outputs, a few configurable parameters. A hardened
firewall might internally combine a grade-threshold comparator, an IDS relay, and
a latch, but from outside it looks like one node with one configurable behavior.
The IC abstraction enables **black-box puzzle mechanics**: you can observe what a
node *does* (external message interface, available actions) without knowing *how*
(internal atom wiring) until you probe and exploit it deeply. Higher-grade ICs hide
their internals better — internal structure revealed progressively as access level
rises, mapping onto the existing probe → exploit → read loop.

**Set-piece PCBs** are prefab subgraphs: a cluster of nodes with predefined
topology, wiring, and atom configurations, placed into a network as a unit by the
generator. Examples:

- *Security operations center* — monitor + two IDS nodes + ice-host, pre-wired;
  the generator places one set-piece rather than four individual nodes
- *Combination vault* — vault node + three switch nodes + `all-of` gate, pre-wired;
  author configures reward and combination, drops it in
- *Deadman perimeter* — clock node + heartbeat relay + NOT gate + trace trigger;
  a self-contained alarm system the player must carefully disarm

Set-pieces are the authoring unit for puzzle content. The atom/IC layers provide
the vocabulary; set-pieces are the sentences. The network generator's biome
templates become catalogs of available set-pieces to compose.

#### Relation to Existing Architecture

`node-types.js` action composition is already a partial step. The full overhaul
replaces the hardcoded IDS → monitor alert chain, `ice-host`/`iceResident` special
cases, and scattered type checks in `ice.js` and `combat.js`. Node type becomes a
named shorthand for an atom bundle; biome templates become atom-palette definitions.

Migration path: current node types re-expressed as atom bundles incrementally — no
flag-day rewrite. The IDS → monitor alert chain is the natural first pilot.

#### Design Risks / Open Questions

- **Debugging**: minimum tooling needed — a message trace log (type, origin, path,
  atoms fired) inspectable via console command. The `path` field helps here.
- **Cycle detection**: a relay that sees its own ID in `path` drops the message.
- **Atom expressiveness ceiling**: atoms should be pure functions of (node state,
  incoming message, context) → (mutations, outgoing messages, ctx calls). No loops
  or closures. Whether this covers all current node types without escaping into
  bespoke JS is the key question — IDS and ICE resident are the litmus tests.
- **Quality scope**: global (per-run) is simpler; per-node enables isolated puzzle
  domains but needs namespacing to avoid collisions.
- **Trigger evaluation cost**: acceptable for small networks; large networks (40–60
  nodes) may need a dependency graph to avoid re-evaluating all triggers on every
  mutation.
- **Testing**: atoms are individually testable in isolation; triggers as condition +
  state snapshot pairs.

This is a significant architectural investment that directly enables the large-network
/ multiple-ICE / zone design and puzzle-heavy dungeon content. Defer until the
single-ICE prototype is fully playtested and the design is stable.

---

## Post-Node-Graph Integration (Deferred from 2026-03-03 session)

### Grade-Scaled Timing for Set-Piece Tick Periods
Set-piece tick periods (deadman heartbeat, IDS relay, probe burst alarm) use fixed
values. They should scale with the network's grade profile so harder networks feel
tighter. Requires defining a grade→period mapping and threading it through set-piece
construction.

### WAN Commands as Node-Specific Actions
WAN commands (jack-out, store) are currently global console commands. They should be
node-specific actions available only when the WAN node is selected, consistent with
the "all actions are node-contextual" pattern established by the node-graph integration.

### Bot Player Rebuild for Node-Graph System
The bot player (`scripts/bot-player.js`) was written against the old static network
and node-type registry. It needs a rebuild to work with the NodeGraph runtime, dynamic
node addition, and graph-bridge state sync. Priority: needed before any balance tuning.

### MANUAL.md Update (Node-Graph)
The player manual needs updating to reflect the node-graph integration changes: new
node types, set-piece behaviors, any changed action semantics. Treat as a checklist
item before calling the integration "shipped."

### ICE Visual Refinement
The ICE HTML overlay works but could look better. The overlay is positioned via
Cytoscape's `renderedPosition()` and tracks pan/zoom, but the visual design is
minimal. Consider: animation on ICE movement, better detection arc visualization,
status indicators matching grade-behavior tiers.

### Set-Piece Timing / Difficulty Tuning Sweep
All set-piece tick periods need a real-world playtesting pass at multiple difficulty
grades. The deadman circuit, nth alarm, and probe burst alarm all have fixed periods
that may not feel right across the full grade range.

### Gate-Access Tests for Graph Subsections
Write tests verifying that graph subsections behind gates (encrypted vaults, password-
gated nodes) are correctly inaccessible until their conditions are met. Currently
untested — circuits are validated but access gating is not.

---

## Technical / Architecture

### Remove `state.js` Re-Export Shim
`js/core/state.js` is a barrel re-export of `js/core/state/index.js` and submodules.
It exists so old `import ... from "./state.js"` paths work. ~27 files import from it.
Low priority — the shim works fine, but consumers could import directly from the
`state/` submodules for clarity. Touches many files.

### ~~Seeded RNG~~ ✓ DONE
Implemented in `js/rng.js` — Mulberry32 PRNG with 5 named streams (exploit, combat,
ice, loot, world). String seeds hashed via djb2. All 26 gameplay `Math.random()` calls
replaced. Deterministic runs verified. Playtest harness supports `--seed`.

### Centralized Grade Constants Module
All grade-keyed lookup tables (ICE move intervals, dwell times, noise thresholds, node
grade ranges, etc.) are currently scattered across `ice.js`, `combat.js`, `probe-exec.js`,
and the generator. A dedicated `js/grades.js` module exporting the grade order, grade-to-index
mapping, and shared utility functions (gradeToIndex, indexToGrade, gradeRange) would make
tuning easier and eliminate duplication. Natural time to do this: when the generator's budget
tables create a third or fourth copy of the grade scale.

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

### Vendor Bundle Size

The Cytoscape vendor bundle (`dist/vendor.js`) is ~1.3mb minified (~300-400kb gzipped).
The two biggest contributors after cytoscape core (~1mb) are:

- **klayjs** — 485kb for the klay layout engine
- **cytoscape-fcose + cytoscape-cose-bilkent** — each brings its own incompatible version
  of `layout-base` and `cose-base`, so those packages are duplicated (~260kb extra)

To reduce bundle size, consider auditing which layout algorithms are actually used in play
and dropping unused ones from both `js/vendor.js` and the `LAYOUTS` map in `js/ui/graph.js`.
Dropping `klay` alone would save ~485kb (~35% of unminified input). The `cose-base`/`layout-base`
duplication can't be resolved without aligning `cytoscape-cose-bilkent` and `cytoscape-fcose`
to the same major version, which may require upstream changes.

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

### ~~Exploit Card IDs~~ ✓ DONE
IDs are already derived from vuln type + counter (e.g. `unpatched-ssh-1`, `kernel-exploit-3`).
Landed in commit `410c18d`.

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

- **Command prefix uniqueness sweep** — several command families share prefixes that
  make tab completion awkward in the heat of gameplay:
  - `cancel-probe`, `cancel-exploit`, `cancel-read`, `cancel-loot`, `cancel-trace` — all
    collapse to `cancel-` on first tab, requiring a second disambiguation
  - `read`, `reboot`, `reconfigure` — all start with `re`
  - `select`, `status`, `store` — all start with `s`
  Consider renaming commands so each has a unique 2–3 character prefix. Approach: audit
  the full verb inventory, sketch a rename table, check for fiction/consistency (names
  should still feel diegetic), update commands + MANUAL.md + any tests that reference
  verb strings.

- **`help` command improvements** — currently exists; could be richer with examples
- **Alert consequence tuning** — trace countdown length, alert escalation pacing
- **Playwright test reliability** — `node.emit('tap')` workaround for synthetic events is fragile; document in CLAUDE.md so it doesn't get rediscovered

---

## Design Questions (Unresolved)

- **Overworld structure** — what links LANs? Star system map? City districts? Planetary internets? Shape of this affects many in-run design decisions.
- **Mission briefing source** — in the overworld, missions come from somewhere (fixers, factions, bulletin boards). Does this affect run structure?
- **What the player *is*** — decker, netrunner, corp agent? Affects flavor, narrative framing, and what "winning" means across runs.
- **Economy scope** — is cash purely a score, or does it buy things between runs? Feeds back into the exploit inventory question.

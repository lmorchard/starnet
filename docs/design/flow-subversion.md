# Flow Subversion — design pillar

**Status:** Vision / north star. Not an implementation plan. Individual slices ship
through their own `docs/dev-sessions/` specs that point back here.

**Origin:** Brainstorm with Les, 2026-06-29. Grows directly out of the un-built
"network as a circuit you splice apart" vision in `docs/SPEC.md` (the router →
audit-collector → security-monitor example, lines ~138–162).

---

## The problem

Today a LAN session is a **per-node extraction grind**: probe → xploit → dump →
fetch → mine, then repeat at the next node. Each node is an independent safe; you
win by emptying every one. The graph is a *container* for loot, not a *system* you
reason about. The hand-authored set-pieces are legible at the wiring level but are
all "do N things to unlock the treasure" gates — more steps, not a different kind of
thinking. Nothing is *running* in the LAN, so there is nothing to read, nothing to
subvert, and no reason to leave a node alone.

## The core move: change what *winning* is

Shift the win condition from **extraction** (empty each node) to **reconfiguration**
(re-wire the running system so value flows to you and alarms don't reach the people
who'd catch you).

> The LAN is a *running machine* with typed data flowing through its edges. You read
> the flows, find the handful of nodes that are load-bearing, and re-route the
> machine. Loot is the *output of a correct subversion*, not a payout collected from
> every box.

This single change resolves four felt problems at once, because they share one root
cause (nothing is running):

| Felt problem | Why it dies under reconfiguration |
|---|---|
| **Grind** | You only touch the few nodes that matter to the flow; most you read and leave alone. |
| **No exploration** | Discovery becomes "what does this node *do*, where does its output go?" — deduction, not tile-reveal. |
| **Not legible** | You can't subvert a flow you can't see, so flow visualization *is* the puzzle readout — legibility becomes load-bearing, not cosmetic. |
| **Nothing to subvert** | The flows themselves are the thing to subvert. |

**Loot-grind survives as dessert.** A correct reconfiguration can *expose* a reward
pocket — e.g. owning a core exposes a bank of fileservers for old-fashioned
dump/fetch. Optional bonus, not the meal. Some objectives (skim) make grind obsolete
entirely: the system pays you on its own clock.

---

## The flow substrate

Edges carry **typed packets**. The connection line itself is **topology only** — it
carries no semantics, because a single edge may carry a *mix* of packet types (a money
artery that also carries audit telemetry is a juicier target than one that carries only
money). All meaning rides on the packets.

### At-a-glance encoding

- **Shape** → packet type (legible with no color perception)
- **Color** → redundant type cue
- **Density / speed** → volume of flow (magnitude)
- **Direction (arrow)** → which way value/alerts travel
- **Dashed / scrambled** → encrypted: a flow you can see *exists* and roughly weigh,
  but can't read until you `SNIFF`/`DECRYPT` it (fog-of-war applied to traffic)

### Packet type inventory (first pass — tune by eye)

| Type | Glyph | Color | Meaning | Acted on by |
|---|---|---|---|---|
| **Money** | ◇ diamond | gold | value moving to a sink — what you skim | `TAP` `SPLICE` `REROUTE` |
| **Data** | ▢ square | cyan | generic payload; loot & credentials ride here | `SNIFF` `THROTTLE` `CUT` |
| **Audit / alert** | △ triangle | red | security telemetry climbing to a monitor; keep it *nominal* | `JAM` `CORRUPT` `INJECT` |
| **Control** | › chevron | amber | commands between nodes (gates, switches, ICE orders) | `SPOOF` `REROUTE` `JAM` |
| **Credential** | ⬡ hexagon | magenta | auth tokens between trusted nodes; capture → key to a node you can't brute | `SNIFF` (capture) → `SPOOF`/`REPLAY` |
| **Encrypted** | ⌗ (dim/dashed) | grey | unread flow — type & contents hidden | `DECRYPT`/`SNIFF` to reveal |

The substrate must be **fully state-encapsulated and serializable** like everything
else (see `CLAUDE.md` State Management). Flows are emitted/consumed by node-graph
operators, so they live in the same runtime as the existing reactive node behavior.

---

## Access: hybrid smash / finesse

Probing a node tells you *how* to get in, and it's one of two paths per node:

- **Smash** — spend a matching brute technique program. The surviving "exploit card"
  notion, reframed as a tool rather than a rock-paper-scissors roll. Smash is loud.
- **Finesse** — the node can't be brute-forced; it only trusts something that flows
  from elsewhere. Capture that (e.g. `SNIFF` a credential two hops upstream) and
  `SPOOF` it in. To own X you first tap Y — the LAN becomes one interlocked puzzle.

Mixing smash/finesse node-to-node is the antidote to "exploit, exploit, exploit":
every node is a small "which approach?" read. **Failure means *noticed*** (feeds the
trace clock), not "roll again."

---

## Programs: a cyberdeck-RAM loadout

Programs are an **equipped loadout, not a draw-and-discard pile** (BBS *Netrunner*
lineage — you choose what to carry into a run). They fill cyberdeck **RAM**; capacity
is an upgrade path. This ties straight into the existing darknet store (buy programs,
fit them into RAM) and gives a clean pre-run decision layer.

Programs are **active tools** that act on the flow board and chain into combos:

| Family | Examples | Acts on |
|---|---|---|
| **Read** | `SNIFF`, `TRACEROUTE`, `DECRYPT` | edges / flows |
| **Move flow** | `TAP`, `SPLICE`, `REROUTE`, `THROTTLE` | edges |
| **Break flow** | `CUT`, `JAM`, `CORRUPT` | edges / nodes |
| **Fake flow** | `SPOOF`/`REPLAY`, `INJECT` | edges |
| **Impose condition** | `BLIND`, `FREEZE`, `DECOY`, `OVERCLOCK` | nodes / global |
| **Smash** | brute techniques (crack a node of class/grade) | nodes |

**The combo is the gameplay** (zero rock-paper-scissors):

> `$CORE` is hardened — no brute works. Probe says it only trusts a token from
> `auth-srv` two hops away. `SNIFF` auth-srv's outbound edge → capture the token.
> `SPOOF` it into `$CORE` → owned. `SPLICE` your `TAP`. Done.

### Economy: noise feeds the trace

Every program play adds **noise/heat** to the *existing* trace clock. Scarcity = your
stealth budget; finding the quietest solution *is* the puzzle. Loud programs (`CUT`,
smash) cost a lot of heat; quiet ones (`SNIFF`, `THROTTLE`) cost little. This unifies
the card economy with the alert system instead of adding a parallel resource.

### Decay narrows to smash only

Card decay survives as flavor but applies **only to smash exploits** — disclosed by
chance on use. Read/flow/condition programs don't wear out.

---

## Objective taxonomy — four operations on one flow

A LAN's win condition is one of several, and each is a different verb against the same
substrate:

| Objective | Flow operation | Tension |
|---|---|---|
| **Loot a star macguffin** | open a path to a guarded sink, grab it | one-shot smash-and-grab |
| **Dismantle (hurt a client)** | cut the load-bearing edges so the machine stops | which cuts kill it vs. reroute around themselves? |
| **Fix a broken system** | complete/restore a failing circuit | can't fix what you haven't read — the best teacher of the whole language |
| **Skim (Superman III)** | tap a money flow, divert a fraction *without breaking it* | greed vs. stealth: skim more = noticed faster; an ongoing clock |

One engine, many session flavors — and far more procgen-friendly than bespoke
unlock-gates: "place a flow + a goal" generates puzzles; "hand-wire a combination
lock" doesn't.

---

## Future hooks (out of scope for the first sessions)

- **ICE damages loadout programs** as an attack — a new threat axis beyond detection.
- **Procedural flow puzzles** — generate objectives by placing flows + goals + a
  threat circuit, the long-term payoff of the substrate.
- **Finesse-access depth** — credential rotation/expiry, multi-hop key chains.

---

## Relationship to existing systems

- **Alert/trace** (`js/core/alert.js`) — the noise economy plugs into this clock;
  audit packets are the visible form of what already trips `recordMonitorAlert`.
- **ICE** (`js/core/ice.js`) — control packets can carry ICE orders; the
  damages-programs hook is an ICE attack.
- **Node-graph runtime** (atoms/operators/triggers) — flows are emitted/consumed by
  operators; this is the natural home, not a new parallel system.
- **Darknet store** — becomes the program shop feeding the RAM loadout.
- **Set-pieces** — today's gate puzzles become *instances* of flow problems.
- **Old extraction loop** — stays intact and playable until the new loop can stand
  beside it. No half-built mechanic replaces it mid-stream.

---

## Session roadmap

Each ships and is testable on its own. The old loop keeps working throughout.

| # | Session | Ships | Risk |
|---|---|---|---|
| **0** | **Flow substrate** | nodes emit/consume typed packets on existing edges; particles render (mixed types/edge); fully state-encapsulated & serializable; preview-harness demo. *No new player verbs.* | Low — pure infra, no balance change |
| **1** | **Flow-acting programs + noise** | `SNIFF` `SPLICE` `TAP` `SPOOF` as loadout items; noise meter wired into the trace clock | Med |
| **2** | **Skim objective + scoring** | one hand-authored financial LAN playable to a payout; win/lose/jack-out | Med — first real validation |
| **3** | **Cyberdeck RAM loadout + store** | pre-run loadout UI, RAM capacity, store reframed around programs | Med |
| later | finesse-access (credentials), more objectives (repair/dismantle), flow fog-of-war polish, ICE-damages-programs, procgen flow puzzles | — | — |

This is **feel-driven** in its visual layer (particle look, density, cadence): build
substrate logic test-first, but tune the *rendering* in a disposable harness with Les
before locking values (per the dev-session feel-driven guidance).

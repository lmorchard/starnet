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

## Anti-tedium arc — heat, verb variants, flows-as-scouting

**Status:** designed, not built (captured from a 2026-06-30/07-01 playtest + design conversation
with Les, mid Session 1). This arc targets the *root* felt problem that seeded the whole pillar —
the `probe → xploit → xploit → xploit → dump → fetch → mine → repeat` grind — and the tension that
surfaced when Session 1's finesse loop risked re-importing that grind as a *prerequisite* to the
elegant part.

**Framing principle — grind ≠ preparation.** Gating a payoff behind *work* is fine; gating it
behind *rote repetition* is the tedium. Grind = repeating a decision-free action (xploit×3 up one
node's ladder). Preparation = a meaningful act that earns the payoff (a scan, a read, positioning).
Every access gate should be a preparation act, not a grind act. First instance already shipped:
**SNIFF is gated on `probed`, not `open`** — one recon act, not the XPLOIT climb (`getProgramActions`
in `js/core/actions/program-actions.js`).

### 1. Two layers — **heat** (fast, decaying meter) feeds **alert** (slow ratchet)

Session 1 shipped `programNoise` as a **monotonic accumulator** (only climbs below trace).
Replace it with a two-layer model:

- **Heat** — a single blurry, unified measure of the *notice* any network activity raises (probe,
  xploit, programs, sweeps — all add heat), which **decays over time**. This is the meter the
  player actively manages. A **burst** spikes it; **spreading the same actions out** lets it cool
  between them and stay under the bar. Pacing is a real playstyle.
- **Alert** — the existing `green → yellow → red → trace` ladder becomes the **ratchet**. When heat
  spikes over a network's (hidden, §2) threshold, it **commits a permanent step up** the alert
  ladder. Alert does **not** decay — an alarm isn't un-rung. Heat is recoverable; alert is not
  (passively).

So heat is the fast, forgiving, felt layer; alert is the slow, sticky consequence. This is one
managed meter (heat) driving the ladder we already have — it honors Session 1's "feed the existing
clock, don't add a parallel resource" principle. It **reverses** Session 1's "noise only escalates"
decision (right for a monotonic accumulator, wrong for decaying heat) → this arc needs a census pass.

**Alert comes down only by subverting security systems** — never passively, and (see §4) *not* via
lie-low. Corrupt the IDS, own + `scrub-logs` the monitor, `cancel-trace` — the existing
security-subversion toolkit becomes the **only** lever on the ratchet. This gives those mechanics a
much stronger reason to exist and **drives a play direction**: get too hot and your only way back
down is to go take out the network's watchers. (Today `scrub-logs`/`lie-low` both cool the grid;
this arc splits their jobs — subversion → alert, lie-low → heat.)

### 2. Heat thresholds are **hidden** (heat is felt, not read)

The player never sees a network's exact heat threshold, and heat itself reads **imprecisely**
(qualitative/blurry, not a bare `NOISE: 6`). Judging how much a network will absorb is a skill.
Later tools might *approximate* a network's sensitivity, but it's never direct knowledge.
(This supersedes Session 1's numeric `NOISE: N` HUD readout — that's provisional to the monotonic
model and gets replaced by an imprecise indicator here.)

### 3. Per-network **heat sensitivity**

The alarm threshold is per-network (threat-grade-scaled, a `balance.js` table like the existing
trace thresholds). A low-threat LAN has a high bar → it can **absorb a burst** (a PROBE-sweep spike
is survivable); a hardened LAN has a low bar → any burst trips it. This is what makes breadth tools
(below) a *situational* choice rather than a strict upgrade.

### 4. **lie-low → active accelerated *heat* cooling** (not alert)

Reframe the existing `lie-low` as *the* action that decays **heat** faster than passive cooling —
you deliberately spend time to shed heat. Because time is itself a cost (ICE keeps moving, the run
clock runs), this turns waiting from dead boredom into a *choice*: eat the time to cool, or push on
hot.

Crucially, under the two-layer model **lie-low no longer lowers alert** — it only cools heat, which
prevents the *next* ratchet. It can't undo a ratchet that already fired. So "does lie-low still help
once we have heat?" → yes, but only as a heat-management tool (avoid the next step-up); to walk back
an alert level you *already* took, you must subvert a security system (§1). This is a change from
today, where `lie-low` calms the grid to green — that alert-calming moves to the subversion levers.

### 5. **Verb variants in the RAM loadout** (breadth / speed / stealth)

Each core verb becomes a *family* of loadout-selectable variants along a small triangle —
**breadth** (one node ↔ sweep), **speed**, **stealth (heat)**:

- **PROBE-sweep** (scan many nodes at once, big heat spike) vs **meticulous PROBE** (one node,
  slow, low heat).
- **Parallel XPLOIT sweep** vs **node-at-a-time XPLOIT**, trading heat/risk for reach.

The RAM loadout decision becomes *"what's my playstyle for this network — meticulous ghost, or
smash-and-grab?"* — a strong pre-run layer that feeds the Session 3 store/RAM economy. Heat is the
shared cost model that makes the tradeoffs bite (breadth = heat spikes, viable only where the
threshold absorbs them or after cooling).

**Cautions:** (a) variants must be **true tradeoffs, not upgrades** — a parallel XPLOIT sweep needs
real shared risk (e.g. one failure trips the whole target set), or it's just "buy it once, always
better." (b) **Multi-node targeting is new UI plumbing** — Sessions 0/1 deliberately avoided
multi-select; a target-set selection model is the non-trivial part.

**Honest scope note:** verb-variants are a *palliative* for the current extraction loop (fewer
keystrokes, more choice) — they don't change what *winning* is. The flow-**reconfiguration** loop
is the structural cure. Both are worth doing; don't mistake shipping SWEEP for fixing the grind.

### 6. **Flows-as-scouting** (the structural cure for exploration grind)

The flow loop is only as un-grindy as the *exploration* that feeds it. Today, finding flows is
gated behind access-climbing (routers reveal at open, firewalls at owned) — so discovery itself is
a grind. Invert it: **traffic on an edge leading into unmapped territory is visible** (its
*existence* and rough volume, type/contents concealed until SNIFFed). Reading the flows then
*directs* exploration — "money's pouring toward something behind that firewall — go find out what" —
replacing "probe everything to map the net" with "follow the load-bearing flows." Deduction, not
grind. (Re-touches the fog-of-war rule Session 1 tightened, so it's a deliberate, tested change.)

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
| **0** | **Flow substrate** | ✅ shipped (#256). Typed packets on existing edges; particles render (mixed types/edge); serializable; preview demo. *No new verbs.* | Low |
| **1** | **Flow-acting programs + noise** | ✅ shipped. `SNIFF` (reveal/decrypt + capture credential) + `REPLAY` (finesse access) as a fixed kit; `programNoise` third alert sensor; finesse-only nodes; numeric NOISE readout. (`SPLICE`/`TAP` deferred to S2; program named `REPLAY` not `SPOOF` — id collision.) | Med |
| **2** | **Skim objective + scoring** | one hand-authored financial LAN playable to a payout; `TAP`/`SPLICE`; win/lose/jack-out | Med — first real validation |
| **3** | **Cyberdeck RAM loadout + store** | pre-run loadout UI, RAM capacity, store reframed around programs | Med |
| **anti-tedium arc** | **Heat + verb variants + flows-as-scouting** | collapse noise → decaying **heat** feeding the alert **ratchet** (hidden thresholds; alert down only via subversion; lie-low → heat cooling); breadth/speed/stealth verb variants in the loadout; flows-as-scouting. See the section above. | Med–High — reverses "noise only escalates", needs census |
| later | finesse-access depth (credential rotation/expiry, multi-hop chains), more objectives (repair/dismantle), ICE-damages-programs, procgen flow puzzles | — | — |

This is **feel-driven** in its visual layer (particle look, density, cadence): build
substrate logic test-first, but tune the *rendering* in a disposable harness with Les
before locking values (per the dev-session feel-driven guidance).

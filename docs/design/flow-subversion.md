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

- **Finesse** (the intended *primary* route) — the node trusts something that flows
  from elsewhere. Capture that (e.g. `SNIFF` a credential two hops upstream) and
  `SPOOF`/`REPLAY` it in. To own X you first tap Y — the LAN becomes one interlocked
  puzzle. Quiet. This is the skill route, run with *equipped gear*.
- **Smash** (the *fallback* — sometimes the sole route) — spray your **disposable
  exploit hoard** at the node until it cracks, runs out of headroom, or runs dry.
  Loud, ammo-hungry, and dumb by default — but always available, and the only way in
  on nodes with no capturable trust path. See **Exploit economy** below.

Most nodes offer both; some are finesse-only (`finesseLocked`, already in the code),
some smash-only. Mixing the two node-to-node is the antidote to "exploit, exploit,
exploit": every node is a small "which approach?" read. **Failure means *noticed***
(feeds the trace clock), not "roll again."

---

## Exploit economy: gear vs. ammo

**Status:** designed, not built (brainstorm with Les, 2026-07-06). This reworks the
current small precious hand-of-cards + per-card decay into **two distinct economies**.
It supersedes the "Smash as a loadout program family" row and the "Decay narrows to
smash only" note below — smash *leaves* the precious loadout and becomes disposable
ammunition; the loadout keeps only the *gear that operates that ammunition well*.

**Why:** the current model treats exploits as scarce, precious, hand-managed cards.
Mass-applying a precious hand across a subnet is incoherent — you'd blow your whole
hand. Auto-matching and mass application only make sense on top of *abundant,
disposable ammo*. Splitting the two also sharpens the smash-vs-finesse duality instead
of muddying it (see **Access** above). Lineage: the `hackcombat` sketch
(lmorchard/sketches-v01) — a pool of ~100 disposable exploits burned through against a
node until it cracked — and the 1990s BBS *Netrunner* (`docs/netrunner.md`): a
RAM-limited cyberdeck of purchased programs, ICEbreaker power-tiers, and Analyzation
recon tools.

### Two layers

- **Layer 1 — Gear (precious, equipped).** The cyberdeck-RAM loadout (below): finesse
  programs *plus* **smash-tooling** — recon/analysis and burn-engine gear that runs the
  hoard better. Store-bought, chosen pre-run, does **not** decay. This is the skill you
  bring. *(Future: ICE can corrupt/damage it — see Future hooks.)*
- **Layer 2 — Exploit hoard (disposable, accumulated).** A large pool (dozens–hundreds)
  grown by **mining** (existing `MINE`), **buying packs** (store), and **looting**.
  Ammunition, not treasure — sprayed and spent, not protected.

### What an exploit is (the match model)

Each exploit carries two dimensions:

- **Rarity** (common / uncommon / rare) — the **hard gate** against a node's grade. A
  hardened S-grade node yields only to rare exploits; a soft F-grade node falls to
  almost anything. (Grade → rarity-chance table, à la the sketch's `exploitChances`.)
- **Type tag(s)** — the **quality signal**. An exploit's type matched against a node's
  probed/`SNIFF`ed vulnerability profile drives *how likely this specific exploit is
  the one*. **Rare exploits can carry multiple types**, so rarity buys both high-grade
  access *and* type-breadth — doubly valuable.

Rarity gates; type steers. Recon (probe/SNIFF/analysis gear) turns "spray blind" into
"spray the right things first."

### The auto-burn loop

Smashing a node fires exploits at it in sequence until one of:

1. **Compromised** — an exploit matches; access rises. Stop.
2. **Ammo exhausted** — the eligible hoard is spent. Stop (access denied).
3. **Heat limit reached** — the run's configured heat ceiling is hit. Stop (bail).

Each attempt **burns/discloses** the exploit (grade-scaled: tough nodes eat ammo fast,
soft nodes barely singe it — the sketch's `disclosureChance`), and each *failed* smash
independently trips the security grid, so a loud burn stacks grid-trips + a heat spike.
Heat (not attrition alone) is the felt cost, tying straight into the anti-tedium heat
ratchet below.

### Gear × hoard synergy (the reason gear matters)

The **selection algorithm** is the gear's job. Baseline (no gear): random spray, blind
to type, wasteful. Better gear (the *Analyzation* family, in *Netrunner* terms):

- fire **best-type-match first**, skipping hopeless-rarity exploits;
- **reveal** a node's vulnerable set so you can hand-pick;
- **reduce heat / burn** per attempt (a better burn engine — *Netrunner*'s
  Icepick→Torch→Flamethrower tiering);
- widen the burn to a **sweep** (the mass rung below).

So recon *feeds* the smasher: probing and SNIFF aren't just for finesse — they make
your dumb fallback smart.

### The verb ladder (where "parallel XPLOIT" lands)

The originally-queued parallel-XPLOIT feature is the **top rung** of one ladder, not a
bolt-on:

1. **Manual** — pick one exploit, one node. Today's `XPLOIT`, preserved as the floor.
2. **Auto-burn** — the loop above, one node. Gear-driven selection.
3. **Mass / xploit-sweep** — the auto-burn propagated across a wave, a `processes.js`
   client (the SWEEP-PROBE seam). Heat scales with breadth; each node resolves
   independently (partial success), so a wide burn with misses is a loud burst — a true
   tradeoff vs. paced single-node work where heat decays between actions.

### Parameterized program runs (shared UX)

Auto-burn, SWEEP, and mass-xploit all take **run parameters** the player sets before
launch — **heat ceiling** (how hard to lean on the door: meticulous ↔ smash-and-grab),
**depth / recursion limit** (SWEEP already has this), and later **aggression** knobs.
This is one shared "configure this run" panel across every progressive process, not a
per-verb afterthought. Thresholds are hidden (heat is *felt*, §2 of the anti-tedium
arc), so the player-set ceiling is a wager, not a solved optimum. The panel's feel is a
candidate for the disposable-lab tuning approach.

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
| **Analysis / smash-tooling** | recon + burn-engine gear that operates the exploit hoard (select, reveal, cut heat, sweep) | the exploit hoard |

The **Analysis / smash-tooling** family is the Layer-1 gear from **Exploit economy**
above — it doesn't crack nodes itself; it makes the disposable hoard's auto-burn smart.
Brute-forcing is no longer a precious *program* you equip; it's the ammunition you
hoard, and the gear is what aims it.

**The combo is the gameplay** (zero rock-paper-scissors):

> `$CORE` is hardened — no brute works. Probe says it only trusts a token from
> `auth-srv` two hops away. `SNIFF` auth-srv's outbound edge → capture the token.
> `SPOOF` it into `$CORE` → owned. `SPLICE` your `TAP`. Done.

### Economy: noise feeds the trace

Every program play adds **noise/heat** to the *existing* trace clock. Scarcity = your
stealth budget; finding the quietest solution *is* the puzzle. Loud programs (`CUT`,
smash) cost a lot of heat; quiet ones (`SNIFF`, `THROTTLE`) cost little. This unifies
the card economy with the alert system instead of adding a parallel resource.

### Decay lives on the ammo, not the gear

Decay/disclosure is now the **exploit hoard's burn mechanic** (see **Exploit economy**):
disposable exploits are disclosed by chance on use, grade-scaled. Equipped gear
(finesse programs *and* smash-tooling) does **not** wear out from use — its only threat
is ICE corruption (Future hooks). This replaces the old "cards decay in your hand"
model wholesale.

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

- **ICE corrupts / damages Layer-1 gear** — a threat axis beyond detection, and the
  stakes that make the precious layer *precious* (lose gear mid-run → fall back to
  spraying the raw hoard). *Netrunner* (`docs/netrunner.md`) has a ready-made model:
  **Corruption** ICE leaves a program working but *crashing intermittently*
  (probabilistic degradation); **Wraith/Vampire** drain a program's strength until it's
  deleted; a **Diagnostics** program reveals which gear got hit. Deferred to its own
  session (see the exploit-economy decomposition).
- **Store virus risk** — bought warez carry a small chance of a rogue/corrupted payload
  (*Netrunner*'s brokers), a spice for the darknet store once gear-corruption exists.
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

- **PROBE-sweep** ✅ **shipped** (verb variants pt.2) — a progressive, depth-bounded, abortable
  broadcast probe that ripples outward wave-by-wave, gate-bounded (stops at routers/firewalls/IDS/
  monitors), heat per node. vs **meticulous PROBE** (the existing one-node scan). Built on a **generic
  progressive-process seam** (`js/core/processes.js`: `state.processes` + a type registry + one
  `stepProcesses()` hook in the central tick + uniform busy/abort) — so it needed *no* bespoke timer
  or abort special-case, and the remaining variants plug into the same registry.
- **Parallel XPLOIT sweep** vs **node-at-a-time XPLOIT** — *pending*, and now folded into the
  **Exploit economy** rework (above): it's the **top rung of the auto-burn ladder**, an xploit-sweep
  that rides the SWEEP-PROBE `processes.js` seam. Because it's an *xploit-sweep* (propagates like
  SWEEP, no manual multi-select), it sidesteps the multi-node-targeting UI that used to be the
  hard part.

The RAM loadout decision becomes *"what's my playstyle for this network — meticulous ghost, or
smash-and-grab?"* — a strong pre-run layer that feeds the Session 3 store/RAM economy. Heat is the
shared cost model that makes the tradeoffs bite (breadth = heat spikes, viable only where the
threshold absorbs them or after cooling).

**Design decisions (2026-07-06):** (a) the parallel XPLOIT tradeoff is **heat-scales-with-breadth**,
not all-or-nothing — each node resolves independently, but a wide burn charges heat per node *and*
each failed node trips the grid, so bursting is a loud spike vs. paced single-node work where heat
decays between actions. (b) Target selection is the **xploit-sweep** (propagating) model, so the
multi-select UI Sessions 0/1 avoided is not needed.

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
| **E1** | **Exploit economy — hoard + auto-burn (one node)** | disposable exploit hoard (rarity + type tags, multi-type rares); auto-burn loop with heat-ceiling stop; store sells packs, `MINE` feeds the hoard; today's hand-of-cards UI → hoard + burn. See **Exploit economy** above. *First buildable session of this thread.* | High — reworks core combat + card UI + store; census pass |
| **E2** | **Smash-tooling gear** | Analysis-family selection/recon/burn-engine gear in the RAM loadout that makes auto-burn smart (best-match-first, reveal, cut heat). Folds into Session 3's loadout/store work. | Med |
| **E3** | **Mass xploit-sweep** | the auto-burn as a `processes.js` client, propagating like SWEEP; heat-scales-with-breadth. Cheap once E1+E2 land. | Low–Med |
| later | finesse-access depth (credential rotation/expiry, multi-hop chains), more objectives (repair/dismantle), **ICE corrupts/damages gear** (+ store virus risk), procgen flow puzzles | — | — |

This is **feel-driven** in its visual layer (particle look, density, cadence): build
substrate logic test-first, but tune the *rendering* in a disposable harness with Les
before locking values (per the dev-session feel-driven guidance).

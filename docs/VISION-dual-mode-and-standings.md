# Vision — Dual-Mode Play and the Standings Constellation

This is a **forward-looking design vision, not scheduled work.** It captures a
brainstorm about where Starnet's gameplay could grow once the single-mode
intrusion prototype is stable: a second mode of play (network defense), a
reputation system that defines the player's stance, and an overworld sandbox
that ties them together. Nothing here is committed to a milestone. The last
section — *What This Means for the Prototype Now* — is the part that should
influence near-term code; everything above it is direction.

Seeded by a question: should the game have a **residential biome** where the
player infiltrates consumer-grade home and apartment networks? Following that
thread to its honest conclusions reshaped it into something larger.

---

## The Seed and Its Problem

The residential-biome idea has an obvious version that is also a bad version:
the player raids ordinary people's homes for loot. Two problems stack:

- **Tonally**, it changes who the player *is*. The current fiction is
  heist-flavored — you hit corps, governments, syndicates. They have it coming.
  Routinely robbing apartments turns the player into someone who mugs grandma's
  smart fridge. That is a valid cyberpunk register, but it should be chosen on
  purpose, not backed into.
- **Mechanically**, a single home is low-yield and repetitive — a phone wallet,
  some media, maybe a compromising document. "Probe → exploit → fetch crumbs" is
  a worse version of the loop we already have. The grimness wouldn't even buy
  good gameplay.

The stronger versions of the idea reframe what a home *is* in the world:

- **Homes as infrastructure, not targets.** Real intrusion doesn't rob home
  routers — it *recruits* them as relays, cut-outs, and staging points. A
  compromised consumer net becomes plumbing the player uses to reach real
  targets. The family may never know. This plugs straight into the **tether /
  cut-out node** mechanics already sketched in `SPEC.md` but never built.
- **Homes as the arena for a defense loop.** A net you can break into is a net
  you can also *harden*. That inversion is the second mode below.
- **Homes as where the world's damage is visible** — cheap ICE on every
  appliance, nets accumulating sprites and daemons like digital mold from
  psychic bleed. The residential biome is the window onto the human cost of a
  galaxy in permanent cyber-conflict.

---

## The Core Idea: Two Seats, One Engine

The whole engine is already an **attacker simulator**: the bot-player traverses
a graph, reads access level and visibility and vulnerabilities, probes,
exploits, loots, trips ICE and the trace. A defense mode does not need a new
engine. It needs to **flip which seat the human occupies**.

- **Today** — human = attacker, ICE = autonomous defender, bot = test harness.
- **Defense mode** — human = defender (place and upgrade ICE, patch
  vulnerabilities, shape topology, deploy sprites as roaming hunters), and the
  **bot becomes the attacker**.

The defense loop inverts the heist loop cleanly:

```
heist:    probe  →  exploit  →  loot
defense:  audit  →  patch    →  harden / evict
```

This plays somewhere between **tower defense** (build between waves, watch the
attackers come) and **Dungeon Keeper** (build a lair, lure intruders in, and
possess your own defenders to fight them directly). The far-future version
unifies both seats: if the human can **drop into a net and act directly during a
defense**, the attacker engine and the defender engine are the *same engine seen
from two seats* — bot in one chair, human in the other, human able to hop. That
is the ambitious end state and is explicitly spec-land, not a near-term build.

### The bot-as-adversary payoff

Turning the bot-player into the human's opponent converts a **QA tool into a
content engine**, and it dogfoods balance for free: tuning the bot to be a fun
adversary is the same work as tuning attacker difficulty in the existing mode.
Distinct bot strategies become distinct attacker archetypes — smash-and-grab,
methodical, stealthy — that the player learns to read and counter.

---

## Two Framings, Same Mechanics

The tower-defense / Dungeon-Keeper split is not just mechanical — it is a *moral
seat*, and the player should be able to sit in either:

- **Protector seat (white hat).** You harden *someone else's* net against
  attackers — a client's home, a hospital, a frontier co-op. Protect the core.
- **Keeper seat (black hat).** Dungeon Keeper is famously the villain's chair.
  You defend **your own** compromised infrastructure — the home nets you
  recruited into a botnet, your loot cache — from rival deckers and the law.
  Lure them in, trap them, crush them.

**The mechanics are identical; only the fiction differs.** Defend a client's
net = white. Defend your hoard = black. We never have to build two defense
systems — and *which framing you are in* becomes the interesting part, read off
the standings system below. This is the answer to "what is the player": not a
fixed archetype, but a drifter whose choices accumulate into a reputation.

---

## Standings: a Constellation, Not an Axis

The stance system should be **Fallen London / StoryNexus-style qualities**, not
a single white↔black slider. A slider would force a false tradeoff — every point
toward white costing a point of black. Reputation doesn't work that way.

**Standings are independent, and they are geographic.** You can be — at the same
time — a trusted white-hat contractor to the Martian corps, underworld royalty
in a Belt syndicate, and an unknown on a frontier world you've never touched.
Some pairs lock each other out (two syndicates at war: standing with one burns
the other), but most don't. The friction of holding incompatible standings at
once *is* gameplay — the corp that hired you to harden their net would be very
interested to learn who else you work for.

This gives the multi-planetary setting a mechanical reason to exist. The galaxy
map becomes a **reputation topology**. The Panic's slow physical travel even
matters: your reputation outruns you by ansible, but your *body* doesn't — so a
world where you're hot is a world you physically avoid.

The StoryNexus mapping onto pieces we already have is nearly one-to-one:

| StoryNexus concept | Starnet equivalent |
|--------------------|--------------------|
| Skills (Watchful / Shadowy) | **Intrusion** (attack craft) vs **Hardening** (defense craft) — competencies grown by doing |
| Menaces (Suspicion / Nightmares) | **Heat** / **True-Name exposure** — already half-built as the trace mechanic and the SPEC "True Name registry"; when too high, diverts you into lay-low / burn-identity recovery content |
| Connections (faction standing) | Place-scoped standings with corps, syndicates, the law, a white-hat guild / CERT-analog, darknet brokers, machine-elf weirdness |
| Storylets gated by qualities | Missions, contracts, and consequences that open and close based on your standings |

The qualities layer is the **keystone**: it makes "drifter in a constellation of
standings" mechanically real, and it *is* the world/progression structure — the
thing that decides which missions and consequences are available.

---

## The Overworld Sandbox

How do the two modes interleave? Not by one rule — by sitting together in one
overworld sandbox. Three kinds of scenario coexist, all feeding the same pool of
standings and persistent assets:

- **Job board.** Attack jobs and defense jobs you pick from, gated by your
  standings.
- **Consequence loop.** You attack and *take over* a net — and what you took
  becomes something you must *defend* when rivals and the law come for it.
  Attack creates defense obligations. This is the qualities engine in motion:
  owning infrastructure is a quality that surfaces defense storylets and attracts
  Heat.
- **Self-directed wandering.** Explore an overworld region, take targets of
  opportunity, claim bounties, and **leave behind installations** — tether-
  redirect nodes you might later need to defend, or deliberately let die as
  decoys.

That last item is the synthesis. "Leave installations you might defend or
sacrifice as decoys" unifies several long-standing threads:

- It is the **cut-out node / convoluted-tether** mechanic from `SPEC.md`, finally
  given a strategic home.
- It is **homes-as-infrastructure** — installations are *why* you touch consumer
  nets, which dodges the grim "rob grandma" problem entirely.
- It is the **bridge between modes** — an installation is an asset, and an asset
  is a thing that can be attacked, which is a defense scenario waiting to start.

Job board, consequence loop, and target-of-opportunity wandering are just
different *reasons* a scenario begins. Underneath, one engine, one standings
constellation, one map of persistent stuff you own and care about (or don't).

---

## What This Reuses

This vision is ambitious but not from-scratch. It leans on systems already built
or already sketched:

- **Bot-player** → the attacker AI for defense mode (see `docs/BOT-PLAYER.md`).
- **ICE model** → the towers/minions the defender places and upgrades; the
  multi-instance data-driven model in `docs/ICE.md` already anticipates variant
  ICE types, including a reverse-access "Defender ICE."
- **Trace / alert system** → the Heat menace, mostly already in code.
- **Darknet broker** → mirror it with a white-hat market (sell hardening, collect
  bounties); the buy-exploits economy already exists.
- **Tether / cut-out nodes** → the persistent installations strewn across the
  overworld.
- **Procedural generation** (`docs/PROCGEN.md`) → residential biome as a node
  palette + set-piece pool, the same way corporate biomes are planned.

---

## What This Means for the Prototype Now

A vision doc that only describes the future never earns its keep. None of the
above should be *built* yet — but a few cheap affordances now keep these doors
open without committing to any of it:

- **Keep game state extensible for per-faction, per-place standings.** Don't bake
  in an assumption that reputation is a single scalar or globally scoped. Even if
  we never read it yet, leave room in the state shape for a map of
  standing-by-faction-by-place.
- **Keep the engine seat-agnostic where it's free to be.** When adding mechanics,
  prefer phrasings that don't hardcode "the human is the attacker." The action
  dispatcher and ICE model are the places this matters most.
- **Assume cross-run persistent state will exist.** Installations, standings, and
  exploit inventory all imply a meta-layer above the single run. Don't design
  in-run systems that would be hostile to being saved and carried forward.
- **Treat the residential biome, if built first, as infrastructure not loot.**
  The fun, non-grim version of homes is "borrow their pipes," and it is the entry
  point to everything else here.

These are guardrails, not tasks. The point is to avoid foreclosing the vision
with a cheap assumption we'd have to tear out later.

---

## Open Questions

- **Mode weight** — is defense a co-equal mode, an occasional set-piece, or the
  eventual main event with the heist loop as its tutorial?
- **Standings granularity** — how many factions, how many places, before the
  constellation becomes noise instead of texture?
- **Defense-mode tempo** — pure tower-defense (set up, watch, minimal
  intervention) vs active Dungeon-Keeper possession. The latter is more fun and
  more complex; the former is buildable sooner.
- **Mutually-exclusive standings** — which faction pairs lock each other out, and
  is that authored or emergent from a syndicate-relationship model?

---

*Based on an original game concept by Les Orchard. Captured from a brainstorming
session, 2026-06-10. Influences: Fallen London / StoryNexus (qualities and
storylets), Dungeon Keeper (the keeper's seat), tower-defense, and Vernor Vinge's
"True Names" (identity as the central stake — see `SPEC.md`).*

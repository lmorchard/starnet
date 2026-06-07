# Core Loop Reassessment — State of the Project & Direction

**Status:** analysis / direction (no code changes)
**Date:** 2026-06-05
**Author:** Les + Claude
**Framing:** Les's call — "I think we've gotten a bit over our skis with work on
procedural generation and automated playtesting. We need to step back and
consider more basic gameplay before proceeding to more complex levels."

This document is a deliberate pause. It assesses where the project actually is,
backs the assessment with evidence from the running game, diagnoses the core
problem, and proposes a direction. **It defers implementation** — nothing here
is built until the direction is reviewed.

---

## 1. Method

This isn't a vibes assessment. The findings below come from:

- Reading the 43-session dev-session log, `SPEC.md`, `BACKLOG.md`,
  `BOT-PLAYER.md`, and the ICE reinvention vision spec.
- Measuring code mass per subsystem (`wc -l` across module groups).
- **Running the bot census** (`node scripts/bot/census.js --seeds 20`) for a
  current balance snapshot.
- **Running verbose playthroughs** (`node scripts/bot/cli.js --verbose`) to watch
  the failure mode directly.
- Reading the core-loop source (`combat.js`, `exploits.js`, `loot.js`, `ice.js`)
  and the intro network meta (`data/networks/corporate-foothold.js`).

---

## 2. Where the code actually went

| Subsystem | LOC | Role |
|---|---|---|
| `js/core/node-graph/` | 6,340 | The reactive engine — genuinely valuable foundation |
| `js/core/network/` (generate/skeleton/set-pieces) | 3,450 | Procedural generation |
| `scripts/bot/` | 1,585 | Deterministic playtest bot + census |
| **`combat.js` + `exploits.js` + `loot.js` + `alert.js`** | **934** | **The actual core loop** |
| `js/core/ice.js` | 275 | Singleton ICE (the only adversary) |
| **Total `js/`** | **~19,500** | |

**The shape of the problem in one table:** roughly **7× more code generating and
automating the playing of networks than the loop that makes playing one
worthwhile.** The engine architecture is good and the infrastructure work is
real — but breadth has consistently outrun depth.

The trajectory confirms it. Of the last ~25 sessions, nearly all were
infrastructure or content-generation: procgen wings/biomes/sub-biomes, scattered
set-pieces, network branching + tuning, Lit web components, the visual preview
harness, action-context cleanup, command-prefix sweeps, bot rebuild + census.
Very few touched whether **one network is fun to crack.**

---

## 3. Evidence: the core loop does not currently hold up

### 3.1 Census snapshot (20 seeds, default C/B/C/C generated networks)

```
successRate            0.30
failReasons            { stuck: 14 }
avgNodesOwned          3.35   (of avgNodesTotal 20.1  → ~17% cracked)
peakAlertDistribution  { green: 19, yellow: 1 }
avgIceDetections       0
avgIceEvasions         0
```

Two facts dominate:

1. **70% of runs end "stuck"** — not lost to tension, *abandoned*. The bot
   cracks ~17% of the network and runs out of moves.
2. **The pressure systems are inert.** Alert stays green; ICE never detects, never
   forces an evasion. The "two-layer alert system + IDS subversion puzzle" that
   `SPEC.md` calls the heart of the dungeon has nothing to push against.

### 3.2 Verbose playthrough — the death spiral

A single run narrates the exact failure: the bot exhausts usable cards, sits at
`cashRemaining: 0` so it *can't* restock at the darknet broker, and quits with
most of the network untouched (`failReason: "stuck"`, `nodesOwned: 4 / 12`).

### 3.3 The mechanic underneath it — a non-operational economy stub

**Important reframe (Les, this session):** the card economy is *deliberately
stubbed*, not accidentally broken. The full economy — acquiring and preparing an
exploit loadout — is intended to be the **overworld meta-loop between runs**. The
darknet store is the **in-run stub for that entire overworld.** So the bug is not
"the economy is unbalanced." The bug is **the stub is provisioned so thinly that
it's non-operational, and the in-run loop starves before network hacking can be
evaluated at all.**

Reading `exploits.js` / `combat.js` makes the starvation legible:

- **Starting hand** is ~4–6 cards (`["common","common","uncommon","uncommon"]`
  on the intro network). Each card targets only **1–3 specific vuln types** out
  of **15**.
- **Nodes** carry 2–4 vulns drawn from those 15 types. So the chance your hand
  *matches* a given node's vulns is moderate at best.
- **Match matters enormously.** Success = `quality × gradeModifier (+0.4 if
  matched)`. A common card (quality 0.2–0.55) blind against a C node
  (modifier 0.5) is a **10–27%** roll; matched it jumps to **50–67%**.
- So unmatched nodes force low-odds gambles that **burn card uses fast** (commons
  have 3 uses), and cards only replenish at the darknet stub…
- …which **the player can't reach**: it costs **100–500 cash**, cash comes from
  **looting owned nodes**, and **you can't own nodes without working cards.** The
  intro network starts at `startCash: 0`. **The one overworld stub we built is
  unreachable, so it's never actually exercised.**

And every procgen feature makes *bigger* networks — widening the gap between
cards-you-have and locks-you-face. **With the stub non-operational, procgen has
been scaling up a loop that can't be supplied.**

### 3.4 The adversary is absent from onboarding

`corporate-foothold.js` (the intro network) has `meta.ice: null`. The generated
networks place ICE where it never engages (census: 0 detections). So a new
player's first experience contains **none** of the tension the design is built
around — and we have no validated baseline for what "ICE creates good pressure"
even feels like.

---

## 4. Diagnosis

Three problems, in priority order:

1. **The economy stub is under-provisioned to the point of being
   non-operational.** Card supply (starting hand + the darknet stub) never closes
   against vulnerability demand because the stub is unreachable at `startCash: 0`.
   This is *not* an economy-balance problem to solve here — the real economy is
   future overworld work. It's a provisioning problem: the in-run loop must be
   supplied generously enough that **"couldn't crack it" is never a supply
   failure**, only a puzzle/pressure failure. Today the bot stalls at ~17% on
   supply starvation, and a human fares only somewhat better.

2. **The adversarial half of the game doesn't fire.** ICE/alert/trace are tuned
   (or placed) such that runs end in "stuck," not "caught." Until losses come
   from *pressure*, the dungeon has no tension to balance against.

3. **We've mistaken motion for progress.** ~40 sessions of real, well-built work,
   almost none of it answering "is one network fun?" The ICE reinvention vision
   (an 8-session roadmap that would ~10× the adversary code) is the apex of this:
   making a system *richer* before it's *load-bearing*.

Les's instinct to step back is correct and the evidence is unambiguous.

---

## 5. Decisions taken in this session

- **Shelve the ICE reinvention vision** (`docs/dev-sessions/2026-04-24-1243-ice-reinvention/`)
  until the core loop is validated. It remains a good document; it's just not
  next. Its session-1 branch (`ice-reinvention-session-1`, unmerged) stays parked.
- **Keep the scripted bot + census** as the regression gate. It is doing its job —
  it produced this entire diagnosis in seconds, deterministically, for free. The
  framing "drop the bot" was reconsidered: the bot and an LLM playtester are
  *complementary*, not substitutes (see §6).
- **Freeze procgen breadth.** No new wings/biomes/set-pieces/scatter-groups until
  the loop is fun on a small hand-crafted map.
- **In-run binding constraint = puzzle + pressure, not economy** (Les's call).
  Cards/cash are provisioned to be effectively abundant in-run; the *entire*
  economy challenge is deferred to the future overworld. The job of the next
  session is to make routing, IDS subversion, ICE evasion, and the trace race the
  things that decide a run.

---

## 6. On the LLM playtest agent

Les raised replacing the bot with an LLM-based agent loop. The refined position:

- **The scripted bot** is a deterministic, free, 50-seeds-in-seconds **regression
  gate.** It answers *"did a change move the numbers?"* It cannot judge fun.
- **An LLM agent** answers the *qualitative* questions we actually care about now:
  *Is this fun? Is the IDS-subversion puzzle legible? Would a thinking player feel
  the trace as tension? Where do they get confused?* The console is already
  designed to be LLM-legible (a stated design principle in `CLAUDE.md`), so the
  harness is cheap to build.
- **They are complementary.** Keep both.

**But build neither next.** Neither tool fixes the loop — they describe it. The
LLM playtester earns its keep *after* a deliberate core-loop fix gives it
something worth judging. Sequencing the LLM agent before the fix would just
generate richer descriptions of a known problem.

---

## 7. Proposed direction (next session — not built yet)

A focused **core-loop tuning session** on **one or two hand-crafted networks**,
procgen and ICE-reinvention frozen, aimed at two measurable goals:

### Goal A — provision the economy stub so supply is never the wall
Make card/cash supply generous enough that a competent player can crack
~80–100% of a small network, and **no run ends "stuck" on supply.** Chosen levers
(Les):

1. **Starting cash + a functioning darknet.** Give the intro network meaningful
   `startCash` so the darknet stub actually works: hit a node you can't crack →
   go buy the matching exploit. This exercises the one overworld stub we already
   built (currently dead at `$0`).
2. **Bigger / smarter starting hand.** Larger hand and/or hand seeded to cover
   the network's actual vuln mix, so early nodes have matches without a store trip.
3. **NEW — `research` / `pentest` action on owned nodes.** An in-run action that
   has a chance to generate a new exploit card scaled by the node's grade. It
   **takes time and makes noise, so it can attract ICE**; some node types/grades
   are better to grind than others. This is the key design move: it makes card
   acquisition an **activity that feeds the pressure systems** rather than an
   economy decision — closing the card↔cash chicken-and-egg without invoking the
   overworld, and routing the "no matching card" escape hatch through *time +
   exposure* instead of a wall.

   **Two acquisition channels, two currencies:** darknet = spend looted *cash*
   (fast, safe); research = spend *time + risk* (no cash, but the trace clock
   bleeds and ICE may arrive).

   **Grind guardrail — two complementary limiters:**
   - **Per-node diminishing returns (primary).** Track an attempt count as
     per-node state; success chance decays with each attempt, on a curve scaled
     by node grade — **higher-grade nodes can be pentested more times** (richer
     targets). This is *pressure-independent*: even with zero ICE a node taps out,
     so the mechanic is robust the moment Goal A ships, before any Goal B tuning
     exists. Emergent property: the best card sources are the most dangerous
     nodes, so keeping supply flowing pushes the player into high-grade territory
     where pressure bites — reinforcing the loop instead of sidestepping it. (It
     also stacks with the grade↔card-quality link: richer targets yield *more*
     attempts *and* better cards.)
   - **Trace/ICE (secondary).** Each attempt costs time and makes noise, so
     grinding bleeds the trace clock and can draw ICE — a temporal limiter on top
     of the spatial one.

   *Design knobs for the dedicated spec:* hard attempt-cap vs. soft decay rate
   (lean soft decay with effective tap-out below ~5%); attempt count strictly
   monotonic per run (lean yes — clean serializable per-node state); diminishing
   odds legible to the player via log/status (per the "everything visible is
   logged" principle).

   This action gets a full brainstorm + spec **as phase 2 of the tuning session**
   (see §7.1), not designed in full here.

### Goal B — make pressure actually fire
With supply provisioned, runs will last long enough for pressure to matter. Tune
ICE/alert/trace on the same small network until the **census shows losses to
*trace* and *ICE*, not *stuck*.** That's the signal the dungeon has working
tension. Includes giving the intro network real (gentle) ICE rather than `null`.
Goals A and B are one arc: A must land first (so there's a live run for pressure
to act on), then B is tuned against it.

### 7.1 Session phasing

The tuning work is **one session in three phases**, validated by census at each
boundary. **Target: two hand-crafted networks** — `corporate-foothold` plus one
more — so tuning doesn't overfit a single topology.

1. **Phase 1 — Provision supply.** `startCash` + functioning darknet + smarter
   starting hand on both networks. Done when no run ends `stuck` on supply.
2. **Phase 2 — `research`/`pentest` action.** Full brainstorm + spec (its own
   `spec.md` artifact within the session), then implement: the action,
   per-node diminishing-returns model, `pentestAttempts` field on `NodeState`,
   log/status legibility. **Teach the bot a minimal `research` heuristic here** so
   it can use the escape hatch and stays a meaningful gate (per the "keep the bot
   working" rule in `CLAUDE.md`). Update `MANUAL.md`.
3. **Phase 3 — Pressure tuning.** Tune ICE/alert/trace on both networks (and give
   `corporate-foothold` real but gentle ICE instead of `null`) until census losses
   are dominated by `trace`/ICE, not `stuck`.

### Definition of done
- Census on both tuned networks: success driven by skill, failures dominated by
  `trace`/ICE rather than `stuck`; `nodesOwned/nodesTotal` ratio high for
  successful runs.
- The updated bot can complete both networks (it stays a meaningful gate), and a
  human can play start-to-finish with decisions that feel meaningful.
- `MANUAL.md` updated for any mechanic changes.

Only after that: revisit the LLM playtester, then procgen, then ICE reinvention —
each now scaling something that actually works.

---

## 8. Open questions for Les

**Resolved this session:**
- *In-run binding constraint* → **puzzle + pressure**; economy deferred to overworld (§5).
- *Supply mechanism* → starting cash + functioning darknet + smarter hand + new
  `research`/`pentest` action (§7 Goal A). Passive loot-as-cards is **not** the
  chosen route — the active, risk-bearing research action is preferred.
- *Session scope* → A then B as **one arc**, A landing first (§7 Goal B).

**Also resolved:**
- *Number of networks* → **two** (`corporate-foothold` + one more), to avoid
  overfitting a single topology (§7.1).
- *Bot's role / target difficulty* → **teach the bot a `research` heuristic in
  phase 2** so it stays a meaningful gate; the tuned networks should be
  bot-completable (§7.1 Definition of done).

All forks are now resolved; nothing in §8 remains open.

## 9. Deferred (unchanged, parked behind the tuning session)

- ICE reinvention (`docs/dev-sessions/2026-04-24-1243-ice-reinvention/`)
- Procgen population / tuning
- LLM playtester
- **Residential biome as the gentle content tier** — unmerged `residential-biome`
  branch is procgen-entangled; revisit once the loop is tuned and the procgen
  freeze is intentionally lifted. (See plan.md Phase 1 note.)

The `research`/`pentest` action is **not** parked here — it's phase 2 of the
tuning session (§7.1), with its own brainstorm + `spec.md` artifact authored when
that phase begins.

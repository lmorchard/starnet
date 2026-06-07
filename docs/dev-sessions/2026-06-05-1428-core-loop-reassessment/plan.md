# Plan — Core-Loop Tuning Session

Execution plan for the direction set in `spec.md`. One session, three phases,
census-validated at each boundary, across **two networks**: `corporate-foothold`
(gentle, no ICE) + `corporate-exchange` (hard, grade-B ICE, A-grade firewall+vault).

## Baseline (honest, post-census-fix, 30 seeds each)

> **Note:** the first baseline taken this session was corrupted by the cross-run
> listener leak (fixed in PR #112 — `tests/headless-run-isolation.test.js`). It
> reported foothold 0.05 / 0.55-owned and exchange 0.05 / 1.95-owned. Those
> numbers were garbage (every census seed after the first ran under stacked
> handlers). The table below is the real baseline, measured with the fix in place.

| Network | success | dominant fail | nodesOwned/total | ICE detect | peak alert |
|---|---|---|---|---|---|
| corporate-foothold | 0.267 | stuck 22 | 5.17 / 12 | 0 | 10 green / 20 yellow |
| corporate-exchange | 0.567 | tick-cap 11, stuck 2 | 8.10 / 14 | 0.5 | 25 green / 5 red |

Reading: **corporate-exchange is already fairly healthy** (57%, two-rare hand +
`startCash: 200`); its non-successes are mostly `tick-cap` (bot times out, not
hard-stuck) — a phase-3 efficiency/pressure question, not supply.
**corporate-foothold is the supply-starved one** (27%, `startCash: 0`, no ICE):
it owns ~43% of nodes then stalls because it can't loot cash without owning nodes,
can't own nodes without matching cards, and can't buy cards without cash. Phase 1
targets foothold first.

---

## Phase 1 — Provision supply ✅ DONE

**Outcome:** `corporate-foothold` `startCash: 0 → 1000` (27% → 100% bot success,
0 stuck). Exchange left at 200 — its bottleneck is pressure/efficiency, not supply
(bumping its cash made it worse). See `notes.md` for the sweep + reasoning.

**Goal:** no run ends `stuck`/`tick-cap` on *supply*. Make supply abundant enough
that failures become puzzle/pressure failures.

**Levers (smallest-change-first):**
1. **`startCash`** (highest leverage) — give both networks enough to prime the
   pump and use the darknet when blocked. Catalog prices: common 100 / uncommon
   250 / rare 500. Start with a budget covering several common buys; tune by census.
2. **Starting hand** — enlarge and/or bias toward common-heavy coverage so early
   nodes have matches without an immediate store trip. (Cards target only 1–3 of
   15 vuln types; a 4-card hand covers too little.)
3. **Confirm the darknet stub actually fires for the bot.** The `cards` heuristic
   buys a matching card when nothing matches *and it can afford it*. Baseline had
   `startCash: 0`, so this path was never exercised. Verify with census that, given
   cash, the bot buys and progresses. If the bot has cash but still stalls, the
   bug is in the buy heuristic / store wiring, not the economy.

**Files:** `data/networks/corporate-foothold.js`, `data/networks/corporate-exchange.js`
(meta `startCash` / `startHand`); possibly `js/core/store-logic.js` /
`scripts/bot/heuristics/cards.js` only if step 3 surfaces a wiring bug.

**Tuning loop:** change → `node scripts/bot/census.js --seeds 20 --network <net>` →
read fail-reason distribution → repeat. **Acceptance:** `stuck`/`tick-cap` no
longer the dominant fail reason on either network; `nodesOwned/total` climbs
substantially.

**Note on gentle-tier content (Les):** the eventual gentlest networks should live
in a **residential biome** (home IoT, appliances, smart-home, phones-with-wallets
— per `SPEC.md`). Prior work exists on the unmerged `residential-biome` branch,
but that branch is **procgen-entangled** (reworks assemble/budget/generate/
skeleton/slot-filler/validate) — merging it is a procgen-breadth decision, which
this session has frozen. **Decision:** tune mechanics on the existing hand-crafted
corporate networks now (mechanics are flavor-agnostic); residential is where the
*validated* gentle-tier mechanics get applied as content, in a later session that
revisits the procgen freeze. Parked in §9.

---

## Phase 2 — `research` / `pentest` owned-node action

Its own brainstorm + `spec.md` artifact in this session dir, then implement.
Covers: the action, per-node grade-scaled diminishing-returns model
(`pentestAttempts` on `NodeState`), time cost + noise/ICE-attraction, card-quality
vs. grade curve, log/status legibility. **Teach the bot a minimal `research`
heuristic** so it can use the escape hatch and stays a meaningful gate. Update
`MANUAL.md` and `js/core/types.js`. Census after: bot still completes both nets.

---

## Phase 3 — Pressure tuning

Give `corporate-foothold` real but gentle ICE (currently `null`). Tune
ICE/alert/trace on both networks until census **losses are dominated by
`trace`/ICE, not `stuck`/`tick-cap`**, and ICE detections > 0. Investigate the
`traceFired` stat discrepancy (reads high while alert stays green) as part of this.

## Definition of done (session)

- Both tuned networks: success driven by skill; failures dominated by trace/ICE.
- Updated bot completes both (meaningful gate); a human run feels meaningful.
- `MANUAL.md` current; `make check` green; `make census` shows no supply-starvation.
</content>

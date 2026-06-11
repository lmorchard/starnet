# Spec — Health + Deck loss clocks (foundation)

**Issue:** #133 — Player health + deck-integrity pools + damage atoms (loss-clock foundation)
**Branch:** `worktree-health-deck-damage` (worktree off `main`)
**Companion follow-on this session:** #134 (plasma hallucination overlay) — designed separately after this lands.

## Problem

ICE-reinvention session 1 (merged in #108) shipped the **data layer** for player
resource pools, but nothing makes them real in play:

- ✅ `player.health` / `player.deckIntegrity` pools (`{current, max}`, default 100)
- ✅ Clamped mutators + `player-orchestration` wrappers that end the run:
  `burned` (health→0) / `bricked` (deck→0). `RunOutcome` already includes both.
- ✅ `damage-health` / `damage-deck` effect atoms calling `ctx.damagePlayerHealth/Deck`
- ✅ Unit + orchestration test coverage

What's missing — the half that makes it a real mechanic:

1. **Effects never fire in a live tick.** `triggerDetection()` in `ice/runtime.js`
   calls `recordIceDetection()` directly and never reads the instance's declared
   `effects[]` list. The trigger→effect dispatch is unwired; the atoms are decorative.
2. **No ICE deals damage.** Only the classic per-grade presets exist, all
   `raise-alert`. Generation spawns exactly one hardcoded `standard-ice` and does
   not consult the type registry.
3. **Zero player visibility.** HUD doesn't show the pools, `status` doesn't print
   them, no log entry on damage. Invisible loss clocks violate the legibility
   requirements (every event gets a log entry; console must be LLM-legible).

## Scope (this session)

A bounded slice of the reinvention's §8 dispatcher — enough to make health/deck
real, without building the full pattern-driven movement engine (a later session).

### 1. Effect dispatch at the detection trigger

In `ice/runtime.js` `triggerDetection(nodeId)`:

- Resolve the detecting instance's type via `getType(instance.typeId)`.
- For each entry in the type's `effects[]`, call
  `getEffect(atom).apply(instance, state, ctx, params)`.
- `ctx` exposes:
  - `propagateAlertEvent(nodeId)` → routes to the existing `recordIceDetection`
    / IDS path (so `raise-alert` flows through the atom, not a hardcoded call)
  - `damagePlayerHealth(n)` / `damagePlayerDeck(n)` → the `player-orchestration`
    wrappers (which already handle burned/bricked run-end)
- Emit `ICE_ACTIVATED` once and `ICE_EFFECT_APPLIED { iceId, effect, result }`
  per atom (events already specced in §8).
- `ICE_DETECTED` (reveal/flavor) still fires **unconditionally** — only the alert
  *stepping* is gated behind the `raise-alert` atom.

**Behavioral invariant:** classic-preset runs play identically to today (alert
stepping + trace start unchanged), because their only effect is `raise-alert`
routed through `propagateAlertEvent`. Bot census on carried-over networks should
show near-zero regression.

### 2. Two damaging presets + registry-driven typed spawn

Alert-raise is treated as **one orthogonal effect type among three** (alert /
health / deck) — not auto-bundled onto damaging ICE.

| Preset | `effects` | Fiction | Clock it attacks |
|---|---|---|---|
| `patrol-classic-*` (existing) | `[raise-alert]` | surveillance | trace |
| **Sentinel** | `[damage-health {amount: 20}]` | neural feedback spike — burns the decker | health |
| **Spike** | `[damage-deck {amount: 20}]` | corrupts deck integrity | deck |

- **Spawn**: replace the hardcoded `typeId: 'standard-ice'` with a registry pick.
  The single ICE a network spawns is typed by a grade/biome-weighted roll:
  mostly classic, with Sentinel/Spike appearing at threat **B+** (where ICE
  already spawns today). The chosen type's `effects` and `grade` flow into the
  spawned `IceInstance`.
- **Flat damage amounts.** Grade already controls detection *frequency* via dwell
  times; no second grade-scaling on amount (avoids double-scaling).

**Consequence (intentional, made conscious):** on a Sentinel/Spike run, ICE no
longer feeds the trace clock — trace pressure there comes only from
exploit-failure IDS detections. The typed-ICE roll therefore changes *which clock
the player is racing*: classic = trace, Sentinel = health, Spike = deck. This is
a feature; it makes the three loss vectors legible and gives runs distinct texture.

### 3. Visibility (legibility requirements)

- **HUD**: two compact meters in the header alongside trace — `HEALTH` and
  `DECK` — color-ramping green→yellow→red as they drop. Match the existing
  trace/alert treatment unless a browser mock surfaces something better.
- **`status`**: add a `HEALTH n/100  DECK n/100` line to `status summary`; full
  breakdown in `status full`.
- **Log**: every `ICE_EFFECT_APPLIED` damage event logs a line, e.g.
  `SENTINEL — neural feedback: −20 HEALTH (60 left)`. Prominent formatting on the
  killing blow (the burned/bricked event).

### 4. Run-end

`burned` / `bricked` outcomes already exist in the type + orchestration. Add
end-screen copy for each, parallel to `caught`.

## Defaults (all tunable; verify via bot census after)

- Pools: **100 / 100**
- Damage per detection: **20** (≈5 detections to deplete a pool)
- Sentinel/Spike gated to threat **B+**; classic remains the common case
- Bloom seam (`setBloomIntensity`, already on `main`): **deferred** — it should be
  driven by deck integrity, but that wiring is part of #134's visual pass, not #133.

## Non-goals (explicitly deferred)

- Pattern-driven `onTick` / `onTriggerFired` movement engine (later reinvention session)
- Multi-ICE placement / budgeting (#133 keeps one ICE per network)
- Textured wounds/debuffs (#103, Layer 2)
- Deck subsystem inventory + named glitches (#102, Layer 3)
- The plasma overlay itself (#134 — designed next, same session, separate PR)

## Out-of-scope verification

- `make check` green throughout (start baseline: 775 tests, 0 fail).
- Bot census after balance changes (`make census`) to confirm the difficulty
  curve hasn't regressed.
- MANUAL.md updated: new node/ICE behavior (Sentinel/Spike), the two new loss
  clocks, the `burned`/`bricked` outcomes, and `status` additions.

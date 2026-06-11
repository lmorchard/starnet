# Overworld Meta-State (v1) Spec

**Goal:** Give the game a persistent layer *between* hack-sessions — a player
profile holding a cash bank and an exploit-card inventory — so runs stop being
isolated islands and become a campaign, launched and resolved through a textual
"overworld hub."

**Source:** User request, 2026-06-10. First buildable slice of the overworld
decomposition; see `docs/VISION-dual-mode-and-standings.md` for the larger arc.

## Current state

Every run is fully independent (`research.md`). `GameState`
(`js/core/types.js:200-274`) is strictly single-run; `resetGame()`
(`scripts/lib/headless-engine.js:77-88`) wipes everything between runs, and
"run again" just re-invokes `initGame()` with the same builder
(`js/ui/main.js:149-157`). Cash and the 5-card hand are regenerated each run;
nothing carries over. Save/load (`js/ui/save-load.js`) is snapshot-of-one-run
only. The darknet store (`js/ui/store.js`) spends in-run cash on cards into the
current hand, but those purchases evaporate at run end.

## Desired end state

A **persistent profile** lives outside `GameState`, in browser localStorage:

```
StarnetProfile {
  version: number,
  bank: number,                 // persistent cash
  inventory: ExploitCard[],     // persistent card collection; each card carries a
                                 // stable, profile-unique instanceId (distinct from
                                 // its vuln-type display id)
  // RESERVED (schema room, not implemented in v1): standings, installations, unlocks
}
```

The browser flow becomes:

1. **Hub** (textual menu, a generalization of the darknet store) shows: bank
   balance, inventory (cards + their worn/disclosed/uses state), and a short list
   of **available targets**.
2. Player **composes a loadout** (≤5 cards from inventory) and **withdraws** an
   amount of cash to carry in.
3. Player **picks a target** → a run launches with `meta.startHand = loadout` and
   `meta.startCash = withdrawn cash`. The run itself plays exactly as today
   (darknet store still spends the carried in-run cash).
4. **On `endRun`, results commit back to the profile:**
   - **success (`jackout`):** run cash (carried leftover + loot) **deposits** to
     bank; the loadout cards return to inventory with their updated
     uses/worn/disclosed state.
   - **caught (trace):** run cash is **forfeit** (extends today's cash-zeroing,
     `js/core/state/index.js:251`) AND the **carried loadout cards are burned** —
     removed from inventory (Medium stakes). Bank and un-carried inventory survive.
5. The **darknet store** and **mining** now feed the persistent inventory:
   purchases/yields land in the profile, not a throwaway hand.

The console keeps parity (per the symmetric-input + LLM-legible principles): the
hub is inspectable/operable via commands, not GUI-only.

## Design decisions

- **Decision:** Meta-state lives in a separate player-scoped profile store, outside
  `GameState`.
  - **Why:** `GameState` is strictly single-run and `resetGame()` wipes it; the
    save-load snapshot is one-run. Cross-run data needs its own home.
  - **Rejected:** adding `bank`/`inventory` fields to `GameState` — fights
    run-isolation and corrupts save/load snapshot semantics.

- **Decision:** v1 profile = **bank + card inventory only**.
  - **Why:** persistent cash is meaningless without a persistent thing to buy;
    together they flip cash from pure score into investment. Smallest slice that
    makes a campaign.
  - **Rejected:** cash-only (no stakes, no meaning); standings/storylets/
    installations (separate subsystems — would be two-specs-in-a-trenchcoat).

- **Decision:** **Medium stakes** — capture forfeits run cash AND burns the carried
  loadout; bank + un-carried inventory survive.
  - **Why:** lightest model that makes the persistent inventory *matter* and gives
    capture teeth now that "run again" isn't free. Makes "which cards / how much
    cash do I risk bringing" the core decision.
  - **Rejected:** Soft (loot-only, no inventory stakes — tensionless); Hard
    (persistent Heat/standings/installation loss — pulls in deferred subsystems).

- **Decision:** Bank ↔ in-run cash = **withdraw/deposit**. You carry cash *into* a
  run; leftover + loot deposits on success.
  - **Why:** keeps the darknet store working unchanged (it spends in-run cash) and
    adds a "how much to risk carrying" decision.
  - **Rejected:** store spends bank directly (changes the store; removes the
    carry-risk decision).

- **Decision:** Persistent inventory + per-run **loadout (≤5)** replaces the random
  `startHand`. Each inventory card gets a **stable, profile-unique `instanceId`**.
  - **Why:** Medium stakes needs to remove *specific carried cards*; stable ids
    enable that. Also turns store/mining into long-term investment, and is the
    cheap door-opener for the future "ICE burns exploits mid-run" idea (same
    targeted-removal operation, triggered earlier).
  - **Rejected:** keep random per-run hands (no persistence = no campaign).

- **Decision:** Hub is a **textual menu**; target selection is a **minimal
  generated list** (the seam where navigation will later grow into a map).
  - **Why:** deliver continuity now; the map is the most design-open + visual piece
    and isn't needed for the spine.
  - **Rejected:** building a graphical navigation map / world hierarchy now.

- **Decision:** **Browser-first.** Headless entry points (`playtest.js`, the bot)
  bypass the profile and synthesize a loadout (current `generateStartingHand`
  behavior).
  - **Why:** the profile is a browser/localStorage concern; headless runs operate
    at the run level and shouldn't depend on a profile.
  - **Rejected:** threading the profile through all three entry points in v1 (scope).

## Patterns to follow

- **core/ui split:** profile **data model + pure mutations in `js/core/`** (e.g.
  `js/core/profile/`); **localStorage binding + hub component in `js/ui/`**.
- **Versioned setter pattern:** mirror `mutate()` in `js/core/state/index.js` —
  pure setters that bump a version, no event emission inside the data layer.
- **Hub component:** mirror the Lit, light-DOM modal pattern of
  `js/ui/components/starnet-store.js` (and its `js/ui/store.js` controller).
- **Run config surface:** populate `meta.startHand` / `meta.startCash` the way
  network builders do today (`js/ui/main.js` `getSelectedNetwork()` + builder meta).
- **Reuse the `ExploitCard` typedef** (`js/core/types.js`) for inventory entries;
  add `instanceId` there.
- **JSON persist/restore:** follow `js/ui/save-load.js` for profile export/import.
- **Console parity:** add hub commands alongside the GUI (symmetric-input principle).

## What we're NOT doing

- **Standings / reputation / the constellation** — deferred subsystem.
- **Storylet engine / player qualities** — deferred; and NOT the in-network
  `js/core/node-graph/qualities.js` (per-run set-piece state, left untouched).
- **Persistent installations / tether-redirect nodes.**
- **Graphical navigation map / world hierarchy** (Universe→…→Device) — target list
  stays a flat menu.
- **Economy depth** beyond bank+inventory — no deck-hardware/script/upgrade shop.
- **Profile in headless entry points** (`playtest.js`, bot) — they synthesize a
  loadout.
- **Multiple profiles / save slots** — single profile for v1.
- **Mid-run ICE burning exploits** — filed to `docs/BACKLOG.md`; future. (v1 only
  leaves the door open via stable card `instanceId`s.)
- **Fixing CLAUDE.md's stale File-Structure section** — noted in `notes.md`, out of
  scope here.

## Open questions

All carry a default so planning can proceed:

- **Target-list generation & refresh.** *Default:* regenerate 3 targets at varying
  grade tiers on each hub visit, seeded deterministically from profile + a visit
  counter; selecting one launches it. Refinement deferred.
- **New-profile bootstrap.** *Default:* on an empty profile, seed an initial bank
  (reuse the current per-network `startCash` value) and an initial inventory (reuse
  `generateStartingHand`, ~5 cards).
- **Carried cash on capture.** *Default:* forfeit along with loot (consistent with
  today's full cash-zeroing on capture).
- **Loadout minimum.** *Default:* no minimum — launching with <5 (even 0, a blind
  run) is allowed.
- **Inventory cap.** *Default:* unbounded in v1.
- **`instanceId` scheme.** *Default:* assign a profile-scoped unique id when a card
  enters inventory (counter or UUID), independent of the vuln-type+counter display id.

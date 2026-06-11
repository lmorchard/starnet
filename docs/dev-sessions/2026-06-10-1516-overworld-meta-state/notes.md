# Notes — Overworld Meta-State (v1)

## Session start (2026-06-10)

- Branched `overworld-meta-state` off `origin/main` (`8667e72`) in a worktree at
  `.worktrees/overworld-meta-state/`. The main checkout stays on
  `vector-crt-rendering` (unrelated CRT work) — untouched.
- Brainstorm was done conversationally before `start`; spec written directly from
  the agreed design. Codebase grounding captured in `research.md` (Explore sweep).
- Baseline `npm install` + `make test` deferred to the execute boundary (spec phase
  needs no deps). **Run a clean baseline before writing any code.**

## Observations to follow up (out of scope this session)

- **CLAUDE.md File-Structure drift.** The project `CLAUDE.md` still documents the
  pre-reorg layout (`js/main.js`, `js/state/`, `js/combat.js`) while the code is
  split into `js/core/` + `js/ui/` (per `MEMORY.md`, confirmed by the sweep). Worth
  a separate doc-fix PR. Not touched here.

## Decisions locked in brainstorm

- v1 = persistent profile (bank + card inventory) outside `GameState`, surfaced via
  a textual hub (a generalization of the darknet store).
- **Medium stakes**: capture forfeits run cash and burns the carried loadout.
- Bank ↔ in-run cash = withdraw/deposit.
- Browser-first; headless entry points synthesize a loadout.
- Filed the "ICE burns exploits mid-run" idea to `docs/BACKLOG.md` (Adversarial/ICE).

## Phase 3a — restart bug (debugged in-browser)

- **Bug:** "run again" reset core state but not the graph view; the prior run's
  revealed nodes persisted on the board. Reproduced with Playwright against the
  worktree server.
- **Deeper root cause:** `initGame` emits `NODE_STATE_CHANGED` during NodeGraph
  *construction* (vuln/macguffin `setNodeAttr` loop, before the new `state` object
  is assigned). On a re-init the global `state` still references the prior run, so
  `visual-renderer`'s NODE_STATE_CHANGED handler re-adds the prior run's revealed
  nodes. Fixed by ordering `startRun` as initGame → resetGraph → syncInitialNodes.
- **LATENT ISSUE for a future session (out of scope):** `initGame` emitting node
  events against the stale global `state` during construction is fragile. Candidate
  cleanups: null/sentinel the global `state` at the top of `initGame`, or suppress
  graph→state→event sync until the new `state` is assigned. Only known symptom so
  far is the graph re-add (now handled by reset ordering); not fixing now to avoid
  touching the shared `initGame` used by playtest/bot entry points.

## Session summary (v1 complete)

Delivered the overworld meta-state v1 across five commits:
- **Phase 1** — persistent profile model (`js/core/profile`) + localStorage store + bootstrap.
- **Phase 2** — loadout launch (`meta.startHandCards`) + `commitRun` (deposit/decay-writeback/absorb mid-run cards on success; burn loadout on capture).
- **Phase 3a** — fixed the broken run-again: unified `startRun` (`run-control.js`) + `resetGraph`; root cause was initGame emitting node events against stale state during construction.
- **Phase 3b** — the overworld hub: `starnet-hub` Lit modal, target list, console parity, boot→hub flow.
- **Phase 4** — MANUAL.md + regression sweep.

Verified end-to-end in-browser (Playwright): boot→hub→equip→carry→launch→run with exact loadout+cash→jackout→commit→return-to-hub. 722 tests green; bot census + playtest headless unaffected.

**Known v1 wart / follow-ups:**
- CLAUDE.md is stale in two places (file-structure section; bot census flags `--time/--money` vs actual `--threat/--wealth/--complexity/--depth`). Worth a doc-fix PR.
- Latent: `initGame` emits node events against stale global `state` during NodeGraph construction (see Phase 3a). Handled for the graph by reset-ordering; consider nulling `state` at the top of `initGame` in a future cleanup.
- Capture-burn was verified by unit test, not in-browser (hard to force a trace via script).

## Gotcha: dev-server port collision

- `make serve` (`npx serve .`) **silently fell back to a random port (49826)**
  because something else already held :3000. Curl/Playwright against :3000 hit a
  *different* server (the main checkout, stale code) — wasted a verify cycle. Always
  confirm the actual port from the serve output, and verify a worktree-only file
  (e.g. `/js/ui/profile-store.js`) returns 200 on the port you're testing.

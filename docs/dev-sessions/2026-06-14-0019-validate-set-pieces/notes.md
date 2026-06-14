# Notes — validate-set-pieces

## Outcome

Implemented `validateSetPiece(def)` in `js/core/network/validate-set-piece.js` (sibling of the
network-level `validate.js`, mirrors its `{ valid, errors }` shape but returns structured errors
`{ pieceId, nodeId, check, message }`). All 12 checks from issue #219 shipped; tests in
`validate-set-piece.test.js` (95 tests). `make check` green — 1251 tests total (1156 baseline + 95).

## Checks implemented (all 12)

Static (in `validateSetPiece`): 1 edge-endpoint, 2 port-target, 3 operator-input,
4 destinations-edge, 5 core-verb-shadow (#153), 6 ctx-method, 7 quality read/write consistency
(#215 class, both directions), 8 enabled-attr, 9 watchdog-armed (#215 static).
Instantiated (exported helpers, called from `validateSetPiece`): 11 reachability,
10 namespace-leak (#215 analog post-instantiate). Behavioral: 12 no-trace-at-init lives in the
test (needs a `NodeGraph` + `mockCtx`; ticks 300 idle ticks, asserts `ctx.calls.startTrace`
undefined).

## Key findings during research (things that shaped the checks)

- **Scatter nodes break naive reachability.** `scattered-key-vault-*` / `scattered-lock-*` have
  `internalEdges: []` and `scatter: true` switch/key nodes placed independently elsewhere,
  communicating via *global* qualities. Reachability (#11) must exempt scatter nodes as roots
  and targets, or it false-positives on the whole scattered family. Documented in the spec as the
  tractable approximation.
- **The `encrypted` trait legitimately overrides `dump`** (a core verb) in trait code. So
  core-verb-shadow (#5) must inspect **raw authored `NodeDef.actions`**, not the trait-resolved
  action list — otherwise it would flag the legit trait override. The #153 bug was an action
  authored *in a piece* (`encrypted-vault` id:"fetch"), which is exactly what we catch.
- **Qualities are per-def even for scatter pieces.** The scatter producer (switch) and consumer
  (vault) both live in the same `SetPieceDef.nodes`, so per-piece quality consistency (#7) holds.
- **Write-without-read passed the whole catalog** (the spec's open question) — every quality is
  both read and written today, so I kept write-without-read as an error rather than downgrading it.
- **ctx-method source of truth** = `Object.keys(nullCtx)` from `node-graph/ctx.js` (matches
  `mockCtx`), not the JSDoc in `types.js` — runtime over annotations.

## Scope decisions / honesty

- **enabled-attr (#8) only** — not `activeAttr`/`progressAttr`/`durationAttr`. Those are
  engine-managed by the timed-action operator and may be initialized lazily; checking them risks
  false positives. Documented in spec, not faked.
- **Dead-node / signal-path liveness** (CLAUDE.md, flagged lowest-confidence in the issue) is NOT
  attempted as full liveness. Approximated by reachability (#11, structural) + no-trace-at-init
  (#12, behavioral). Called out, not faked.
- **destinations-edge (#4)** is vacuous on today's catalog (no piece uses `destinations`) but
  guards future authoring — the machine form of the reviewer-only CLAUDE.md rule.
- Each high-value check has a **broken-def unit test** asserting it fires (filtered by exact
  `check` tag), so the catalog passing isn't the only evidence the checks work. The #215
  reproduction has both a behavioral assertion (free-running watchdog → startTrace) and a static
  one (watchdog-armed fires).

## Not changed (deliberately)

- `instantiate` untouched (that's #220's rewriter-robustness scope; we did the validation side
  of check #10 only).
- No builders / authoring dedup (#221).
- Not wired into the generation pipeline — issue asks for a *test* over the catalog; validator is
  authoring-time, enforced by the test suite / CI. No runtime/generation/balance impact → census,
  MANUAL.md, BOT-PLAYER.md unaffected.

## Verification

- `make lint` → exit 0 (tsc clean, new file in the checked set).
- `make check` → 1251 tests pass, 0 fail.
- New file ran standalone: 95 tests pass.

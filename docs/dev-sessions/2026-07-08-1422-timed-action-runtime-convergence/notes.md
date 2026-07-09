# Notes — #288 timed-action / process runtime convergence

**Branch:** `worktree-timed-action-runtime-convergence` → **PR #313**
**Base:** origin/main `8518085` (post-#310 combat cutover)
**Outcome:** shipped as a PR; pure coherence refactor, census byte-identical.

## What we set out to do
Converge the "two timed-execution runtimes" (#288) and cut the hand-wiring #187 Phase 1
left on the core verbs.

## Key reframing (during brainstorm/planning)
The "two runtimes" framing was misleading. There is **one** timed-execution engine (the
node-graph `timed-action` operator) and **one** orchestration layer (`processes.js`) that
*composes* the operator (SWEEP, and now `autoburn`, are its clients). So convergence wasn't a
substrate merge — it was (A) finishing the core-verb migration onto declarative `timed:`, and
(B) collapsing the two hand-bridged seams (busy, abort) into single game-layer contracts.

## Decisions (with Les)
- Slice: both A and B in one session, one PR, A as the first checkpoint.
- B substrate model: **two levels, one shared contract** (lowest risk; ~80% already true).
- A scope: migrate the **clean four** (probe/dump/fetch/mine + encrypted dump); document
  reboot/volatile as deliberate bespoke exceptions.
- B1 mechanism: **game-layer `isNodeBusy` helper**, NOT graph-injection (discovered redundant
  — `node-actions.js` early-returns `[ABORT]` during a process before the graph evaluates node
  actions). Les signed off on the reversal.

## Discovered during planning (spec revised)
- **#310 already moved `xploit`** off the timed operator into the `autoburn` process — dropped it
  from Part A; it's now a Part-B-relevant process client.
- **Synthesis enabler needed:** the migrated verbs use irregular activeAttrs (`probing` etc.) that
  are load-bearing; synthesis had to honor the `TIMED_ACTIONS` registry activeAttr
  (`getTimedActionAttrNames(id).activeAttr ?? timedActiveAttr(id)`). Registry stays the source of
  truth; only durationTable/onComplete moved out of traits.js.
- **B3 shrank to documentation** — processes emit no audio and their log lines are type-keyed, so a
  `PROCESS_*→feedback-profiles` bridge would be dead plumbing (YAGNI).

## Execution (subagent-driven, review gate per task)
- **A0** synthesis enabler (behavior-neutral) — 60b5b6b.
- **A1** migrate the four verbs + encrypted dump; retire trait operators — d35321e, + parity-test
  honesty fix 0b27547 (added negative `getTrait` assertions so the test fails on revert; the
  original parity test was a tautology — caught in review).
- **B1** `js/core/busy.js` + reroutes — 69ac402.
- **B2** `abortNode` + one nav-cancel pass — ac81b84.
- **B3 + docs** feedback-boundary comments — 2b1d102.
- Post-review cleanup (fold double lookup, fix stale comment) — 89084ec.

## Verification
- `make check`: 1590/1590, tsc clean.
- `make census SEEDS=50`: byte-identical vs origin/main `8518085` — checked after Part A, after B2,
  and at the end. Determinism confirmed (same-code runs identical).
- Whole-branch review (opus): **Ready to merge, no Critical/Important**.

## Carry-forward / follow-ups
- **Intentional behavior note (in PR body):** the unified nav-cancel is abortable-only, so `volatile`
  is no longer reset on nav-away — an alignment with the "volatile never cancellable" invariant and a
  latent-bug fix. Not exercised by census (volatile unused in shipped networks today).
- `abortTimedAction` ctx method retained (a test uses it) as a delegating alias to
  `resetActiveAbortableTimedAction`.
- Full operator↔process substrate merge remains deliberately un-done — the two-level model with one
  shared contract is the chosen resting point, not a stepping stone that must go further.

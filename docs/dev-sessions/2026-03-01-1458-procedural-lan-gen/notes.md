# Notes: Procedural LAN Generation

## Session Progress

All 9 phases completed. Generator is wired into both the headless harness
(`--time` / `--money` flags) and the browser (`?seed=&time=&money=` URL params).
276 tests passing.

---

## Headless Playtest Results

### Easy Run — F/F seed:"easy-test"

Network: 7 nodes. Completed in ~400 simulated ticks with no ICE pressure.

**Observations:**
- Network topology is clean: wan → gateway → router → fileserver + workstation + ids chain
- F-grade ICE barely moved; not a meaningful threat at this difficulty
- Hand had good coverage; 72% match rate on gateway allowed easy entry
- ¥5,994 looted, alert stayed GREEN throughout — very forgiving
- **Too easy at F/F:** Node count (7) feels thin; ICE is invisible

**Potential tuning:**
- Add a minimum of 2 workstations at F so there's something to explore beyond the direct path
- Consider raising F depthBudget from 2 to 2 (keep), but place fileserver slightly deeper
- F/F ICE could still be a nuisance — consider setting iceGrade to E if/when a grade is added below F

### Medium Run — B/B seed:"mid-test"

Network: 11 nodes. Mission not completed — ran out of matching cards before owning fileserver.

**Observations:**
- The firewall (path-traversal only vuln) forced darknet store visit — this is correct behavior
- TimingOracle was the sole match, failed 3× at 48% success rate and was disclosed
- Darknet store purchase (¥250 for path-traversal card) was intuitive and effective
- ICE B-grade patrolled visibly and triggered detection pressure (~4s warning twice)
- Alert stayed GREEN throughout (ICE moved away before detection fired both times)
- Firewall "owned" eventually but fileserver needed 3 more exploits; card uses ran low
- Mission not completed on jackout — correct, jackout is escape not success

**Key insight — mission target at depth 3:**
The B/B fileserver (targetDepth=3) requires: gateway → firewall → fileserver, each
needing 2+ exploits. That's 6+ exploits on the critical path. With 6 cards at 3–8
uses each and B-grade nodes at ~50% success rate, expected failures = ~6 more uses.
A 6-card hand may not have enough total uses for a clean B/B run. The darknet store
is essential — not just for vuln matching but for use replenishment.

**Potential tuning:**
- Starting cash (¥1,000) feels tight for B/B. Consider giving ¥1,500 for B/C or higher
- Or reduce B fileserver to 2 exploits needed by reducing its pathGradeMax
- The careless-user set piece did NOT fire this run (rng ≥ 0.6). When it does fire,
  it may change the routing significantly — needs explicit playtesting with a seed
  that triggers it

### Careless-User Set Piece

Not observed in F/F (ineligible — requires moneyCost ≥ C) or the B/B test run
(40% miss probability). The set piece implementation looks correct; needs a seed
that exercises the 60% path to be fully validated through play.

**To observe it:**
```bash
# try seeds until careless-user fires (check node count > 11 for B/B)
node scripts/playtest.js --seed "foo" --time B --money B reset
```

---

## Balance Notes & Backlog Items

- **F/F feels thin** — 7 nodes, trivial ICE, complete in ~5 minutes. Consider
  adding a minimum workstation count or a soft "always add 1 extra router" rule.
- **B/B cash pressure** — starting ¥1,000 is tight when one card purchase is ¥250
  and you need 3+ purchases for a hard run. Log as balance backlog item.
- **Card count scaling** — starting hand size (6) may need to scale with difficulty.
  At S/S, 6 cards will almost certainly not be enough. Consider deal 8 cards at A+.
- **ICE at F/F** — effectively absent. A grade-F ICE with a very long move timer
  (> 30 ticks) is basically invisible. May want ICE to be off entirely at F/F.
- **Exploit success% at B-grade nodes** — 48–52% is about right for a medium
  difficulty match. Feels appropriately tense.
- **Determinism confirmed** — same seed, same params → same network every time.
  The snapshot tests cover this and will catch regressions.

---

## Technical Notes

### Colocated tests

Moved grades tests to `js/grades.test.js` (colocated with `js/grades.js`).
Added `js/*.test.js` to Makefile test glob (the existing `js/**/*.test.js` pattern
only matched subdirectories under `/bin/sh`, not top-level `js/*.test.js`).

### Generator architecture

The four-layer split (rules / algorithm / validators / set pieces) worked cleanly.
The validator retry loop never fired during playtesting — the algorithm reliably
produces valid networks on the first attempt for all difficulty combinations tested.

### Set piece integration

The `applySetPiece` API passes `makeId` and `nextLabel` closures from the generator,
so set piece nodes integrate seamlessly into the main ID sequence and label pools.
No module-level state in `js/set-pieces.js`.

---

## Retrospective

### Recap

Built a full procedural LAN generator from scratch across 9 planned phases:

- `js/grades.js` — grade utilities (GRADES, shiftGrade, randomGrade, etc.)
- `data/node-type-rules.js` — topology rule data (singleton, depth, connectsTo, etc.)
- `js/network-gen.js` — core generator with budget tables, label pools, layout
- Validator predicates with retry loop
- `js/set-pieces.js` — set piece system + `careless-user` piece
- Harness integration (`--time`, `--money`, `--force-piece` flags)
- Browser URL param integration (`?seed=&time=&money=`)
- Snapshot + structural tests (276 passing)
- Headless playtesting with balance notes

Post-plan additions driven by playtesting: `status full` showing revealed node IDs,
F depthBudget bump, `startCash`/`startHandSpec` scaling tables, `forcePieces` option.

Late-session RNG consolidation (not in original plan): extracted `makeSeededRng` and
`shuffleWith` into `js/rng.js`, eliminating duplicate Mulberry32/djb2 code from the
generator. **This work is uncommitted at session close** — needs to land before the
branch is merged.

### Divergences from plan

- **Phase 3** originally called for local `djb2`/`makeMulberry32` in the generator.
  These were later consolidated into `js/rng.js` as `makeSeededRng`/`shuffleWith`.
  Plan was correct at the time; the refactor emerged naturally once the pattern was
  repeated a third time (shuffle).

- **Phase 8** snapshots were written to `js/snapshots/` (colocated) rather than
  `tests/snapshots/` as originally planned. Aligns with the colocated-tests convention
  established for grades.

- **Post-plan balance tweaks** (cash scaling, hand scaling, F depth, revealed node
  listing) were added after playtesting. These were genuinely discovered through play
  and couldn't have been specified upfront — the process worked as intended.

- **`data/node-type-rules.js` is not imported by the generator.** The rules file was
  created in Phase 2 but `buildNetwork` never adopted it — grade assignments, label
  pools, and type strings remain hardcoded in the generator. This is the primary
  technical debt handed off to the biome-bundles session.

### Insights

- **The four-layer architecture held up.** Rules / algorithm / validators / set pieces
  is a clean separation. The validator retry loop is an elegant escape valve — the
  algorithm doesn't need to be perfect, just usually correct.

- **Snapshot tests are invaluable for generators.** They caught two regressions during
  the session (after adding startCash/startHandSpec, and after depthBudget change).
  Worth the upfront cost of writing them.

- **`data/node-type-rules.js` was created prematurely.** It was designed to be read by
  the generator but that step was never taken. The rules data and the generator algorithm
  are effectively in separate universes. This was the seed of the biome-bundles idea —
  the right fix is to bundle them together, not just import one from the other.

- **Balance can't be designed upfront at this level of fidelity.** Playtesting produced
  three concrete tweaks that improved the game feel significantly. Iterating after seeing
  numbers is faster than pre-specifying difficulty curves.

- **The `forcePieces` option was a good mid-session addition.** User spotted the
  opportunity while the set piece code was being written. Cost: ~15 minutes. Value:
  makes set pieces testable without seed-hunting. Good instinct to interrupt and add it.

### What data/node-type-rules.js was supposed to be

The rules file was designed with good intentions — decouple topology facts from
the algorithm — but it became a data orphan. The biome-bundles session should absorb
it entirely. The lesson: data without a consumer isn't architecture, it's wishful
thinking. Next time, wire the data file in before moving on.

### Efficiency

- Phases 1–5 went smoothly — the plan was tight and implementation was mostly mechanical.
- Phases 6–7 (harness/browser integration) required careful coordination between two
  parallel entry points (`scripts/playtest.js` and `js/main.js`).
- Phase 9 (playtesting) produced valuable signal quickly. The harness is fast enough
  that manual play through `tick` and `exploit` commands is genuinely fun.
- The RNG consolidation at end of session was unplanned but fast (~20 min) and clean.
  Leaving it uncommitted was a mistake — should have committed immediately.

### Process improvements

- **Commit more frequently.** The RNG consolidation was left uncommitted at session end.
  Rule: commit before switching contexts.
- **Wire data files to their consumers in the same phase they're created.** Creating
  `node-type-rules.js` without reading it in the generator created false confidence
  that the architecture was sound.
- **Note the "UNCOMMITTED" status of any work that doesn't land in a commit** before
  the retro, so it's visible and doesn't get lost across sessions.

### Conversation turns

Approximately 30–35 exchanges across two context windows (session continued from
a prior summarized conversation).

### Other highlights

- The biome-bundles session was conceived during the retro conversation. Good sign:
  the current session did enough to surface the right next problem.
- The `forcePieces` interrupt pattern was a good example of a mid-execution spec
  change that was worth taking. Small scope, high leverage.
- 276 tests at session close. Starting count: 224 (before network-gen tests).
  52 new tests added.

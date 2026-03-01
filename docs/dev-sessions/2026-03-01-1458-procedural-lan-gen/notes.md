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

## Session Retro Summary

**Completed:** All 9 planned phases.
**Worked well:** The four-layer architecture, snapshot tests, harness flags, URL params.
**Deferred:** Multiple set pieces (workstation array, lucky break, security theater),
biome system, ICE grade scaling with difficulty.
**Bugs found:** None blocking. Minor: `status full` shows "N node(s) revealed" summary
rather than listing each node's ID — makes harness-guided play slightly awkward.

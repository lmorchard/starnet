# Notes: Hand Strip + Pie Menu

## Retrospective

### Recap

Phase 1 (hand strip) was fully implemented and polished across two conversation sessions:

- Moved the exploit hand from the right sidebar into a `#hand-strip` div spanning the full width of `#graph-column`, between the graph canvas and the log pane
- Cards reshaped from horizontal sidebar panels into narrow vertical tiles (190×160px)
- Progress fill direction changed from left-to-right to bottom-to-top (`scaleY` + `transform-origin: bottom center`)
- Executing label (`▶ EXECUTING — X%`) always in DOM with `visibility: hidden` to prevent layout shift
- Rarity expressed via border color/glow only (no text label): common = grey, uncommon = `#009999`, rare = `#bb0077`
- Match highlighting replaced: old approach overrode border color (clashing with rarity); new approach uses opacity only — match cards at `opacity: 1`, no-match at `opacity: 0.35`

Phase 2 (pie menu) was attempted and then reverted at Les's request. Deferred to a future session.

Additional polish landed during the second session:
- Wider cards (130px → 160px → 190px) to fit titles on one line
- More top/bottom margin within cards (title, vuln list)
- Log pane layout instability fixed (log entries no longer grow the pane)
- Uniform card gap (0.5rem) to eliminate sub-pixel rounding jitter

**Commits:**
- `eb5a196` Add hand strip layout and pie menu for node actions
- `fac2df1` Revert pie menu, keep hand strip
- `2bd80b7` Polish hand strip: wider cards, implicit rarity, stacked vulns
- `93ea8a0` Polish hand strip: layout stability, rarity colors, match highlighting

---

### Divergences from Plan

**Pie menu reverted.** The ctxmenu integration was implemented (including CDN, `initCxtMenu` in graph.js, `buildPieCommands` in visual-renderer.js, CSS overrides) but Les decided the pie menu wasn't ready aesthetically and wanted to defer it. Sidebar action buttons were fully restored.

**Card width grew significantly.** The plan spec'd ~130px; we ended up at 190px. The font and content density required more room than anticipated — specifically, multi-word exploit names (e.g., "TimingOracle Prime") need roughly 170px of content area.

**Rarity via border vs. text.** Plan mentioned removing the rarity text label and using border/glow. Implemented as planned, but the initial border colors were too subtle (cyan-dim, dark magenta) and required two rounds of iteration to reach the final vibrant values.

**Match highlighting changed.** Original plan didn't specify changing match highlighting; the green border override approach was already in place. The rarity border colors made the conflict visible, which led to switching to opacity-only highlighting. This was an unplanned but clearly correct improvement.

**Log pane instability was unplanned.** Discovered mid-session via Playwright measurements — the log pane was `flex: 0 0 auto` with `#log-entries` unconstrained, causing it to steal space from the graph container as entries accumulated. Fixed by changing `#log-entries` to `flex: 0 0 9rem`.

---

### Insights

**Playwright measurement loop is very effective for CSS debugging.** Running `getBoundingClientRect()` on elements before/after state changes was the right move for diagnosing both the card width issue and the log pane growth. Much faster than eyeballing screenshots.

**Sub-pixel rounding is a real issue with fractional rem gaps.** `gap: 0.4rem` = 6.4px causes alternating 6px/7px gaps due to rounding. This made cards look uneven even though they were all exactly 190px. Switching to `0.5rem` = 8px (a whole pixel at 16px base) fixed it.

**`visibility: hidden` vs `display: none` for stable layout.** The executing label needed to reserve space in all states. Using `visibility: hidden` keeps the element in flow but invisible — the right tool here, and it only works when the hidden text and visible text have the same dimensions. `white-space: nowrap` + `overflow: hidden` were needed to keep the label from varying in height as the percentage changed.

**Rarity via border only works cleanly if match highlighting doesn't also use borders.** The conflict between rarity border colors and the green match border was subtle but visually ugly. Opacity is a cleaner dimension for match state — it doesn't interfere with any color semantics already in use.

**Card sort causes visible positional jumps on probe.** When `exploitSortKey` reorders match cards to position 0, cards visibly jump. This is intentional (the sort is useful for priority) but was initially flagged as a "width bug" because the shift looked irregular. The gap rounding issue was amplifying it. After fixing the gap, the jump is clean and predictable.

---

### Efficiency

The session split across two conversations due to context limits. The first half (implementation) went smoothly. The second half (polish) involved a lot of visual iteration: screenshot → feedback → tweak → screenshot. About 6-7 screenshot-driven polish rounds total.

The ctxmenu work (implement + revert) was ~30% of the first session's effort, all discarded. Worth doing in a throwaway branch or proof-of-concept first next time before wiring into the main branch.

---

### Process Improvements

- **Visual iteration sessions benefit from a wider viewport.** The browser at default 1232×928 is tighter than a real user's screen; cards were borderline. Consider a wider viewport in Playwright for UI work.
- **Pie menu / experimental UI additions should be prototyped separately** before committing to the main feature branch, so a revert doesn't pollute the commit history.
- **Spec initial card width estimates were too optimistic.** When speccing card dimensions, account for monospace font density — especially for multi-word names with version suffixes.

---

### Conversation Turns

~25 turns across two conversation sessions (context compaction split them).

---

### Cost

Not recorded.

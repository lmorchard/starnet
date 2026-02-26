# Notes: Node Visual Indicators

## Retrospective

### Recap

Overhauled node visual indicators across four planned steps plus significant unplanned
polish. The core work:

1. **Shape fix** — `security-monitor` moved from `hexagon` to `octagon`, making it
   visually distinct from `ids`
2. **Visual channel redesign** — fill → access level (locked/compromised/owned),
   border → alert state (green/yellow/red), selection → SVG reticle overlay
3. **flashNode** — switched from border to fill so flash animations don't cross channels
4. **Selection reticle** — animated SVG ring with 4 cardinal tick marks, rotates as a
   group at 12s per revolution, fades in/out on select/deselect

Unplanned additions that emerged organically:
- HUD LAN connection status indicator (PASSIVE SCAN / ACTIVE: node / detecting pulse)
- ICE snap-on-arrival from invisible territory (no stale animation)
- Reboot opacity pulse (slow breathe instead of static dim)
- GUI/console symmetry: `logCommand()` in `main.js` ensures UI clicks produce the same
  log entry and history entry as typed commands
- MANUAL.md: passive/active mode mechanic documented
- CLAUDE.md: GUI/console symmetry added as design principle

### Divergences from Plan

The plan was faithfully executed. Everything extra was additive — the plan was
a floor, not a ceiling.

Fill brightness required three rounds of iteration to land somewhere satisfying
(`#080810` → `#0a2035`/`#0a2510` → `#1a3850`/`#1a3820` → `#1a4d70`/`#1a5530`).
Could have anchored to a target earlier in brainstorm.

### Insights

**Visual channel separation pays off immediately.** Once fill=access and border=alert
were separated, every subsequent visual addition (reboot pulse, HUD indicator, ICE
detection state) had a clear home and didn't conflict with anything else.

**The reticle is more complex than expected.** Pan/zoom tracking, `transform-box`
subtleties for SVG group rotation, and `display` vs `opacity` for transitions all
needed attention. Worth the time — it's a strong visual.

**GUI/console symmetry is a real design constraint, not just an aspiration.** The
`logCommand()` consolidation was a natural consequence of applying it consistently.
The `fromConsole` flag is a contained wart but the pattern is sound. See the deferred
architecture note below for the deeper question this raised.

**Passive/active mode is good lore.** The reticle prompted articulating why selection
increases exposure. That's now in the MANUAL and CLAUDE.md as a design principle —
it came out of visual work, not game design work.

### Efficiency

The session moved well. Brainstorm was tight (clear priorities established quickly).
Plan was solid and didn't need revision during execution. Most extra time was spent on:
- Fill color iteration (expected)
- Reticle polish (tick marks, rotation, fade)
- GUI/console symmetry discovery and refactor (worthwhile tangent)

`make check` came back clean with no issues.

### Process Improvements

- For visual work involving color values, consider establishing target anchors
  (e.g. "roughly as bright as the border at alert-yellow") in the spec rather than
  iterating by eye. Would have saved 1-2 rounds on fill brightness.

### Conversation Turns

~40 exchanges.

### Other Highlights

- The passive/active distinction (selecting a node = active presence, ICE can detect
  you; deselecting = ghost mode) was articulated clearly for the first time this
  session and is now documented. Good candidate for surfacing in-game as a tutorial
  hint or first-run tooltip.
- Defender ICE concept (access reversal) captured for future session — it fits
  naturally with the fill channel established here.

---

## Deferred Ideas (captured during session)

### Defender ICE — access level reversal

New class of ICE that doesn't detect/alert the player, but actively counter-hacks
to reverse access level progress: owned → compromised → locked. Repair/cleanup
behavior rather than detection behavior.

Interesting mechanical implications:
- Creates pressure to hold territory, not just claim it
- Asymmetric ICE roles: detectors raise alert, defenders erode progress
- Could combine with ICE types session (different ICE behaviors/roles)
- Potential counterplay: prioritize looting fast, subvert/destroy defender before it
  reverses critical nodes
- Visual signal needed for "node being reversed" state — would fit naturally into the
  fill channel (access level) already established this session

Fits in the ICE types / node interactions future session.

---

## Deferred: GUI/Console Architecture — String Dispatch vs Structured Events

**Question raised:** Should the visual UI interact with the game by literally composing
and issuing command strings (routing through `runCommand`), rather than emitting
`starnet:action:*` events directly?

**Appeal:** Single code path for all input. `fromConsole` flag disappears. GUI and
console are provably symmetric by construction.

**Concerns:**
- Routes structured data through a string serialization/parse round-trip that adds
  no information. The UI already has clean values (exploitId, cardIndex, nodeId) —
  converting to `"exploit 3"` and re-parsing them back is coupling the UI to command
  syntax for no gain beyond conceptual tidiness.
- Any change to command syntax becomes a UI concern.
- The playtest harness bypasses console parsing intentionally — structured dispatch
  is more robust than string parsing for programmatic use.

**Current resolution:** `logCommand()` in `main.js` is the single source of truth for
"what command string does this action correspond to." The `fromConsole` flag is a
contained wart, one per handler. Data stays structured throughout.

**Middle ground to consider:** A `toCommandString(actionName, payload)` mapping that
produces the canonical command string for log/history purposes without routing through
the parser. Effectively what `logCommand` already does.

Worth revisiting if the `fromConsole` pattern proliferates further or if the command
language becomes more complex.

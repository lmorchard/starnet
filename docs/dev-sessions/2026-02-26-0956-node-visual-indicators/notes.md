# Notes: Node Visual Indicators

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

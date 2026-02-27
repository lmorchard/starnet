# Notes: WAN Node + Darknet Store

## Retrospective

### Recap

Built the WAN node and darknet broker store as specified. Key deliverables:

- WAN node added to network topology (barrel shape, always accessible, outboard of gateway)
- `wan` type registered in `node-types.js` with `access-darknet` action
- Starting cash bumped to ¥500
- `buyExploit(card, price)` state mutation
- WAN excluded from ICE movement candidates
- `pauseTimers()` / `resumeTimers()` added to `timers.js`
- `access-darknet` wired through `ActionContext` in `action-context.js`
- Darknet store modal in new `js/store.js` module (extracted from visual-renderer.js)
- Console commands `store` and `buy` added for GUI/console symmetry
- `getStoreCatalog()` factored into `exploits.js` as shared source
- Pointer cursor added to clickable graph nodes
- Integration tests for WAN visibility, `access-darknet` availability, ICE exclusion, `buyExploit`

### Divergences from Plan

**ActionContext wiring moved to `action-context.js`** — plan said `main.js`, but the prior session had already extracted ActionContext to its own module. The right home was obvious once we started.

**Store extracted to `js/store.js`** — plan put store logic in `visual-renderer.js`. After implementing it there, Les asked to extract it to its own module. Clean call. `visual-renderer.js` is already a big file.

**`accessLevel: "accessible"` type error** — plan said to set WAN's `accessLevel` to `"accessible"`, but `accessible` is a `Visibility` value, not an `AccessLevel` (which is `locked | compromised | owned`). TypeScript/JSDoc caught it. Fixed by only setting `visibility = "accessible"`.

**Console symmetry not in original plan** — after seeing the store as a modal-only feature, Les correctly flagged that it violated the GUI/console symmetry principle. Added `store` and `buy` console commands that work without the modal. The console path bypasses timer pause (intentional — console is already outside the game loop conceptually).

**Multiple store UI iterations** — the modal went through several rounds of feedback: too large, close button too faint, no click-outside-to-close, purchases not appearing in log/history. Each was a small fix but added up to significant scope beyond the original plan.

**`getStoreCatalog()` extracted** — originally each caller (store.js, console.js) would have generated the catalog independently. Factored into `exploits.js` to share a single source. Good call.

### Insights

**Commit planning docs before executing** — Les asked to commit the spec + plan before starting execution. This is worth making a standing practice: committing planning artifacts gives a clean record of intent vs. outcome, and getting them into git before the coding begins prevents them from being bundled ambiguously into feature commits.

**`cursor: pointer` is not a valid Cytoscape style property** — Cytoscape's stylesheet API is not CSS; `cursor` is a browser CSS property that Cytoscape does not support. The warning `The style property cursor: pointer is invalid` fires on every load. The pointer cursor feature is effectively a no-op. This needs to be fixed — likely by setting cursor via the `#cy canvas` element directly in CSS, or via the Cytoscape `renderer` options. **Logged as a bug.**

**Context compaction mid-session** — the session ran long enough to hit context limits during execution. The continuation from the compacted context was smooth, but it underlines that large sessions with many follow-up iterations are more fragile. Consider smaller feature scope or earlier retro/commit boundaries.

**Bugs discovered (pre-existing, not caused by this session):**
- `???` revealed state appears not to be working in normal gameplay — nodes may be jumping straight from hidden to accessible because `accessNeighbors()` is being called somewhere in the normal game flow. Needs investigation.
- Some accessible-but-locked nodes (workstation-a/b, fileserver) display what appears to be grey fill. Cytoscape style API confirms `rgb(8,8,16)` (correct), so this may be a visual perception issue — the locked node background `#080810` is nearly identical to the container background `#0a0a0f`. Worth increasing the contrast.

### Bugs Introduced

- **`cursor: pointer` Cytoscape warning** — `buildStylesheet()` in `graph.js` includes `{ selector: "node.revealed, node.accessible", style: { cursor: "pointer" } }`. This is not a valid Cytoscape style property. It generates a warning on every page load and has no effect. Should be removed and replaced with a CSS rule targeting the canvas element.

### Cost

Not recorded.

### Efficiency

The core mechanics (WAN node, ICE exclusion, timer pause, buyExploit, tests) were fast to build — maybe 30% of session time. The remaining 70% was UI polish iterations on the store modal. The GUI/console symmetry issue was the most significant scope expansion. Both were worth doing, but the iteration cost was high.

### Process Improvements

- **Add "commit planning docs" as a standard pre-execution step in the execute phase reference.**
- **Add a GUI/console symmetry checklist item to the spec template** — any new UI feature should answer "is this accessible via console?" before planning is considered complete.
- **Smaller sessions** — this session was large enough to require context compaction. Future sessions that touch both backend logic and UI are good candidates for splitting into two sessions.

### Conversation Turns

Approximately 30–40 back-and-forth exchanges across two context windows.

### Other Highlights

- The store modal's compact design (scoped to `#graph-container` with `position: absolute`) works well — it covers only the graph, leaving the sidebar and console visible during shopping. This feels right for the game aesthetic.
- The `[DARKNET] Connected to broker` log message on store open gives good feedback without being intrusive.
- The `data-index` attribute on BUY buttons and `COMMAND_ISSUED` emission from the click handler achieves full log/history parity between GUI and console purchases — a clean pattern to repeat for other modal interactions.

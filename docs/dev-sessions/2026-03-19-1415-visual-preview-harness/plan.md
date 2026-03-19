# Visual Preview Harness — Plan

_Session: 2026-03-19-1415 | Issue: #63_

## Strategy

Build incrementally: start with a working page that shows one effect, then add the rest. The key risk is graph.js integration — once `initGraph()` works with fake data, everything else is straightforward wiring.

---

## Phase 0: Commit session docs

---

## Phase 1: Minimal preview.html + one overlay

Get the foundation working: preview.html with Cytoscape, one demo node, and probe sweep.

### Prompt

Create `preview.html` at the project root. This is a standalone visual preview harness for testing game effects.

**HTML structure:**
- Load `dist/vendor.js` (Cytoscape) and `css/style.css`
- Two-panel layout: left = graph container, right = control panel
- Graph container (`#graph-container`) with `#cy` div inside, plus all 6 SVG overlay elements copied from `index.html` lines 46–101 (probe-sweep, ice-detect-sweep, loot-rings, read-sectors, exploit-brackets, selection-reticle)
- Control panel with cyberpunk styling (dark background, monospace, cyan accents)
- Load `js/ui/preview.js` as `type="module"`

**CSS (inline or in a `<style>` block):**
- Body: `#0a0a0f` background, monospace font, no margin
- Two-column flexbox layout: graph takes ~65% width, controls take ~35%
- Graph container: same styling as the game (`position: relative; overflow: hidden; background: #0a0a0f`)
- Control panel: scrollable, padding, border-left with `var(--border)` color
- Slider inputs styled for dark theme
- Buttons: bordered, cyan on hover

**`js/ui/preview.js`:**
- Import `initGraph`, `syncProbeSweep`, `clearProbeSweep` from `./graph.js`
- Define fake network data with one demo node: `{ nodes: [{ id: "demo-probe", label: "PROBE", type: "router", grade: "C" }], edges: [] }`
- Call `initGraph(networkData, () => {}, () => {})` to initialize Cytoscape
- After init, manually add the node to Cytoscape as visible+accessible (since initGraph starts empty and reveals nodes on demand): use `getCy()` or access the cy instance
- Wire up a slider (0–1 range, step 0.01) that calls `syncProbeSweep("demo-probe", value)` on input
- Wire up a "Play" button that animates the slider from 0 to 1 over 3 seconds using requestAnimationFrame
- Wire up a "Reset" button that calls `clearProbeSweep()` and resets slider to 0

**Important:** `initGraph()` starts with an empty graph and adds nodes only when they become "visible" during gameplay. For the preview, we need to add nodes directly to Cytoscape after init. Check if graph.js exports `getCy()` or if we need to add that export. The nodes need `data.type` set so the stylesheet maps their shape correctly.

Also check: `addNode` is exported from graph.js and is used to add visible nodes. We may be able to call it directly with the right data shape, or we may need to add nodes via `cy.add()` after getting the cy reference.

Test by opening `preview.html` in a browser via `make serve`. Verify the probe sweep renders and the slider drives it.

---

## Phase 2: All 6 SVG overlay effects

Add the remaining 5 effects with their own demo nodes and controls.

### Prompt

Extend `preview.html` and `js/ui/preview.js` to include all 6 SVG overlay effects.

**Add 5 more demo nodes** to the fake network, positioned in a grid or column layout so they don't overlap. Each gets a label matching its effect:
- `demo-read` (Read Sectors)
- `demo-loot` (Loot Rings)
- `demo-exploit` (Exploit Brackets)
- `demo-ice` (ICE Detection)
- `demo-select` (Selection Reticle)

**Import** the additional functions from graph.js:
- `syncReadSectors`, `clearReadSectors`
- `syncLootRings`, `clearLootRings`
- `syncExploitBrackets`, `clearExploitBrackets`
- `syncIceDetectSweep`, `clearIceDetectSweep`
- `syncSelection`

**For each effect**, add a control panel section with:
- Effect name as header
- Slider (0–1, step 0.01) wired to the sync function
- Play button (animate 0→1 over 3s)
- Reset button (clear function + reset slider)

**Special cases:**
- Loot Rings: `syncLootRings` spawns interval-based rings — the slider drives `currentLootProgress` but rings spawn over time. Play button is more natural here.
- Exploit Brackets: also starts zap effects. Play triggers the full animation.
- Selection Reticle: no progress — just a toggle button (on/off). `syncSelection("demo-select")` to show, `syncSelection(null)` to hide.

Test each effect in the browser.

---

## Phase 3: Node flash + shape gallery + alert states

Add the non-overlay visual features.

### Prompt

Extend the preview to include node flash, shape gallery, and alert state demos.

**Node Flash section:**
- One demo node (`demo-flash`)
- Three buttons: "Success", "Failure", "Reveal"
- Each calls `flashNode("demo-flash", type)`
- Import `flashNode` from graph.js

**Node Shape Gallery:**
- Add a row of nodes to the graph, one per type from `NODE_SHAPES`: wan, gateway, router, firewall, workstation, ids, security-monitor, fileserver, cryptovault
- Each labeled with its type name
- Position them in a horizontal row below the effect demo nodes
- Cycle grades across the gallery (F, D, C, B, A, S, F, D, C) so border colors vary
- These are display-only — no controls needed

**Node Alert States:**
- Four demo nodes in a row: `demo-alert-green`, `demo-alert-yellow`, `demo-alert-red`, `demo-alert-reboot`
- Import `updateNodeStyle` from graph.js
- After adding nodes, call `updateNodeStyle` with mock state objects:
  - Green: `{ alertState: "green", accessLevel: "owned", visibility: "accessible" }`
  - Yellow: `{ alertState: "yellow", accessLevel: "owned", visibility: "accessible" }`
  - Red: `{ alertState: "red", accessLevel: "owned", visibility: "accessible" }`
  - Rebooting: `{ alertState: "green", accessLevel: "owned", visibility: "accessible", rebooting: true }`
- The pulse animations should start automatically from `updateNodeStyle`

Position all sections vertically in the graph area with enough spacing to avoid overlap.

Test in browser: shapes render correctly, flash works, alert states pulse.

---

## Phase 4: Polish + Play All

### Prompt

Final polish pass:

1. **"Play All" button** at the top of the control panel — triggers all 6 effects simultaneously so you can see the full visual vocabulary at once.

2. **Speed control** — a dropdown or slider for animation speed (0.5x, 1x, 2x, 4x) that scales the play button duration.

3. **Visual polish:**
   - Section headers with cyan underlines
   - Slider value display (e.g. "0.45" next to each slider)
   - Compact layout so all controls fit without excessive scrolling
   - Add a title: "STARNET — Visual Preview Harness"

4. Add `preview.html` to `.gitignore` exclusion if needed (it's a dev tool but should be tracked).

5. Update `CLAUDE.md` — add a note about `preview.html` in the architecture section.

Run `make check` to verify no lint/test regressions.

## Notes

All needed graph.js functions are already exported: `initGraph`, `getCy`, all `sync*`/`clear*` functions, `flashNode`, `updateNodeStyle`, `syncSelection`. No graph.js changes needed.

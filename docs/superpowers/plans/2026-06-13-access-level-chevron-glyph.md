# Access-level Chevron Glyph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a stroke-only chevron glyph to the node inspector header that encodes access tier (locked/open/owned) by lit-chevron count, colored to match the node fence ramp, making access glance-legible.

**Architecture:** A new pure SVG generator (`accessGlyphSvg`) in `js/ui/indicator-glyphs.js` alongside the existing alert-lamp/tick-meter generators, following their exact conventions (stroke-only, baked-in glow, deterministic, no DOM). The context-menu inspector header renders it as a data-URI `<img>` next to the existing access text label. A preview-harness swatch row lets us tune it without playing to the right game state.

**Tech Stack:** Vanilla ES modules, JSDoc `@ts-check`, Lit (light-DOM component), `node:test` unit tests.

**Spec:** `docs/superpowers/specs/2026-06-13-access-level-chevron-glyph-design.md` · **Approved mockup:** `…-mockup.html` (Treatment A — unified color).

**Branch & PR:** Work continues on the current branch `worktree-rename-compromised-cracked`. This feature builds directly on the `compromised → open` rename (it lights chevrons for the value `"open"`) and is in the same access-level UX area, so it extends PR #211 rather than opening a stacked PR. The final step broadens the PR title/body to cover both changes. (If you'd rather keep PRs single-concern, branch off here instead — noted at handoff.)

---

## File structure

- `js/ui/indicator-glyphs.js` — **modify**: add `ACCESS` palette, `ACCESS_LIT` count map, `CHEVRONS` geometry, `accessGlyphSvg`, `accessGlyphDataUri`. (Owns all stroke-only indicator geometry.)
- `js/ui/indicator-glyphs.test.js` — **modify**: add an `accessGlyphSvg` describe block.
- `js/ui/components/starnet-context-menu.js` — **modify**: import `accessGlyphDataUri`; render it in the `insp-meta` row.
- `css/style.css` — **modify**: add `.access-glyph` sizing rule.
- `js/ui/preview-cards.js` — **modify**: import `accessGlyphDataUri`; add an "Access level" swatch row.

---

## Task 1: `accessGlyphSvg` / `accessGlyphDataUri` generator (TDD)

**Files:**
- Modify: `js/ui/indicator-glyphs.js`
- Test: `js/ui/indicator-glyphs.test.js`

- [ ] **Step 1: Write the failing tests**

In `js/ui/indicator-glyphs.test.js`, add the two new names to the existing import block (top of file):

```js
import {
  alertLampSvg,
  alertLampDataUri,
  connStatusSvg,
  connStatusDataUri,
  tickMeterSvg,
  tickMeterDataUri,
  missionMarkSvg,
  missionMarkDataUri,
  accessGlyphSvg,
  accessGlyphDataUri,
} from "./indicator-glyphs.js";
```

Then add this describe block just before the final `// ── dataUri helpers` describe (the helper functions `countOccurrences`, `countPoints` already exist at the top of the file):

```js
  // ── accessGlyphSvg ────────────────────────────────────────────────────────────

  describe("accessGlyphSvg", () => {
    /** lit chevrons render at stroke-width 1.8; dim at 1.4. */
    const litCount = (svg) => countOccurrences(svg, `stroke-width="1.8"`);

    test("always renders exactly 3 chevron polylines", () => {
      for (const lvl of ["locked", "open", "owned", "—", "nonsense"]) {
        assert.equal(countOccurrences(accessGlyphSvg(lvl), "<polyline"), 3,
          `expected 3 polylines for "${lvl}"`);
      }
    });

    test("locked → 1 lit chevron", () => {
      assert.equal(litCount(accessGlyphSvg("locked")), 1);
    });
    test("open → 2 lit chevrons", () => {
      assert.equal(litCount(accessGlyphSvg("open")), 2);
    });
    test("owned → 3 lit chevrons", () => {
      assert.equal(litCount(accessGlyphSvg("owned")), 3);
    });
    test("unknown / obscured (—) → 0 lit chevrons", () => {
      assert.equal(litCount(accessGlyphSvg("—")), 0);
      assert.equal(litCount(accessGlyphSvg("nonsense")), 0);
    });

    test("locked lit hue is teal #45c4c4", () => {
      assert.ok(accessGlyphSvg("locked").includes("#45c4c4"));
    });
    test("open lit hue is azure #36a6e0", () => {
      assert.ok(accessGlyphSvg("open").includes("#36a6e0"));
    });
    test("owned lit hue is green-teal #2ad17a", () => {
      assert.ok(accessGlyphSvg("owned").includes("#2ad17a"));
    });

    test("unreached chevrons use the dim color #2a3a55", () => {
      // locked has 2 dim chevrons, open has 1.
      assert.ok(accessGlyphSvg("locked").includes("#2a3a55"));
      assert.ok(accessGlyphSvg("open").includes("#2a3a55"));
    });
    test("owned has no dim chevrons (no #2a3a55)", () => {
      assert.ok(!accessGlyphSvg("owned").includes("#2a3a55"));
    });

    test("stroke-only: top-level fill=none, no shape fill in body", () => {
      const svg = accessGlyphSvg("open");
      assert.ok(svg.includes(`fill="none"`));
      const body = svg.slice(svg.indexOf(">") + 1);
      assert.ok(!body.includes(`fill="#`), `body has a shape fill: ${body}`);
    });

    test("deterministic: identical args → identical string", () => {
      assert.equal(accessGlyphSvg("open"), accessGlyphSvg("open"));
    });

    test("accessGlyphDataUri starts with data:image/svg+xml,", () => {
      assert.ok(accessGlyphDataUri("owned").startsWith("data:image/svg+xml,"));
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test js/ui/indicator-glyphs.test.js`
Expected: FAIL — `accessGlyphSvg`/`accessGlyphDataUri` are `undefined` (import resolves to undefined; calling them throws "is not a function").

- [ ] **Step 3: Implement the generator**

In `js/ui/indicator-glyphs.js`, add this block after the `missionMarkSvg`/`missionMarkDataUri` section (near the end of the file, before any trailing export aggregation if present). It reuses the module-level `DIM` constant and the `dataUri` helper already defined at the top of the file:

```js
// ── accessGlyphSvg ────────────────────────────────────────────────────────────
// Three stacked point-up chevrons; lit-from-the-bottom count encodes the access
// tier (colorblind-safe: count is the primary channel). Lit chevrons take the
// current level's hue — the glance-legible bright sibling of the node fence ramp
// in node-glyphs.js (which is intentionally dimmed so the node border stays
// brightest). Deliberately NOT the alert green/amber/red ramp, so it never reads
// as alert state even sitting beside the alert lamp.

/** Bright header hues, by access level. @type {Record<string, string>} */
const ACCESS = {
  locked: "#45c4c4", // bright teal
  open:   "#36a6e0", // bright azure
  owned:  "#2ad17a", // bright green-teal (kept teal-ward to stay clear of alert green)
};

/** Lit-chevron count, by access level. @type {Record<string, number>} */
const ACCESS_LIT = { locked: 1, open: 2, owned: 3 };

/** Chevron polylines (viewBox 0 0 16 18), ordered bottom → top. */
const CHEVRONS = [
  "3,16.5 8,13 13,16.5",
  "3,11.5 8,8 13,11.5",
  "3,6.5 8,3 13,6.5",
];

/**
 * Access-level indicator: 3 stacked chevrons, lit from the bottom up by tier.
 *   locked → 1 lit · open → 2 lit · owned → 3 lit · anything else → 0 lit.
 * Lit chevrons use the level hue (stroke 1.8 + glow); unreached use DIM (stroke 1.4).
 *
 * @param {string} accessLevel
 * @returns {string} standalone SVG markup
 */
export function accessGlyphSvg(accessLevel) {
  const lit = ACCESS_LIT[accessLevel] ?? 0;
  const color = ACCESS[accessLevel] ?? DIM;
  let body = "";
  for (let i = 0; i < CHEVRONS.length; i++) {
    const isLit = i < lit;
    body += `<polyline points="${CHEVRONS[i]}"`
          + ` stroke="${isLit ? color : DIM}"`
          + ` stroke-width="${isLit ? 1.8 : 1.4}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 18" fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="1.4" flood-color="${color}"/></filter></defs>`
    + `<g filter="url(#g)">${body}</g></svg>`;
}

/**
 * Access glyph as an `<img src>`-ready data URI.
 * @param {string} accessLevel
 * @returns {string}
 */
export function accessGlyphDataUri(accessLevel) {
  return dataUri(accessGlyphSvg(accessLevel));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test js/ui/indicator-glyphs.test.js`
Expected: PASS — all new `accessGlyphSvg` tests green, existing tests unaffected.

- [ ] **Step 5: Lint**

Run: `make lint`
Expected: no errors (the `@type {Record<string, …>}` annotations let tsc accept the string-indexed lookups).

- [ ] **Step 6: Commit**

```bash
git add js/ui/indicator-glyphs.js js/ui/indicator-glyphs.test.js
git commit -m 'Add accessGlyphSvg: 3-chevron access-level indicator' \
  -m 'Stroke-only stacked chevrons, lit bottom-up by tier (locked=1/open=2/owned=3),
colored to match the node fence ramp; deliberately not the alert ramp. Pure
deterministic generator alongside the other indicator glyphs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task 2: Render the glyph in the inspector header

**Files:**
- Modify: `js/ui/components/starnet-context-menu.js:16` (import) and `:124` (markup)
- Modify: `css/style.css` (after `.nd-lamp`, ~line 842)

- [ ] **Step 1: Add the import**

In `js/ui/components/starnet-context-menu.js`, change line 16 from:

```js
import { alertLampDataUri } from "../indicator-glyphs.js";
```

to:

```js
import { alertLampDataUri, accessGlyphDataUri } from "../indicator-glyphs.js";
```

- [ ] **Step 2: Add the glyph to the access cell**

In the `_renderHeader` method, replace the access `<span>` (line 124):

```js
            <span class="im-val">${(node.accessLevel || "—").toUpperCase()}</span>
```

with (glyph before the label, mirroring the alert-lamp cell two lines below it):

```js
            <span class="im-val"><img class="access-glyph" alt="" src=${accessGlyphDataUri(node.accessLevel)}> ${(node.accessLevel || "—").toUpperCase()}</span>
```

- [ ] **Step 3: Add the CSS rule**

In `css/style.css`, add immediately after the `.nd-lamp { … }` block (which ends at line 842):

```css
.access-glyph {
  width: 12px;
  height: 14px;
  vertical-align: middle;
}
```

- [ ] **Step 4: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add js/ui/components/starnet-context-menu.js css/style.css
git commit -m 'Show access-level chevron glyph in the inspector header' \
  -m 'Renders accessGlyphDataUri(node.accessLevel) beside the access label in the
insp-meta row, mirroring the adjacent alert lamp. Text label retained for
console/LLM-legibility.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task 3: Add the glyph to the preview harness

**Files:**
- Modify: `js/ui/preview-cards.js` (import block ~lines 12-16, and `mountIndicatorSwatches`)

- [ ] **Step 1: Add the import**

In `js/ui/preview-cards.js`, add `accessGlyphDataUri` to the existing import from `./indicator-glyphs.js`:

```js
import {
  alertLampDataUri,
  connStatusDataUri,
  tickMeterDataUri,
  missionMarkDataUri,
  accessGlyphDataUri,
} from "./indicator-glyphs.js";
```

- [ ] **Step 2: Add an "Access level" swatch row**

In `mountIndicatorSwatches`, add this block at the end of the function (after the "Mission marks" loop, before the closing `}`):

```js
  // Access level — 3-chevron tier badge (lit bottom-up by tier)
  row("Access level");
  for (const level of ["locked", "open", "owned"]) {
    container.appendChild(cell(accessGlyphDataUri(level), level));
  }
```

- [ ] **Step 3: Lint**

Run: `make lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add js/ui/preview-cards.js
git commit -m 'Add access-level glyph swatches to the preview harness' \
  -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Task 4: Verify (tests + visual) and finalize

**Files:** none (verification + PR update)

- [ ] **Step 1: Full check**

Run: `make check`
Expected: lint clean; all tests pass (1137 prior + the new `accessGlyphSvg` cases).

- [ ] **Step 2: Visual check in the preview harness**

Run: `make bundle-vendor` (if not already built), then open `http://localhost:35345/preview.html` (the dev server from `make dev` is already running; the port may differ — check the server output).
Expected: the **Indicators** panel shows an "Access level" row with three chevron badges — locked (1 teal chevron + 2 dim), open (2 azure + 1 dim), owned (3 green-teal). Confirm at widget size the chevrons are crisp, the glow reads, and the three states are distinguishable by count alone (squint test).

- [ ] **Step 3: Visual check in the live inspector header**

Open `http://localhost:35345/` (the game). Probe then exploit a node to reach `open` (or use the playtest harness flow). Click the node to open the context menu / inspector header.
Expected: the `GRADE · ACCESS · ALERT` row shows the chevron glyph immediately left of the access word (`OPEN`), in the access hue, visibly distinct from the green/amber/red alert lamp at the end of the row. Verify a `locked` (unprobed-but-revealed) node shows 1 lit chevron and an obscured node shows the all-dim glyph without error.

- [ ] **Step 4: Tune if needed, then commit any adjustment**

If the visual check calls for a tweak (hue, `width/height` in `.access-glyph`, glow `stdDeviation`, chevron spacing), make the smallest change, re-run `make check`, and commit:

```bash
git add -A
git commit -m 'Tune access-glyph sizing/hue after visual check' \
  -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

If no tweak is needed, skip this commit.

- [ ] **Step 5: Push and broaden PR #211**

```bash
git push
gh pr edit 211 --title 'Access-level UX: rename "compromised" → "open" + inspector chevron glyph'
```

Add a section to the PR body summarizing the glyph feature (link the spec + mockup), or post a comment noting the added commits. Confirm CI is green.

---

## Self-review

- **Spec coverage:** generator (Task 1) ✓; header integration + label retained (Task 2) ✓; `.access-glyph` CSS (Task 2) ✓; preview harness (Task 3) ✓; tests for count/hue/dim/stroke-only/unknown (Task 1) ✓; obscured = all-dim, no new log/event, fence unchanged (Tasks 1/2 + non-goals honored — no graph.js/node-glyphs.js edits) ✓; visual verification incl. alert-lamp distinctness and obscured case (Task 4) ✓.
- **Placeholder scan:** none — every code step shows complete code; every command has expected output.
- **Type consistency:** `accessGlyphSvg` / `accessGlyphDataUri` names match across the generator, tests, context-menu import, and preview-cards import. `ACCESS`, `ACCESS_LIT`, `CHEVRONS`, `DIM`, `dataUri` all defined/available in `indicator-glyphs.js`. Lit-detection in tests (`stroke-width="1.8"`) matches the implementation's emitted attribute exactly.

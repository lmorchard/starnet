# Plan: Node Visual Indicators

## Overview

Four changes to `graph.js`, `index.html`, and `css/style.css`:

1. **Fix shape collision** — IDS and security-monitor get distinct shapes
2. **Redesign visual channels** — access level → fill, alert state → border
3. **Update flash animations** — `flashNode` currently flashes border; switch to fill
4. **Selection reticle** — replace magenta border override with an SVG ring animation

Each step leaves the game functional. Steps 1–3 are stylesheet/animation changes only.
Step 4 introduces a new DOM element and JS positioning logic.

---

## Step 1 — Fix IDS / Security-Monitor Shape Collision

**Context:** `NODE_SHAPES` in `graph.js` maps both `ids` and `security-monitor` to
`hexagon`. They're visually indistinguishable on the graph.

**Change:** Update `NODE_SHAPES` in `graph.js`:

```js
const NODE_SHAPES = {
  "gateway":          "diamond",
  "router":           "ellipse",
  "firewall":         "pentagon",
  "workstation":      "ellipse",
  "ids":              "hexagon",
  "security-monitor": "octagon",   // was: "hexagon"
  "fileserver":       "rectangle",
  "cryptovault":      "diamond",
};
```

`octagon` reads as "heavier" and more authoritative — appropriate for the node that
drives global alert level.

**After this step:** IDS and security-monitor are visually distinct. No other changes.

---

## Step 2 — Redesign Visual Channels (Fill → Access Level, Border → Alert)

**Context:** Currently the border encodes access level; background-color encodes alert
state. They collide (red alert wipes out access-level border color; selection also
overwrites it). Swapping channels resolves all three conflicts.

**Changes to `buildStylesheet()` in `graph.js`:**

### Base accessible node (locked, no alert)

```js
{
  selector: "node.accessible",
  style: {
    // ... (label, font, size properties unchanged)
    "background-color": "#080810",   // dark/absent — locked = nearly invisible fill
    "border-width": 1,
    "border-color": "#1a3333",       // minimal, nearly invisible (quiet/green alert)
  },
},
```

### Access level — compromised

Move from border-color to background-color:

```js
{
  selector: "node.accessible.compromised",
  style: {
    "background-color": "#061525",   // dim cyan-blue tint — foothold, contested
  },
},
```

### Access level — owned

```js
{
  selector: "node.accessible.owned",
  style: {
    "background-color": "#051a08",   // dim green tint — territory, claimed
    "border-width": 1,               // no longer needs wider border
  },
},
```

### Alert state — yellow (border, not background)

```js
{
  selector: "node.accessible.alert-yellow",
  style: {
    "border-color": "#996600",       // amber border — disturbed
    "border-width": 2,
  },
},
```

### Alert state — red (border, not background)

```js
{
  selector: "node.accessible.alert-red",
  style: {
    "border-color": "#cc1100",       // red border — hostile
    "border-width": 2,
  },
},
```

### Selection — remove game-selected border rule

Remove the `node.game-selected` CSS rule from `buildStylesheet()`. Remove the
`removeClass("game-selected")` and `addClass("game-selected")` calls from
`syncSelection()`. The reticle in Step 4 replaces this entirely.

**Update JS pulse animations:**

`runYellowPulse` currently animates `background-color`. Switch to `border-color`:

```js
function runYellowPulse(node) {
  const id = node.id();
  if (!yellowPulsingNodes.has(id)) return;
  node.animate(
    { style: { "border-color": "#cc8800", "border-width": 2 } },
    { duration: 900, complete: () => {
      if (!yellowPulsingNodes.has(id)) return;
      node.animate(
        { style: { "border-color": "#553300", "border-width": 2 } },
        { duration: 1200, complete: () => runYellowPulse(node) }
      );
    }}
  );
}
```

`runRedPulse` already animates border-color — adjust values to match new baseline:

```js
function runRedPulse(node) {
  const id = node.id();
  if (!pulsingNodes.has(id)) return;
  node.animate(
    { style: { "border-color": "#ff4040", "border-width": 3 } },
    { duration: 400, complete: () => {
      if (!pulsingNodes.has(id)) return;
      node.animate(
        { style: { "border-color": "#cc1100", "border-width": 2 } },
        { duration: 700, complete: () => runRedPulse(node) }
      );
    }}
  );
}
```

**After this step:** Access level is visible in fill at all times. Alert state is
visible in border at all times. The two no longer overwrite each other. Selection
is temporarily invisible (Step 4 will restore it via reticle).

---

## Step 3 — Update `flashNode` to Use Fill Instead of Border

**Context:** `flashNode` (success/failure/reveal) currently flashes `border-color`.
With border now owned by alert state, these momentary flashes should use fill
(background-color) instead. They use `removeStyle()` to clean up, so they won't
permanently conflict with access-level fill — just wrong channel.

**Changes to `flashNode` in `graph.js`:**

```js
// success: fill flashes to bright cyan tint
if (type === "success") {
  node.animate(
    { style: { "background-color": "#0d3a3a" } },
    { duration: 150, complete: () =>
      node.animate(
        { style: { "background-color": "#041820" } },
        { duration: 350, complete: () => node.removeStyle("background-color") }
      )
    }
  );
}

// failure: fill flashes red
else if (type === "failure") {
  node.animate(
    { style: { "background-color": "#2a0505" } },
    { duration: 150, complete: () =>
      node.animate(
        { style: { "background-color": "#150202" } },
        { duration: 350, complete: () => node.removeStyle("background-color") }
      )
    }
  );
}

// reveal: dim cyan fill pulse
else if (type === "reveal") {
  node.animate(
    { style: { "background-color": "#061525" } },
    { duration: 250, complete: () =>
      node.animate(
        { style: { "background-color": "#080810" } },
        { duration: 500, complete: () => node.removeStyle("background-color") }
      )
    }
  );
}
```

**After this step:** All visual state is consistently channeled. Border = alert.
Fill = access level. Flash animations don't cross channels.

---

## Step 4 — Selection Reticle (SVG Ring Animation)

**Context:** Selection currently uses a magenta border override (removed in Step 2).
Replace with an SVG ring positioned around the selected node — animated to show
dashes scrolling around the circumference (reads as rotation). Lives in the DOM
above the Cytoscape canvas. `#graph-container` is already `position: relative`,
so the SVG can be placed inside it as a sibling of `#cy`.

### 4a — Add SVG to `index.html`

Add inside `#graph-container`, as a sibling of `#cy`:

```html
<div id="graph-container">
  <div id="cy"></div>
  <svg id="selection-reticle"
       style="position:absolute; display:none; pointer-events:none; overflow:visible; z-index:6;">
    <circle id="reticle-ring" cx="30" cy="30" r="28"
            fill="none"
            stroke="#cc00cc"
            stroke-width="1.5"
            stroke-dasharray="6 3"
            stroke-opacity="0.75"/>
  </svg>
</div>
```

### 4b — Add CSS to `style.css`

```css
/* Selection reticle — animated SVG ring overlay */
#reticle-ring {
  animation: reticle-dash 5s linear infinite;
}

@keyframes reticle-dash {
  from { stroke-dashoffset: 0; }
  to   { stroke-dashoffset: -200; }
}
```

Negative dashoffset increment makes dashes appear to travel clockwise. The value
`-200` slightly exceeds the circumference of an ~r30 ring (≈188px), giving a
smooth continuous-loop feel at any zoom level.

### 4c — Add reticle logic to `graph.js`

Add a module-level variable to track the currently selected node:

```js
let currentSelectedNodeId = null;
```

Add `syncReticle()` function:

```js
function syncReticle() {
  const svg = document.getElementById("selection-reticle");
  if (!svg) return;

  if (!currentSelectedNodeId || !cy) {
    svg.style.display = "none";
    return;
  }

  const node = cy.getElementById(currentSelectedNodeId);
  if (!node || node.length === 0) {
    svg.style.display = "none";
    return;
  }

  const pos = node.renderedPosition();
  const r = (node.renderedWidth() / 2) + 12;  // node radius + gap
  const size = r * 2;

  const ring = document.getElementById("reticle-ring");
  ring.setAttribute("cx", r);
  ring.setAttribute("cy", r);
  ring.setAttribute("r", r - 2);

  svg.style.width  = `${size}px`;
  svg.style.height = `${size}px`;
  svg.style.left   = `${pos.x - r}px`;
  svg.style.top    = `${pos.y - r}px`;
  svg.style.display = "block";
}
```

Update `syncSelection()` to track selection and call `syncReticle`:

```js
export function syncSelection(nodeId) {
  if (!cy) return;
  currentSelectedNodeId = nodeId || null;
  syncReticle();
}
```

Register pan/zoom handler in `initGraph()` so the reticle follows viewport changes:

```js
cy.on("pan zoom", syncReticle);
```

**After this step:** Selected node has an animated dashed ring floating around it.
Pan and zoom keep it correctly positioned. Selection no longer overwrites fill or
border, so access level and alert state remain readable while a node is selected.

---

## Commit Strategy

- **Step 1** alone: `Fix: IDS and security-monitor node shape collision`
- **Steps 2–3** together: `Redesign node visual channels: fill=access level, border=alert state`
- **Step 4** alone: `Feature: selection reticle replaces magenta border override`

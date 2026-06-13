# Notes: Eliminate top header → bottom status bar

## Summary

Removed the top HUD header entirely and relocated the status elements into a
full-width status bar that sits directly above the terminal + hand strip
(brainstorm layout "Option A"). The game title (`★ STARNET`) is gone; the graph
now reclaims the whole top band.

Kept `<starnet-hud>` as a single component — only its position, title, and the
menu-dropdown direction changed. Because the component's public property API was
untouched, `syncHud()` and the `main.js` `hud-action` wiring needed **no
changes**, keeping the blast radius to render markup + CSS.

## What changed

- **`index.html`** — moved `<starnet-hud id="hud">` from the top of `#app` to
  inside `#graph-column`, below the `.splitter` and above `#bottom-row`.
- **`js/ui/components/starnet-hud.js`** — dropped the `★ STARNET` title;
  re-added `${this._renderCheatLabel()}` (the `// CHEAT` label was preserved in
  code specifically for this "status bar under the terminal"); refreshed the
  stale comments and the component header comment ("Status bar", not "Header bar").
- **`css/style.css`** — `#hud` restyled from top header (`border-bottom`,
  `z-index:10`) to a bottom strip (`border-top`, normal flow); removed the
  obsolete `.hud-title` rule; added `margin-left:auto` to `.hud-menu-wrap` so the
  `☰` floats to the far right while status items stay left; flipped `#hud-menu`
  to open upward (`bottom: calc(100% + 0.4rem)`).
- **`MANUAL.md`** — updated the interface ASCII diagram (status bar now sits
  below the graph, above the log), the HUD → "Status bar" description, and the
  "header bar / HUD top bar / header controls panel" wording.

## Hamburger decision

Original ask floated putting `☰` inside the terminal input field. On reflection
(and confirmed by Les) it went to the **right end of the status bar** instead —
keeps `starnet-hud` a single component with no wiring split, and the bar sits one
row above the input anyway so it's visually almost identical. Dropdown opens
upward since the bar is at the bottom of the screen.

## Verification

- `make check` (tsc + tests): pass — 1150 tests, 0 fail.
- Visual (Playwright against `make serve`): header band gone / graph reclaims it;
  status bar reads `PASSIVE SCAN · ALERT: GREEN · WALLET · MISSION ▶ ACTIVE` with
  `[ ☰ ]` far right; menu dropdown opens upward over the graph (verified menu
  bottom 483px sits above button top 492px) and renders cleanly.

## Follow-ups / notes

- Hand strip layout is still a work in progress (Les) — left untouched.
- No `preview.html` change: this relocates existing chrome, not a new effect.

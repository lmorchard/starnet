# Exploit Card Redesign Spec

**Goal:** Tighten the exploit-card rendering (kill the dead space from the fixed 160px height) and move the in-graph XPLOIT submenu to 3 columns, via a light two-zone card redesign shared by the hand and the picker.

**Source:** Follow-up to #117 (exploit legibility), user request 2026-06-10.

## Current state

`exploitCardBody()` (`js/ui/components/exploit-card-view.js`) renders, top to bottom: header (index + name), a `QUAL` row (3rem text key + colored pips), a `USES` row (3rem text key + value), and a `.ec-vulns` column of glyph+label rows. The card chrome `.exploit-card` (`css/style.css`) is a **fixed `height: 160px`** flex column, so low-vuln cards show a large empty lower half.

Consumers: the hand (`starnet-hand.js`, `.nd-hand` 2-col grid) and the graph XPLOIT picker (`starnet-action-choices.js`, `#action-choices .ac-choices` 2-col grid in a `max-width: 320px` panel). Both call `exploitCardBody(card, indexLabel?, matchedVulnIds?)`.

Match highlight (green glow/lift + per-glyph lock), quality color ramp (`qualityTier` → `.ec-pips.q0..q4`), wear (`wearFraction` → `--wear` desaturation + `.worn` cracks + `.disclosed` burnt), and rarity border all already exist from #117.

## Desired end state

A **two-zone card**, content-height (no fixed height):
- **Identity zone (top):** name (with `N.` index in the hand), then the vuln area.
- **Stat footer (bottom):** quality pips on the left, uses on the right, separated by a top border. The `QUAL`/`USES` text keys and their 3rem column are gone.

**Hybrid vuln rendering:**
- **Hand (inventory):** glyph **+ text label**, one vuln per row (rare 3-vuln cards grow taller; the 2-col grid keeps pairs row-aligned). Stays **2 columns**.
- **Graph XPLOIT submenu:** **glyphs in a single row**, no labels. Moves to **3 columns**, fitting the existing ~320px panel.

All #117 treatments carry over unchanged: rarity border, match glow/lift + per-glyph lock, quality color ramp, wear desaturation/cracks, `disclosed` (greyed/struck/burnt — rendered in the footer as `DISCLOSED`). Worn cards show the uses count marked in the footer.

Console/`status` text representation is untouched (this is presentational only).

## Design decisions

- **Decision:** Two-zone layout (identity + stat footer), content-height, drop the `QUAL`/`USES` text keys.
  - **Why:** The fixed 160px + per-stat text rows are the source of the bulk/empty space. Pips already read as quality; a compact footer recovers the vertical space and gives a clean place for pips+uses.
  - **Rejected:** Glyph-forward "hero glyph" direction (B) — strong at-a-glance but sacrifices the text labels the hand benefits from; compact-stacked (A) — kept the inline stat line but read busier than the footer separation.

- **Decision:** Hybrid vuln rendering via a parameter on the shared `exploitCardBody`.
  - **Why:** Labels aid learning in the persistent, roomy hand; glyph-only keeps the transient, tight 3-col submenu clean and lets even rare (3-target) cards stay short. Keeping one shared component (with a mode flag) preserves the GUI/console symmetry and the single match/quality/wear surface.
  - **Rejected:** Two separate card components (drifts visually, duplicates the footer/header/state logic); labels everywhere (3-col submenu too cramped); glyph-only everywhere (loses hand learnability).

- **Decision:** Submenu to 3 columns within the existing ~320px panel; hand stays 2 columns.
  - **Why:** Glyph-only cards are narrow enough for 3 columns at the current panel width — no need to widen the panel. The user only asked to densify the submenu; the hand at 2-col already reads fine.
  - **Rejected:** Widening the panel for 3 labeled columns (unnecessary once the submenu is glyph-only).

## Patterns to follow

- Extend `exploitCardBody(card, indexLabel?, matchedVulnIds?)` (`js/ui/components/exploit-card-view.js`) with a vuln-rendering mode (e.g. an options arg or a `glyphsOnly` flag). Hand passes labeled mode; `starnet-action-choices.js` passes glyph-row mode. Keep header/footer/match/quality/wear shared.
- Mirror the existing class conventions (`.ec-*`, `.exploit-card.match/.no-match/.worn/.disclosed`, `.ec-pips.qN`, `--wear`) — restructure CSS into the two-zone layout without changing the state-class contract, so #117's match/quality/wear rules keep working.
- `css/style.css`: replace the fixed-height `.exploit-card` block and the `.ec-header/.ec-row/.ec-key/.ec-vulns` rules with the two-zone structure (`.ec-top`, `.ec-foot`); update `.nd-hand` (stays 2-col) and `#action-choices .ac-choices` (→ 3-col).
- Preview harness: the existing card gallery (`js/ui/preview-cards.js`) and the swatch sheet already exercise rarity/quality/wear/match — verify the redesign there; add a 3-col submenu-style sample if the gallery doesn't already cover the glyph-row mode.

## What we're NOT doing

- **No game-logic changes** — purely presentational (layout/CSS + a render-mode param). Match/quality/wear/decay logic from #117 is untouched.
- **Not changing the glyph artwork** — the 15 glyphs stay as-is (separate follow-up).
- **Not widening the submenu panel** — 3 columns fit the current ~320px via glyph-only cards.
- **Not changing the hand column count** — stays 2.
- **Not touching console/`status` text** rendering.
- **Not changing what the footer displays for uses** — keeps the explicit count (`N×`) for now. Obscuring the count / reframing decay as white-hat/blue-team patch disclosure is [#143](https://github.com/lmorchard/starnet/issues/143), sequenced after this redesign. The two-zone **footer is the single display surface** that follow-up will swap, so this redesign deliberately localizes uses-rendering there.
- **Not adding tooltips** for the glyph-only submenu labels in this pass (the node panel + hand already carry the text; revisit if it tests poorly).

## Open questions

- **Worn footer treatment.** *Default:* show the uses count with a worn marker in the footer (e.g. tinted `N×` or `N× worn`), consistent with current "(worn)" semantics; tune in the preview. Not a blocker.
- **Card min-height / grid raggedness.** *Default:* content-height with no min; the 2-col hand grid aligns row pairs, and submenu rows align per grid row. If single-vuln cards look too short next to 3-vuln ones, add a small `min-height`. Decide visually in the preview. Not a blocker.

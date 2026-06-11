# Exploit Card Redesign — Implementation Plan

**Goal:** Restructure the exploit card into a content-height two-zone layout (identity + stat footer) shared by the hand and the graph XPLOIT picker, and move the picker to 3 columns.

**Approach:** Rewrite the shared `exploitCardBody` into a two-zone fragment with a `glyphsOnly` render mode (hand = glyph+label rows, picker = glyph row); replace the fixed-height card CSS with the two-zone structure; switch the picker grid to 3 columns. All #117 state classes (`.match/.no-match/.worn/.disclosed`, `.ec-pips.qN`, `--wear`/`--sat-extra`, rarity) keep their contract so match/quality/wear keep working.

**Tech stack:** Lit component (light DOM), CSS, preview harness + Playwright for visual verification.

**TDD note:** Presentational restructure — no new pure logic, so test-first doesn't apply. Verification is the existing suite (regression) + lint + visual checks in the preview harness and live game.

---

## Phase 1: Two-zone card (component + CSS), both surfaces

Rewrite `exploitCardBody` into identity-zone + stat-footer with a `glyphsOnly` mode, and replace the card CSS. Hand renders labeled (default); the picker passes `glyphsOnly = true`. Drops the fixed 160px height and the `QUAL`/`USES` text rows.

**Files:**
- Modify: `js/ui/components/exploit-card-view.js` — two-zone body + `glyphsOnly` param
- Modify: `js/ui/components/starnet-action-choices.js` — pass `glyphsOnly = true`
- Modify: `js/ui/components/starnet-hand.js` — (no signature change needed; confirm it omits the new param so it stays labeled)
- Modify: `css/style.css` — replace `.exploit-card` fixed-height block, `.ec-header/.ec-row/.ec-key/.ec-val/.ec-vulns` with two-zone (`.ec-top`, `.ec-foot`, `.ec-uses`, `.ec-vulns.glyphs-only`)

**Key changes:**

`exploitCardBody` — new signature `exploitCardBody(card, indexLabel, matchedVulnIds = [], glyphsOnly = false)`:
```js
export function exploitCardBody(card, indexLabel, matchedVulnIds = [], glyphsOnly = false) {
  const disclosed = card.decayState === "disclosed";
  const worn = card.decayState === "worn";
  const qualityPips = Math.round(card.quality * 5);
  const pips = "█".repeat(qualityPips) + "░".repeat(5 - qualityPips);
  const matched = new Set(matchedVulnIds);

  const vulns = card.targetVulnTypes.map((t) => html`
    <div class="ec-vuln ${matched.has(t) ? "matched" : ""}">
      <img class="ec-vuln-glyph" src=${vulnGlyphDataUri(t)} alt="" />
      ${glyphsOnly ? nothing : html`<span class="ec-vuln-label">${t}</span>`}
    </div>`);

  return html`
    <div class="ec-top">
      <div class="ec-header">
        ${indexLabel ? html`<span class="ec-index">${indexLabel}</span>` : nothing}
        <span class="ec-name">${card.name}</span>
      </div>
      <div class="ec-vulns ${glyphsOnly ? "glyphs-only" : ""}">${vulns}</div>
    </div>
    <div class="ec-foot">
      <span class="ec-pips ${qualityTier(card.quality)}">${pips}</span>
      <span class="ec-uses ${worn ? "worn" : ""}">${disclosed ? "DISCLOSED" : `${card.usesRemaining}×`}</span>
    </div>`;
}
```
- `starnet-action-choices.js` `_renderChoice`: `${exploitCardBody(choice.data, undefined, matched, true)}` (4th arg `true`).
- `starnet-hand.js` `_renderCard`: stays `${exploitCardBody(card, `${index}.`, matchedVulnIds)}` (glyphsOnly defaults false). No change required — confirm only.

CSS — replace the fixed-height `.exploit-card` rule and the header/row/key/val/vulns rules:
```css
.exploit-card {
  border: 1px solid var(--grey);
  display: flex;
  flex-direction: column;
  font-size: 0.72rem;
  background: var(--bg-panel2);
  position: relative;
  overflow: hidden;
  /* content-height — no fixed height (was 160px) */
}
/* base wear filter rule, rarity rules, .worn/.disclosed, .match/.no-match,
   .ec-pips.qN, .ec-vuln.matched all UNCHANGED — keep their existing blocks */

.ec-top {
  padding: 0.4rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.ec-header { display: flex; align-items: baseline; gap: 0.25rem; }  /* drop margin-bottom: 0.5rem */
.ec-index  { color: var(--text-dim); font-size: 0.7rem; flex-shrink: 0; }
.ec-name   { color: var(--green); overflow-wrap: break-word; min-width: 0; }

.ec-vulns { display: flex; flex-direction: column; gap: 0.15rem; overflow: hidden; }  /* drop margin-top: 0.6rem */
.ec-vulns.glyphs-only { flex-direction: row; gap: 0.4rem; flex-wrap: wrap; }

.ec-vuln { display: flex; align-items: center; gap: 0.3rem; color: var(--text-dim); font-size: 0.65rem; white-space: nowrap; overflow: hidden; }
.ec-vuln-glyph { width: 16px; height: 16px; flex-shrink: 0; }
.ec-vuln-label { overflow: hidden; text-overflow: ellipsis; }

.ec-foot {
  margin-top: auto;            /* stick to card bottom; grid stretches row pairs */
  border-top: 1px solid #223;
  background: var(--bg-panel);
  padding: 0.25rem 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.7rem;
}
.ec-pips { letter-spacing: 0.05em; }     /* color comes from .qN ramp */
.ec-uses { color: var(--green); }
.ec-uses.worn { color: #e08a1e; }        /* amber tint signals worn; cracks/desat carry the rest */
```
Delete the now-unused `.ec-row`, `.ec-key`, `.ec-val` rules (the new body emits none of them). Keep `.ec-pips.q0..q4` exactly as-is.

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes (regression — 821 pass; preview-card-gallery test still green)
- [x] `make check` passes

**Verification — manual (preview harness via Playwright):**
- [x] `make bundle-vendor`; serve; open `preview.html` — hand card gallery: cards are content-height (no empty lower half), name + glyph/label rows on top, pips+uses footer. Rarity borders, quality pip colors, match glow + glyph lock, worn cracks + amber uses, disclosed burnt/struck all still render. *Verified via screenshot; 0 console errors.*
- [x] A rare 3-vuln card shows three glyph+label rows and grows taller; its 2-col grid partner stretches to match with its footer pinned to the bottom. *Verified: 3 vuln rows; worn partner footer got 18.55px auto top-margin to align; worn uses amber #e08a1e.*

---

## Phase 2: 3-column XPLOIT submenu + polish

Switch the picker grid to 3 columns and finish the glyph-row submenu look; resolve the worn-footer and min-height open questions visually; update the manual.

**Files:**
- Modify: `css/style.css` — `#action-choices .ac-choices` → 3 columns; any submenu-specific sizing
- Modify: `MANUAL.md` — note the card layout/footer + 3-col submenu if the Exploit Cards section describes layout
- (Possibly) Modify: `css/style.css` — add `.exploit-card { min-height: … }` only if single-vuln cards look too ragged next to multi-vuln ones (decide in preview)

**Key changes:**
```css
#action-choices .ac-choices {
  display: grid;
  grid-template-columns: repeat(3, 1fr);  /* was 1fr 1fr */
  gap: 0.5rem;
  max-height: 50vh;
  overflow-y: auto;
}
```
- Panel stays `max-width: 320px` — glyph-only cards (≈97px) fit 3 across. If they feel cramped, nudge panel `max-width` up slightly (decide in preview); note the value chosen.
- Worn footer: the amber `.ec-uses.worn` tint from Phase 1 is the marker; confirm it reads at submenu width. (Worn cards can appear in the picker; disclosed cannot.)
- Min-height: default is content-height (no min). Add a small `min-height` only if the preview shows ragged single-vuln cards — record the decision in notes.

**Verification — automated:**
- [x] `make lint` passes
- [x] `make test` passes
- [x] `make check` passes

**Verification — manual (preview + live game via Playwright):**
- [x] Live game: open the XPLOIT submenu on a probed node — 3 columns, glyph-row cards (no labels), matching cards glow + glyph lock, fits the panel without horizontal scroll. *Verified: 3 cols, 320px panel, no x-overflow, glyphsOnly active (0 labels), 3-vuln glyphs fit one row.*
- [x] Hand still 2 columns with labels; switching node selection updates match highlight in both hand and submenu. *Verified: hand `.nd-hand` 2-col.*
- [x] Executing-card state in the hand still renders correctly with the two-zone layout (progress fill + cancel overlay not broken by `.ec-foot { margin-top:auto }`). *Verified: EXECUTING label renders below footer, cyan border + fill + cancel intact.*
- [x] `status` text output unchanged. *No `js/core/console-commands/` changes.*

**Decisions recorded:** no `min-height` added (cards read well at content height); submenu panel kept at `max-width: 320px` (3 glyph-only cards fit without overflow).

---

## Final verification (before PR)

- [x] `make check` clean (821 tests, lint)
- [x] `make bundle-vendor && make serve` → verified via Playwright (preview + live game): hand reads tighter (no dead space), XPLOIT submenu is 3-col glyph-row, all #117 treatments intact, 0 console errors.
- [x] Bot still runs cleanly (`make census SEEDS=10`) — ran 10 seeds, no errors; success rate is a balance metric unaffected by the presentational change.
- [x] `MANUAL.md` updated (clarified hand/panel show labels, picker is glyph-only "express" view); footer keeps the explicit `N×` count (per #143 deferral).

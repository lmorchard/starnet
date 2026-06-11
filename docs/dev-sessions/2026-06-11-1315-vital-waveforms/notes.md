# Notes — Vital-Sign Waveforms

## Filed
- Issue: https://github.com/lmorchard/starnet/issues/157
- Date: 2026-06-11
- Resume command: `/dev-session express https://github.com/lmorchard/starnet/issues/157`

## Session log
- Brainstormed design: Health+Deck mapping, faster+erratic ECG, flatten+glitch pulse,
  inline placement now + stacked-strip prototype in preview.
- Worktree: `.worktrees/vital-waveforms` on branch `vital-waveforms`.
- Baseline: 928 tests passing.

## Final summary

Replaced the HUD's HEALTH/DECK bar meters with animated Zoids-style vital-sign waveforms
(homage to the 1986 Zoids C64 dashboard). Executed subagent-driven (implementer + spec
review + code-quality review per phase), all autonomous.

**What shipped:**
- `js/ui/waveform.js` — pure, deterministic SVG-waveform geometry (ECG + square pulse),
  33 unit tests. No `Math.random` (deterministic `hash01`); straight segments only.
- `js/ui/components/starnet-waveform.js` — `<starnet-waveform>` Lit component; self-animates
  a scroll `_phase` via rAF (ephemeral, not in game state). Guards against double-start; phase wraps.
- Preview demo (`preview.html` / `preview.js` / `style.css`) — health/deck sliders + an
  inline-vs-stacked-strip layout toggle; added `--violet` palette token.
- HUD (`starnet-hud.js`) — bar meters → waveforms (green ECG = health, violet pulse = deck);
  `_meter` helper and dead `.hud-meter*` CSS removed. Numeric value now on hover `title`.
- Docs — CLAUDE.md (visual effects moved into scope), MANUAL.md (HUD/HEALTH-DECK display).

**Mappings (final):** HEALTH → green ECG, beats faster + more erratic as health falls,
flatline at 0. DECK → violet square pulse, amplitude shrinks + dropout glitches as integrity
falls, flatline at 0.

**Verification:** `make check` green (957 tests, 0 fail; lint clean). Automated checks
complete with evidence; **manual eyeball checks left unchecked for Les** (animation feel,
violet hue, inline-vs-strip choice, degradation under real damage) — autonomous execution
can't self-verify these.

**Deferred / follow-ups:**
- Layout decision: shipped HUD-inline (per spec default); stacked-strip exists in preview
  only, for comparison. Whether to adopt the strip in-game is a follow-up.
- Tuning by eye: `--violet` hue (`#b06cff` placeholder), HUD waveform dimensions
  (`w=96 h=22`), scroll speed (`0.003`/frame), beat-count range (2–6) — all eyeball-tunable.
- Geometry edge note: phase aliasing at beat-period multiples is expected/correct (see
  `waveform.test.js` comment).

**Commits:** Phase 1 `b7b4630` (+review `7a8cbab`), Phase 2 `11f3e81` (+review `685f201`),
Phase 3 `71ea45f` (+review `a084275`), Phase 4 `6707c64` (+`acd91d4`), Phase 5 `353a915`.

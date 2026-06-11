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

## Retrospective

> The "Final summary" above describes only **v1** — the autonomous subagent build. The
> feature that actually merged (PR #159) is a near-total redesign that happened *after*,
> in a long interactive-tuning loop with Les. Recording the real arc here.

**Recap.** Shipped two animated vital-sign traces replacing the HUD HEALTH/DECK meters:
a clinical PQRST(+U) ECG and a double square-pulse deck monitor, rendered as a vector-CRT
sweep (dot + fading phosphor trail) on `<canvas>`, stacked at the top of the sidebar with
label + depleting pip meters. Health/deck degradation drives shape (faster/erratic ECG;
ringing/dropout/glitch breakdown on the deck pulse).

**Scope drift (large, and instructive).** The spec/plan/autonomous-execute pipeline
produced a *correct but shallow* v1: scrolling SVG waveforms in the HUD header — exactly
what the spec literally said, including its explicit deferral of the stacked-strip layout.
But essentially everything that makes the feature good emerged **after** merge-of-plan,
none of it in the spec: the CRT sweep+phosphor animation model (replaced scroll), the
clinical PQRST shape, the deck breakdown behavior, canvas (replaced SVG), and the sidebar
placement (replaced header, via a full-width-strip detour). v1 was a scaffold; the feature
was hand-tuned on top of it.

**The hero: a throwaway interactive lab.** `tmp/waveform-lab.html` (Canvas + sliders for
every knob) let Les drive ~15 fast visual-iteration rounds. Converging on "trailing bounce,"
"phosphor burn-in," "ring that takes over near 0 health" was trivial visually and would
have been miserable in prose or through the real component's test suite. Saved as a memory
([[interactive-lab-for-visual-tuning]]).

**Workflow friction.** Subagent-driven *autonomous* execution was the wrong fit for the
visual half of this feature. Its two-stage reviews dutifully verified spec-compliance of a
v1 whose every visual default (SVG, scroll, header) we then threw away. The discipline was
sound; it was aimed at the wrong target. The feel could not be specified up front, so
"execute the plan autonomously" optimized for the wrong thing.

**Surprises.** (1) Detail tuned at 720×90 in the lab was illegible at 96×22 in the header —
placement is a *function of* the visual density, not independent of it. (2) Canvas phosphor
fade has a rounding-floor burn-in under any iterative alpha decay; the fix is redraw-from-
history each frame (journaled). (3) Per-segment `shadowBlur` is a perf cliff; age-band it.

**Misses.** I should have flagged at brainstorm that this was a *feel-driven* feature the
spec couldn't capture, and built the lab THEN — before any autonomous build. We'd have
skipped writing (and reviewing, and testing) a v1 that was almost entirely replaced.

**Skill candidate.** The dev-session flow could gain a cue: when a feature is dominated by
subjective visual/animation judgment, prefer an interactive-prototype phase (lab harness +
human iteration) over `express`/autonomous `execute`; the latter locks in defaults that
feel-work will discard. Worth folding into brainstorm/plan guidance.

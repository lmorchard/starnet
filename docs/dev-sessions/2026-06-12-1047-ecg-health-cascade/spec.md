# ECG health-degradation cascade

**Goal:** Make the health (ECG) waveform deteriorate through a clinically-ordered cascade of
real ECG abnormalities as health falls — subtle early, unmistakable near death — so it reads
as escalating danger (and as an Easter egg for anyone who knows ECGs).

**Source:** User request from 2026-06-12, follow-up to the vital-waveforms / deck-clock work.
Cascade tuned by eye in the lab (saved at `lab/waveform-lab.html` in this session folder).

## Current state

`js/ui/waveform.js` `ecgPoints({frac,width,height})` draws a clinical PQRST(+U) complex; its
only health degradation today is faster rate (beat count `lerp(4,7,1-frac)`) plus spike/timing
jitter. Drawn by the `<starnet-waveform>` CRT sweep; deterministic (`hash01`, no `Math.random`).

## Desired end state (locked in the lab)

`severity = 1 - frac` drives an ordered cascade layered onto the existing PQRST(+U):
- **ST-segment elevation** — J point + ST segment lift above baseline (`H*0.16*severity^1.3`).
- **T-wave flattening → inversion** — T amplitude eases from upright to inverted
  (`lerp(T, -0.85T, ease(severity-0.15))`).
- **QRS widening** — Q shifts earlier, S later (`±0.025–0.03 * severity` in complex-fraction).
- **PVCs** — per-beat chance (`~0..0.30`, onset ~35% damage): a premature, P-less, wide/bizarre
  QRS + compensatory pause.
- **Dropped beats** — per-beat chance (`~0..0.30`, onset ~55% damage): a P wave with no QRS/T.
- **Ventricular fibrillation** — below **7%** health the discrete complex dissolves into a
  disorganized chaotic oscillation (amplitude scales as it nears 0), then the existing
  `frac<=0` flatline (asystole).
- Faster rate + jitter (existing) carry through.

Roughly the order a real heart decompensates: ST/T changes → ectopy/conduction failure → VF →
asystole.

## Design decisions

- **Clinically-ordered, threshold-layered cascade** (not all-at-once) — subtle early, dramatic
  late; the order doubles as a legible danger read and is medically authentic.
- **Pure/deterministic**, mirroring the module: per-beat rolls use `hash01(seed)` (the lab's
  `Math.abs(Math.sin(...))` rolls port to `hash01`); the VF chaos is a deterministic sum-of-sines
  waveform (a synthesized wave, not RNG). No `Math.random`.
- Only `ecgPoints` changes; the sweep renderer, component, and `pulsePoints`/`sampleY`/
  `pointsToPath` are untouched.

## Patterns to follow

- Port the cascade verbatim from `lab/waveform-lab.html` `ecgPoints`, adapting `(frac,W,H)` →
  `({frac,width,height})`, `Math.abs(Math.sin(seed))` rolls → `hash01(seed)`, inline `clamp`
  → the module's clamp helper.

## What we're NOT doing

- Not touching the deck pulse, the sweep/component, or gameplay (health semantics unchanged).
- Not adding further abnormalities (atrial fib, bundle-branch morphology, etc.) — locked here.

## Open questions

- None — cascade + thresholds (PVC ~35%, dropped ~55%, VF <7%) are tuned and locked by eye.

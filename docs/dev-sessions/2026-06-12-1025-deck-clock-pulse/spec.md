# Deck-pulse → symmetric CPU clock

**Goal:** Replace the deck-integrity waveform's "double square pulse" with a symmetric
machine-clock signal, so the deck reads as a CPU clock (distinct from the human ECG) and
its breakdown under damage reads as clock ringing/instability.

**Source:** User request from 2026-06-12, follow-up to the vital-waveforms work. Shape
locked by eye in the lab (saved at `lab/waveform-lab.html` in this session folder; the
canonical lab also lives in the vital-waveforms session folder).

## Current state

`js/ui/waveform.js` `pulsePoints({frac,width,height})` currently renders a double pulse
(main + smaller follow) with damage-driven ringing/dropouts/height-and-width glitches.
It's drawn by the `<starnet-waveform>` CRT sweep, anchored to `[0,width]`, deterministic
(`hash01`, no `Math.random`).

## Desired end state (locked in the lab)

A **symmetric square clock**, no resting baseline:
- Equal-duty alternating **up-pulses** (`hi = mid-amp`) and **down-pulses** (`lo = mid+amp`),
  ~4 hi+lo cycles across the width (each plateau ~`W/8`).
- Every transition rings: a **departing overshoot** (further in the departing pulse's
  direction) and an **arriving overshoot** (past the arriving level), each held briefly so
  it reads as a small **square micro-pulse**, then a damped settle. Up-pulses overshoot
  *up* (positive), down-pulses *down* (negative); a positive trailing spike leads straight
  into the next negative leading spike (and vice versa).
- Overshoot is visible even at full health (clock-edge ringing); **damage** grows the
  overshoot depth + adds damped wobbles, and roughens **both** the hi and lo plateaus
  (ragged). Amplitude stays ~constant; widths stay ~regular.
- `frac <= 0` → flat 2-point baseline (unchanged).

## Design decisions

- **Symmetric clock, not the ECG-derived shape.** A CPU clock fits the machine fiction and
  contrasts with the human ECG; the edge overshoots are exactly the ringing a real digital
  line shows. (Rejected: keeping the heartbeat-like Q-R-S, which read as biological.)
- **Pure, deterministic geometry**, mirroring the existing module: `hash01` for the
  plateau-noise (no `Math.random`), static shape (the sweep/animation lives in the component).

## Patterns to follow

- Port the `pulsePoints` body verbatim from `lab/waveform-lab.html` (the locked geometry),
  adapting: `(frac,W,H)` → `({frac,width,height})`, `Math.abs(Math.sin(...))` → `hash01(...)`,
  inline `clamp` → the module's clamp helper. Keep `ecgPoints`/`sampleY`/`pointsToPath` untouched.

## What we're NOT doing

- Not touching the health ECG, the sweep renderer, or the `<starnet-waveform>` component.
- Not changing gameplay — deck integrity semantics are unchanged; only the drawn shape.
- Not adding the optional "tiny width perturbance" (regular widths read fine; deferred).

## Open questions

- None — shape is locked by eye. Cycle count (4) and proportions are tuned; further nudges
  are eyeball tweaks post-merge if wanted.

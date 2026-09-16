# Skill: starnet-playtest

Drive an automated playtest run of Starnet using the headless CLI harness (`scripts/playtest.js`) and generate an evaluation report on game legibility, fairness, and tedium.

Use when playtesting Starnet, evaluating CLI console legibility or command symmetry, testing balance/feel on a seed, or verifying game mechanics through the headless harness.

## Quick Start

```bash
# 1. Reset game state (optional seed)
node scripts/playtest.js reset --seed "playtest-run-1"

# 2. Check legal actions and status
node scripts/playtest.js --json "actions"

# 3. Target node and act
node scripts/playtest.js "target gateway"
node scripts/playtest.js "probe"

# 4. Advance time for timed actions
node scripts/playtest.js --json "tick 50"
```

## Playtest Loop

### 1. Initialize
Run `node scripts/playtest.js reset [--seed "<seed>"]`. Read initial status with `node scripts/playtest.js --json "status"`.

### 2. Decision & Action Phase
On each turn:
1. Run `node scripts/playtest.js --json "actions"` to list legal commands and inline context hints.
2. Select an action using a **play-to-evaluate** mindset:
   - Prioritize exploring available nodes, matching exploit cards, retrieving loot, subverting security (`corrupt` IDS, `scrub-logs` on monitor), shedding heat (`lie-low`), and testing ICE interaction (`kick`, `reboot`).
   - Occasionally take risky or non-optimal actions to observe how the game communicates danger, alerts, or failure states.
3. Execute the chosen command via `node scripts/playtest.js --json "<command>"`.
4. If a timed action starts (e.g. `probe`, `dump`, `fetch`, `mine`, `lie-low`, `subvert`, `kick`), tick virtual time with `node scripts/playtest.js --json "tick <N>"` (typically 20 to 50 ticks) until the action completes or events fire.

### 3. State & Event Read
After each command or tick:
- Read `{ events, state, log }` from the JSON response.
- Note whether the event log clearly explains the outcome of the action.

### 4. Stopping Rules
Stop the run when any of these conditions are met:
- **Mission Accomplished:** Target macguffin collected and successfully jacked out (`jackout`).
- **Tactical Disconnect:** Jacked out safely before trace completion.
- **Trace Caught / Defeat:** Trace countdown expired or player health/deck integrity dropped to 0.
- **Step Budget Exceeded:** 60 action commands or 1200 ticks reached (prevents infinite loops).

---

## Evaluation & Reporting Framework

After the run ends, assemble a **Playtest Evaluation Report** covering the four key pillars:

### 1. Legibility & Console Symmetry
- **Log Clarity:** Did every action produce a clear, plain-language log entry?
- **Exposed State:** Was any state necessary for decisions missing from `status` or `actions`?
- **Console Symmetry:** Were all available GUI actions accessible via console commands?

### 2. Fairness & System Signals
- **Alert Escalation:** Did alert or trace escalate unexpectedly without prior visual/textual warning?
- **Manual Alignment:** Did game mechanics behave according to `MANUAL.md`?

### 3. Tedium & Action Flow
- **Pacing Bottlenecks:** Were there repetitive sequences that felt tedious or stalled the flow?
- **Subversion Value:** Did subversion levers (`corrupt`, `scrub-logs`, `lie-low`) feel useful and well-communicated?

### 4. Reproduction Transcript
Include:
- **Seed:** Exact seed string used.
- **Action Sequence:** List of all commands dispatched step-by-step.
- **Key Findings:** Specific step index and log output where any legibility, fairness, or tedium issue occurred.

---

## Report Template

```markdown
# Starnet Playtest Report — Seed: "<seed>"

## Summary
- **Outcome:** [Win / Tactical Exit / Defeat / Budget Exceeded]
- **Final Cash:** ¥<amount>
- **Alert Level:** <level>
- **Health / Deck:** <health>/100 · <deck>/100
- **Total Actions:** <count>

## Key Findings

### 1. Legibility & Console Symmetry
- [Observation on text clarity, status completeness, or command symmetry]

### 2. Fairness & Signals
- [Observation on alert escalation, ICE warnings, or manual adherence]

### 3. Tedium & Flow
- [Observation on action pacing, repetition, or subversion mechanics]

## Action Transcript & Reproduction
1. `reset --seed "<seed>"`
2. `target gateway`
3. `probe`
4. `tick 20`
...
```

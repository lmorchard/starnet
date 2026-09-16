# Spec — Issue #326: Starnet Agent Playtest Skill

## 1. Goal

Author a Claude Code / Opencode skill (`starnet-playtest`) that allows an agent to play a full Starnet run through the headless CLI harness (`scripts/playtest.js`) and report back on game legibility, fairness, and tedium.

This fulfills the requirement in `CLAUDE.md`: "The console must be LLM-legible. The log + command interface should be sufficient for an LLM to fully observe and play the game without access to the visual graph."

## 2. Scope & Target Surface

- **Location:** `.claude/skills/starnet-playtest/SKILL.md` in the repository, symlinked to `~/.claude/skills/starnet-playtest`.
- **Target Surface:** Headless CLI harness (`scripts/playtest.js`), using `--json` mode for structured event and state reads, and `actions` for context-aware move discovery.
- **Mode:** Play-to-evaluate policy — rather than purely optimizing for win rate, the skill guides the agent to explore LAN mechanics, test subversion levers, observe alert responses, and evaluate the clarity of feedback.

## 3. Playtest Workflow & Loop

1. **Initialization:**
   - Execute `node scripts/playtest.js reset [--seed "<seed>"]`
   - Read initial state using `status full` or `--json "status"`.
2. **Turn Loop:**
   - Query legal actions with `node scripts/playtest.js --json "actions"`.
   - Inspect context hints (target node, access level, card matches, active timers, ICE position).
   - Select and execute an action: `node scripts/playtest.js --json "<command>"`.
   - If action is timed (e.g. `probe`, `dump`, `fetch`, `mine`, `lie-low`), advance time with `node scripts/playtest.js --json "tick <N>"`.
   - Parse `--json` output (`events`, `state`, `log`).
3. **Stopping Conditions:**
   - Mission objective completed & jacked out (Win).
   - Jacked out voluntarily due to high trace/alert (Safe Exit).
   - Trace countdown reached zero / caught by ICE (Loss).
   - Hard step budget reached (e.g. 60 actions or 1200 ticks max) to prevent infinite loops.

## 4. Evaluation & Reporting Requirements

The skill directs the agent to track and produce a final report covering:

1. **Legibility & Text Symmetry:**
   - Did any command yield an outcome that could not be inferred from the log or event stream?
   - Is there state critical for decisions that `status` / `actions` fail to display?
2. **Fairness & System Signals:**
   - Did global alert or trace escalate without preceding player signal or feedback?
   - Were mechanics transparent according to `MANUAL.md`?
3. **Tedium & Action Flow:**
   - Did gameplay stall or require excessive repetitive steps?
4. **Reproduction Transcript:**
   - Seed used.
   - Exact action sequence taken.
   - Specific step where issue/observation occurred.

## 5. Verification

- Execute the `starnet-playtest` skill on a real headless run.
- Ensure the agent completes the run, respects stopping rules, and produces a structured playtest report with concrete findings and a reproduction sequence.

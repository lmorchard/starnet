# Notes — Dev Session Issue #326: Agent Playtest Skill

## Session Info
- **Branch:** `issue-326-playtest-skill`
- **Worktree:** `.claude/worktrees/issue-326`
- **Session Dir:** `docs/dev-sessions/2026-09-15-1750-issue-326-playtest-skill`

## Context & Key Corrections
- Corrected prior stale assumptions (e.g. heat model is active, node grades vary, subvert is timed).
- Verified `scripts/playtest.js` interface: `actions` provides inline context hints, `--json` returns `{ events, state, log }`.
- Verified `make check` passes cleanly (1745 tests).

## Progress
- [x] Initialized worktree and session artifacts (`spec.md`, `plan.md`, `notes.md`).
- [x] Author `.claude/skills/starnet-playtest/SKILL.md`.
- [x] Symlink `~/.claude/skills/starnet-playtest` and `~/.config/opencode/skills/starnet-playtest`.
- [x] Conduct live playtest run (`seed: playtest-326`) and generate Playtest Report.
- [x] Run `make check` (1745 tests pass, 0 fail).

## Outcome & Key Takeaways
- The `starnet-playtest` skill provides a clear, repeatable playtest loop for agent-driven evaluation.
- Live run identified two concrete findings:
  1. Timed action command collision (`probe` immediately followed by `xploit` without `tick`).
  2. Hidden set-piece sensor attribution (`alarm/sensor` tripping `alarm/alarm-latch` and escalating global alert to TRACE without logging which node/sensor triggered it).

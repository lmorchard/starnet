# Implementation Plan — Issue #326: Agent Playtest Skill

## Phase 1: Author the Skill Definition

- Create `.claude/skills/starnet-playtest/SKILL.md` in the repo.
- Write the skill following `writing-great-skills` principles:
  - Concise description with trigger phrases for playing/evaluating Starnet via the headless harness.
  - Clear, ordered steps: setup/reset -> action query -> command execution -> ticking -> event checking -> stopping rules.
  - Play-to-evaluate guidance: test subversion, probe nodes, watch alert/ICE escalations, check console logging.
  - Concrete report structure: summary, legibility observations, fairness/balance notes, tedium/flow findings, exact transcript & reproduction.
- Create symlink at `~/.claude/skills/starnet-playtest` pointing to the repo skill.

## Phase 2: Live Playtest Run & Verification

- Run a full playtest session using the new skill on a seed (e.g. seed `"eval-326"`).
- Execute the turn loop step-by-step using `scripts/playtest.js`.
- Collect events, inspect logs, and observe game feel and CLI clarity.
- Produce a structured Playtest Report based on the run.

## Phase 3: Project Verification & Commit

- Run `make check` to ensure all tests and typechecks remain 100% green.
- Document session learnings in `notes.md`.
- Commit session artifacts and skill files.

# Spec: LAN Dungeon Prototype — Session 2

_Session: 2026-02-24-1615-lan-dungeon-prototype-2_

## Overview

Three interlocking improvements to the LAN dungeon prototype:

1. **Interactive console** — the log pane gains a CLI input layer; all game actions are accessible via typed commands
2. **Deeper exploit mechanics** — multi-step node escalation and staged vulnerability chaining
3. **Playtesting cheats** — a flagged set of cheat commands for granting game objects during development

---

## 1. Interactive Console

### Concept

The log pane (currently output-only) gains a text input at the bottom. The player can type commands directly instead of (or alongside) clicking the graph and sidebar. Both input methods remain available throughout — the console does not replace click-driven interaction.

### Click → Command echo

When the player clicks through any action in the UI, the equivalent command is printed to the console log as if they had typed it. This:
- Teaches the command vocabulary through normal play
- Creates a full audit trail of actions in the log
- Makes the console feel like a natural extension of the UI, not a separate mode

### Command vocabulary

Initial command set (mirrors all available click actions):

```
probe <node>
exploit <node> <card-id>
read <node>
loot <node>
reconfigure <node>
jackout
```

Node references use the node ID (short, machine-readable) as the canonical form, but tab completion should offer human-readable names.

### Tab completion

Tab-completes:
- Command verbs (first token)
- Node IDs/names (contextual to command — `probe` only completes revealed/accessible nodes)
- Card IDs (for `exploit` second argument)

### Command history

Arrow-up / arrow-down cycles through previously issued commands for the current run.

### Out of scope (this session)

- `help` command — deferred until command set stabilizes
- Full parser error messages — basic "unknown command" is sufficient

---

## 2. Deeper Exploit Mechanics

### Multi-step escalation

Currently a single successful exploit can take a node from `locked` → `owned`. In this session, escalation becomes two distinct steps:

- `locked` → `compromised`: requires one successful exploit (initial foothold)
- `compromised` → `owned`: requires a second successful exploit (privilege escalation)

The second exploit may target a different vulnerability than the first. The node detail panel and console both reflect the current access level and what's needed next.

### Staged vulnerability chaining (primary chaining mechanic)

Some vulnerabilities on a node are **hidden** at probe time and only revealed after a specific exploit type has been successfully used. Example:

- Node has one visible vuln: `ssh-bruteforce` (type: `network`)
- After exploiting `network`-type successfully, a deeper vuln unlocks: `kernel-overflow` (type: `system`)
- The second vuln enables full ownership

This models realistic attack chains: initial recon/access opens deeper attack surface.

Implementation notes:
- Vulnerabilities gain a `hidden: true` flag and an optional `unlockedBy: [vulnType]` field
- On a successful exploit, all hidden vulns whose `unlockedBy` types match the used card type are revealed
- Revealed staged vulns appear in the node detail panel and are available for subsequent exploits

### Future phases (out of scope this session)

- **Prerequisite cards** — `requires` field on cards enforcing play order
- **Combo bonuses** — probability boosts for card sequences on the same node
- **Active countermeasures** — nodes fight back on failed exploits
- **Exploit crafting/combining** — merge weaker cards into stronger ones

---

## 3. Playtesting Cheats

### Cheat commands

A set of console commands prefixed or otherwise marked as cheats:

```
cheat give card [common|uncommon|rare]
cheat give cash <amount>
cheat set alert [green|yellow|red|trace]
cheat own <node>
```

### Cheat flag

When any cheat command is used, a `isCheating: true` flag is set on the run state and persists for the rest of the run. This enables:
- Future scoring to zero out or penalize cheated runs
- Achievements/leaderboards to exclude cheated runs
- Visual indicator in the HUD ("CHEAT MODE" or similar) so it's obvious

### Code marking

All cheat command handlers are clearly marked in the codebase (e.g. a `// CHEAT` comment block or a dedicated `cheats.js` module) so they can be gated, removed, or penalized as a unit in future.

---

## Acceptance Criteria

- All existing click actions have a corresponding console command
- Clicking an action in the UI echoes the command to the console log
- Tab completion works for verbs, node names, and card IDs
- Arrow-up/down cycles command history
- Nodes require two successful exploits to reach `owned` (via `compromised` intermediate)
- At least one node in the dungeon has a staged vulnerability that unlocks after a successful exploit
- All four cheat commands work
- `isCheating` flag is set on first cheat use and visible in the HUD
- Cheat handlers are clearly isolated in code

---

## Out of Scope (This Session)

- `help` command
- Active countermeasures
- Exploit crafting/combining
- Prerequisite card chaining
- Combo bonus chaining
- Persistent progression / scoring backend
- Mobile/touch support

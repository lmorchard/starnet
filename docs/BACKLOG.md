# Starnet — Deferred Ideas Backlog

_Compiled from all dev session notes. Not a prioritized roadmap — just a living inventory._

---

## Gameplay Systems

### Exploit Economy / Card Acquisition
- **Card restock mid-run** — player has no way to get new cards except cheats; consider a "buy card" action at certain node types, or a drop on loot
- **Persistent inventory between runs** — in the overworld context, exploit loadout carries across LANs; crafting/acquiring a better kit is part of the meta-loop
- **Balance: starting hand vs. network vulnerability mix** — current hand frequently doesn't match early node vulns; in the overworld context this is solved by pre-run preparation, not hand seeding _(deferred pending overworld design)_

### Mission / Objectives
- **Mission conditions** — secondary objectives like "never exceed yellow alert" or "don't trigger trace"; adds replayability and run variety
- **Node flavor text** — when you `read` a node, give it cyberpunk lore flavor beyond "X item(s) found"
- **Alert consequence tuning** — trace countdown (60s) may feel long; consider tightening or making it configurable per network

### Adversarial / ICE
- **`cheat ice-move <node>`** — cheat command to teleport ICE directly to a node for testing detection scenarios without waiting for ticks
- **ICE path tracing via traffic analysis daemon** — ICE movements currently invisible until dwell fires; a "traffic analysis daemon" installed on a compromised node could reveal ICE movement logs as events _(part of the log-verbosity-as-mechanic idea below)_

### Information Asymmetry (Log Verbosity as Game Mechanic)
From session-5 design discussion — reframe log verbosity as something the player *earns*:
- **Traffic analysis daemon** — installed on a compromised node; reveals ICE movements through visible territory in the log
- **Alert propagation logs** — requires subverting/compromising an IDS; once owned, you see alert events as they propagate to monitors
- **Deep network telemetry** — high-tier readable nodes contain network maps, revealing hidden nodes or edges without traversal
- This reframes information asymmetry as diegetic and earned, not a UI toggle

### Exploit Mechanics (Depth)
- **Chaining exploits** — sequential exploitation requiring specific steps; privilege escalation as a multi-step sequence
- **Countermeasures** — active defenses beyond ICE (firewalls that degrade card quality, honeypots, etc.)
- **Visual feedback for staged vuln reveal** — log message on deeper attack surface unlock is subtle; a pulse/flash on the node would be more satisfying (currently only a log entry)

---

## World / Structure

### Overworld / Meta-loop
- **Overworld linking LANs** — the dungeon run takes place in a larger world context; structure connecting LAN to LAN (planet internets, star systems, ansible networks)
- **Procedural or semi-procedural network generation** — random LAN topologies with seeded RNG for reproducibility (roguelike runs); currently static hand-crafted network
- **Inter-run progression** — player skills, reputation, contacts, persistent exploit inventory carry between runs

### Worldbuilding (from SPEC.md)
- Sprites, daemons, machine elves as in-network entities / power-ups (semi-autonomous AI anomalies)
- Psychic bleed / neuraldeck direct neural interface flavor
- Sidebands — parallel hidden networks harboring hackers and alien artifacts
- Ansible network topology as overworld communication layer
- Finding Earth as a late-game quest thread

---

## Technical / Architecture

### Node.js Runtime for Core Logic

**Status: in progress / partially complete** (session 2026-02-25-1605-node-playtesting)

DOM decoupling, virtual tick clock, state serialization, and headless playtest
harness (`scripts/playtest.js`) being built this session.

**Remaining / follow-on:**
- **Seeded RNG** — `Math.random()` calls in `combat.js`, `exploits.js`, `ice.js`,
  `loot.js` need a seedable PRNG to make runs fully reproducible from a saved state.
  Prerequisite: state serialization (landing this session). The seed would be stored
  in game state and used everywhere random numbers are drawn.

---

### LLM Playtest Harness
- **Typed event log** — replace ad-hoc log strings with structured `logEvent(type, payload)` that both renders human-readable and records machine-readable events
- **Formal log message conventions** — consistent prefixes per category (`ICE:`, `EXPLOIT:`, `ALERT:`, `NODE:`)
- **LLM playtest script** — feeds `status` output + log to an LLM, reads back console commands; validates game balance and text interface completeness
- **Richer `status` subcommands** — `status ice`, `status hand`, `status node <id>` for targeted queries without full dump noise
- _Recommendation: don't formalize until actually building an LLM agent — requirements will clarify then_

### Module Refactoring
- **`state.js` and `main.js` are large** — candidates for splitting once the architecture stabilizes; JSDoc types now in place make this lower risk
- **Web Components** — noted as a potential architecture for the sidebar if it grows complex; not urgent

### Node Type Action Registry

Currently "what actions are available on this node?" is implemented as scattered
`if (node.type === ...) / if (node.accessLevel === ...)` checks in two separate
places: `visual-renderer.js` (sidebar buttons) and `console.js` (actions output).
They can and do drift — the `cancel-trace` button being missing from the sidebar
while present in console output is a direct example.

**Proposed:** a centralized action registry where each node type declares its
available actions as a function of game state. Something like:

```js
// js/node-actions.js
export const NODE_ACTIONS = {
  "security-monitor": [
    {
      id: "cancel-trace",
      label: "CANCEL TRACE",
      available: (node, state) =>
        node.accessLevel === "owned" && state.traceSecondsRemaining !== null,
      desc: (node, state) => `Abort trace countdown (${state.traceSecondsRemaining}s remaining).`,
    },
    ...
  ],
  ...
};
```

Both the sidebar renderer and the console `actions` command would derive their
output from this single source. Adding a new action to a node type would require
touching exactly one place.

Pairs well with the defender ICE / node interaction work — if node behaviors
become more complex, having a per-type action model is the right foundation.

### Exploit Card IDs
- **Legible card IDs** — currently `exploit-1`, `exploit-2`, etc.; consider IDs derived from vuln type + suffix (e.g. `ssh-1`, `privesc-3`) for more diegetic log/console references

---

## UI / Visual Polish

### Effects (out of scope, recurring)
- Screenshake on jack-out
- Bloom / vector glitch on trace countdown or countermeasure hit
- Node flash on exploit success (currently implemented for some cases)
- Audio (explicitly out of scope until much later)

### Console / UX
- **`help` command improvements** — currently exists; could be richer with examples
- **Alert consequence tuning** — trace countdown length, alert escalation pacing
- **Playwright test reliability** — `node.emit('tap')` workaround for synthetic events is fragile; document in CLAUDE.md so it doesn't get rediscovered

---

## Design Questions (Unresolved)

- **Overworld structure** — what links LANs? Star system map? City districts? Planetary internets? Shape of this affects many in-run design decisions.
- **Mission briefing source** — in the overworld, missions come from somewhere (fixers, factions, bulletin boards). Does this affect run structure?
- **What the player *is*** — decker, netrunner, corp agent? Affects flavor, narrative framing, and what "winning" means across runs.
- **Economy scope** — is cash purely a score, or does it buy things between runs? Feeds back into the exploit inventory question.

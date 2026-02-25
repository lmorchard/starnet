# Notes: Game Events Console Redesign

_Running notes and final retrospective._

---

## Pre-execution notes

### TypeScript / type safety

Discussed whether to migrate to TypeScript before this session. Decision: defer.

The event system being built here is a textbook case for TypeScript — typed event payloads with discriminated unions, complex state shapes shared across modules. The codebase is approaching the complexity threshold where type drift is a real risk.

**Why deferred:** adding TypeScript simultaneously with a major architectural migration is too much change at once. Also requires committing to a build tool (esbuild/vite/tsc), which changes the zero-build dev workflow.

**Intermediate option noted:** JSDoc `@ts-check` gives VS Code type checking with no build step. Define types in `js/types.js`, add `// @ts-check` to each file. Type definitions would be reusable if/when migrating to full TS later.

**Recommendation for next session:** consider a dedicated cleanup/refactor session — TypeScript migration (or JSDoc types), module size review (`main.js` and `state.js` are getting large), general housekeeping before layering more game systems on top.

---

## Design idea: log verbosity as a game mechanic

Raised during playtesting. Rather than log filtering being a pure UI convenience, what if it's diegetic — something the player earns or installs?

The framing: the decker's console readout is a live feed of network telemetry. What you can *see* depends on what tools and footholds you have established. Possible examples:

- **ICE movement logs** — requires a "traffic analysis daemon" installed on a compromised node. Without it, ICE movements are invisible (you only find out when the dwell timer fires). With it, you see ICE's path through visible territory.
- **Alert propagation logs** — requires subverting or compromising an IDS. Once you own the IDS, you see alert events as they propagate to monitors.
- **Deep network telemetry** — a high-tier readable node might contain network maps, revealing hidden nodes or edges without needing to traverse to them.

This reframes "log verbosity" as information asymmetry, which is both thematically appropriate (decker earning visibility into a system) and mechanically interesting (tradeoffs between what you spend exploits on vs. what you can see). Pairs well with the idea of ICE tracing paths through your network — if ICE can read your movements, your tools let you read its.

Worth designing properly in a future session once the core loop is more stable.

# ICE — Intrusion Counter Electronics

This document describes the **data-driven, multi-instance ICE model**. It is
the evergreen paradigm reference. Player-facing mechanics live in
`MANUAL.md`; the game-design-document lives in `SPEC.md`; this document
describes the conceptual model and its architectural shape.

For the vision that drove the design and its multi-session rollout plan, see
`docs/dev-sessions/2026-04-24-1243-ice-reinvention/spec.md`.

---

## The model

ICE is a first-class, data-driven entity **installed at a host node**. A LAN
may carry zero, one, or many ICE instances. Each instance is composed from
named atoms resolved at construction:

```
IceInstance {
  id, typeId, hostNodeId, active, enabled,
  focus,             // "stationary" | "roaming"
  behaviorPattern,   // named pattern atom
  triggers,          // list of trigger atoms
  effects,           // list of effect atoms
  detectionConfig,   // dwell time, alert ladder, ...
  repeat,            // "one-shot" | { mode: "cooldown", ticks: N }
  revealed, grade
}
```

### Two focus classes

- **Stationary** ICE is confined to its host node. It springs like a trap when
  a player action on the host matches its trigger list. Examples: a Trapwire
  that detonates on `on-select`, a vault honeypot that fires on `on-probe-fail`.
- **Roaming** ICE patrols the graph. Its behavior pattern decides where to go
  each tick (`patrol-random`, `disturbance-tracker`, `player-hunter`,
  `sentry-radius`, etc.). It reports through its host's IDS chain the same way
  the current singleton does.

Both share the same `hostNodeId`. The host is the management anchor: owning it
unlocks the hack verbs (§ below) that let the player uninstall, disable, or
reprogram the ICE.

### Composition from atoms

Three atom types, all living in the registry at `js/core/ice/`:

- **Trigger atoms** — "when does this ICE act?" — `on-select`, `on-probe`,
  `on-exploit`, `on-exploit-fail`, `on-dwell-N-ticks`, `on-detect-presence`,
  ...
- **Behavior-pattern atoms** — "how does the ICE move and schedule itself?" —
  `trap` (stationary), `patrol-random`, `patrol-route`, `disturbance-tracker`,
  `player-hunter`, `sentry-radius`, `relocate-on-activate`, `player-avoid`,
  `freeze`.
- **Effect atoms** — "what does it do when it activates?" — `raise-alert`,
  `damage-health`, `damage-deck`, `steal-cash`, `shred-card`, `degrade-card`,
  `steal-card`, `lock-node`, `patch-vulns`, `force-reboot`, `deselect-player`,
  `cancel-action`, `accelerate`, `broadcast-alert-adjacent`, ...

Effect atoms receive a selector when they need to pick a target. Selector
grammar: `self-host`, `player-selected`, `random-owned`, `random-compromised`,
`random-revealed`, `adjacent-to-self`, `farthest-from-player`, `stash-tagged`.

### Catalog

Named presets — authored in the registry — combine all three axes. Procgen
picks from the catalog weighted by LAN grade and host node type. Example:

```
Thief-C = {
  focus:   "roaming",
  pattern: "disturbance-tracker",
  triggers: ["on-dwell-short"],
  effects: [
    { atom: "steal-cash", params: { amount: 50, stashSelector: "stash-tagged" } },
    { atom: "damage-deck", params: { amount: 5 } }
  ],
  repeat:  { mode: "cooldown", ticks: 300 },
  canTempDisable: true,
  reprogramAllowlist: { effects: ["steal-cash"], stashSelectors: ["player-wallet"] }
}
```

---

## Discovery and visibility

ICE starts hidden. It is revealed when any of:

- The player **probes** its host (probe report enumerates installed ICE).
- The player **dumps** its host.
- A stationary ICE **activates** (trap springs).
- A roaming ICE **detects** the player or enters a node the player owns.

The graph uses two distinct markers:

- **Host badge** on the installed-at node — revealed ICE permanently shown.
- **Attention cursor** (red diamond) — roaming ICE's current patrol location.
  Follows the ICE as it moves.

Counter-play: `scan-for-ice` action on owned/compromised nodes reveals ICE
without triggering it. Reveals typeId, focus, and pattern; does not reveal
effects.

---

## Player resources as loss clocks

Alongside the existing trace, two integer pools on `PlayerState` serve as
additional loss conditions:

- **Health** (`health: { current, max }`) — reaches 0 → run ends `burned`.
- **Deck integrity** (`deckIntegrity: { current, max }`) — reaches 0 → run
  ends `bricked`.

Damage is monotonic within a run; jack-out resets both pools. No mid-run
healing in the current model — attritional ICE creates decision pressure
("push on or jack out with what I have?") rather than a treadmill.

Loss clocks, unified:

| Clock | Trigger | Outcome |
|---|---|---|
| Trace | alert → trace timer expires | `caught` |
| Health | `health.current <= 0` | `burned` |
| Deck integrity | `deckIntegrity.current <= 0` | `bricked` |
| Jack out | player action | `success` / `escaped` |

---

## Stash and recovery gameplay

Some effects create **stashes** — stolen player resources deposited into a
node in the network. This turns attritional damage into a recovery quest:
steal-cash drops cash somewhere the player must find; steal-card similarly.

- Stash nodes are just nodes with a `stash: true` attribute. Procgen tags a
  small number per map — often deep leaves, or nodes behind heavy IDS.
- The `cryptowallet` node type is a stash-preset variant; dumping it reveals
  deposits the same way dumping a macguffin-bearing node works.
- Stash discovery is **diegetic** — the player dumps nodes to find them, no
  HUD indicator of "you have 340¢ stashed somewhere."

---

## Hack / reprogram layer

Once the player owns the host, a sidebar group appears listing installed ICE
with per-ICE actions. Verbs:

| Verb | Availability | Effect |
|---|---|---|
| `uninstall-ice` | Owned host | Removes the instance entirely |
| `disable-ice` | Compromised host, type-gated | Disables for a short timer (type declares `canTempDisable`) |
| `swap-pattern` | Owned host, type-gated | Swap behavior pattern from an allowed set |
| `reprogram-effects` | Owned host, type-gated | Swap effect atoms from an allowed set |

`reprogram-effects` is the most strategic: it's how a captured Thief ICE can
be redirected to deposit stolen cash into the player's wallet instead of a
stash node.

### Cost and risk

Hack verbs are not free:

- **Backfire** — chance to fail, triggering the ICE hostilely once. Inverse
  to grade.
- **Alert bump** on every attempt, like a failed exploit.
- **Timed action** (~3–8 s) during which roaming ICE can still detect the
  player on the host.

### Reprogram allowlists

Each catalog entry declares what's legal to reprogram. A `Trapwire` won't let
itself be turned into a thief; a `Thief-B` can have its stash selector
redirected. Prevents "every ICE becomes a Recruited ally" from breaking the
game.

---

## Alert and IDS relationship

**Current model (MVP):** global alert and global trace, unchanged. Every ICE
reports `raise-alert` through its host's IDS chain, exactly as the former
singleton did. Multiple ICE in different zones feed the same monitor. IDS
subversion still severs the chain for ICE whose path runs through it.

**North-star model (separate session):** per-zone alert. Each ICE reports
through a designated IDS in its zone; IDS subversion blinds only its own ICE.
Multiple concurrent traces possible. Requires broader alert-system rethink;
scheduled for a dedicated session.

Non-alert effects (steal-cash, damage-health, etc.) do **not** route through
IDS. They mutate state directly with their own log entries. Alert remains
reserved for detection / surveillance fiction.

---

## Architectural shape

- `js/core/ice/registry.js` — catalog of ICE types
- `js/core/ice/atoms.js` — trigger + effect atom registries
- `js/core/ice/runtime.js` — per-tick dispatcher iterating `s.ice.instances`
- `js/core/ice/patterns/*.js` — one file per behavior pattern; pure, no DOM

State: `s.ice.instances` keyed by instance id; each instance serializable
for save/load round-tripping.

Events on `js/core/events.js` include `ICE_INSTALLED`, `ICE_REVEALED`,
`ICE_ACTIVATED`, `ICE_EFFECT_APPLIED`, `ICE_HACKED`, `ICE_STASH_DEPOSITED`.
Existing events (`ICE_MOVED`, `ICE_DETECTED`, etc.) carry `iceId` to
disambiguate among concurrent instances.

Determinism: stash selection, backfire rolls, and probabilistic triggers use
a named RNG stream (`RNG.ICE_EFFECT`). Bot census seeds reproduce exactly.

The three parallel entry points (`js/ui/main.js`, `scripts/playtest.js`,
`scripts/bot-player.js`) share timer wiring and action dispatch; all three
must iterate `s.ice.instances` rather than reading a singleton.

---

## What this replaces

The pre-reinvention ICE model was a singleton at `s.ice` with hardcoded
grade-tiered behavior. Key differences:

| Pre-reinvention | Reinvention |
|---|---|
| One ICE per run | Many ICE per LAN |
| Grade (F–S) dictates movement | Named behavior-pattern atoms; grade is a procgen weight only |
| Fixed resident node (security monitor) | Any node can host; configurable via network meta |
| Single effect (raise-alert → trace) | Catalog of composable effect atoms |
| Disable via owning resident | Uninstall / disable / swap / reprogram verbs on host |
| No player health / deck integrity | Two new loss clocks |
| No recovery gameplay from ICE effects | Stash nodes create recovery hunts |

See `docs/dev-sessions/2026-04-24-1243-ice-reinvention/spec.md` for the vision
spec and session decomposition that produced this model.

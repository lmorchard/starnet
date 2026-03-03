# Session Spec: ice-host Node + pkill Action

## Problem / Motivation

ICE is currently "resident" at the security-monitor node. When the player owns the
security-monitor, the `iceResident` behavior fires automatically and kills ICE as a
side effect — no deliberate player choice involved.

This is mechanically muddy: owning security-monitor should feel like owning the
surveillance aggregation point (cancels trace), not like stumbling onto the ICE
process controller. The ICE host and the security monitor are distinct infrastructure
pieces that happen to be co-located — and that co-location was an implementation
shortcut, not a design intention.

Separating them gives the player a clearer mental model and a more interesting optional
arc: "if I want to kill ICE I need to find where it runs, not just own the alarm
dashboard."

## New Node Type: `ice-host`

A dedicated node representing the machine on which the ICE AI process runs.

**Properties:**
- Type string: `"ice-host"`
- **Not lootable** — no macguffins, no `read` or `loot` actions
- **Hard grade** — always at `pathGradeMax` difficulty (same as security-monitor)
- **Singleton** — exactly one per network
- **Security infrastructure** — excluded from bot full-clear, not a mission target
- **Located adjacent to security-monitor** — revealed only when security-monitor is
  owned, so it naturally becomes the next optional objective

**Actions on ice-host:**
- Standard: probe, exploit (standard access-level unlock sequence)
- Once owned: `pkill` — explicitly terminate the ICE process

## `pkill` Action

A new node action available on owned `ice-host` nodes when ICE is active.

- **ID**: `"pkill"`
- **Label**: `"PKILL ICE"`
- **Available**: `node.type === "ice-host" && node.accessLevel === "owned" && state.ice?.active`
- **Effect**: calls `ctx.pkillIce()` which stops ICE timers and marks ICE inactive
- **Console command**: `pkill` (no arguments — acts on selected node)
- **Log entry**: `[ICE] Process terminated.`

## Topology Changes

### `ice-host` placement in network gen

- The `ice-host` layer spawns **after the `monitor` layer** in the corporate biome
- `connectTo: "monitor"` — ice-host ← edge → security-monitor
- Depth: `depthBudget + 1` (one step deeper than security-monitor)
- Grade role: `"hard"` (pathGradeMax, same as security-monitor)
- ICE `startNode` moves from `spawnedByRole.monitor[0]` to `spawnedByRole["ice-host"][0]`

### `security-monitor` changes

- Remove `iceResident` behavior — owning security-monitor no longer auto-kills ICE
- Monitor still cancels trace countdown (the `monitor` behavior remains)
- The `iceResident` behavior atom stays in the registry (may be reused later) but is
  removed from the security-monitor node type definition

## Gameplay Arc

```
[gateway] → [router] → [ids] → [security-monitor] → [ice-host]
                                        ↕
                                  own this: cancels trace
                                                      ↕
                                              own this + pkill: kills ICE
```

Player who wants to neutralize ICE now has a clear two-step objective:
1. Navigate the security region (router → ids → security-monitor)
2. Probe and own ice-host, then pkill

Skipping the ICE kill is still a valid strategy — jack out early or just tolerate ICE pressure.

## Bot Player Impact

The bot does NOT use `pkill`. The new `ice-host` type should be added to `SECURITY_TYPES`
in `scripts/bot-player.js` so the bot skips it (same treatment as `ids` and
`security-monitor`). The `fullClear` calculation should also exclude it.

`docs/BOT-PLAYER.md` should note `pkill` in "What the Bot Does NOT Do."

## Files Changed

| File | Change |
|------|--------|
| `js/core/actions/node-types.js` | Add `"ice-host"` type; remove `iceResident` from `security-monitor` |
| `js/core/network/biomes/corporate/gen-rules.js` | Add `"ice-host"` role, node rule, and layer |
| `js/core/network/network-gen.js` | ICE `startNode` → `spawnedByRole["ice-host"][0]` |
| `js/core/types.js` | Add `pkillIce: () => void` to `ActionContext` |
| `js/core/actions/action-context.js` | Wire `pkillIce` to `stopIce` + `disableIce` |
| `scripts/bot-player.js` | Add `"ice-host"` to `SECURITY_TYPES` |
| `docs/BOT-PLAYER.md` | Add pkill to "What Bot Does NOT Do" |
| `MANUAL.md` | Add ice-host node type, pkill action |
| `tests/` | Unit tests for pkill action; regenerate network-gen snapshots |

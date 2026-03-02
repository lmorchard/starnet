# Notes: Census Metrics v2

## Future work: move ICE resident node

Currently ICE starts at the security monitor. The fiction would be cleaner if
ICE started at a node on the far side of the IDS — patrolling the working
network, reporting back through the IDS chain. This would mean:
- ICE patrols where the player operates (routing/workstation layer)
- Detection reports travel through IDS → monitor (severable via reconfigure)
- Reboot sends ICE to its new resident node, not the monitor
- Security monitor remains valuable for cancel-trace, but isn't ICE home base

This is a topology/gen-rules change with implications for network layout and
the layer-processor. Separate session.

## Future work: ICE behavior improvements

### High-value-target patrol (augment random walk)
Instead of pure random walk at F/D, ICE patrols a fixed route through
high-value nodes (fileservers, cryptovaults, firewalls). Predictable but
unavoidable — the player has to time actions around the patrol schedule.
Could augment any grade as a base behavior underneath the tracking modes.

### Multi-signal tracking
ICE tracks disturbance (like C/B) but also responds to alert level. Higher
global alert → ICE moves faster or covers more ground. Failing exploits →
noise → ICE investigates → detection → alert rises → ICE gets more aggressive.
Creates a feedback loop that punishes sloppy play.

### Area lockdown ICE type
When this ICE type detects, it "locks" the region — nearby nodes get reduced
detection dwell time, creating a danger radius the player must avoid. This
is a different ICE type entirely (not a grade variant). Good candidate for
the future multiple-ICE-instance feature.

### Reward scaling with difficulty
Currently higher-difficulty networks cost more to crack (harder nodes, deeper
paths, more ICE pressure) but don't contain more valuable loot. Macguffin
values are set in the game state layer (loot.js), not the generator. Scaling
rewards with moneyCost would give players incentive to tackle harder networks
and offset the increased card/cash expenditure. This is a game state change,
not a generator change — separate session.

### A/S player tracking removed
The old A/S behavior (pathfind directly to `selectedNodeId`) was removed
because it felt like cheating — ICE had perfect knowledge of the player's
location regardless of player actions. Replaced with faster disturbance
tracking, which preserves player agency (go quiet to lose ICE).

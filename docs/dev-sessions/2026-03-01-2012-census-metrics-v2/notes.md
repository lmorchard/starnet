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

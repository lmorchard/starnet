# Vision — The Physical Layer: Drone Crawl & Airgap Bridging

This is a **forward-looking design vision, not scheduled work** — and the most
ambitious idea on the table. It describes a possible *physical* layer to the
game: a first-person, grid-based, turn-based dungeon crawl in which the player
pilots a drone through a real-world location to do something the network layer
cannot — most centrally, **bridge an airgap** between network nodes.

It is a sibling to [`VISION-dual-mode-and-standings.md`](VISION-dual-mode-and-standings.md).
The two future modes relate to the heist loop differently:

- **Defense mode** is a *parallel top-level mode* — a different *seat* (you
  become the defender; the bot becomes the attacker).
- **The drone crawl** is a *nested sub-mode* — a different *layer* inside a
  single heist (a dungeon within the dungeon).

Nothing here is committed to a milestone. The *What This Means for the Prototype
Now* section near the end is the only part meant to touch near-term thinking, and
it is deliberately thin — this is far out.

---

## The Hook: Why a Physical Layer Exists

Most genre mashups are arbitrary. This one isn't. An **airgap** is the one
situation where you *physically cannot* reach a machine over the network —
isolation is the entire point of airgapping. To get to an airgapped node you
need physical presence: get a device in range, plug something in, bridge a
wireless link, carry data across by hand. So "deploy a drone and physically prowl
to the isolated machine" isn't a random mode switch — it is the *only* diegetic
way across. **The fiction demands the layer change.** That justification is what
makes this worth a whole sub-mode rather than a gimmick.

---

## Two Lenses on One Building

The physical layer maps cleanly onto the node hierarchy already sketched in
`SPEC.md` (Universe → … → Building → Room → Device):

- The **network graph** is *logical adjacency* — what can talk to what.
- The **drone crawl** is *physical adjacency* — what's down the hall from what.
- **An airgap is precisely where those two diverge** — logically unreachable,
  physically present.

The floorplan and the network topology are the same building seen through two
lenses. The drone is how you cross from one lens to the other.

---

## Form: Grid, Turn-Based, and Why

Grid-based and turn-based isn't a taste call — it's forced by two of the game's
load-bearing rules:

- **Full state serialization.** The whole game state must serialize and
  reconstitute at any instant (`CLAUDE.md`). Real-time 3D physics breaks that; a
  discrete grid + turns stays serializable, including a sub-mode session nested
  inside a run.
- **Console symmetry + LLM-legibility.** A core design principle is that the
  console can fully observe and drive the game, and that every visual event has a
  textual record. "Drone moves north, sweeps its camera left, the corridor ends
  in a sealed door" is console-expressible the way Wizardry and roguelikes always
  were. Free real-time 3D movement is *not*.

The spatial form takes after **Etrian Odyssey** and the **Atlus / Shin Megami
Tensei** first-person grid crawlers (and Legend of Grimrock). The *threat model*
takes after **Invisible Inc.** — turn-based stealth with patrols and sightlines —
but held to **minigame scope**, not a sprawling tactics campaign.

---

## How It Slots Into a Heist

The drone crawl is a **nested sub-mode**, triggered mid-run when you hit an
airgapped node:

1. You're working the network graph and reach a node you can't touch — it's
   airgapped.
2. You deploy and pilot a drone into the physical location.
3. A **non-fullscreen window pops up over the network grid** — a drone camera
   view. The network layer stays present underneath; the drone feed is one pane
   of your attention, not a context you leave. This reinforces the
   dungeon-within-the-dungeon framing both fictionally and visually.
4. You prowl the floor, evade physical security, and perform a physical action
   that bridges the gap.
5. You pop back to the network layer with new access — the graph has changed.

---

## The Drone and Its Mini-Tether

The drone is a fragile remote body, and it carries its **own mini-tether** — a
signal link back to your jack-in point, mirroring the player's own tether at a
smaller scale. Consequences fall out of that:

- The mini-tether can be **jammed, cut, or traced**. Lose it and you lose control
  of the drone — possibly stranding it as evidence.
- Physical presence is the **ultimate exposure**: a camera that captures the
  drone is a thread back to *you*. This ties straight into the identity/Heat
  stakes from the standings vision and the "True Names" thread in `SPEC.md` —
  the physical layer is where anonymity is hardest to keep.

---

## Physical ICE: Spatial Threats

The physical layer has its own counter-intrusion analogues — the spatial cousins
of network ICE:

- Cameras and motion sensors with **line-of-sight and detection cones**.
- Guards and patrol drones with **patrol routes** you read and time.
- Locked doors, keypads, and barriers that gate the floorplan the way firewalls
  gate the graph.

Turn-based stealth: read the patterns, move on the beats, stay out of the cones.
Detection in the physical layer should have teeth that the network layer can't —
it raises Heat, leaves evidence, and can sever the drone's tether.

---

## Capability by Takeover (the Paradroid Loop)

Borrowed from **Paradroid** (Andrew Braybrook, 1985): you don't start powerful,
and you don't fight your way up — you **commandeer** your way up. You enter as a
low-capability chassis — a janitorial Roomba: slow, unarmed, near-blind — and
climb by hacking progressively more capable droids (a maintenance unit, then a
security bot) to inherit their bodies and abilities.

This isn't extra flavor — it gives the sub-mode its **core loop** and answers what
the physical layer's "combat" even is. A hacker's drone crawl shouldn't be about
shooting; it's about *taking over*, the same verb as the rest of the game. So
commandeering a bot **reuses the network layer's model directly**: a droid is a
node with a grade and vulnerabilities, and "owning" it means piloting it (locked →
compromised → owned, resolved with exploit cards). The physical layer's bots are
nodes too — which is why this *bounds* scope rather than expanding it.

The decision space is **stealth vs capability**:

- The **Roomba start** is invisible-by-belonging — a cleaning droid is *supposed*
  to be there, so it roams without raising alarm. It also justifies the degraded
  sensor feed: a cheap drone has bad eyes.
- A **security bot** opens restricted doors, disables cameras, moves fast, maybe
  subdues other units — but it's conspicuous, and a security droid wandering
  off-patrol is exactly what *other* security notices.

Every takeover trades belonging for power. A small roster of chassis
(cleaner → maintenance → security → …), each with a clear
capability/conspicuousness profile, is enough — no sprawling ability tree
required. (This is also the SMT lineage again: hacking a droid to inherit its body
is demon recruitment in chassis form.)

---

## Physical Actions Write Back to the Graph

This is the payoff that keeps the sub-mode from being a tedious key-fetch. Actions
in the physical layer **change the network layer**:

- **Plant a dropbox** in an open port → a new network node appears; the airgap is
  bridged and the graph re-opens.
- **Photograph a written credential** (the sticky-note password) → an exploit or
  auth advantage in the network layer.
- **Pull a drive / flip a switch / unplug a cable** → directly alters node state
  or topology.

The physical layer isn't a detour away from the game — it *reaches back in and
edits the puzzle*.

---

## Visual Register: Degraded Vector

The drone feed stays inside the game's existing design language rather than
breaking to a raster camera image. Render it as **wireframe with cross-hatch
shading** — a rough, best-effort reconstruction of the real world assembled from
drone sensors in the vector renderer, and **diegetically degraded**: noisy,
low-fidelity, incomplete.

The degradation *is* the fiction. It explains why the world looks like sketchy
vector linework (it's a sensor reconstruction, not a photo), preserves tonal
coherence with the phosphene aesthetic, and leans on the SPEC's existing "blob
phosphenes" / sensor-noise vocabulary. A clean photoreal feed would break the
game's whole visual premise; a degraded vector feed extends it.

---

## What This Reuses / Connects To

- **Tether mechanic** (`SPEC.md`) → the drone's mini-tether is the same idea at a
  smaller scale; cut-out and trace logic transfers.
- **ICE model** (`docs/ICE.md`) → physical security is a spatial reskin of the
  data-driven, multi-instance ICE concept (hosts, patrol behavior, detection).
- **Exploit-vs-vuln combat + access levels** (`js/core/combat.js`) → droid
  takeover (the Paradroid loop) is the same resolution: a bot is a node with a
  grade and vulnerabilities; piloting it is "owning" it.
- **Standings / Heat** ([`VISION-dual-mode-and-standings.md`](VISION-dual-mode-and-standings.md))
  → physical detection is a potent Heat source; getting your drone seen is an
  identity-exposure event.
- **Vector renderer** → the degraded-vector drone feed is an extension of the
  existing aesthetic, not a new rendering paradigm.
- **Sprites / daemons / machine elves + the SMT influence** → the Atlus lineage
  isn't only spatial. The physical layer could be where you *encounter* AI
  anomalies as in-world entities — negotiate, evade, or recruit them — echoing
  SMT demon negotiation and the "collecting daemons" idea already in `SPEC.md`.

---

## What This Means for the Prototype Now

This is far enough out that near-term affordances are minimal — and it would be
dishonest to invent more than exist. The few worth holding loosely:

- **Don't assume all reachability is network reachability.** If/when the network
  model or the generator formalizes node adjacency, leave conceptual room for an
  *airgap* — an edge that is logically absent but physically present. That single
  concept is the seam the whole layer hangs on.
- **Keep run state nestable.** A sub-mode session living inside a run must still
  serialize cleanly. Don't design run state that assumes exactly one graph and no
  nested sub-contexts, ever.

That's genuinely it. Everything else is distant-future.

---

## Open Questions

- **Tactical depth** — how close to Invisible Inc. does the stealth model get
  before it stops being a minigame? Where's the complexity ceiling?
- **Takeover depth** — how many droid chassis, and how distinct are their
  capability/conspicuousness profiles, before the roster becomes bookkeeping? Is
  commandeering the *only* way to act on other droids, or can the drone also
  evade and disable without taking over?
- **Drone persistence** — does your chassis (and any you commandeer) carry across
  the run, or reset each crawl? What do you keep when a takeover fails or a body
  is lost?
- **Floorplan generation** — hand-authored physical levels, or procedural, and
  how does a physical floor relate to the procedurally-generated LAN it sits
  inside?
- **Failure consequences** — what exactly happens when the drone is detected or
  its tether is cut, and how does that propagate back to the network run and to
  Heat / standings?

---

*Based on an original game concept by Les Orchard. Captured from a brainstorming
session, 2026-06-10. Influences: Etrian Odyssey and the Atlus / Shin Megami
Tensei first-person grid crawlers, Legend of Grimrock, Invisible Inc. (turn-based
stealth), Paradroid (Andrew Braybrook, 1985 — capability by takeover), and the
airgap as a classic intrusion trope.*

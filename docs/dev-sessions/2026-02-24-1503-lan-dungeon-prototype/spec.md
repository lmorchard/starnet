# Spec: LAN Dungeon Prototype

_Session: 2026-02-24-1503-lan-dungeon-prototype_

## Overview

A web-based cyberpunk hacking game prototype focused on LAN dungeon exploration. The player navigates a network graph of nodes, exploiting vulnerabilities to gain access, subverting security systems to avoid detection, and collecting macguffins (loot) for cash. The game is a roguelike — each run is a self-contained dungeon with a semi-randomly generated network.

This session establishes the core loop: **explore → exploit → loot → jack out**.

---

## Aesthetic

- Dark background with glowing neon edges and nodes (cyberpunk vector phosphene style)
- CRT/oscilloscope-like rendering: continuous glowing vector lines, not raster sprites
- Terminal-green, cyan, and magenta palette
- Effects reserved for later iterations: screenshake, bloom pulses, vector glitches when hit by countermeasures
- UI panels (node details, action menus, exploit cards) in a dark terminal/HUD style

---

## Tech Stack

- **Vanilla HTML/CSS/JS** — no framework, no build tooling to start
- **Cytoscape.js** — network graph rendering, layout, and node interaction
- Plain JS modules for game state and logic
- Vite may be added later if module complexity warrants it

---

## Game Structure

### The Dungeon

A single LAN — a self-contained network graph of 8–20 nodes. Each run generates (or loads) a new dungeon. For early prototyping, static hand-crafted network graphs will be used before introducing procedural generation.

The dungeon has:
- A **starting node** (the player's entry point — e.g. an Internet Gateway)
- Several **intermediate nodes** (routers, firewalls, switches, workstations, etc.)
- One or more **loot nodes** containing macguffins
- One or more **security nodes** that monitor alert events from detection nodes

### Node Visibility

Nodes begin hidden. The starting node is visible. As the player gains access to a node, its directly connected neighbors are **revealed** (visible but not yet accessible). Accessing a revealed node requires exploiting it or finding another path.

---

## Core Mechanics

### Alert System

Two-layer alert model:

1. **Per-node alert state**: Each node tracks whether it has detected suspicious activity (green / yellow / red). Certain player actions (failed exploits, brute-force attempts) raise a node's local alert state.

2. **Global dungeon alert level**: One or more **security monitor nodes** aggregate events from **detection nodes** (e.g. IDS, audit log collectors). If detection nodes are subverted or disconnected, their alert events don't propagate to the global level.

Global alert states: **Green → Yellow → Red → Trace**. At Trace, a countdown begins — if it completes, the run ends (player is caught). The player can jack out voluntarily at any time to preserve loot.

### Nodes

Each node has:
- **Type** (gateway, router, firewall, workstation, file server, cryptovault, IDS, security monitor, etc.)
- **Security grade** (S through F, where S is hardest)
- **Vulnerabilities** — a set of vulnerability entries, each with a type tag, severity, and flavor text using plausible security jargon (e.g. "CVE-style: unpatched SSH daemon, buffer overflow in auth handler")
- **Access state**: locked / compromised / owned
- **Alert state**: green / yellow / red
- **Contents**: macguffins (if any), connections to other nodes (some hidden until access gained), actions available

### Exploit Cards

The player holds a hand of exploit cards. Each card has:
- **Rarity**: common / uncommon / rare
- **Target vulnerability types** it can be used against
- **Quality** (affects success probability)
- **Decay state**: fresh / worn / disclosed (disclosed exploits are useless)

Playing an exploit card against a node:
1. Match card against node vulnerabilities — must target a matching vulnerability type
2. Roll success based on card quality vs. node security grade
3. On success: node access level increases (locked → compromised → owned)
4. On failure: node local alert state rises; exploit may become disclosed

Exploit decay:
- Exploits degrade with use and with exposure (failed attempts)
- The "blue team" patches vulnerabilities over time — a patched vulnerability can no longer be exploited by matching cards
- Patch lag varies by node grade (high-grade nodes patch fast; low-grade nodes are slow)

### Actions

When a node is selected, the player sees a detail panel with available actions based on current access level:

**No access (node revealed but locked):**
- Probe (reveals vulnerability types, raises local alert slightly)
- Exploit (opens exploit card hand to attempt access)

**Compromised (partial access):**
- Escalate (attempt to gain full ownership via another exploit)
- Read (access files — may reveal macguffins or connected nodes)
- Reconfigure (modify node behavior — e.g. disable IDS event forwarding)

**Owned (full access):**
- All of the above, plus:
- Loot (collect macguffins for cash)
- Subvert (set node to actively deceive connected security monitors)
- Backdoor (install persistent access for this run)

### Macguffins

Loot items with cash value. Flavor text as plausible technobabble:
- Encrypted documents / research files
- Program binaries / zero-day archives
- Cryptowallets
- Auth credential dumps

The player accumulates cash by looting macguffins. Cash is the run score. No mission objectives in this prototype — freeform collection until jack-out or trace completion.

---

## Win / Lose Conditions

- **Win**: Player jacks out voluntarily with loot. Final score = total cash collected.
- **Lose**: Trace countdown completes. Score = 0 (or partial, TBD).
- No persistent progression between runs in this prototype.

---

## Out of Scope (This Session)

- Missions / quest objectives
- Sprites, daemons, machine elves
- Player inventory persistence between runs
- Wider world (galaxy, planets, cities) — single dungeon only
- Procedural generation (static graphs first, may prototype later)
- Visual effects (screenshake, bloom, vector glitches) — noted for future iteration
- Audio
- Mobile / touch support

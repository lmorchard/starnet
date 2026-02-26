# STARNET — PLAYER'S MANUAL

```
            S T A R N E T
     ── nethacking across the interplanetary web ──
```

---

## THE SITUATION

Five hundred years out, humanity is scattered across the galaxy. Faster-than-light travel
through a region of hostile spacetime called The Panic is slow, brutal, and mostly automated
— colonists go in medically-induced coma, wake up somewhere new. But communication is nearly
instantaneous. Leguin Ansibles — city-block-sized resonators burning megawatts of power —
relay signals across the interstellar web. Every planet runs its own internet hanging off
ansible nodes. Every corp, every government, every criminal syndicate runs their own LANs.

You are a decker. Freelance intrusion specialist. You jack a neuraldeck into your local
network, trace a tether through the ansible web to a target system, and rob it blind. You
work alone. You take the job, get in, get the goods, get out. Simple.

The security systems that stand between you and the goods are called ICE — Intrusion Counter
Electronics. Some are dumb, some are smart. They don't sleep. They don't take breaks.
And when they find you, the clock starts.

---

## THE INTERFACE

```
┌──────────────────────────────────────┬────────────────────────┐
│                                      │  MISSION / NODE INFO   │
│           NETWORK GRAPH              │  ACTIONS               │
│                                      ├────────────────────────┤
│                                      │  EXPLOIT HAND          │
├──────────────────────────────────────┤                        │
│  LOG                                 │                        │
│  > CONSOLE INPUT                     │                        │
└──────────────────────────────────────┴────────────────────────┘
```

**Network Graph** — The LAN rendered as a node graph. Your accessible nodes glow cyan.
Unknown nodes appear as `???`. ICE appears as a red diamond when it moves onto a node
you control.

**Node Info Panel** — Details for your selected node: type, grade, access level, alert
state, vulnerabilities (after probing), and available actions.

**Exploit Hand** — Your five exploit cards. When a node is selected, matching cards
highlight in cyan. Click a card or type its number to use it.

**Log** — The full event record of your run. Every system event, every exploit roll,
every ICE movement that crosses into your territory appears here.

**Console** — Type commands directly. Tab-complete node names. Full command reference
at the end of this manual.

**HUD** — Top bar shows global alert level and your current cash balance.

---

## NODE TYPES

Each node in the LAN has a **type** that determines what it does and why you want it:

| Type              | Shape    | What it does                                      |
|-------------------|----------|---------------------------------------------------|
| **Gateway**       | Diamond  | Entry point. Your foothold into the LAN.          |
| **Router**        | Circle   | Routes traffic. Bridges to deeper nodes.          |
| **Firewall**      | Pentagon | High-security chokepoint. Hard to crack.          |
| **Workstation**   | Circle   | User machines. Often soft targets with loose data.|
| **File Server**   | Square   | Where documents live. Usually where your mission target is. |
| **Cryptovault**   | Diamond  | High-value encrypted storage. Hardest targets.    |
| **IDS**           | Hexagon  | Intrusion Detection System. Watches for exploits and reports to security monitors. Can be subverted. |
| **Security Mon.** | Hexagon  | Aggregates IDS alerts and raises global alert level. Can be owned to cancel trace. |

Nodes also have a **grade** (F through S) that affects how hard they are to exploit.
Lower grade = softer target = better odds. The gateway is usually grade D or F.
The cryptovault is grade S — bring your best cards.

---

## ACCESS LEVELS

Every node starts **locked**. To use a node you must work through its access levels:

```
LOCKED  →  COMPROMISED  →  OWNED
```

**Locked** — No access. You can probe it to reveal vulnerabilities.

**Compromised** — Partial access. You can read contents and attempt to escalate.
An IDS at this level can be reconfigured to stop forwarding alerts.

**Owned** — Full control. You can loot macguffins, reboot the node, or eject ICE.

---

## THE CORE LOOP

### 1. Select a Node

Click a node on the graph or type `select <node-id>`. Only nodes you have access to
(or nodes adjacent to ones you own) are available. Unknown `???` nodes become accessible
once you own a neighboring node.

### 2. Probe

```
> probe
```

Scanning a node reveals its **vulnerabilities** — the specific weaknesses in its software
you can exploit. Probing raises the node's local alert from green to yellow. If this node
is watched by an IDS, that alert will propagate.

### 3. Exploit

```
> exploit <card-number>
```

Or click an exploit card from your hand. Each card targets one or more vulnerability types.
If a card matches a known vulnerability on the selected node, your odds improve significantly.

**Exploit resolution:**

- Base success chance scales with **card quality** (the pip meter) vs **node grade**
- A **matching vulnerability** boosts your odds considerably
- Success: node access level rises (locked → compromised, compromised → owned)
- Failure: local alert rises; IDS nodes forward the alert event upstream

### 4. Read

```
> read
```

On a compromised or owned node, `read` scans for contents — data packages, files,
anything of value. You'll see what macguffins are present and whether your mission
target is here.

### 5. Loot

```
> loot
```

On an owned node with contents, `loot` extracts all macguffins and credits their
value to your wallet. Your mission target, if found, is flagged as collected.

### 6. Jack Out

```
> jackout
```

End the run and collect your score. Do this before the trace countdown hits zero.

---

## EXPLOIT CARDS

Your hand contains five exploit cards, randomly generated at the start of each run.

**Rarity** determines card power:

| Rarity    | Targets      | Starting Uses | Quality Range |
|-----------|--------------|---------------|---------------|
| Common    | 1 vuln type  | 3             | Low–Medium    |
| Uncommon  | 2 vuln types | 5             | Medium–High   |
| Rare      | 3 vuln types | 8             | High–Very High|

**Quality** is shown as a pip meter (█░░░░ to █████). Higher quality means better
base success chances, especially on unprobed or high-grade nodes.

**Decay** — Cards wear out:

- Each use costs one **use** from the remaining count
- When uses drop low and the card takes a failure hit, it becomes **worn** — still usable, but flagged
- A failed exploit can also **disclose** a card — the exploit signature leaks to the blue team,
  rendering the card useless for further escalation attempts. Disclosed cards stay in your hand
  but cannot be played.

When a node is selected, your hand re-sorts: matching cards first, then usable cards,
then worn, then disclosed. Cards that match the selected node's known vulnerabilities
highlight in cyan.

---

## THE ALERT SYSTEM

The LAN has a two-layer security architecture. Understanding it is the difference between
a clean run and a trace.

### Node Alert State

Every node has its own alert level: **GREEN → YELLOW → RED**. This escalates when:
- You probe the node (green → yellow)
- An exploit attempt fails on the node (yellow → red)

Node alerts only escalate, never de-escalate during a run.

### Global Alert

The **global alert** (shown in the HUD) is driven by **security monitors** — special nodes
that aggregate alerts from **IDS nodes** connected to them.

```
IDS node  →  (alert event)  →  Security Monitor  →  Global Alert
```

An IDS node that detects an exploit failure on a connected node fires an alert event
upstream to its security monitor. The security monitor raises the global alert.

**Global alert levels:**

- **GREEN** — Quiet. No active detection.
- **YELLOW** — Elevated. Security systems are watching.
- **RED** — Hot. Full intrusion detection active.

### The TRACE Countdown

When global alert hits red and security monitors confirm active intrusion, a **60-second
TRACE countdown** begins. The countdown shows in the HUD and sidebar. If it reaches zero,
your tether is traced back to your home node — run over, score lost.

To stop it: **jack out** before zero, or **own the security monitor** and use the
`cancel-trace` action.

### Subverting the IDS

If you can compromise and then **reconfigure** an IDS node:

```
> reconfigure
```

Event forwarding from that IDS to its connected security monitor is severed. Subsequent
exploit failures on nodes watched by that IDS will no longer escalate the global alert.
This is often worth the detour.

---

## ICE

ICE — Intrusion Counter Electronics — is the autonomous security program patrolling the LAN.
There is one ICE entity per run. It starts at its **resident node** (usually near the
security monitor, deep in the network) and moves.

### ICE Grades

| Grade | Behavior |
|-------|----------|
| F, D  | Random walk — wanders unpredictably |
| C, B  | Disturbance-tracking — drawn toward nodes that have been probed or exploited |
| A, S  | Player-seeking — actively hunts your current position |

### ICE Movement

ICE moves every few seconds, traversing the network graph. You can only see ICE when it
enters a node you **control** (compromised or owned) — it's invisible in the dark territory
of unowned nodes. When it moves onto a node you control, a red diamond appears on the graph
and the log reports its arrival.

### Passive vs Active Mode

When your deck connects to a LAN, it begins in **passive mode** — monitoring network
traffic and signals without announcing itself. In this state you are effectively a
ghost: observing, not present. ICE cannot detect you.

**Selecting a node** shifts you into **active mode**. Your deck is now actively coupled
to that node — maintaining a live connection, probing its service stack. This is when
you become visible. ICE on that node can sense your presence and the detection clock
can start. The reticle around a selected node represents this active coupling.

**Deselecting** returns you to passive mode. Your signal drops to background noise.
Unless a trace is already running, you become undetectable again.

The implication: **staying selected on a node costs you exposure.** Do your work,
then pull back.

### Detection

If ICE **dwells on your currently selected node** long enough, a detection countdown begins.
The sidebar shows the timer: `⚠ ICE DETECTION: Xs`. When it hits zero, ICE locks your signal,
the global alert escalates, and the trace countdown may begin.

**Counters:**

- **Deselect** the node or select a different one — drops back to passive, cancels the dwell timer
- **Eject** (owned nodes) — boots ICE to a random adjacent node: `> eject`
- **Reboot** (owned nodes) — forces ICE back to its resident node and takes your node
  offline briefly: `> reboot`

ICE on a node you've deselected continues its movement pattern but cannot detect you
unless you select that node again.

---

## MISSION

Each run has an optional mission: retrieve a specific **macguffin** from somewhere in the
network. The mission target is named in the sidebar at the start of the run.

You won't know which node holds the target until you `read` it. Once you loot the mission
target, the sidebar marks the mission complete. Mission completion is tracked separately
from your cash score.

---

## NODE ACTIONS REFERENCE

Actions depend on the selected node's type and access level:

| Action         | Available when...                              | Effect |
|----------------|------------------------------------------------|--------|
| `probe`        | Node is locked and unprobed                   | Reveals vulnerabilities, raises local alert |
| `exploit`      | Node is locked/compromised + probed            | Attempt to raise access level |
| `escalate`     | Node is compromised                            | Attempt to escalate to owned (shortcut to exploit UI) |
| `read`         | Node is compromised or owned, unread           | Reveals macguffins |
| `loot`         | Node is owned + has uncollected macguffins     | Extracts macguffins for cash |
| `reconfigure`  | IDS node is compromised or owned               | Severs event forwarding to security monitor |
| `eject`        | Owned node + ICE is present here               | Boots ICE to adjacent node |
| `reboot`       | Owned node, not currently rebooting            | Forces ICE home, node offline briefly |
| `cancel-trace` | Owned security-monitor + trace active          | Cancels the trace countdown |
| `jackout`      | Any time during run                            | End run, collect score |

---

## CONSOLE COMMANDS

The console accepts the following commands. Tab-complete works on node IDs.

```
select <node>          Select a node. Alias: s
deselect               Deselect current node.
probe [node]           Probe selected or specified node.
exploit <#|name>       Use exploit card by number or name on selected node.
escalate               Enter exploit-select mode on a compromised node.
read [node]            Read contents of selected/specified node.
loot [node]            Loot macguffins from owned node.
reconfigure [node]     Disable IDS event forwarding.
eject                  Push ICE off current node to adjacent node.
reboot [node]          Force ICE home; node goes briefly offline.
cancel-trace           Abort trace (requires owned security-monitor).
jackout                End run.

status                 Summary status (alias: status summary)
status full            Complete state dump
status ice             ICE grade, position (if visible), detection timer
status hand            Exploit hand with match indicators
status alert           Global alert, trace countdown, security node states
status mission         Mission target and collection status
status node <id>       Detail on a specific node
actions                List all currently valid actions with context

log [n]                Replay last n log entries (default: 20)
help                   Command listing
```

---

## TIPS

**Probe before you exploit.** Without probing, you're attacking blind. A matched
vulnerability can mean the difference between a 30% and a 65% success chance.

**Watch the IDS chain.** Before you start hammering on nodes deep in the network,
find the IDS nodes and figure out which security monitor they feed. If you can
compromise and reconfigure the IDS first, you can work quietly behind it.

**ICE is predictable once you understand its grade.** A grade-C ICE is drawn to
disturbances — it will come to where the action is. If you're making noise in one
part of the network, expect it to show up. Plan an escape route or have an eject
ready.

**Decay is real.** Don't burn your best card on a soft target. Save rare cards for
the high-grade nodes. A disclosed card is deadweight.

**The security monitor is the kill switch.** If you can own the security monitor,
you can cancel the trace and work at your own pace. It's usually the hardest node
on the board — but worth it if you're going for a deep run.

**Jack out when the job is done.** There's no shame in a clean exit.

---

*Based on an original game concept by Les Orchard.*
*Inspired by Netrunner (Rob Jacob, 1996), Hacknet, Neuromancer, and the cyberpunk tradition.*

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
Nodes you've detected but not yet identified appear as unlabelled signal contacts tagged
`sig-1`, `sig-2`, … — their real identity (id, type, grade) stays hidden until you probe
them. ICE appears as a red diamond when it moves onto a node you control.

**Node Info Panel** — Details for your targeted node: type, grade, access level, alert
state, vulnerabilities (after probing), and available actions.

**Exploit Hand** — Your five exploit cards. When a node is targeted, matching cards
highlight in cyan. There are two ways to play one: choose **XPLOIT** from the node's
action menu to open a card picker anchored on the node (the guided path — see the
*Exploit* step in *The Core Loop* below), or click a card directly in the hand strip (the override path — plays
any usable card, even a long shot). Both do the same thing; the hand is also your
at-a-glance inventory.

**Log** — The full event record of your run. Every system event, every exploit roll,
every ICE movement that crosses into your territory appears here.

**Console** — Type commands directly. Tab-complete node names. Full command reference
at the end of this manual.

**HUD** — Top bar shows global alert level, your current cash balance, and your two resource meters: **HEALTH** and **DECK INTEGRITY**. Both ramp from green through yellow to red as they deplete.

**Seed** — Each run is generated from a seed string, shown in the status display.
Sharing a seed lets someone else play the same network layout, vulnerabilities,
and exploit hand. Use `status summary` to see your current seed.

---

## NODE TYPES

Each node in the LAN has a **type** that determines what it does and why you want it:

| Type              | Glyph              | Gate         | What it does                                      |
|-------------------|-------------------|--------------|---------------------------------------------------|
| **WAN**           | Globe             | Probe        | The network boundary — your tether to the outside. Access the darknet broker here. |
| **Gateway**       | Portal arch       | Probe        | Entry point. Your foothold into the LAN.          |
| **Router**        | Four-way arrows   | Compromised  | Routes traffic. Bridges to deeper nodes. Must compromise to see connections. |
| **Firewall**      | Brick wall        | Owned        | High-security chokepoint. Must fully own to reveal what's beyond. |
| **Workstation**   | Monitor           | Probe        | User machines. Often soft targets with loose data.|
| **File Server**   | Rack stack        | Probe        | Where documents live. Usually where your mission target is. |
| **Cryptovault**   | Safe + dial       | Probe        | High-value encrypted storage. Hardest targets.    |
| **IDS**           | Camera eye        | Owned        | Intrusion Detection System. Must own to see connections. Can be subverted. |
| **Security Mon.** | Scope + crosshair | Owned        | Aggregates IDS alerts. Must own to see connections. Can cancel trace. |

Every node is drawn as a 12-sided container holding a small glyph of the device
it represents, rendered as a glowing vector outline. The glyph (and its color)
tells you *what kind* of node it is; the container's border plus a fence-hatch
pattern inside it tell you its *state* — the hatching gets denser as a node goes
from locked to compromised to owned, and the border color/pulse shows alert.

The **Gate** column shows when a node reveals its connections to neighboring nodes.
"Probe" means probing the node is enough to see what's connected. "Compromised" or
"Owned" means you must reach that access level before the node reveals what's beyond it.
Security infrastructure and chokepoints gate their connections — you can't just scan
them to map the network.

Nodes also have a **grade** (F through S) that affects how hard they are to exploit.
Lower grade = softer target = better odds. The gateway is usually grade D or F.
The cryptovault is grade S — bring your best cards.

### Honey-Pots

Some networks deploy **honey-pots** — countermeasure nodes disguised as tempting loot
targets. A honey-pot appears on the graph as an already-owned fileserver or workstation
with data waiting inside. Its true nature is hidden behind a spoofed type and label.

**DUMP is safe.** Dumping a honey-pot reveals its contents — bait data that looks real.
Nothing bad happens yet.

**FETCH, MINE, and XPLOIT spring the trap.** Any of these actions on a honey-pot
immediately fires a **counter-intrusion trace**: the same trace countdown as a full
detection, starting now. There is no payout — only the snap.

The honey-pot's bait data is never the mission target. If your mission calls for a
specific macguffin, it won't be sitting in a trap node.

---

## ACCESS LEVELS

Every node starts **locked**. To use a node you must work through its access levels:

```
LOCKED  →  COMPROMISED  →  OWNED
```

**Locked** — No access. You can probe it to reveal vulnerabilities.

**Compromised** — Partial access. You can read contents and attempt to escalate.
An IDS at this level can be corrupted to stop forwarding alerts.

**Owned** — Full control. You can fetch macguffins, reboot the node, or kick ICE.

A clean exploit on a **locked** node usually lands you at *compromised*, but a
high-quality card can punch straight through to **owned** in a single shot,
skipping the middle step. The better the card, the more often this happens.

---

## THE OVERWORLD HUB

Between runs you sit in the **overworld hub** — your home base. The game opens
here, and you return here after every run.

The hub holds your **persistent state**. A single run is self-contained, but two
things carry across runs:

- **Bank** — your cash. Loot you extract is deposited here when you jack out clean.
- **Exploit inventory** — the exploit cards you own. The darknet broker and mining
  add to it, and it persists between runs.

### Outfitting a run

From the hub you:

1. **Equip a loadout** — choose up to **5 exploits** from your inventory to take
   into the run; these become your hand. (Click a card, or `equip <#>`.)
2. **Carry cash** — decide how much of your bank to bring along, e.g. to shop the
   darknet broker mid-run. (`carry <amount>`.)
3. **Pick a target** — the hub offers a short list of targets at varying
   difficulty. Selecting one launches the run. (`launch <id>`.)

From the hub you can also **discard disclosed exploits** (burned-out cards
cluttering your inventory) and **visit the darknet broker** — opened from the
hub, the broker spends your **bank** and delivers purchases straight to your
**inventory** (rather than in-run cash and your hand).

### Stakes

What you bring is what you risk:

- **Clean jack-out** — your carried cash plus any loot is banked, and your loadout
  returns to inventory (worn by use, but yours). Cards you bought or mined mid-run
  are added to your inventory too.
- **Traced (caught)** — you lose the run's cash **and your carried loadout is
  burned** — those exploits are seized, gone from your inventory. Your bank and the
  exploits you *didn't* bring are safe.

A loadout is an ante: bring your best cards against a hard target and a trace costs
you dearly; bring cheap cards and you risk less but crack less.

---

## THE CORE LOOP

### 1. Select a Node

Click a node on the graph or type `target <node-id>`. Only nodes you have access to
are targetable. Detected-but-unidentified nodes appear as signal contacts (`sig-1`,
`sig-2`, …) when you exploit a neighboring node — click one to connect to it and begin
working. **Connecting does not reveal what the node is.** Its identity (id, type, grade)
stays hidden behind the `sig-N` tag until you probe it (or land a blind exploit on it);
until then you refer to it by that tag, both on the graph and in console commands.

### 2. Probe

```
> probe
```

Scanning a node reveals its **identity** — its id, type, and grade, which were hidden
behind its `sig-N` tag until now — along with its **vulnerabilities**, the specific
weaknesses in its software you can exploit. Probing takes time — higher-grade nodes take
longer to scan. A clockwise sweep animation shows progress. You can cancel a scan in
progress with `abort`, and navigating away from the node cancels it automatically.
(A successful blind exploit also counts as a probe, so it reveals the node's identity
and vulnerabilities the same way.)

For most node types, probing also reveals **neighboring connections** — you'll see new
`???` nodes appear on the graph. However, security infrastructure (firewalls, IDS,
security monitors) and routers gate their connections. You must reach a higher access
level before those nodes reveal what's beyond them. Check the node types table for
each type's gate level.

Probing raises the node's local alert from green to yellow. If this node is watched by
an IDS, that alert will propagate.

### 3. Exploit

Choose **XPLOIT** from the node's action menu, click a card in the hand strip, or type:

```
> xploit <card-number>
```

**XPLOIT is a node action like PROBE or DUMP.** Choosing it opens a card picker anchored
on the node:

- **Before you probe**, you're attacking blind — the picker offers *every usable card*.
- **After you probe**, the picker engages a match filter — it offers *only cards that
  target the node's revealed vulnerabilities*. Probing is what earns you this clarity.
- If a probed node has **no matching card** (or your whole hand is burned out), XPLOIT is
  shown disabled in the menu with a short reason ("No matching exploit available." / "No
  exploits available."). When that happens, play a long shot from the hand or shop the
  darknet broker.
- On an **already-owned node**, XPLOIT is disabled ("Already owned.") — there's no further
  access to gain. You can still play a card from the hand to re-exploit it if you really want.

The picker is the *guided* path. The **hand strip** and the `xploit <n>` console command
are *full-agency* channels: they can play any usable card against the selected node,
including a deliberate off-target long shot or a blind attempt on an unprobed node. Each
card targets one or more vulnerability types; a card matching a known vulnerability
improves your odds significantly.

**Exploit resolution:**

- Base success chance scales with **card quality** (the pip meter) vs **node grade**
- A **matching vulnerability** boosts your odds considerably
- Success: node access level rises (locked → compromised, compromised → owned).
  A high-quality card can skip the middle step, jumping a locked node straight to
  owned — more likely the better the card's quality pip
- Success also **counts as a probe** — the node's vulnerabilities are revealed, so a
  blind gamble that lands shows you what you're working with (no need to probe after)
- Failure: local alert rises; IDS nodes forward the alert event upstream

### 4. Dump

```
> dump
```

On a compromised or owned node, `dump` extracts data from the node's filesystem —
data packages, files, anything of value. This takes time, scaled by node grade.
The node's 12 facets light up in random order as data is extracted. You can cancel
with `abort`, and navigating away cancels automatically.

Once complete, you'll see what macguffins are present and whether your mission
target is here.

### 5. Fetch

```
> fetch
```

On an owned node with contents, `fetch` begins extracting all macguffins. This takes
time, scaled by node grade. Concentric rings ripple outward from the node as data
is siphoned. You can cancel with `abort`, and navigating away cancels
automatically. Once complete, all items are credited to your wallet. Your mission
target, if found, is flagged as collected.

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
base success chances, especially on unprobed or high-grade nodes. The pip meter is
also **color-coded** along a ramp — dim red (low) → amber → bright green/white
(high) — so a card's strength reads at a glance. The pip count carries the same
information without relying on color.

**Vulnerability glyphs** — Each vulnerability type has its own **glyph**, shown on
both the exploit card (next to each vuln it targets) and on the node panel (next to
each revealed vulnerability). Color groups the glyphs by rarity tier: teal (common),
amber (uncommon), magenta (rare). In the **hand** and node panel the textual vuln id
sits beside the glyph; the in-graph **XPLOIT picker** is a denser "express" view that
shows glyphs only (no labels). `status` output is unchanged.

**Decay** — Cards wear out, and *look* worn as they do:

- Each use costs one **use** from the remaining count; the card progressively
  **desaturates** as its uses deplete
- When uses drop low and the card takes a failure hit, it becomes **worn** — still
  usable, but desaturated and showing hairline cracks
- A failed exploit can also **disclose** a card — the exploit signature leaks to the
  blue team, rendering the card useless for further escalation attempts. Disclosed
  cards stay in your hand (rendered greyed-out, struck-through, and visibly burnt)
  but cannot be played.

When a node is targeted, your hand re-sorts: matching cards first, then usable cards,
then worn, then disclosed. Cards that match the selected node's known vulnerabilities
**glow green and lift**, and the specific shared **vuln glyph lights up** on the card —
a visual lock-and-key against the node's revealed vulnerabilities. Non-matching cards
recede (dimmed and desaturated).

The numbers shown next to cards in `status hand` are the numbers to use with
`xploit <n>` — the sort order changes with your selection, so always check
`status hand` to confirm which card is at which position.

---

## GETTING MORE EXPLOIT CARDS

Two channels replenish your hand mid-run. They trade off different resources:

| Channel | Cost | Speed | Risk |
|---------|------|-------|------|
| **Darknet broker** (WAN node) | Cash | Instant (LAN pauses) | None while shopping |
| **Mine** (owned node) | Time + ICE exposure | Grade-scaled delay | Trace clock keeps running |

Use the broker when you have cash and want certainty. Mine when you're broke but own
a node whose vulnerability profile matches what you need.

---

## THE DARKNET BROKER

The **WAN node** — the boundary between your tether and the LAN — is more than an exit
point. A darknet broker operates through it, selling exploit cards mid-run.

### Accessing the Store

Select the WAN node and run `exec access-darknet` (or choose it from the EXEC submenu /
sidebar button). **The LAN pauses while you shop** — ICE stops moving, timers freeze. You
can browse without the clock running.

```
> target wan
> darknet         # list available cards and prices
> buy <index>     # purchase the card at that position
> untarget        # or target another node to resume
```

### When to Use It

- Your hand doesn't match the node vulnerabilities you're facing — check the catalog
  for a better-targeted card
- Key cards are worn or disclosed mid-run — replenish before tackling hard nodes
- You've looted enough cash to afford an upgrade and a tough node lies ahead

### What's Available

The broker stocks a rotating catalog of exploit cards at varying prices. Cards cost
more the higher their rarity and quality. Rare cards with broad vulnerability coverage
are expensive but powerful against the hardest nodes.

You'll need cash to buy. Loot macguffins first, then shop.

---

## MINING

On any node you fully own, you can **mine** it for exploit code buried in its
filesystem — data-mining the node's own software stack for usable vulnerabilities.

```
> mine
```

Mining is a timed action. Higher-grade nodes take longer to mine. The trace clock
keeps running and ICE keeps moving — there is no pause.

### Yield

When mining completes, the system rolls a yield chance:

- **Hit** — you receive one exploit card. Its target vulnerability class is drawn
  from the *mined node's own vulnerabilities* (so mining a node with AuthBrute
  exposure tends to produce AuthBrute-type cards). Rarity is rolled by the node's
  grade: higher-grade nodes produce better cards more often.
- **Miss** — nothing. The log reports "vein running thin."

### Diminishing Returns

Every mining attempt — hit or miss — counts against the node. The yield chance
decays geometrically with each attempt. Higher-grade nodes sustain more attempts
before the curve bottoms out. When the next attempt's expected yield drops below
roughly 5%, the node is **exhausted**: the `mine` action disappears from its menu
and the node won't yield further.

Attempt counts are **permanent for the run** — they never reset, not even if you
reboot the node.

`status node <id>` on an owned node shows:
```
mine: attempts:N  exhausted:false  next-yield:42%
```

### Strategy

Mining is generic card supply, not a guaranteed answer. To crack a node showing
vulnerability class X, find an already-owned node that also exhibits X — mine it
for a matching exploit. But the clock is running, so weigh the time cost against
buying from the broker.

The spatial insight: **you're farming the network's own vulnerabilities back against
itself.** A node you've already owned is a potential exploit factory for the nodes
around it.

---

## THE ALERT SYSTEM

The LAN has a two-layer security architecture. Understanding it is the difference between
a clean run and a trace.

### Node Alert State

Every node has its own alert level: **GREEN → YELLOW → RED**. This escalates when:
- You probe the node (green → yellow)
- An exploit attempt fails on the node (yellow → red)

A **successful exploit resets the node's alert to green** — you found a clean way in and
contained the noise. Failed attempts leave their mark; successes erase it.

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

When global alert hits red and security monitors confirm active intrusion, a **TRACE
countdown** begins (30–90 seconds depending on network threat grade). The countdown shows in the HUD and sidebar. If it reaches zero,
your tether is traced back to your home node — run over, score lost.

To stop it: **jack out** before zero, or **own the security monitor** and run
`exec cancel-trace`.

### HEALTH and DECK INTEGRITY

In addition to the trace, you have two resource pools that start each run at 100:

- **HEALTH** — Your neural integrity. Certain ICE deal direct damage here instead of raising the
  alert. Depleting HEALTH to zero ends the run immediately — outcome: **burned** (end screen:
  "FLATLINED"). Fiction: neural feedback, brain injury.

- **DECK INTEGRITY** — Your hardware's operating condition. Other ICE target this pool directly.
  Depleting DECK INTEGRITY to zero ends the run — outcome: **bricked** (end screen: "DECK FRIED").
  Fiction: the deck's OS is corrupted past recovery.

Both are shown in the HUD as color-ramping meters (green → yellow → red). They appear in
`status` and `status full`. Damage events are logged with the offending node, e.g.
`[ICE] gateway neural feedback: −20 HEALTH (80 left)` or `[ICE] router-2 deck corruption: −20 DECK (80 left)`.

These are **parallel loss conditions** alongside the trace. A successful jack-out ends in
`success`; a trace that hits zero ends in `caught`; HEALTH depletion ends in `burned`; DECK
INTEGRITY depletion ends in `bricked`. You can lose any of the three ways without the others
being a factor.

As your condition worsens, the **network graph itself begins to degrade.** Low HEALTH bleeds
an organic, hallucinatory bloom across the graph and hazes it — faint as soon as you take a
wound, spreading and intensifying as health falls (it plateaus before the end, so it never
fully whites out). Low DECK INTEGRITY corrupts the graph itself: rare, easily-missed glitches
while your deck is mostly intact ("did I see that?"), escalating on a steep curve into
near-continuous chaos as it nears zero — nodes tremoring and blinking out, scrambled IDs and
glyphs, dropped connections, and phantom nodes and links that were never there. The effect is
confined to the graph — and at high damage the hallucinations bleed over the node action menus
too, so when your eyes can't be trusted, read the raw stream and drive from the **console**,
which stays perfectly legible.

### Subverting the IDS

If you can compromise and then **corrupt** an IDS node:

```
> exec corrupt
```

Event forwarding from that IDS to its connected security monitor is severed. Subsequent
exploit failures on nodes watched by that IDS will no longer escalate the global alert.
This is often worth the detour.

---

## ICE

ICE — Intrusion Counter Electronics — is the autonomous security program patrolling the LAN.
Low-security LANs (threat C and below) field no ICE. On secured LANs (threat B and up),
the network runs **one ICE program per security monitor** — so a heavily-monitored LAN may
be patrolled by several at once (currently capped at three). Each ICE starts at its
**resident node** (its security monitor, deep in the network) and patrols independently:
they don't coordinate, move on their own schedules, and each can detect you on its own.
And each is **its own type** — a single LAN can field a mix, so one ICE might drain your
HEALTH while another corrupts your DECK and a third just raises the alert. Read the log:
each instance announces what it did when it catches you.

### ICE Grades

| Grade | Behavior |
|-------|----------|
| F, D  | Random walk — wanders unpredictably |
| C, B  | Disturbance-tracking — drawn toward nodes where activity has been detected |
| A, S  | Player-seeking — actively hunts your current position |

Disturbance-tracking ICE doesn't only react to completed actions. An exploit in progress
leaks signal — the longer execution runs, the louder the noise. If ICE picks it up before
your exploit resolves, it will start routing. Cancelling mid-run leaves that signal in place.

### ICE Movement

ICE moves every few seconds, traversing the network graph. You can only see ICE when it
enters a node you **control** (compromised or owned) — it's invisible in the dark territory
of unowned nodes. When it moves onto a node you control, a red diamond appears on the graph
and the log reports its arrival. When a LAN has multiple ICE, each moves on its own
cadence (set by its grade) and a node you control can be visited by more than one at a time.

### Passive vs Active Mode

When your deck connects to a LAN, it begins in **passive mode** — monitoring network
traffic and signals without announcing itself. In this state you are effectively a
ghost: observing, not present. ICE cannot detect you.

**Targeting a node** shifts you into **active mode**. Your deck is now actively coupled
to that node — maintaining a live connection, probing its service stack. This is when
you become visible. ICE on that node can sense your presence and the detection clock
can start. The reticle around a targeted node represents this active coupling.

**Untargeting** returns you to passive mode. Your signal drops to background noise.
Unless a trace is already running, you become undetectable again.

The implication: **staying targeted on a node costs you exposure.** Do your work,
then pull back.

### Detection

If ICE **dwells on your currently targeted node** long enough, a detection countdown begins.
The sidebar shows the timer: `⚠ ICE DETECTION: Xs`. When it hits zero, ICE locks your signal
and the global alert escalates by one level. Each ICE dwells and detects independently — if
two ICE sit on your targeted node, each runs its own countdown, so you can be detected twice.

Each detection event steps the alert up: **GREEN → YELLOW → RED → TRACE**. Detections from
**all** ICE accumulate toward the same threshold — more ICE on you means the trace clock
starts sooner. The number of detections before the trace countdown begins depends on ICE grade:

| Grade | Detections to trace | What it means                                        |
|-------|---------------------|------------------------------------------------------|
| S, A  | 1                   | Instant trace — no second chances                    |
| B, C  | 2                   | First detection raises alert; second starts the clock|
| D, F  | 3                   | Slow to commit — three strikes before trace          |

Each visit by ICE to your targeted node is a fresh detection opportunity. If ICE leaves
your node and returns, the dwell timer resets and another detection cycle begins.

**Counters:**

- **Untarget** the node or target a different one — drops back to passive, cancels the dwell timer
- **Kick** (owned nodes) — boots the ICE present on this node to a random adjacent node: `> kick`
- **Reboot** (owned nodes) — forces ICE back to its resident node and takes your node
  offline briefly: `> reboot`

When several ICE are on the prowl, clearing one node doesn't help with the others — eject
buys time against the ICE in front of you, not the swarm.

ICE on a node you've untargeted continues its movement pattern but cannot detect you
unless you target that node again.

### ICE Types

All ICE share the same grade-based movement and detection mechanics, but their **effect on
detection** varies. Classic patrol ICE raises the global alert when it locks your signal —
advancing the trace. Two additional ICE types appear at threat grade B or better, and they
attack a different clock entirely:

| Type        | Available at | Detection effect                                      |
|-------------|--------------|-------------------------------------------------------|
| **Patrol**  | All grades   | Detection raises global alert → advances the trace    |
| **Sentinel**| B and above  | Detection deals **−20 HEALTH**; does NOT raise alert  |
| **Spike**   | B and above  | Detection deals **−20 DECK INTEGRITY**; does NOT raise alert |

The practical implication: **which ICE you face determines which clock you're racing.** A
network with patrol ICE puts pressure on your trace timer. A network with a Sentinel puts
pressure on your HEALTH. A Spike pursues your deck. A run can end without the trace ever
reaching red — if Sentinel or Spike detects you enough times. (There is one ICE entity per
run; its type is rolled at spawn. At B+ that roll is weighted — a patrol ICE can still turn
up — so a high-threat run doesn't guarantee a damaging type.)

Counters are the same regardless of ICE type: untarget, eject, or reboot.

---

## MISSION

Each run has an optional mission: retrieve a specific **macguffin** from somewhere in the
network. The mission target is named in the sidebar at the start of the run.

You won't know which node holds the target until you `dump` it. Once you fetch the mission
target, the sidebar marks the mission complete. Mission completion is tracked separately
from your cash score.

---

## NODE ACTIONS REFERENCE

Actions depend on the selected node's type and access level:

| Action            | Available when...                              | Effect |
|-------------------|------------------------------------------------|--------|
| `exec access-darknet` | WAN node is targeted                       | Opens the darknet broker store; pauses the LAN while shopping (run via `exec`) |
| `probe`           | Node is locked and unprobed                   | Timed scan — reveals vulnerabilities, raises local alert |
| `abort`           | Timed action in progress on targeted node      | Aborts the current action (probe, xploit, dump, or fetch) |
| `xploit` (menu) / `xploit <n>` (console) | Node is accessible and not currently exploiting | Opens a node-anchored card picker. Unprobed → all usable cards (blind); probed → only cards matching revealed vulns; disabled with a reason when no card applies or the node is already owned. The hand strip and `xploit <n>` console command stay full-agency (play any usable card). Raises access level on success. |
| `dump`         | Node is compromised or owned, unread           | Timed scan — reveals macguffins |
| `fetch`        | Node is owned + has uncollected macguffins     | Timed extraction — collects macguffins for cash |
| `mine`         | Node is owned and not exhausted                | Timed data-mining — rolls a yield chance for one exploit card targeting the node's own vuln classes; yield decays per attempt; disappears when the node is exhausted |
| `exec <script>` | A compromised/owned node exposes node scripts | Lists/runs the node's scripts (corrupt, spoof, unlock-vault, cancel-trace, access-darknet, …) |
| `corrupt`      | IDS node is compromised or owned               | Severs event forwarding to security monitor (run via `exec`) |
| `spoof`        | Security-monitor node, compromised or owned    | Recalibrates security monitor (run via `exec`) |
| `kick`         | Owned node + ICE is present here               | Boots ICE to adjacent node |
| `reboot`       | Owned node, not currently rebooting            | Forces ICE home, node offline briefly |
| `cancel-trace` | Owned security-monitor + trace active          | Cancels the trace countdown (run via `exec`) |
| `jackout`      | Any time during run                            | End run, collect score |

---

## CONSOLE COMMANDS

The console accepts the following commands. Tab-complete works on node IDs — and on the
`sig-N` tags of detected-but-unidentified nodes, which you refer to by tag (not id) until
you probe them. `status node sig-N` reports `[???]` for an unidentified node's type/grade.

```
target <node>          Target a node. Alias: t
untarget               Untarget current node.
probe [node]           Probe targeted or specified node.
abort                  Abort any in-progress timed action on targeted node.
xploit <#|name>        Use exploit card by number or name on targeted node.
dump [node]            Dump contents of targeted/specified node.
fetch [node]           Extract macguffins from owned node.
mine [node]            Data-mine owned node for an exploit card (timed; diminishing returns).
exec [<script>]        Run a node script (corrupt, spoof, unlock-vault, …). No arg lists scripts.
kick                   Push ICE off current node to adjacent node.
reboot [node]          Force ICE home; node goes briefly offline.
jackout                End run.

darknet                List darknet broker catalog (requires WAN targeted).
buy <index>            Purchase exploit card from broker (requires WAN targeted).

hub                    Open the overworld hub (between runs).
inventory              List your bank balance and persistent exploit inventory.
equip <#|id>           Add an inventory exploit to your loadout (max 5).
unequip <#|id>         Remove an exploit from your loadout.
carry <amount>         Set how much cash to carry into the next run.
discard-disclosed      Discard all disclosed (burned) exploits from inventory.
targets                List available targets to launch.
launch <targetId>      Start a run against a target with your loadout + carried cash.
                       (At the hub, `darknet` lists the broker catalog and `buy <index>`
                        purchases into your inventory, spending bank.)

status                 Summary status — alert, wallet, HEALTH, DECK INTEGRITY, ICE, hand (alias: status summary)
status full            Complete state dump — includes HEALTH and DECK INTEGRITY
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

**Firewalls hide what's behind them.** You won't see any connections beyond a
firewall, IDS, or security monitor until you own it. Routers require at least
compromised access. Plan your route — sometimes the soft path through a workstation
reveals more of the network than hammering on a hardened chokepoint.

**Watch the IDS chain.** Before you start hammering on nodes deep in the network,
find the IDS nodes and figure out which security monitor they feed. If you can
compromise and corrupt the IDS first, you can work quietly behind it.

**ICE is predictable once you understand its grade.** A grade-C ICE is drawn to
disturbances — it will come to where the action is. If you're making noise in one
part of the network, expect it to show up. Plan an escape route or have a kick
ready.

**Decay is real.** Don't burn your best card on a soft target. Save rare cards for
the high-grade nodes. A disclosed card is deadweight.

**The security monitor is the kill switch.** If you can own the security monitor,
you can cancel the trace and work at your own pace. It's usually the hardest node
on the board — but worth it if you're going for a deep run.

**If your hand doesn't match, resupply.** Two options: detour to the WAN node and
check the darknet catalog (the LAN freezes while you browse, costs cash), or mine
an owned node whose vulnerabilities overlap your target (costs time and ICE exposure,
no cash). Mining is the broke decker's fallback — and a reason to own nodes
strategically, not just opportunistically.

**Not every owned node is yours.** Some networks deploy honey-pots: loot nodes that
appear already-owned and ready to harvest. DUMP is safe — it just shows what's inside.
FETCH, MINE, or XPLOIT springs a counter-trace with no payout. If an owned fileserver
or workstation appeared without you doing any work on it, proceed with caution.

**Jack out when the job is done.** There's no shame in a clean exit.

---

*Based on an original game concept by Les Orchard.*
*Inspired by Netrunner (Rob Jacob, 1996), Hacknet, Neuromancer, and the cyberpunk tradition.*

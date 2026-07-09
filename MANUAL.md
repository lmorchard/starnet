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
┌──────────────────────────────────────────────────────────────┐
│                                                  ┌─────────┐ │
│                  NETWORK GRAPH                   │ HEALTH  │ │
│                                                  │  DECK   │ │
│         [ node inspector popup ]                 │VISIT WAN│ │
│                                                  └─────────┘ │
├──────────────────────────────────────────────────────────────┤
│  STATUS: LINK · ALERT · WALLET · MISSION              [ ☰ ]  │
├────────────────────────────────────┬─────────────────────────┤
│  LOG                               │  EXPLOIT HOARD [ ▾ ]   │
│  > CONSOLE INPUT                   │                         │
└────────────────────────────────────┴─────────────────────────┘
```

**Network Graph** — The LAN rendered as a node graph filling the full window width. Your
accessible nodes glow cyan. Nodes you've detected but not yet identified appear as
unlabelled signal contacts tagged `sig-1`, `sig-2`, … — their real identity (id, type,
grade) stays hidden until you probe them. ICE appears as a red diamond when it moves onto
a node you control.

**Node Inspector** — Selecting a node opens an anchored popup beside it on the graph. The
inspector has three regions: a header (type, GRADE · ACCESS · alert lamp, then the node
label), action buttons in the middle, and a footer showing ICE/action timers, CONTENTS,
and VULNERABILITIES. While a timed action runs on the node, the action buttons are
replaced by a busy indicator (e.g. `▶ EXECUTING`) with a progress tick-ladder; the
inspector stays visible. Submenu pickers (EXEC scripts) cascade off the inspector.
Unidentified nodes show the same header with `[???]` / the `sig-N` alias in place of
the real type and label.

**Exploit Hoard** — A summary of your ammo pile along the bottom of the screen beside the
terminal. It shows how many rounds you have left by rarity tier. When you fire **XPLOIT**
on a node, the auto-burn loop draws from this pile until the node is cracked, the heat
ceiling is hit, or the hoard runs dry. The hoard has a collapse toggle (`[ ▾ HOARD ]`);
use the `hand` console command to toggle it from the keyboard.

**Log** — The full event record of your run. Every system event, every exploit roll,
every ICE movement that crosses into your territory appears here.

**Console** — Type commands directly. Tab-complete node names. Full command reference
at the end of this manual.

**Status bar** — A full-width strip directly above the terminal showing the connection
status, the global alert level (as a vector lamp whose shape encodes the level: hexagon =
safe, point-up triangle = warning, inverted triangle = danger/trace), your current cash
balance, the active **mission** target and status, and — at its right end — a hamburger
button `[ ☰ ]` that opens a dropdown panel (NEW RUN / PAUSE / SAVE / LOAD) upward. Use the
`menu` console command to toggle the panel from the keyboard.

**Vital traces** — HEALTH and DECK INTEGRITY float as an inset in the upper-right corner
over the graph, drawn as vector-CRT vital traces that sweep left-to-right with a fading
phosphor trail. HEALTH is a green ECG/heartbeat (PQRST) complex — as health falls the
beat speeds up and decays through escalating ECG abnormalities (ST/T-wave changes, then
premature and skipped beats), breaking into a chaotic fibrillation flutter near death
before flatlining at zero. DECK INTEGRITY is a violet symmetric CPU-clock pulse — as
deck integrity falls its edges develop deepening ringing, overshoot and timing/amplitude
glitches (the amplitude itself stays roughly constant); it flatlines at zero. Hover
either trace to see the exact value as a percentage.

**Uplink control** — Floating beneath the vital traces (upper-right). Shows
`[ VISIT WAN ]`, which selects the WAN node (useful shortcut to reach the darknet broker,
lie-low, or disconnect). When the global alert is elevated (not green) or a trace is
counting down, a pulsing `[ JACK OUT ]` for instant disconnect is stacked beneath it —
`[ VISIT WAN ]` stays available so you can still hop to the WAN to lie low under pressure.

**Resizing the layout** — Two borders are drag-resizable: the border above the log/console
(graph vs. log height) and the border between the log and the exploit hoard strip (log vs.
hoard width). Grab a border and drag; **double-click a border to reset that split** to its
default. Your chosen sizes persist across reloads. The status bar is fixed.

**Seed** — Each run is generated from a seed string, shown in the status display.
Sharing a seed lets someone else play the same network layout, vulnerabilities,
and starting hoard. Use `status summary` to see your current seed.

---

## NODE TYPES

Each node in the LAN has a **type** that determines what it does and why you want it:

| Type              | Glyph              | Gate         | What it does                                      |
|-------------------|-------------------|--------------|---------------------------------------------------|
| **WAN**           | Globe             | Probe        | The network boundary — your tether to the outside. Access the darknet broker here. |
| **Gateway**       | Portal arch       | Probe        | Entry point. Your foothold into the LAN.          |
| **Router**        | Four-way arrows   | Probe        | Routes traffic. Bridges to deeper nodes. Probing reveals what's connected. |
| **Firewall**      | Brick wall        | Owned        | High-security chokepoint. Must fully own to reveal what's beyond. |
| **Workstation**   | Monitor           | Probe        | User machines. Often soft targets with loose data.|
| **File Server**   | Rack stack        | Probe        | Where documents live. Usually where your mission target is. |
| **Cryptovault**   | Safe + dial       | Probe        | High-value encrypted storage. Hardest targets.    |
| **IDS**           | Camera eye        | Owned        | Intrusion Detection System. Must own to see connections. Can be subverted. |
| **Security Mon.** | Scope + crosshair | Owned        | Aggregates IDS alerts. Must own to see connections. Own it, then run `cancel-trace` to abort a trace. |

Every node is drawn as a 12-sided container holding a small glyph of the device
it represents, rendered as a glowing vector outline. The glyph (and its color)
tells you *what kind* of node it is; the container's border plus a fence-hatch
pattern inside it tell you its *state* — the hatching changes as a node goes from
locked to owned, and the border color/pulse shows alert.

The **Gate** column shows when a node reveals its connections to neighboring nodes.
"Probe" means probing the node is enough to see what's connected. "Owned" means you
must crack it before the node reveals what's beyond it. Security infrastructure
(firewalls, IDS, monitors) gates their connections — you can't just scan them to
map the network.

Nodes also have a **grade** (F through S) that affects how hard they are to exploit.
Lower grade = softer target = better odds. The gateway is usually grade D or F.
The cryptovault is grade S — a high coherence reserve; bring your rare rounds.

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

Every node starts **locked**. Cracking it takes it straight to fully owned:

```
LOCKED  →  OWNED
```

**Locked** — No access. You can probe it to reveal vulnerabilities, and
dump its contents once probed. To use it fully you must crack it.

**Owned** — Full control. You can fetch macguffins, mine for rounds,
reboot the node, or kick ICE. Owning a node also reveals its connections
to neighboring nodes (for gates that require ownership — firewalls, IDS,
security monitors).

**XPLOIT** launches the coherence auto-burn on a locked node and takes it
straight to owned when coherence bottoms out — there is no intermediate step.

---

## THE OVERWORLD HUB

Between runs you sit in the **overworld hub** — your home base. The game opens
here, and you return here after every run.

The hub holds your **persistent state**. A single run is self-contained, but two
things carry across runs:

- **Bank** — your cash. Loot you extract is deposited here when you jack out clean.
- **Exploit hoard** — your ammo pile of exploit rounds. The darknet broker, mining,
  and loot drops add to it, and the whole thing persists between runs.

### Outfitting a run

From the hub you:

1. **Carry your hoard** — your entire persistent hoard travels with you into every
   run. No limit; you bring everything you own.
2. **Equip gear** — choose up to 2 pieces of smash-tooling gear from your profile
   for this run (`equip <gear>` / `unequip <gear>`). See GEAR / LOADOUT below.
3. **Carry cash** — decide how much of your bank to bring along, e.g. to buy
   research packs from the darknet broker mid-run. (`carry <amount>`.)
4. **Pick a target** — the hub offers a short list of **procedurally-generated
   jobs** at varying difficulty (soft / standard / hard), plus a set of
   **authored networks** (hand-crafted set-piece LANs). Selecting one launches the
   run. (`targets` lists them, `launch <id>`.)

From the hub you can also **discard disclosed rounds** (burned-out ammo cluttering
your hoard) and **visit the darknet broker** — opened from the hub, the broker
spends your **bank** and delivers research packs and gear straight to your profile
(rather than in-run cash).

### Stakes

What you bring is what you risk:

- **Clean jack-out** — your carried cash plus any loot is banked. Rounds burned
  (disclosed) during the run are gone; the rest of your hoard returns intact.
  Research packs bought or rounds mined mid-run are added to your hoard too.
- **Traced (caught)** — you lose the run's cash and loot. Your **hoard is safe** —
  it is not seized. (The ante mechanic is deferred to a later version.)

Your bank and your hoard survive a trace. What you lose is the run's earnings.

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
security monitors) gate their connections behind ownership. You must crack them before
those nodes reveal what's beyond them. Routers do reveal their neighbors on probe —
scanning a router shows the topology beyond it without needing to own it first. Check
the node types table for each type's gate level.

Probing raises the node's local alert from green to yellow. If this node is watched by
an IDS, that alert will propagate.

**Selective probe vs. SWEEP.** `probe` is the quiet, one-node-at-a-time scan. When you want to
map fast, **SWEEP** is a *broadcast* probe: choose it (and a depth), and it **ripples outward**
from the node — each branch advancing as its own probes complete, probing each node it reaches and
bringing it fully online — up to the depth you set, or until you `abort`. It flows *through* nodes
that reveal their neighbors on probe and **stops at the ones that gate their connections** (routers,
firewalls, IDS, monitors) — so the network's chokepoints are its natural sweep-breakers. The catch
is **heat**: every node a sweep touches adds heat all at once, so a deep/wide sweep spikes fast and
can trip the alarm mid-ripple. Watch the heat gauge and abort before it's too hot.
(Console: `sweep <depth|max>` on the targeted node.)

### 3. Exploit

Choose **XPLOIT** from the node's action menu, or type:

```
> xploit
```

**XPLOIT is a node action like PROBE or DUMP.** It is arg-less — no card picker,
no selection. Firing it launches a **coherence auto-burn**: the system pulls rounds from
your hoard one by one, each chipping away at the node's **coherence reserve**, until
the node **faults and goes owned** at zero coherence, until the burst **heat ceiling**
is reached, or until your **hoard runs dry**.

**How auto-burn works:**

- Every node has a **coherence reserve** that scales with grade. Hardened
  nodes (grade A/S) absorb far more punishment than soft ones (grade F).
- Each round fired chips coherence by:
  `base(grade × rarity) × (1 + type-match bonus) × jitter`.
  **Rarity** is the main damage driver — rare rounds bite hard. If a round's
  **type tags** match the node's probed vulnerabilities, it bites roughly twice
  as hard. Type amplifies the hit; it does not gate which rounds you can fire.
- After each shot, the node rolls a **grade-scaled disclosure chance**: if it
  fires, that round's pattern is exposed and the round is **burned** — gone from
  your hoard permanently. Higher-grade nodes are better at fingering your techniques.
- The barrage **stops** on any of three conditions:
  1. **Cracked** — coherence hits zero; the node faults → owned.
  2. **Heat ceiling** — burst heat (accumulated per shot) reaches the ceiling;
     XPLOIT pauses with coherence eroded but not yet zero. Try again later, or
     let the network cool first.
  3. **Hoard dry** — you have no undisclosed rounds left; XPLOIT fails.

Probe the node first. A matched run (type tags hitting revealed vulns) burns through
coherence far faster than a blind one, and costs fewer rounds.

On an **already-owned node**, XPLOIT is not available — there is nothing left to crack.

### 4. Dump

```
> dump
```

On any **probed** node, `dump` extracts data from the node's filesystem —
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

Three paths to the same outcome:

- **`jackout` console command** — instant, works any time.
- **`[ JACK OUT ]` uplink control** — the button floated in the upper-right corner of
  the graph. It appears stacked beneath `[ VISIT WAN ]` whenever the global alert is elevated
  (not green) or a trace is counting down; at green alert only `[ VISIT WAN ]` shows (which
  selects the WAN node rather than ending the run).
- **`exec disconnect`** — the in-fiction path. Target the WAN node and choose DISCONNECT
  from the EXEC submenu in the node inspector (or type `exec disconnect`). Severs the uplink
  and ends the run.

---

## EXPLOIT HOARD

Your **hoard** is a large pile of disposable exploit rounds — your ammunition for
cracking nodes. You carry the entire hoard into every run. Each round has a terse
hex id (e.g. `a3f19b2c`), a **rarity**, and one or more **type tags**.

**Rarity** drives how hard each round bites a node's coherence:

| Rarity    | Type tags  | Coherence bite  |
|-----------|------------|-----------------|
| Common    | 1          | Baseline         |
| Uncommon  | 2          | ~2× baseline     |
| Rare      | 3          | ~5× baseline     |

Rare rounds carry more type tags and hit harder — both because the rarity multiplier
is larger and because with three tags they're more likely to match a node's
vulnerabilities (which doubles the bite again).

**Type tags** — Each round targets one or more vulnerability classes. If any of a
round's tags matches a **probed** node's revealed vulnerabilities, the round hits
harder. Type does not gate eligibility — any round can be fired at any node;
type just amplifies the damage on a match.

**Disclosed (burned)** — A round that has been pattern-matched by the blue team is
**disclosed**: its signature is blown and it is gone from your hoard permanently.
Every shot rolls a grade-scaled chance that the node fingers the round's type
signature — harder nodes disclose your techniques more reliably. Disclosed rounds
do not return between runs; they are simply absent from your pile.

Your hoard persists between runs. Rounds burned during a run are gone; the rest
carry forward. The broker, mining, and loot add to it over time.

---

## GROWING YOUR HOARD

Three channels add rounds to your hoard. They trade off different resources:

| Channel | Cost | Speed | Risk |
|---------|------|-------|------|
| **Research packs** (darknet broker, WAN node) | Cash | Instant (LAN pauses) | None while shopping |
| **Mine** (owned node) | Time + ICE exposure | Grade-scaled delay | Trace clock keeps running |
| **Loot drops** | Already in-run | On fetch | Trace clock keeps running |

Use the broker when you have cash and want to bulk up fast. Mine when you're low
and own a node whose vulnerability profile overlaps your target — you'll get a
round that matches the node's own weaknesses. Loot is a bonus, not a plan.

---

## THE DARKNET BROKER

The **WAN node** — the boundary between your tether and the LAN — is more than an exit
point. A darknet broker operates through it, selling **research packs** mid-run.

### Accessing the Store

Select the WAN node and run `exec access-darknet` (or choose it from the EXEC submenu in
the node inspector). **The LAN pauses while you shop** — ICE stops moving, timers freeze.
You can browse without the clock running.

```
> target wan
> darknet         # list available research packs and prices
> buy <index>     # purchase the pack at that position
> untarget        # or target another node to resume
```

### When to Use It

- Your hoard is running thin — buy a pack to restock before a tough node
- You're sitting on looted cash with hard nodes ahead
- You want a specific rarity mix — packs show their contents before you buy

### What's Available

The broker sells **research packs**: blind-box assortments of exploit rounds at fixed
prices. Each pack listing shows the **rarity mix** (how many common, uncommon, and rare
rounds it contains) and the **price**. You see what rarity spread you're buying; the
specific rounds are revealed when the pack opens and deposits into your hoard.

Example packs:

| Pack                   | Contents                          | Price |
|------------------------|-----------------------------------|-------|
| Common Cache           | 12 common rounds                  | ¢120  |
| Mixed Signal Dump      | 6 common + 3 uncommon             | ¢300  |
| Rare Requisition       | 2 common + 2 uncommon + 1 rare    | ¢650  |

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

- **Hit** — you receive one **exploit round**, added directly to your hoard.
  Its type tags are drawn from the *mined node's own vulnerabilities* (so mining
  a node with AuthBrute exposure tends to produce AuthBrute-typed rounds — purpose-built
  for nodes like it). Rarity is rolled by the node's grade: higher-grade nodes produce
  better rounds more often.
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

Mining is targeted hoard supply, not a guaranteed answer. To crack a node showing
vulnerability class X, find an already-owned node that also exhibits X — mine it
for a matching round. But the clock is running, so weigh the time cost against
buying a pack from the broker.

The spatial insight: **you're farming the network's own vulnerabilities back against
itself.** A node you've already owned is a potential ammo factory for the nodes
around it.

---

## GEAR / LOADOUT

Your cyberdeck can be fitted with **smash-tooling gear** — persistent hardware that modifies
how the coherence auto-burn fires. Gear is bought at the **darknet broker** (hub or WAN node)
and persists in your **profile** between runs. It does not decay and is never lost on a trace.

### The Gear Roster

| Gear       | Effect                                                   | Price |
|------------|----------------------------------------------------------|-------|
| **Analyzer**  | Fires best-matched rounds first instead of a blind spray | ¢400  |
| **Dampener**  | Quiets the barrage — less heat per round                 | ¢350  |
| **Recon Rig** | Sharper targeting — matched rounds bite harder           | ¢350  |

- **Analyzer** — changes round selection from random to best-match (rounds whose type tags match
  the target's vulnerabilities fire before unmatched rounds). Cracking is more efficient; you
  waste fewer rounds on misses.
- **Dampener** — halves the heat contribution of each round fired during a burst. You can push
  further into a node before the heat ceiling stops you, at the cost of burning more rounds.
- **Recon Rig** — adds a flat bonus to the coherence bite of matched rounds. Combined with the
  Analyzer, matched rounds hit significantly harder.

### Loadout (the forced choice)

You can equip at most **2 pieces of gear** for each run (your deck has limited slots). The gear
roster has 3 items, so you must choose 2 — the third stays benched. This is the intended design:
each run you pick a style.

| Style preset | Gear equipped        | Play feel                                                |
|--------------|----------------------|----------------------------------------------------------|
| Analyzer + Dampener  | Analyzer, Dampener   | Smart and quiet — efficient burns, lower heat            |
| Ghost        | Dampener, Recon Rig  | Quiet and hard-hitting — lower heat, deeper matched bites|
| Smash        | Analyzer, Recon Rig  | Fast crack — best-match + matched bite bonus; runs hot   |

**Ammo (hoard) and gear are separate concerns.** You carry your entire hoard into every run
with no limit. Gear is the 2-slot structured choice on top of that.

### Equipping for a Run

At the **hub**, before launching:

```
> equip analyzer      # add to loadout (up to GEAR_SLOTS limit)
> equip dampener
> unequip recon-rig   # remove from loadout
> status              # shows Loadout: Analyzer · Dampener  (best-match · heat×0.5)
```

Gear is also buyable from the darknet broker at the hub. Purchased gear goes straight
into your profile; you then equip up to 2 pieces before launching.

Your equipped loadout is shown in `status` and `status full` during a run.

### Effect on Auto-burn

When `xploit` starts a coherence burst, the equipped gear takes effect immediately:

- **Analyzer** active → log notes "best-match" round selection
- **Dampener** active → heat per shot is reduced; you'll see fewer heat-ceiling stops
- **Recon Rig** active → matched rounds bite harder; coherence drops faster on type hits

The gear effects are fixed at burst start — swapping gear mid-run (at the hub store) does not
affect a burst already in progress.

---

## FLOW PROGRAMS

Some LANs aren't just containers of loot — they're **running machines**, with typed data
**flowing** along the connections between nodes. Where a network has flows, you'll see packets
travelling its edges: **money** (gold diamonds), **data** (cyan squares), **audit/alert** (red
triangles), **control** (amber chevrons), and **credentials** (magenta hexagons). Speed and
density show volume; the arrow shows which way value (or an alarm) is moving. A **dashed, dim**
flow is **encrypted** — you can see it exists but not what it carries until you read it.

> Flows currently appear on hand-authored networks (e.g. the Corporate Exchange). Not every LAN
> is wired this way yet.

Your cyberdeck carries a small always-available kit of **programs** that act on flows. Two ship
today:

- **SNIFF** — read a flow. Requires the node be **probed** first — a bit of reconnaissance before
  you can read its traffic (but just a scan, not the full break-in). Target a probed node, choose
  **SNIFF**, and pick a flow from the list (only flows to nodes you've already revealed appear).
  Sniffing an **encrypted** flow decrypts it (you can now read its type); sniffing a **credential**
  flow additionally **captures the token** for later use. Quiet — low heat. Like the other in-world
  verbs it's a **timed action** — a short read you can `abort`, and navigating away cancels it (you
  capture nothing, and pay no heat — the heat lands only when the read completes).
- **REPLAY** — replay a captured credential into a node that trusts it. Louder than SNIFF, and a
  **timed action** that takes a beat longer to inject (abortable; navigating away cancels, granting
  no access and costing no heat — the cost lands only on completion).

Console (act on the targeted node): `sniff [flow]` (no flow argument → lists the targeted node's flows, numbered), `replay`.

### Finesse access — the nodes you can't smash

Most nodes fall to a matching exploit (a **smash**). Some can't: a **finesse-only** node is
brute-immune — it offers no XPLOIT at all, because it only trusts a **credential that flows in
from elsewhere**. Probing it tells you which credential it wants.

To own one: find the credential flow feeding it, **probe the node that emits that flow** (SNIFF
needs recon first), **SNIFF** the flow to capture the token, then **REPLAY** the token into the
locked node. It jumps straight to **owned** — and whatever it was gating (a firewall's protected
subnet, say) is revealed. The whole LAN becomes one interlocked puzzle: to open X, find and tap
what flows toward it.

### Heat feeds the trace

Everything you do in a LAN raises **heat** — a measure of how much the network has *noticed* you.
Probing, exploiting, and running programs all add heat; loud actions add more. But heat **cools on
its own** over time: if you space your actions out, it bleeds back down and stays beneath notice.
Do too much *at once* and it spikes — and when heat crosses a network's tolerance, the alarm trips
and the global alert ratchets up a level (it can climb all the way to a trace). Each network has a
different, **unadvertised** tolerance: a sleepy low-threat LAN absorbs a flurry that a hardened one
would trip on instantly — you learn a network's patience by feel, not from a number.

Heat shows two ways. A **gauge** beside the alert in the status bar reads your heat *right now*
(cool → warm → hot). And in the upper-right vitals stack — below the HEALTH and DECK traces — a
**heat strip** draws it *over time* as a rising vector flame: it climbs as you act and sinks back as
you pace or lie low, so you can watch a spike building and the cooldown taking hold. Both are
deliberately *relative* — they tell you how hot you're running, never exactly how close the line is
(the network's tolerance stays hidden). The skill is pacing: read the network, act in measured
steps, and let it cool between moves rather than blitzing.

---

## THE ALERT SYSTEM

The LAN watches you through two sensors — a passive security grid and active ICE — both
feeding one alert ladder. Understanding it is the difference between a clean run and a trace.
(A third input, your accumulated **heat**, feeds the same ladder when it spikes — see *Heat feeds
the trace* above.)

The alert ladder is a **ratchet**: it only climbs (it never cools on its own). Heat can cool, but
once a heat spike has *ratcheted the alert up a level*, that level is stuck — the only way back
down is to **subvert the network's security systems** (corrupt an IDS, scrub a monitor's logs, or
own the monitor and cancel the trace). Get hot and the way out is to go quiet **and** take out the
watchers, not just wait.

### Node Alert State

Every node has its own alert level: **GREEN → YELLOW → RED**. This escalates when:
- You probe the node (green → yellow)
- An exploit attempt fails on the node (yellow → red)

A **successful exploit resets the node's alert to green** — you found a clean way in and
contained the noise. Failed attempts leave their mark; successes erase it.

### Global Alert — two sensors, one ladder

The **global alert** (shown in the HUD) climbs `GREEN → YELLOW → RED → TRACE`. It is driven by
**two independent sensors** that feed the same ladder and the same trace clock:

**1. The security grid (passive).** Sloppy hacking trips it. Every failed exploit raises an
alert that the LAN's **IDS** nodes hear; each un-corrupted IDS relays it to its **security
monitor**, which accumulates the alerts and climbs the ladder — starting the trace once enough
have piled up (a grade-scaled count: fewer on tougher networks).

```
exploit failure  →  IDS  →  (relay, unless corrupted)  →  Security Monitor  →  Global Alert
```

**2. ICE (active).** A roaming ICE that detects you climbs the *same* ladder and starts the
trace after a grade-scaled number of detections (see ICE, below).

A LAN with no ICE is more static and forgiving — the grid is the only clock, and you control
it: hack carefully, corrupt the IDS to go dark, or own the monitor and run `cancel-trace`.

**Global alert levels** (lamp shape: hexagon → point-up triangle → inverted triangle → inverted triangle):

- **GREEN** — Quiet. No active detection.
- **YELLOW** — Elevated. Security systems are watching.
- **RED** — Hot. Full intrusion detection active.
- **TRACE** — Countdown running. Jack out or cancel the trace before it hits zero.

### The TRACE Countdown

When either sensor reaches its threshold, a **TRACE countdown** begins (30–90 seconds
depending on network threat grade). The countdown shows in the HUD. If it reaches
zero, your tether is traced back to your home node — run over, score lost.

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

Both are shown as animated vector-CRT vital traces floating in the upper-right corner over the graph (see **Vital traces** in *The Interface*). They also appear in `status` and `status full`. Damage events are logged with the offending node, e.g.
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

If you can **own** an IDS node and then **corrupt** it:

```
> exec corrupt
```

This is a **timed action** — subverting the IDS takes a few seconds, longer on a higher-grade
IDS, and can be aborted mid-run. Once it completes, event forwarding from that IDS to its
connected security monitor is severed — that monitor goes dark and stops climbing the alert
ladder, no matter how many exploits you fail. (A LAN
with more than one IDS/monitor pair needs each IDS corrupted to fully go dark.) This is often
worth the detour, especially on an ICE-less LAN where the grid is your only clock.

### Two different things to cool: heat, and the alert

**Heat** and the **alert level** cool by different means, and it's worth keeping them straight:

- **Lie low** (`exec lie-low`) — at the **WAN node** — sheds **heat** fast. You go quiet and *wait*
  (a timed action — ICE keeps moving while you sit); a clock face spins on the WAN node as the wait
  completes, and your heat drops. It's **limited to a couple of uses per run** (keep lying low and a
  human admin eventually clocks your tether). Lie-low is heat relief — it does **not** lower the
  alert ladder.
- **Scrub logs** (`exec scrub-logs`) — on an **owned** security-monitor. Wipes that monitor's
  accumulated grid alerts and eases the global **alert** one level. Cheap and repeatable.

So the alert **ratchet** only comes down by subverting the watchers: **corrupt the IDS** (stop new
grid alerts) → **scrub the monitor** (ease the alert a level) → **own the monitor + `cancel-trace`**
(kill an active trace). Lie-low keeps you *cool* so the ratchet doesn't climb in the first place;
subversion is how you walk it back once it has. Once a trace is actually running, only jacking out
or `cancel-trace` stops it.

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
enters a node you **own** — it's invisible in the dark territory of nodes you haven't
cracked. When it moves onto a node you control, a red diamond appears on the graph
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
The node inspector shows the timer: `⚠ ICE DETECTION: Xs`. When it hits zero, ICE locks your signal
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
- **Kick** (owned nodes) — boots the ICE present on this node to a random adjacent node: `> kick`.
  A short **timed action** (a fraction of a second) — quick enough for a panic move, but abortable
  and cancelled by navigating away like any other timed verb
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
network. The mission target and its status (ACTIVE / COMPLETE / FAILED) are shown in the
status bar.

You won't know which node holds the target until you `dump` it. Once you fetch the mission
target, the status bar marks the mission complete. Mission completion is tracked separately
from your cash score.

---

## NODE ACTIONS REFERENCE

Actions depend on the selected node's type and access level:

| Action            | Available when...                              | Effect |
|-------------------|------------------------------------------------|--------|
| `exec access-darknet` | WAN node is targeted                       | Opens the darknet broker store; pauses the LAN while shopping (run via `exec`) |
| `probe`           | Node is locked and unprobed                   | Timed scan — reveals vulnerabilities, raises local alert |
| `sweep` (menu) / `sweep <depth|max>` (console) | Targeted accessible node, no sweep already running | Broadcast probe — ripples outward (each branch advances as its own probes complete) up to the chosen depth, probing + fully revealing each reached node, flowing through probe-gate nodes and stopping at gate-controllers. Adds heat per node (a fast spike). Abortable mid-ripple. |
| `abort`           | Timed action **or a sweep** in progress on targeted node | Aborts the current timed action (any abortable verb — reboot is involuntary) or a running sweep on the targeted node |
| `xploit` (menu) / `xploit` (console) | Node is accessible, not owned, not finesse-locked, not already burning | Launches coherence auto-burn from your hoard — fires rounds in sequence, each chipping the node's coherence, until it cracks (→ owned), the heat ceiling is hit, or the hoard runs dry. Arg-less — no card selection. Not offered on an already-owned node. |
| `dump`         | Node is probed, unread                         | Timed scan — reveals macguffins (available as soon as the node is probed; does not require owning it) |
| `fetch`        | Node is owned + has uncollected macguffins     | Timed extraction — collects macguffins for cash |
| `mine`         | Node is owned and not exhausted                | Timed data-mining — rolls a yield chance for one exploit round typed from the node's own vuln classes; deposits into your hoard; yield decays per attempt; disappears when the node is exhausted |
| `sniff`        | Probed node with a visible flow touching it, not already busy | Opens a flow picker (only flows to already-revealed nodes). Timed read — decrypts an encrypted flow / captures a credential token, but only once it completes; abortable, and navigating away cancels it (captures nothing). Adds heat. Needs the node probed first — not available on an unprobed node. |
| `replay`       | Finesse-locked node you hold its trusted credential for, not already busy | Timed injection — replays the captured credential; node jumps to owned (revealing what it gated) once it completes. Abortable; navigating away cancels it (no access granted). Adds heat. |
| `exec <script>` | An owned node exposes node scripts            | Lists/runs the node's scripts (corrupt, spoof, unlock-vault, cancel-trace, access-darknet, …). Set-piece/puzzle scripts run as timed actions by default (brief, ~2s, with the generic-process animation) unless they're a UI/exit action like cancel-trace, access-darknet, or disconnect |
| `corrupt`      | IDS node is owned                              | Timed subversion — severs event forwarding to security monitor once complete; grade-scaled duration (run via `exec`) |
| `scrub-logs`   | Security-monitor is owned                      | Wipes that monitor's accumulated alerts, eases the global alert one level (below trace; run via `exec`) |
| `lie-low`      | WAN node, uses remaining this run              | Timed wait that sheds **heat** (does not lower the alert ladder); limited per run (run via `exec`) |
| `spoof`        | Security-monitor node is owned                 | Recalibrates security monitor (run via `exec`) |
| `kick`         | Owned node + ICE is present here, not already busy | Timed (brief, ~0.5s) — boots ICE to an adjacent node once it completes; abortable |
| `reboot`       | Owned node, not currently rebooting            | Forces ICE home, node offline briefly |
| `cancel-trace` | Owned security-monitor + trace active          | Cancels the trace countdown (run via `exec`) |
| `disconnect`   | WAN node is targeted                           | Severs the uplink and ends the run (in-fiction jack-out path; run via `exec` or the node inspector) |
| `jackout`      | Any time during run                            | End run, collect score (console shortcut; identical outcome to `disconnect`) |

---

## CONSOLE COMMANDS

The console accepts the following commands. Tab-complete works on node IDs — and on the
`sig-N` tags of detected-but-unidentified nodes, which you refer to by tag (not id) until
you probe them. `status node sig-N` reports `[???]` for an unidentified node's type/grade.
Action verbs (`probe`, `xploit`, `dump`, `fetch`, `mine`, `sniff`, `replay`) act on the
**targeted** node — `target <node>` first, then issue the action.

```
target <node>          Target a node. Alias: t
untarget               Untarget current node.
probe                  Probe the targeted node.
sweep <depth|max>       Broadcast probe from the targeted node, rippling to depth (or "max"); abort to stop.
abort                  Abort any in-progress timed action on targeted node.
xploit                 Launch coherence auto-burn on targeted node (arg-less; draws from your hoard).
dump                   Dump contents of the targeted probed node.
fetch                  Extract macguffins from the targeted owned node.
mine                   Data-mine the targeted owned node for an exploit round (timed; diminishing returns).
sniff [flow]           Read a flow on the targeted node (decrypt / capture credential). No flow arg lists the node's flows.
replay                 Replay a captured credential into the targeted finesse node that trusts it.
exec [<script>]        Run a node script (corrupt, spoof, unlock-vault, disconnect, …). No arg lists scripts.
kick                   Push ICE off current node to adjacent node.
reboot                 Force ICE home; node goes briefly offline.
jackout                End run.

menu                   Toggle the status-bar controls panel (NEW RUN / PAUSE / SAVE / LOAD).
hand                   Toggle collapse of the exploit hoard strip.

darknet                List darknet broker research pack + gear catalog (requires WAN targeted or hub).
buy <index>            Purchase a research pack or gear item from the broker; rounds/gear go to your profile.

equip <gear>           Add a gear item to your loadout for the next run (hub only; up to GEAR_SLOTS limit).
unequip <gear>         Remove a gear item from your current loadout (hub only).

hub                    Open the overworld hub (between runs).
inventory              List your bank balance, persistent exploit hoard, and owned gear.
carry <amount>         Set how much cash to carry into the next run.
discard-disclosed      Discard all disclosed (burned) rounds from your hoard.
targets                List available targets to launch.
launch <targetId>      Start a run against a target with your full hoard, equipped loadout, and carried cash.
                       (At the hub, `darknet` lists the broker catalog and `buy <index>`
                        purchases a pack into your hoard, spending bank.)

status                 Summary status — alert, wallet, HEALTH, DECK INTEGRITY, ICE, hoard, loadout (alias: status summary)
status full            Complete state dump — includes HEALTH, DECK INTEGRITY, and loadout
status ice             ICE grade, position (if visible), detection timer
status hand            Exploit hoard summary with round counts by rarity
status alert           Global alert, trace countdown, security node states
status mission         Mission target and collection status
status node <id>       Detail on a specific node
actions                List all currently valid actions with context

log [n]                Replay last n log entries (default: 20)
help                   Command listing
```

---

## AUDIO

The soundtrack is **reactive** — it reads your run and scores it in real time, built up
from layers rather than a fixed loop.

- **Progress = reward.** As you penetrate deeper and own more of the LAN, the music
  *unfolds* — percussion, bass, lead, and a celebratory arp layer in as you go.
- **Threat = warning.** As the alert level climbs, ICE locks on, or your health/deck takes
  damage, urgency layers and a filter sweep cut in — fast to rise, slow to ease back down.
- **Variety.** Each run picks one of several songs (different moods/keys/tempos), and the
  arrangement periodically shifts into breakdowns so a long run never sits still.
- **A wandering harmonic bed.** The sustained drone chord doesn't hold one note all run — it
  drifts to neighbouring chords in the score's key every few bars, so the harmony slowly
  evolves instead of droning on. It always stays in key and consonant.
- **The hub has its own calm ambient theme**, separate from the LAN scores. Its drone and pad
  drift together through the key the same way, for more variety while you linger. The run's
  music **fades out** when you jack out, and the hub ambience drifts back in.

**Music commands** (console): `music` shows what's playing, `music list` lists the songs,
`music next` switches randomly, `music <name>` picks one (e.g. `music neon`), `music on|off`.

**Music: On / Off** lives in the hamburger menu (`[ ☰ ]`). The choice is remembered between
sessions. (Audio starts on your first click or keypress — browsers require a gesture before
playing sound.)

### Sound effects

Separate from the music, a layer of **synthesized sound effects** punctuates what's happening —
short cyberpunk-terminal cues organized into families you can read by ear:

- **info** — soft blips for probing, navigating, and revealing nodes.
- **success** — bright rising tones when an exploit lands or a node opens up.
- **reward** — chimes and quick arpeggios for fetching loot, mining a round, and completing a run.
- **failure** — dark buzzes and thuds for failed exploits, traps, and damage taken.
- **danger** — harsh rising alarms as the alert climbs, ICE locks on, or a trace begins.
- **relief** — settled descending tones when the alert cools or a trace is cancelled.

Many cues are **state-reflective** — they encode what happened, not just that something did:
gaining access (cracking a node to **owned**) plays a fuller 3-hit chord; mined
rounds escalate by rarity (common → uncommon → rare); a big-value loot haul gets a richer cue than
a small one; and **revealing nodes is a "discovery rush"** — a single reveal is a bright blip, but
unlocking a cluster of neighbors cascades into a quick rising run.

Every **timed action** (probe, xploit, dump, fetch, mine, lie-low, reboot, corrupt, and — by
default — set-piece/EXEC scripts) also gets its own **sustained drone** that plays while the
action is in progress and evolves as it advances — echoing the action's on-graph animation (a
scanning pulse for probe, a grinding tighten for xploit, a lock-on beat that settles for mine,
a neutral pulse for a generic set-piece script, and so on). The drone stops when the action
completes or is cancelled, and the usual one-shot fires at the end.

SFX are **independent of the music** — they have their own on/off and run on their own audio bus,
so you can have effects with the music off, and they play in the hub as well as in a run.

**SFX commands** (console): `sfx` shows on/off status, `sfx list` lists every cue,
`sfx test <cue>` auditions one, `sfx on|off` toggles them.

**SFX: On / Off** lives in the hamburger menu (`[ ☰ ]`) next to the music toggle. The choice is
remembered between sessions.

---

## TIPS

**Probe before you exploit.** Without probing, your rounds fire without the type-match
bonus. Probing first can more than double the coherence bite on a matched hit — the
same hoard goes twice as far.

**Firewalls hide what's behind them.** You won't see any connections beyond a
firewall, IDS, or security monitor until you own it. Routers reveal their neighbors
on probe. Plan your route — sometimes the soft path through a workstation reveals
more of the network than hammering on a hardened chokepoint.

**Watch the IDS chain.** Before you start burning rounds on nodes deep in the network,
find the IDS nodes and figure out which security monitor they feed. If you can
own and corrupt the IDS first, you can work quietly behind it.

**ICE is predictable once you understand its grade.** A grade-C ICE is drawn to
disturbances — it will come to where the action is. If you're making noise in one
part of the network, expect it to show up. Plan an escape route or have a kick
ready.

**Save rare rounds for hard targets.** Rare rounds hit five times as hard as common —
don't burn them on soft nodes. A disclosed round is gone forever.

**The security monitor is the kill switch.** If you can own the security monitor,
you can run `cancel-trace` to abort the countdown and work at your own pace (owning
alone doesn't stop it — you have to issue the command). It's usually the hardest node
on the board — but worth it if you're going for a deep run.

**If your hoard is running thin, resupply.** Two options: detour to the WAN node and
buy a research pack from the darknet broker (the LAN freezes while you browse, costs
cash), or mine an owned node whose vulnerabilities overlap your target (costs time and
ICE exposure, no cash). Mining is the broke decker's fallback — and a reason to own
nodes strategically, not just opportunistically.

**Not every owned node is yours.** Some networks deploy honey-pots: loot nodes that
appear already-owned and ready to harvest. DUMP is safe — it just shows what's inside.
FETCH, MINE, or XPLOIT springs a counter-trace with no payout. If an owned fileserver
or workstation appeared without you doing any work on it, proceed with caution.

**Jack out when the job is done.** There's no shame in a clean exit.

---

*Based on an original game concept by Les Orchard.*
*Inspired by Netrunner (Rob Jacob, 1996), Hacknet, Neuromancer, and the cyberpunk tradition.*

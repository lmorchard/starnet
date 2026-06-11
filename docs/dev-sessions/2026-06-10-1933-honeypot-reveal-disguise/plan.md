# Honey-pot Reveal + Disguise Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an owned node reveal its identity ("own it = know it"), then disguise the owned-by-default honey-pot as a seeded loot node whose DUMP baits and whose FETCH / MINE / EXPLOIT spring the counter-trace.

**Architecture:** The reveal fix is a one-line predicate change (already implemented). The disguise is baked into `graphDef` at network-generation time (NOT `initGame` — `toCytoscapeFormat` reads `type`/`label` from `graphDef` before `initGame` runs, especially on run-again). The trap re-arms by intercepting the existing `resolveLoot`/`resolveMine` ctx methods for nodes carrying a `trap: true` marker; the existing `poisoned → startTrace` per-node trigger remains the shared snap. Mission selection excludes trap-node loot so a run can't target unobtainable bait.

**Tech Stack:** Vanilla JS ES modules, `node:test` + `node:assert/strict`, seeded Mulberry32 RNG (`js/core/rng.js`), the NodeGraph runtime + trait/operator/trigger system.

**Working directory:** the worktree at `.claude/worktrees/honeypot-reveal-disguise`. Run all commands from there.

**Run a single test file:** `node --test <path>`  ·  **Full gate:** `make check`

---

### Task 1: Commit the already-implemented reveal fix

The `isObscured` "own it = know it" change is already in the working tree (foundation; it makes the honey-pot visible so the disguise matters). Verify it's green and commit it as the first standalone change.

**Files:**
- Modify (already changed): `js/core/state/node.js`
- Test (already changed): `js/core/state/node.test.js`, `js/core/console-commands/completions.test.js`

- [ ] **Step 1: Confirm the predicate is the generalized version**

`js/core/state/node.js` `isObscured` must read:

```js
export function isObscured(node) {
  return Boolean(node?.sigAlias) && !node.probed && node.accessLevel === "locked";
}
```

- [ ] **Step 2: Run the affected tests**

Run: `node --test js/core/state/node.test.js js/core/console-commands/completions.test.js`
Expected: PASS (node.test.js includes "owned-but-unprobed node is NOT obscured" and "compromised-but-unprobed node is NOT obscured").

- [ ] **Step 3: Commit**

```bash
git add js/core/state/node.js js/core/state/node.test.js js/core/console-commands/completions.test.js
git commit -m 'fix: reveal owned/compromised node identity (own it = know it)' \
  -m 'isObscured() now also requires accessLevel:"locked". A node you are inside
(compromised/owned) reveals its id/label/type even without a probe — fixing the
owned-by-default honey-pot, which PROBE can never touch and so stayed a permanent
sig-N mystery.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 2: Honey-pot set-piece — add loot surface + trap marker

Give the honey-pot the `lootable` trait (so DUMP/FETCH exist and bait loot generates) and a `trap: true` marker (the attribute resolvers and mission selection key on). Keep the existing `flag on:exploit → poisoned` operator and `poisoned → startTrace` trigger.

**Files:**
- Modify: `data/biomes/corporate-pieces.js` (the `honeyPot` export, ~line 614)
- Test: `tests/init-game.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/init-game.test.js` inside the top-level (after the existing `describe("initGame", …)` block):

```js
describe("honey-pot loot surface", () => {
  it("honey-pot is a trap node with bait loot and dump/fetch state", () => {
    initGame(() => buildCorporateExchange(), "honeypot-seed-1");
    const pot = getState().nodes["pot/honey-pot"];
    assert.ok(pot, "corporate-exchange should contain pot/honey-pot");
    assert.equal(pot.trap, true, "honey-pot must carry the trap marker");
    assert.equal(pot.read, false);
    assert.equal(pot.looted, false);
    assert.ok((pot.macguffins ?? []).length > 0, "honey-pot should have bait macguffins");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/init-game.test.js`
Expected: FAIL — `pot.trap` is undefined and `pot.macguffins` is empty (no `lootable` trait yet).

- [ ] **Step 3: Edit the honey-pot set-piece**

In `data/biomes/corporate-pieces.js`, change the `honeyPot` node's `traits` and `attributes`:

```js
    {
      id: "honey-pot",
      type: "honey-pot",
      traits: ["graded", "hackable", "rebootable", "lootable"],
      attributes: { accessLevel: "owned", contents: "corp-secrets", poisoned: false, trap: true },
      operators: [{ name: "flag", on: "exploit", attr: "poisoned" }],
      actions: [],
      // Per-node trigger: fire trace when poisoned (exploit/fetch/mine received)
      triggers: [{
        id: "triggered",
        when: { type: "node-attr", attr: "poisoned", eq: true },
        then: [
          { effect: "ctx-call", method: "startTrace", args: [] },
          { effect: "ctx-call", method: "log", args: ["HONEYPOT: Counter-intrusion trace initiated"] },
        ],
      }],
    },
```

(`lootCount` defaults to `[1,2]` via the `lootable` trait — no need to set it explicitly.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/init-game.test.js`
Expected: PASS.

- [ ] **Step 5: Run the set-piece tests (no regression to existing honey-pot behavior)**

Run: `node --test js/core/network/set-pieces.test.js`
Expected: PASS — "honey-pot: exploit attempt fires counter-trace" still green; "per-node triggers are preserved" still green.

- [ ] **Step 6: Commit**

```bash
git add data/biomes/corporate-pieces.js tests/init-game.test.js
git commit -m 'feat: honey-pot gains loot surface + trap marker' \
  -m 'Add lootable trait (DUMP/FETCH + bait macguffins) and a trap:true marker to
the honey-pot set-piece. Behavior mechanics (flag on:exploit, poisoned->startTrace)
unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 3: Trap springs on FETCH (resolveLoot intercept)

DUMP stays safe (baits — reveals the fake loot). FETCH on a trap node sets `poisoned` (the existing trigger fires the trace), marks the node looted, and pays out **nothing**.

**Files:**
- Modify: `js/core/node-graph/game-ctx.js` (`resolveLoot`, ~line 228)
- Test: `tests/integration.test.js`

- [ ] **Step 1: Write the failing test**

Append a new `describe` block to `tests/integration.test.js`. (The file already imports `initGame`, `getState`, and registers the lifecycle dispatcher — confirm `buildCorporateExchange` is imported; if not, add `import { buildNetwork as buildCorporateExchange } from "../data/networks/corporate-exchange.js";` at the top.)

```js
describe("honey-pot trap: FETCH springs the counter-trace", () => {
  it("dumping is safe; fetching traps, pays no cash, and starts the trace", () => {
    initGame(() => buildCorporateExchange(), "honeypot-fetch-seed");
    const s = getState();
    const graph = s.nodeGraph;
    const cashBefore = s.player.cash;

    // DUMP — safe bait. resolveRead sets read:true; trap must NOT fire.
    graph.executeAction("pot/honey-pot", "dump");
    graph.tick(40);
    assert.equal(graph.getNodeState("pot/honey-pot").read, true, "dump should complete");
    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, false, "dump must not spring the trap");
    assert.equal(getState().traceSecondsRemaining, null, "dump must not start a trace");

    // FETCH — the snap.
    graph.executeAction("pot/honey-pot", "fetch");
    graph.tick(40);
    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, true, "fetch must poison the node");
    assert.notEqual(getState().traceSecondsRemaining, null, "fetch must start the trace");
    assert.equal(getState().player.cash, cashBefore, "fetch must pay no cash on a trap node");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/integration.test.js`
Expected: FAIL — cash increases (loot paid out) and `poisoned` stays false (resolveLoot doesn't yet know about traps).

- [ ] **Step 3: Implement the intercept**

In `js/core/node-graph/game-ctx.js`, replace the body of `resolveLoot` (currently lines ~228-250) with:

```js
    resolveLoot: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node || node.looted) return;

      // Trap node (honey-pot): reaching for the bait springs the counter-trace.
      // Mark looted, poison the node (its trigger fires startTrace), pay nothing.
      if (node.trap) {
        setNodeLooted(nodeId);
        if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "poisoned", true);
        emitEvent(E.ACTION_RESOLVED, { action: A.FETCH, nodeId, label: node.label, detail: { items: 0, total: 0, trap: true } });
        return;
      }

      const { items, total } = collectMacguffins(nodeId);
      if (items.length === 0) {
        setNodeLooted(nodeId);
        return;
      }

      setNodeLooted(nodeId);
      addCash(total);
      emitEvent(E.ACTION_RESOLVED, { action: A.FETCH, nodeId, label: node.label, detail: { items: items.length, total } });

      if (s.mission && !s.mission.complete) {
        const gotMission = items.some((m) => m.id === s.mission.targetMacguffinId);
        if (gotMission) {
          setMissionComplete();
          emitEvent(E.MISSION_COMPLETE, { targetName: s.mission.targetName });
        }
      }
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/integration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/node-graph/game-ctx.js tests/integration.test.js
git commit -m 'feat: FETCH on a honey-pot springs the trap instead of paying out' \
  -m 'resolveLoot now diverts trap nodes: poison the node (existing trigger fires the
counter-trace), pay no cash. DUMP remains safe bait.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 4: Trap springs on MINE (resolveMine intercept)

Mining an owned honey-pot currently yields cards for free (loophole). Make MINE on a trap node spring the trap and grant no card.

**Files:**
- Modify: `js/core/node-graph/game-ctx.js` (`resolveMine`, ~line 252)
- Test: `tests/integration.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/integration.test.js`:

```js
describe("honey-pot trap: MINE springs the counter-trace", () => {
  it("mining a trap node poisons it, starts the trace, and grants no card", () => {
    initGame(() => buildCorporateExchange(), "honeypot-mine-seed");
    const s = getState();
    const graph = s.nodeGraph;
    const handBefore = s.player.hand.length;

    graph.executeAction("pot/honey-pot", "mine");
    graph.tick(60);

    assert.equal(graph.getNodeState("pot/honey-pot").poisoned, true, "mine must poison the node");
    assert.notEqual(getState().traceSecondsRemaining, null, "mine must start the trace");
    assert.equal(getState().player.hand.length, handBefore, "mine must grant no card on a trap node");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/integration.test.js`
Expected: FAIL — `poisoned` stays false; a card may be added.

- [ ] **Step 3: Implement the intercept**

In `js/core/node-graph/game-ctx.js`, add the trap guard at the **top** of `resolveMine` (right after the `if (!node) return;` line, before the `grade`/`attempts`/`chance` logic):

```js
    resolveMine: (nodeId) => {
      const s = getState();
      const node = s.nodes[nodeId];
      if (!node) return;

      // Trap node (honey-pot): data-mining trips the counter-trace, yields nothing.
      if (node.trap) {
        if (ctx._graph) ctx._graph.setNodeAttr(nodeId, "poisoned", true);
        setLastDisturbedNode(nodeId);
        emitEvent(E.ACTION_RESOLVED, { action: A.MINE, nodeId, label: node.label, detail: { outcome: "trap" } });
        return;
      }

      const grade = node.grade ?? "D";
      // ... existing body unchanged from here ...
```

(Leave everything from `const grade = …` onward exactly as it is.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/integration.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/node-graph/game-ctx.js tests/integration.test.js
git commit -m 'feat: MINE on a honey-pot springs the trap (closes the mine loophole)' \
  -m 'resolveMine diverts trap nodes: poison the node, no card. Previously an owned
honey-pot could be strip-mined for cards with no consequence.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 5: Seeded disguise helper

A pure helper that rewrites trap nodes' displayed `type` + `label` to a seeded pick from a loot-bearing pool. Operates on `graphDef.nodes` (shape `{ id, type, attributes }`), takes a raw seeded RNG function. Internal `id` is never touched (edges depend on it).

**Files:**
- Create: `js/core/network/disguise.js`
- Test: `js/core/network/disguise.test.js`

- [ ] **Step 1: Write the failing test**

Create `js/core/network/disguise.test.js`:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { disguiseTrapNodes, DISGUISE_TYPES } from "./disguise.js";
import { makeSeededRng } from "../rng.js";

function trapNode(id) {
  return { id, type: "honey-pot", attributes: { label: `pot/${id}`, trap: true } };
}
function plainNode(id, type) {
  return { id, type, attributes: { label: id } };
}

describe("disguiseTrapNodes", () => {
  it("rewrites a trap node's type to a loot-bearing disguise", () => {
    const nodes = [trapNode("honey-pot")];
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.ok(DISGUISE_TYPES.includes(nodes[0].type), "type should be a disguise");
    assert.notEqual(nodes[0].type, "honey-pot", "real type must be hidden");
  });

  it("rewrites the label so it no longer reads as a honey-pot", () => {
    const nodes = [trapNode("honey-pot")];
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.ok(!/honey/i.test(nodes[0].attributes.label), "label must not say honey");
  });

  it("leaves non-trap nodes untouched", () => {
    const nodes = [plainNode("fileserver", "fileserver")];
    const before = JSON.stringify(nodes[0]);
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.equal(JSON.stringify(nodes[0]), before);
  });

  it("is deterministic for a given seed", () => {
    const a = [trapNode("honey-pot")];
    const b = [trapNode("honey-pot")];
    disguiseTrapNodes(a, makeSeededRng("seed-x"));
    disguiseTrapNodes(b, makeSeededRng("seed-x"));
    assert.equal(a[0].type, b[0].type);
    assert.equal(a[0].attributes.label, b[0].attributes.label);
  });

  it("never touches the node id", () => {
    const nodes = [trapNode("honey-pot")];
    disguiseTrapNodes(nodes, makeSeededRng("seed-a"));
    assert.equal(nodes[0].id, "honey-pot");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/network/disguise.test.js`
Expected: FAIL — module `./disguise.js` does not exist.

- [ ] **Step 3: Implement the helper**

Create `js/core/network/disguise.js`:

```js
// @ts-check
/**
 * Trap-node disguise. The honey-pot ships accessLevel:"owned" (bait) and, since
 * the "own it = know it" reveal rule, shows its identity from the start. To keep
 * the deception, trap nodes masquerade as a seeded loot-bearing node: only the
 * displayed `type` (drives the glyph) and `label` change — the internal id is
 * untouched because edges depend on it. Applied at network-generation time so the
 * disguise is present in graphDef before the renderer (toCytoscapeFormat) reads it.
 */

/** Loot-bearing types a trap node may masquerade as (plain loot boxes only). */
export const DISGUISE_TYPES = ["fileserver", "workstation"];

/**
 * Rewrite each trap node's `type` + `label` to a seeded disguise, in place.
 * @param {Array<{ id: string, type: string, attributes?: Record<string, any> }>} nodes
 * @param {() => number} rng — raw seeded RNG returning [0, 1)
 */
export function disguiseTrapNodes(nodes, rng) {
  for (const node of nodes) {
    if (!node.attributes?.trap) continue;
    const disguise = DISGUISE_TYPES[Math.floor(rng() * DISGUISE_TYPES.length)];
    const suffix = Math.floor(rng() * 90) + 10; // 10–99
    node.type = disguise;
    node.attributes.label = `${disguise}-${suffix}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/core/network/disguise.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/network/disguise.js js/core/network/disguise.test.js
git commit -m 'feat: seeded trap-node disguise helper' \
  -m 'disguiseTrapNodes() rewrites trap nodes type+label to a seeded loot-bearing
disguise (fileserver/workstation). Pure, deterministic, id untouched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 6: Wire the disguise into network builders

Apply `disguiseTrapNodes` to every network that can contain a honey-pot: generated networks (seeded `rng` in scope) and the static `corporate-exchange`.

**Files:**
- Modify: `js/core/network/generate.js` (`generateNetwork`, ~line 144-158)
- Modify: `data/networks/corporate-exchange.js` (`buildNetwork`, ~line 93)
- Test: `tests/network-gen.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/network-gen.test.js` (it already exercises `generateNetwork`; confirm the imports it uses and mirror them — it imports `generateNetwork` from `../js/core/network/generate.js` and `CORPORATE_BIOME` from `../data/biomes/corporate.js`. If a helper for the default spec exists in that file, reuse it; otherwise use `CORPORATE_BIOME.defaultBudget`):

```js
describe("generateNetwork: honey-pots are disguised", () => {
  it("a generated corporate network never exposes a honey-pot type, and disguise is seeded", () => {
    const a = generateNetwork("disguise-seed-1", CORPORATE_BIOME.defaultBudget, CORPORATE_BIOME).graphDef;
    const trap = a.nodes.find((n) => n.attributes?.trap);
    if (!trap) return; // this seed produced no honey-pot; nothing to assert
    assert.notEqual(trap.type, "honey-pot", "disguise must hide the real type");
    assert.ok(["fileserver", "workstation"].includes(trap.type));

    // Same seed → identical disguise (deterministic).
    const b = generateNetwork("disguise-seed-1", CORPORATE_BIOME.defaultBudget, CORPORATE_BIOME).graphDef;
    const trapB = b.nodes.find((n) => n.id === trap.id);
    assert.equal(trapB.type, trap.type);
    assert.equal(trapB.attributes.label, trap.attributes.label);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/network-gen.test.js`
Expected: FAIL — the trap node's type is still `"honey-pot"`.

- [ ] **Step 3: Wire into `generateNetwork`**

In `js/core/network/generate.js`, add the import near the other network-layer imports (next to `import { makeSeededRng } from "../rng.js";`):

```js
import { disguiseTrapNodes } from "./disguise.js";
```

Then, inside `generateNetwork`, after `validate(...)` succeeds and **before** `return output;` (so validation runs on the real structure), add:

```js
      // Disguise trap nodes (honey-pots) using this attempt's seeded RNG, so the
      // disguise is baked into graphDef before the renderer reads type/label.
      disguiseTrapNodes(output.graphDef.nodes, rng);
```

(Place it in the same scope where `rng` and `output` are both defined — the success branch that returns `output`.)

- [ ] **Step 4: Wire into `corporate-exchange`**

In `data/networks/corporate-exchange.js`, add imports at the top:

```js
import { disguiseTrapNodes } from "../../js/core/network/disguise.js";
import { makeSeededRng } from "../../js/core/rng.js";
```

Then, just before the `return { graphDef: { nodes, edges, triggers }, meta }` line, add:

```js
  // Static network: deterministic disguise (fixed seed) so the honey-pot still
  // masquerades as a loot node.
  disguiseTrapNodes(nodes, makeSeededRng("corporate-exchange-honeypot"));
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/network-gen.test.js tests/init-game.test.js js/core/network/set-pieces.test.js`
Expected: PASS. (Note: `tests/init-game.test.js` Task-2 test references `pot/honey-pot` by **id** — unaffected by the disguise, which only changes type/label.)

- [ ] **Step 6: Commit**

```bash
git add js/core/network/generate.js data/networks/corporate-exchange.js tests/network-gen.test.js
git commit -m 'feat: disguise honey-pots in generated + corporate-exchange networks' \
  -m 'Apply disguiseTrapNodes at network-build time (seeded). Generated networks use
the generation RNG; the static corporate-exchange uses a fixed seed.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 7: Mission safety — never target trap-node loot

A run must never choose a honey-pot's bait macguffin as the mission objective (it can never be collected → unwinnable). Exclude trap nodes from mission selection.

**Files:**
- Modify: `js/core/loot.js` (`flagMissionMacguffin`, ~line 97)
- Test: `js/core/loot.test.js` (create if absent; otherwise append)

- [ ] **Step 1: Write the failing test**

If `js/core/loot.test.js` does not exist, create it:

```js
// @ts-check
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { flagMissionMacguffin } from "./loot.js";

describe("flagMissionMacguffin: trap safety", () => {
  it("never selects a macguffin on a trap node", () => {
    const nodes = [
      { id: "pot/honey-pot", trap: true, macguffins: [{ id: "bait-1", name: "Bait", cashValue: 100 }] },
    ];
    assert.equal(flagMissionMacguffin(nodes), null, "trap-only network has no valid mission target");
  });

  it("selects a real (non-trap) macguffin when one exists", () => {
    const nodes = [
      { id: "pot/honey-pot", trap: true, macguffins: [{ id: "bait-1", name: "Bait", cashValue: 100 }] },
      { id: "office/fileserver", macguffins: [{ id: "real-1", name: "Real", cashValue: 200 }] },
    ];
    const target = flagMissionMacguffin(nodes);
    assert.equal(target?.id, "real-1");
  });
});
```

(If the file already exists, append just the `describe` block above.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test js/core/loot.test.js`
Expected: FAIL on the first case — the bait macguffin gets selected (returns `{id:"bait-1",…}`), not `null`.

- [ ] **Step 3: Implement the exclusion**

In `js/core/loot.js`, change the first line of `flagMissionMacguffin`:

```js
export function flagMissionMacguffin(nodes) {
  const all = nodes.filter((n) => !n.trap).flatMap((n) => n.macguffins || []);
  if (all.length === 0) return null;
  const target = randomPick(RNG.LOOT, all);
  target.isMission = true;
  target.cashValue *= 3;
  return { id: target.id, name: target.name };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test js/core/loot.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/core/loot.js js/core/loot.test.js
git commit -m 'fix: exclude honey-pot bait loot from mission target selection' \
  -m 'flagMissionMacguffin skips trap nodes so a run cannot target unobtainable bait
and become unwinnable.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

### Task 8: Manual update + full verification

Reflect the changed honey-pot behavior in the player manual and run the full gate plus a bot-census smoke test (the bot will now fetch the disguised honey-pot and spring the trap — confirm it doesn't crash and the success curve is sane).

**Files:**
- Modify: `MANUAL.md` (honey-pot / node-types and any trap section)

- [ ] **Step 1: Update MANUAL.md**

Find the honey-pot entry (search `honey`). Update it to describe current behavior, e.g.:

> **Honey-pot** — Appears as an already-owned loot node (its true nature is hidden behind a disguised type and name). DUMP reveals tempting data, but FETCH, MINE, or XPLOIT springs a counter-intrusion trace. There is no payout — only the snap.

Adjust the node-types table / actions reference if they describe the honey-pot's old "fires on exploit only" behavior.

- [ ] **Step 2: Run the full gate**

Run: `make check`
Expected: lint clean, all tests pass (0 fail).

- [ ] **Step 3: Bot-census smoke test**

Run: `node scripts/bot-census.js --time F --money F --seeds 10`
Expected: completes without errors; report prints. Note the success rate in `notes.md`. A drop vs. the documented ~80% baseline is a balance signal to record (the bot now springs honey-pots) — NOT a blocker unless the bot crashes.

- [ ] **Step 4: Update notes.md and commit**

Record in `docs/dev-sessions/2026-06-10-1933-honeypot-reveal-disguise/notes.md`: a summary, the census result, and any follow-ups (e.g. whether the bot should learn to avoid trap nodes — likely a backlog item, since springing them is realistic).

```bash
git add MANUAL.md docs/dev-sessions/2026-06-10-1933-honeypot-reveal-disguise/notes.md
git commit -m 'docs: manual + session notes for honey-pot reveal + disguise' \
  -m 'Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>'
```

---

## Self-review notes

- **Spec coverage:** reveal fix (Task 1), disguise identity seeded/loot-bearing (Tasks 5-6), bait loot via lootable (Task 2), DUMP baits + FETCH/MINE/EXPLOIT snap (Tasks 2-4; EXPLOIT unchanged + regression-checked in Task 2 Step 5), mission safety (Task 7), docs (Task 8). All spec sections map to a task.
- **Spec correction:** the spec placed the disguise "in initGame"; investigation showed `toCytoscapeFormat` reads `type`/`label` from `graphDef` *before* `initGame` on run-again, so the disguise is applied at **network-generation time** instead. This plan supersedes that detail.
- **Type consistency:** `trap` (boolean attribute) and `disguiseTrapNodes(nodes, rng)` / `DISGUISE_TYPES` are used identically across Tasks 2, 5, 6, 7. `node.trap` is read at top level on state nodes (getNode flattens attributes) and at `node.attributes.trap` on raw graphDef nodes — the helper (graphDef) uses `node.attributes?.trap`; resolvers and mission selection (state nodes) use `node.trap`. This split is intentional and correct for each layer.

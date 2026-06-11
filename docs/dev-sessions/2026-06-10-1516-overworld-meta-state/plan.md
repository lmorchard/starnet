# Overworld Meta-State (v1) Implementation Plan

**Goal:** A persistent player profile (cash bank + exploit-card inventory) that
survives between runs, with runs launched and resolved through a textual hub.

**Approach:** Profile lives outside `GameState` in localStorage (a pure core model
+ a UI localStorage binding). Runs launch from a chosen loadout via a new
`meta.startHandCards` path; on `RUN_ENDED` the result commits back — success
deposits cash and writes card decay back, capture (Medium stakes) forfeits run
cash and burns the carried loadout. The hub is a Lit modal mirroring the darknet
store, with symmetric console commands.

**Tech stack:** Vanilla ES modules, Lit (light-DOM components), Node `node:test`,
browser `localStorage`. No new dependencies.

---

## Phase 1: Persistent profile foundation (model + store + bootstrap)

Pure profile data model in core, a localStorage binding in UI, and a
new-profile bootstrap. Not user-visible yet; establishes the spine everything
else reads/writes.

**Files:**
- Modify: `js/core/types.js` — add `instanceId` to `ExploitCard`; add `StarnetProfile` typedef.
- Create: `js/core/profile/index.js` — pure profile model + mutations.
- Create: `js/ui/profile-store.js` — localStorage load/save + bootstrap.
- Test: `js/core/profile/profile.test.js`

**Key changes:**

`js/core/types.js` — extend `ExploitCard`, add profile type:
```javascript
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   rarity: Rarity,
 *   quality: number,
 *   targetVulnTypes: string[],
 *   decayState: DecayState,
 *   usesRemaining: number,
 *   instanceId?: string,   // profile-scoped unique id; assigned on inventory entry
 * }} ExploitCard
 */

/**
 * Persistent cross-run player profile. Lives OUTSIDE GameState (localStorage).
 * @typedef {{
 *   version: number,
 *   bank: number,
 *   inventory: ExploitCard[],
 *   _instanceSeq: number,   // monotonic source of instanceIds (persisted)
 *   _hubVisits: number,      // drives deterministic target generation
 * }} StarnetProfile
 */
```

`js/core/profile/index.js` — pure functions, mutate-and-return a passed profile:
```javascript
// @ts-check
/** @typedef {import('../types.js').StarnetProfile} StarnetProfile */
/** @typedef {import('../types.js').ExploitCard} ExploitCard */

export const PROFILE_VERSION = 1;

/** @returns {StarnetProfile} */
export function createProfile({ bank = 0, inventory = [] } = {}) {
  const p = { version: PROFILE_VERSION, bank, inventory: [], _instanceSeq: 0, _hubVisits: 0 };
  inventory.forEach((c) => addCardToInventory(p, c));
  return p;
}

/** Assigns an instanceId if absent and pushes the card into inventory. @returns {ExploitCard} */
export function addCardToInventory(profile, card) {
  if (!card.instanceId) card.instanceId = `inv-${profile._instanceSeq++}`;
  profile.inventory.push(card);
  return card;
}

/** @returns {ExploitCard|undefined} */
export function findCard(profile, instanceId) {
  return profile.inventory.find((c) => c.instanceId === instanceId);
}

/** Removes inventory cards whose instanceId is in the set. @returns {ExploitCard[]} removed */
export function removeCardsByInstanceId(profile, instanceIds) {
  const set = new Set(instanceIds);
  const removed = profile.inventory.filter((c) => set.has(c.instanceId));
  profile.inventory = profile.inventory.filter((c) => !set.has(c.instanceId));
  return removed;
}

export function deposit(profile, amount) { profile.bank += amount; return profile; }

/** Debits bank if sufficient. @returns {boolean} success */
export function withdraw(profile, amount) {
  if (amount < 0 || profile.bank < amount) return false;
  profile.bank -= amount;
  return true;
}
```

`js/ui/profile-store.js` — localStorage binding + bootstrap (mirror `save-load.js` JSON):
```javascript
// @ts-check
import { createProfile, addCardToInventory } from "../core/profile/index.js";
import { generateStartingHand } from "../core/exploits.js";

const PROFILE_KEY = "starnet:profile";
const DEFAULT_BANK = 1000; // matches initGame's startCash fallback

/** Load the profile from localStorage, or bootstrap a new one. @returns {import('../core/types.js').StarnetProfile} */
export function loadProfile() {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (raw) { try { return JSON.parse(raw); } catch { /* fall through to bootstrap */ } }
  return bootstrapProfile();
}

export function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function bootstrapProfile() {
  const p = createProfile({ bank: DEFAULT_BANK });
  generateStartingHand().forEach((c) => addCardToInventory(p, c)); // ~5 starter cards
  saveProfile(p);
  return p;
}
```

**Verification — automated:**
- [x] `make test` passes (new `js/core/profile/profile.test.js`: instanceId assigned & unique; `removeCardsByInstanceId` removes only matches; `withdraw` guards on insufficient bank; `createProfile` bootstraps inventory with instanceIds)
- [x] `make lint` passes (JSDoc types for new typedefs resolve)

**Verification — manual:**
- [x] Browser (Phase 3b): on boot the hub calls `loadProfile()`, bootstrapping `starnet:profile` with `bank: 1000` and 6 starter cards each carrying an `instanceId`. Verified via Playwright.

---

## Phase 2: Launch from a loadout + commit results on run end

A run can be launched with real loadout cards, and on `RUN_ENDED` the outcome
commits back to the profile. After this phase, persistence is real end-to-end
(verifiable via tests and a manual play-through), even before the hub UI exists.

**Files:**
- Modify: `js/core/state/index.js` — `initGame` accepts `meta.startHandCards`.
- Modify: `js/core/profile/index.js` — add `buildRunHand` + `commitRun`.
- Modify: `js/ui/profile-store.js` — `launchRun`, an `activeRun` record, and an `E.RUN_ENDED` subscriber that commits.
- Test: `js/core/profile/profile.test.js` (extend) and `tests/profile-commit.test.js`

**Key changes:**

`js/core/state/index.js` (~line 156) — backwards-compatible hand source:
```javascript
player: {
  cash: meta.startCash ?? 1000,
  hand: meta.startHandCards ?? generateStartingHand(meta.startHand),
},
```
(Headless entry points pass no `startHandCards`, so they keep generating from the rarity spec — unchanged.)

`js/core/profile/index.js` — loadout cloning + commit:
```javascript
/**
 * Clone loadout cards for use as a run hand. Clones so in-run decay mutates the
 * run copy, not the inventory object; instanceId is preserved for write-back.
 * @param {ExploitCard[]} loadoutCards
 * @returns {ExploitCard[]}
 */
export function buildRunHand(loadoutCards) {
  return loadoutCards.map((c) => ({ ...c, targetVulnTypes: [...c.targetVulnTypes] }));
}

/**
 * Commit a finished run back into the profile.
 * @param {StarnetProfile} profile
 * @param {{ outcome: "success"|"caught", finalCash: number, finalHand: ExploitCard[], carriedInstanceIds: string[] }} run
 * @returns {StarnetProfile}
 */
export function commitRun(profile, { outcome, finalCash, finalHand, carriedInstanceIds }) {
  if (outcome === "caught") {
    // Medium stakes: carried loadout burned; run cash already forfeit (finalCash 0).
    removeCardsByInstanceId(profile, carriedInstanceIds);
    return profile;
  }
  // success: deposit run cash (carried leftover + loot), then reconcile the hand.
  deposit(profile, finalCash);
  for (const card of finalHand) {
    const existing = card.instanceId ? findCard(profile, card.instanceId) : null;
    if (existing) {
      existing.usesRemaining = card.usesRemaining;  // write back decay
      existing.decayState = card.decayState;
    } else {
      addCardToInventory(profile, card);  // bought/mined mid-run → new inventory card
    }
  }
  return profile;
}
```

`js/ui/profile-store.js` — launch + commit wiring:
```javascript
import { on } from "../core/events.js";
import { E } from "../core/events.js";
import { getState, initGame } from "../core/state/index.js";
import { buildRunHand, commitRun, withdraw, findCard } from "../core/profile/index.js";

let activeRun = null; // { carriedInstanceIds: string[] } for the in-flight run

/**
 * Launch a run from the profile. buildNetworkResult() returns { graphDef, meta }.
 * @param {{ buildNetworkResult: () => any, loadoutInstanceIds: string[], withdrawAmount: number, opts?: object }} args
 */
export function launchRun({ buildNetworkResult, loadoutInstanceIds, withdrawAmount, opts = {} }) {
  const profile = loadProfile();
  if (!withdraw(profile, withdrawAmount)) return false;
  const loadout = loadoutInstanceIds.map((id) => findCard(profile, id)).filter(Boolean);
  saveProfile(profile); // bank debited at launch
  activeRun = { carriedInstanceIds: loadout.map((c) => c.instanceId) };
  const base = buildNetworkResult();
  const meta = { ...base.meta, startHandCards: buildRunHand(loadout), startCash: withdrawAmount };
  initGame(() => ({ graphDef: base.graphDef, meta }), undefined, opts);
  return true;
}

// Commit on run end (subscribe once at module init).
on(E.RUN_ENDED, ({ outcome }) => {
  if (!activeRun) return;
  const s = getState();
  const profile = loadProfile();
  commitRun(profile, {
    outcome,
    finalCash: s.player.cash,        // already 0 on "caught" (endRun zeroes it)
    finalHand: s.player.hand,
    carriedInstanceIds: activeRun.carriedInstanceIds,
  });
  saveProfile(profile);
  activeRun = null;
});
```

**Verification — automated:**
- [x] `make test` passes. New tests in `tests/profile-commit.test.js` (use explicit seeds per the seed convention):
  - success deposits `finalCash` to bank
  - a carried card whose `usesRemaining`/`decayState` changed writes back to the same inventory instance (matched by `instanceId`)
  - a `finalHand` card with no `instanceId` (simulating a mid-run store/mine acquisition) is added to inventory with a fresh `instanceId`
  - "caught" removes exactly the carried `instanceId`s and deposits nothing; bank unchanged from post-withdraw value
  - `initGame` with `meta.startHandCards` produces a `player.hand` equal to those cards (by `instanceId`); with only `meta.startHand` it still generates from the rarity spec
- [x] `make lint` passes

> **Adaptation:** the run-end commit is wired via an exported `initProfileRunCommit()`
> (called from `main.js` in Phase 3) rather than a bare import side-effect — avoids
> registering the handler just by importing `launchRun`.

**Verification — manual:**
- [x] Browser (Phase 3b): launched from the hub with loadout `[inv-0, inv-1]` + ¥200 carried → bank debited 1000→800; jacked out → `commitRun` deposited the ¥200 back (bank 1000) and the loadout returned to inventory (not duplicated, not burned on success). Capture-burn path covered by the `commitRun` "caught" unit test.

---

## Phase 3a: Rework restart into a unified `startRun` + graph reset

Fixes the broken "run again" (discovered mid-execute) and builds the foundation
the hub needs. **Root cause:** `runAgainHandler` calls `initGame` (core state
resets) but never resets the view — `graph.js` has no `RUN_STARTED`/`STATE_CHANGED`
hook, `ensureNodeInGraph` is add-only/idempotent, and there is no element-removal
path. The prior run's nodes/ICE persist, so the game appears not to reset. Today's
"run again" only worked at all because it reused the same topology.

**Files:**
- Modify: `js/ui/graph.js` — add `resetGraph(networkData)`.
- Modify: `js/ui/main.js` — extract `startRun(networkResult)`; use it from `init()` and `runAgainHandler`.

**Key changes:**
```javascript
// graph.js — clear the board and re-point topology, reusing the same cy instance
// (no cytoscape teardown → sidesteps the destroy/leak risk of Option A).
export function resetGraph(networkData) {
  if (!cy) return;
  cy.elements().remove();
  _networkNodes = new Map();
  for (const n of networkData.nodes) {
    _networkNodes.set(n.id, { id: n.id, label: n.label, type: n.type, grade: n.grade });
  }
  _networkEdges = networkData.edges;
}

// main.js — the one path all three callers share (first boot, run-again, hub)
function startRun(networkResult) {
  resetGraph(toCytoscapeFormat(networkResult)); // no-op first time (cy empty)
  initGame(() => networkResult, undefined, { openDarknetsStore });
  syncInitialNodes(getState().nodes);
  const cy = getCy();
  if (cy) fitGraph(cy);
  addIceNode();
  startIce();
}
```
`init()` keeps its one-time setup (initGraph to create cy, console, visual-renderer
— which must subscribe before the first `initGame` STATE_CHANGED — graph-bridge,
dynamic-actions), then calls `startRun(networkResult)`. `runAgainHandler` becomes
`() => startRun(buildNetworkFn())`. (`startRun` is exported/closured so the hub can
call it in Phase 3b.)

**Deeper root cause found during execute (Playwright):** the bug wasn't just a
missing reset. `initGame` fires `NODE_STATE_CHANGED` events while *constructing*
the NodeGraph (setting vulns/macguffins), and on a re-init the global `state` still
points at the prior run during that window — so `visual-renderer` re-adds the prior
run's revealed nodes from stale state. Resetting *before* `initGame` got immediately
re-populated. **Fix:** `startRun` does `initGame` → `resetGraph` → `syncInitialNodes`
(reset after the event storm, rebuild from authoritative new state). The latent
"initGame emits against stale state during construction" fragility is noted in
`notes.md` for a future cleanup (out of scope here; no other known symptom).

**Verification — automated:**
- [x] `make lint` + `make test` still pass (719 tests; refactor + ordering fix, no core-logic change)

**Verification — manual (browser via Playwright):**
- [x] Reproduce-before: start a run, probe to reveal `router-1`, run-again → board still showed `router-1` while core state had reset (bug confirmed).
- [x] After fix: run-again → board resets to `[gateway, wan]` (matches state exactly, `router-1` gone); re-probing the restarted run reveals `router-1` again — new run fully playable; no console errors.

---

## Phase 3b: The hub (UI + target list + console parity + end-screen wiring)

The user-facing slice: a textual hub modal to manage bank/inventory/loadout and
launch a target (via `startRun` from Phase 3a), symmetric console commands, and the
end-screen returning to the hub instead of an instant re-run.

**Files:**
- Create: `js/core/profile/targets.js` — deterministic target-list generation.
- Create: `js/ui/components/starnet-hub.js` — Lit modal (mirror `starnet-store.js`).
- Create: `js/ui/hub.js` — controller: open/close, wire component events to `launchRun`.
- Create: `js/ui/hub-commands.js` — console commands (registered from UI; profile is a browser concern).
- Modify: `js/ui/main.js` — open the hub on load and after `RUN_ENDED`; replace the `run-again` handler with a return-to-hub flow.
- Modify: `index.html` — add the `<starnet-hub>` element next to `<starnet-store>`.
- Modify: `js/ui/console.js` — import `./hub-commands.js` so its `registerCommand` calls run.
- Test: `js/core/profile/targets.test.js`

**Key changes:**

`js/core/profile/targets.js` — 3 targets at varying grades, deterministic per visit:
```javascript
// @ts-check
const TIERS = [
  { id: "soft",   label: "Soft target",   spec: { threat: "F", wealth: "D", complexity: "F", depth: "F" } },
  { id: "median", label: "Standard job",  spec: { threat: "C", wealth: "B", complexity: "C", depth: "C" } },
  { id: "hard",   label: "Hard mark",     spec: { threat: "A", wealth: "S", complexity: "B", depth: "B" } },
];

/**
 * Build the hub's target list. Seeds are derived from the profile's hub-visit
 * counter so the list is deterministic for a given profile state.
 * @param {import('../types.js').StarnetProfile} profile
 * @returns {{ id: string, label: string, seed: string, spec: object }[]}
 */
export function generateTargets(profile) {
  const visit = profile._hubVisits;
  return TIERS.map((t) => ({ ...t, seed: `target-${visit}-${t.id}` }));
}
```

`js/ui/components/starnet-hub.js` — Lit, light-DOM, mirrors `starnet-store.js`:
```javascript
import { html, nothing } from "/dist/lit.js";
import { StarnetElement } from "./starnet-element.js";

class StarnetHub extends StarnetElement {
  static properties = {
    open: { type: Boolean },
    bank: { type: Number },
    inventory: { type: Array },
    loadout: { type: Array },      // selected instanceIds
    withdrawAmount: { type: Number },
    targets: { type: Array },
  };
  constructor() {
    super();
    this.open = false; this.bank = 0; this.inventory = []; this.loadout = [];
    this.withdrawAmount = 0; this.targets = [];
  }
  updated(c) { if (c.has("open")) this.style.display = this.open ? "" : "none"; }
  connectedCallback() { super.connectedCallback(); this.style.display = this.open ? "" : "none"; }

  _toggleCard(id) {
    const next = this.loadout.includes(id)
      ? this.loadout.filter((x) => x !== id)
      : (this.loadout.length < 5 ? [...this.loadout, id] : this.loadout);
    this.dispatchEvent(new CustomEvent("loadout-change", { bubbles: true, detail: { loadout: next } }));
  }
  _launch(target) {
    this.dispatchEvent(new CustomEvent("launch", { bubbles: true,
      detail: { targetId: target.id, loadout: this.loadout, withdrawAmount: this.withdrawAmount } }));
  }
  render() {
    if (!this.open) return nothing;
    return html`
      <div class="hub-box">
        <h2>OVERWORLD HUB</h2>
        <div>Bank: ¥${this.bank.toLocaleString()}</div>
        <h3>Inventory (loadout ${this.loadout.length}/5)</h3>
        ${this.inventory.map((c) => html`
          <div class="hub-card ${this.loadout.includes(c.instanceId) ? "equipped" : ""}"
               @click=${() => this._toggleCard(c.instanceId)}>
            ${c.name} [${c.rarity}] ${c.decayState} ×${c.usesRemaining}
          </div>`)}
        <h3>Carry cash</h3>
        <input type="number" .value=${String(this.withdrawAmount)} min="0" max=${this.bank}
          @input=${(e) => this.dispatchEvent(new CustomEvent("withdraw-change",
            { bubbles: true, detail: { amount: Number(e.target.value) } }))} />
        <h3>Targets</h3>
        ${this.targets.map((t) => html`
          <div class="hub-target" @click=${() => this._launch(t)}>${t.label} — ${t.spec.threat}/${t.spec.wealth}</div>`)}
      </div>`;
  }
}
customElements.define("starnet-hub", StarnetHub);
```

`js/ui/hub.js` — controller binds component ↔ profile-store:
```javascript
// @ts-check
import { loadProfile, saveProfile, launchRun } from "./profile-store.js";
import { generateTargets } from "../core/profile/index.js"; // re-exported from targets.js via index
import { buildGenerated } from "../core/network/...";        // same builder getSelectedNetwork() uses

export function openHub() {
  const el = /** @type {any} */ (document.getElementById("overworld-hub"));
  const profile = loadProfile();
  profile._hubVisits++; saveProfile(profile);
  el.bank = profile.bank; el.inventory = profile.inventory; el.loadout = [];
  el.withdrawAmount = 0; el.targets = generateTargets(profile); el.open = true;

  el.addEventListener("loadout-change", (e) => { el.loadout = e.detail.loadout; });
  el.addEventListener("withdraw-change", (e) => { el.withdrawAmount = e.detail.amount; });
  el.addEventListener("launch", (e) => {
    const target = el.targets.find((t) => t.id === e.detail.targetId);
    el.open = false;
    launchRun({
      buildNetworkResult: () => buildGenerated({ seed: target.seed, spec: target.spec }),
      loadoutInstanceIds: e.detail.loadout,
      withdrawAmount: e.detail.withdrawAmount,
      opts: { openDarknetsStore },   // imported as today
    });
  }, { once: true });
}
```

`js/ui/hub-commands.js` — console parity (registered from UI):
```javascript
// @ts-check
import { registerCommand } from "../core/console-commands/index.js";
import { addLogEntry } from "./log-util.js"; // same logger the store command uses
import { loadProfile } from "./profile-store.js";
import { openHub } from "./hub.js";

registerCommand({ verb: "hub", execute() { openHub(); addLogEntry("[HUB] Overworld hub opened.", "meta"); } });
registerCommand({ verb: "inventory", execute() {
  const p = loadProfile();
  addLogEntry(`Bank: ¥${p.bank.toLocaleString()}`, "meta");
  p.inventory.forEach((c, i) => addLogEntry(`  [${i + 1}] ${c.name} [${c.rarity}] ${c.decayState} ×${c.usesRemaining} (${c.instanceId})`, "meta"));
} });
// `equip <instanceId>`, `unequip <instanceId>`, `carry <amount>`, `targets`, `launch <targetId>`
// follow the same shape, reading/mutating an in-progress hub selection held in hub.js.
```

`js/ui/main.js` — open hub on boot and after a run; retire instant run-again:
```javascript
// boot: instead of initGame() directly, open the hub
init();           // keep graph/console/renderer init
openHub();        // player launches the first run from the hub

// replace runAgainHandler:
const returnToHubHandler = () => { openHub(); };
on("starnet:action:run-again", returnToHubHandler);
document.getElementById("end-screen")?.addEventListener("run-again", returnToHubHandler);
```
(The `RUN_ENDED` subscriber in `profile-store.js` commits before the end-screen's button fires; opening the hub reloads the freshly-committed profile.)

**Verification — automated:**
- [x] `make test` passes (new `js/core/profile/targets.test.js`: `generateTargets` returns 3 targets with distinct seeds that change when `_hubVisits` changes; specs match the tier table) — 722 tests total
- [x] `make lint` passes

**Verification — manual (browser via Playwright):**
- [x] Boot → the hub opens showing bank ¥1000, 6 starter cards, and 3 targets; no console errors (after fixing a boot-order bug: the profile bootstrap needed the RNG initialized — added `initRng()` at app startup).
- [x] Equip a loadout (console `equip`/GUI click — verified both produce the same result), set carry ¥200, launch "soft" → a run starts with the hand = exactly the equipped loadout (`[inv-0, inv-1]`) and wallet = ¥200, on the target's generated topology; hub closes.
- [x] Jack out → end-screen → "RETURN TO HUB" reopens the hub with the committed bank and re-rolled targets; selection reset.
- [~] Capture path: the carried-loadout burn on "caught" is covered by the `commitRun` unit test (forcing a trace in-browser is impractical to script quickly).
- [x] Console parity: `hub`, `inventory`, `equip`, `carry`, `launch` route through the same `hub.js` operations as the GUI — a clicked card and `equip <n>` produce identical state + log.

---

## Phase 4: Manual update + regression sweep

Bring `MANUAL.md` current and confirm nothing regressed — especially the headless
entry points, since `initGame` changed.

**Files:**
- Modify: `MANUAL.md` — document the overworld hub, persistent bank + inventory, loadout selection, Medium capture stakes, and the new console commands.
- Modify: `docs/dev-sessions/2026-06-10-1516-overworld-meta-state/notes.md` — session retro notes.

This phase is a TDD opt-out (docs + verification only — no behavior change).

**Verification — automated:**
- [x] `make check` passes (lint + test, 722 tests)
- [x] Bot census smoke unaffected by the `initGame` change: `node scripts/bot/census.js --seeds 10 --threat F --wealth F --complexity F --depth F` ran all 10 seeds cleanly (avg cash ¥11.7k, all-green alerts, no crashes). _(Note: census is `scripts/bot/census.js` with `--threat/--wealth/--complexity/--depth`, not the CLAUDE.md `--time/--money` flags — CLAUDE.md is stale here too.)_
- [x] `node scripts/playtest.js reset && … "status hand"` still deals a generated hand (headless path uses `meta.startHand`, unchanged by `startHandCards`).

**Verification — manual:**
- [x] `MANUAL.md` updated: new "THE OVERWORLD HUB" section (persistent bank/inventory, loadout, carry-cash, Medium stakes) + the hub console commands in the reference.
- [x] Re-read the spec's "What we're NOT doing": scope held — no standings, storylets, installations, navigation map, economy depth, headless-profile, or multiple profiles crept in. (`run-control.js` extraction and boot→hub were necessary integration + the Phase 3a bug fix, not deferred subsystems.)

---

## Plan self-review

- **Spec coverage:** persistent profile (P1) ✓; bank+inventory (P1) ✓; loadout selection (P3 UI, P2 launch) ✓; run read/write contract (P2) ✓; Medium stakes (P2 `commitRun`) ✓; withdraw/deposit bank↔run cash (P2 `launchRun`/`commitRun`) ✓; hub as textual menu (P3) ✓; target list seam (P3) ✓; store/mining feed inventory (P2 `commitRun` new-card rule) ✓; browser-first / headless synthesize loadout (P2 backwards-compat + P4 regression) ✓; instanceId scheme (P1) ✓; new-profile bootstrap (P1) ✓; console parity (P3) ✓; MANUAL update (P4) ✓.
- **Placeholder scan:** the `hub-commands.js` equip/unequip/carry/targets/launch verbs are described by shape, not fully written — they are mechanical mirrors of the two shown commands operating on `hub.js` selection state; flagged here so `execute` writes them out in full rather than stubbing.
- **Type consistency:** `instanceId`, `carriedInstanceIds`, `StarnetProfile` fields (`bank`, `inventory`, `_instanceSeq`, `_hubVisits`), and `commitRun`/`buildRunHand`/`launchRun` signatures are consistent across phases.

**One import to confirm at execute time:** `js/ui/hub.js` needs the same generated-network builder `getSelectedNetwork()` uses (`buildGenerated`) — verify its exact import path in `js/ui/main.js` before wiring (path elided above as `../core/network/...`).

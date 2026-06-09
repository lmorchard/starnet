# Research — preview harness animations (#116) + Lit component gallery (#118)

Worktree: `.claude/worktrees/preview-harness-anim-components`

## Part A — Node-graph overlay animation system (#116)

### Per-effect functions in `js/ui/graph.js`

Pattern: `current*NodeId` / `current*Progress` module vars + `sync*` / `clear*` / `_render*`.

| Effect | Module state | Functions | Render style |
|---|---|---|---|
| Probe sweep | `currentProbeSweepNodeId`, `currentProbeSweepProgress` (37-38) | `syncProbeSweep` (864), `clearProbeSweep` (870), `_renderProbeSweep` (877) | Pure progress-driven. Pie-slice arc from 12 o'clock CW. SVG `probe-sweep-fill`, `probe-sweep-ring`. |
| Mine scan | `currentMineScanNodeId`, `currentMineScanProgress`, `mineScanFx`, `mineScanFy`, `mineScanPhase` (39-44) | `syncMineScan` (920), `clearMineScan` (934), `_renderMineScan` (941) | Pure progress-driven. Lissajous roam, amplitude eases to 0 (lock-on) at p→1. Params reseeded per target (925-928). SVG `mine-scan-h/v/box`. |
| Read sectors | `currentReadSectorsNodeId`, `currentReadSectorsProgress`, `readSectorCount`, `readSectorOrder` (45-48) | `syncReadSectors` (984), `clearReadSectors` (1001), `_renderReadSectors` (1010) | Pure progress-driven, scaled to 0.9 (997). 7-20 sectors, Fisher-Yates fill order. SVG `read-sectors-fill/ring`. |
| Loot rings | `currentLootRingsNodeId`, `currentLootProgress`, `lootRingIntervalId` | `syncLootRings` (1072), `clearLootRings` (1082), `_renderLootRings` (1096) | **RAF loop (1162) + setInterval spawn** (LOOT_RING_SPAWN_MS=200). Rings r=2→maxR over 800ms. Progress damps spawn. SVG container `loot-rings`. |
| Exploit brackets | `currentExploitBracketsNodeId`, `currentExploitBracketsProgress`, `zapIntervalId`, `zapNextCorner`, `zapTicksToFire` (49-50) | `syncExploitBrackets` (1243), `clearExploitBrackets` (1250), `_renderExploitBrackets` (1261), `startExploitZaps` (1179), `stopExploitZaps` (1186), `_tickZaps` (1197) | Progress-driven brackets (convergence + 360° CW) **+ dual interval zap loop** (30ms ticks). SVG 8 bracket lines + 4 zap lines + `zap-bloom` filter. |
| ICE detect | `currentIceDetectNodeId`, `currentIceDetectProgress` (51-52) | `syncIceDetectSweep` (1295), `clearIceDetectSweep` (1301), `completeAndClearIceDetectSweep` (1309), `_renderIceDetectSweep` (1317) | Pure progress-driven. **CCW** arc (adversarial convention). Opacity ramps. Special "snap to full then clear" variant. SVG `ice-detect-arc`. |

**Contract:** `sync*(nodeId, progress)` where progress ∈ [0,1] (clamped). Updates module state, calls `_render*()` to recompute SVG geometry. `clear*()` sets opacity 0, resets state. `_render*()` reads module state, early-exits if nodeId null/not in graph. Read-sectors maps 0→0.9 internally.

**Two kinds of effect:** pure progress-driven (probe, mine, read, ice) vs. self-running loops (loot = RAF+interval, exploit = progress brackets + interval zaps). The base contract must accommodate both.

### Dispatch in `js/ui/visual-renderer.js`

- Single `E.ACTION_FEEDBACK` handler (72-124). Payload `{ nodeId, action, phase, progress }`. phase ∈ start|progress|complete|cancel.
- Per-action tracker vars: `activeProbeNodeId` (66), `activeExploitNodeId` (67), `activeReadNodeId` (68), `activeLootNodeId` (69), `activeMineNodeId` (70).
- Action→effect mapping: `A.PROBE`→probe, `A.XPLOIT`→exploit brackets (+`updateExploitProgress`), `A.DUMP`→read sectors, `A.FETCH`→loot rings, `A.MINE`→mine scan. Action ids in `js/core/actions/action-ids.js:15-19`.
- `RUN_STARTED` reset (131-136): clears all overlays + nulls all tracker vars.
- `ACTION_RESOLVED` (127-129): exploit-only success/failure node flash.
- **ICE detect is NOT in ACTION_FEEDBACK.** Driven by `E.TIMERS_UPDATED` tick (145-158): scans visible timers for label "ICE DETECTION", calls `syncIceDetectSweep("ice-0", progress)`. Cleared on ICE_DETECTED/MOVED/EJECTED/REBOOTED + PLAYER_NAVIGATED (138-143). → ICE is a sibling, different driver.

### onPanZoom re-render (`graph.js:188-206`)

Registered once `cy.on("pan zoom", onPanZoom)` (205). Closure (188-204) unconditionally calls all six `_render*()` + `syncReticle()` (190) + `_repositionIceOverlay()` (203). Re-renders using current module state so overlays stay locked during pan/zoom.

### SVG markup — DUPLICATED

- `index.html:29-90` and `preview.html:148-209` contain **identical** SVG overlay markup. Containers: `probe-sweep`, `ice-detect-sweep`, `mine-scan`, `loot-rings`, `read-sectors`, `exploit-brackets`, `selection-reticle`. Styled `position:absolute; opacity:0; pointer-events:none; z-index:5` (reticle 6).

### preview.js effect driver (`js/ui/preview.js`)

- `EFFECTS` array (132-169): `[{name, nodeId, sync, clear}, ...]` for the six effects — hand-maintained.
- Demo nodes `EFFECT_NODES` (23-31), also `SHAPE_NODES` (39-46), `ALERT_NODES` (49-54).
- Controls per effect (171-201): slider scrubs progress → `effect.sync(nodeId, v)`; play → `animateEffect()`; reset.
- `animateEffect(sliderId, valId, syncFn, nodeId)` (108-125): RAF loop, slider 0→1 over BASE_DURATION=3000ms/speed. `runningAnimations` map for cancel.
- **Progress-scrubbing contract** is what the harness relies on: any registered effect must accept `sync(nodeId, t∈[0,1])`.

## Part B — Lit components + preview harness (#118)

### Base class `js/ui/components/starnet-element.js:1-8`

Light DOM only — `createRenderRoot()` returns `this` (7). Inherits global `css/style.css`. Components: `static properties`, init in ctor, `render()` returns `html`, `customElements.define()` at bottom.

### Components in `js/ui/components/`

`<starnet-hand>`, `exploit-card-view.js` (no tag — `exploitCardBody()` fragment), `<starnet-action-choices>`, `<starnet-context-menu>`, `<starnet-hud>`, `<starnet-end-screen>`, `<starnet-mission-pane>`, `<starnet-node-panel>`, `<starnet-ice-timers>`, `<starnet-level-select>`, `<starnet-log>`, `<starnet-store>`.

### Hand + card (the #118 motivator)

`starnet-hand.js:8-95` reactive props (9-16): `cards: ExploitCard[]`, `selectedNode`, `executingCardId`, `execProgress`, `isSelecting`, `selectedNodeId`.
- Sorted via `exploitSortKey()` (`js/core/exploits.js:183-191`).
- Click → `starnet:action` `{actionId:"xploit", nodeId, exploitId, cardIndex}` (28-33).
- `_renderCard()` (57-91): calls `exploitCardBody()`. CSS classes: `exploit-card`, `rarity-{common|uncommon|rare}` (72), `disclosed` (73), `match`/`no-match` (62-68), `executing` (76).
- Match logic (62-68): needs `selectedNode.probed` + `selectedNode.vulnerabilities` (filter !patched && !hidden → ids); `card.targetVulnTypes.some(t ∈ knownVulnIds)`.

`exploit-card-view.js:12-32` — `exploitCardBody(card, indexLabel?)` → html. Header (name + optional index), quality 5-pip bar (`█░`, `quality*5`), uses row (disclosed → "DISCLOSED"; worn → "N (worn)"; else N), targetVulnTypes list.

`ExploitCard` typedef (`js/core/types.js:49-59`): `{id, name, rarity:"common"|"uncommon"|"rare", quality:0-1, targetVulnTypes:string[], decayState:"fresh"|"worn"|"disclosed", usesRemaining:number}`.

### Card generation (for mock construction)

`js/core/exploits.js`:
- `generateExploit(rarity=null)` (237-251) → fresh ExploitCard. Quality from `QUALITY_RANGES` (common [.2,.55], uncommon [.45,.75], rare [.70,.95]); `USES_BY_RARITY` common 3 / uncommon 5 / rare 8.
- `generateExploitForVuln(vulnId, rarityOverride=null)`.
- `generateStartingHand(spec=DEFAULT_HAND_SPEC)` (291-293), default `["common","common","uncommon","uncommon","uncommon","rare"]`.
- Hand stored at `state.player.hand` (`js/core/state/player.js`); `applyCardDecay(cardId, usesRemaining, decayState)` (40-48) sets wear.
- Generation is **RNG-seeded** (`RNG.EXPLOIT`) — deterministic given seed.

### Loading setup

- `index.html`: importmap (8-13) maps `lit` → `./dist/lit.js`; `dist/vendor.js` (16); 11 component module scripts + `main.js` (119-130).
- `preview.html`: **no importmap**, **no component scripts** — only `dist/vendor.js` + `js/ui/preview.js` (331-332). preview.js imports only from `./graph.js`, NO Lit components.
- `js/lit-vendor.js` → `dist/lit.js`: exports `LitElement, html, css, nothing, repeat, classMap, ifDefined`.

**Consequence for #118:** mounting components in preview.html requires adding the importmap (so `import "lit"` resolves) + importing the component modules. Components feed off plain reactive props, so mock data = plain objects (mock cards via `generateExploit` or hand-built ExploitCard objects), no event bus needed.

## Cross-cutting notes

- Both #116 and #118 reshape `preview.html` + `js/ui/preview.js`.
- #116's registry could drive preview auto-discovery, replacing the hand-maintained `EFFECTS` array.
- ICE detect is the odd effect out (timer-driven, CCW, sibling not ACTION_FEEDBACK) — base contract vs. sibling is an open design question.
- Loot rings + exploit zaps are self-running loops, not pure progress — base contract must allow an effect to own its own RAF/interval lifecycle while still honoring `sync(nodeId, progress)` for the scrub harness.

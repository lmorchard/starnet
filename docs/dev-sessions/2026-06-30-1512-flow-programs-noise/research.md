# Session 1 — codebase research (integration points)

Findings from a documentarian sweep of the worktree, plus direct reads. `file:line`
refs are as of branch `flow-programs-noise` off `origin/main` @ a630db7.

## 1. Flow typedef + `state.flows`

- **`Flow` typedef:** `js/core/types.js:308-319` —
  `{ from, to, type:('money'|'data'|'audit'|'control'|'credential'), rate:number, encrypted?:boolean }`.
  (CLAUDE.md still says `js/types.js`; the real path post-reorg is `js/core/types.js`.)
- **Init from `meta.flows`:** `js/core/state/index.js:166` —
  `flows: (meta.flows ?? []).map((f) => ({ ...f }))` (shallow-clone per flow; in-run
  mutation must not write back into the network def).
- **Heal on load:** `js/core/state/index.js:388-389` — `if (!ctx.state.flows) ctx.state.flows = []`.
  Flows ride `...rest` through `serializeState`.
- **Authored flows (demo):** `data/networks/corporate-exchange.js:120-127`. Already includes
  `{ from:"switch-2", to:"fw-1", type:"credential", rate:0.25, encrypted:true }` (line 126) —
  the firewall already *receives* an encrypted credential flow. Also a money artery
  `switch-1->gateway->wan`, a mixed gateway<->switch-1 edge, audit toward `sec/ids`.

## 2. Node action / script definition + dispatch

- **Action-id catalog:** `js/core/action-ids.js` (`A.PROBE`, `A.XPLOIT`, `A.CORRUPT`,
  `A.SCRUB_LOGS`, `A.LIE_LOW`, ...). New programs add ids here.
- **Script vs core classification:** `js/core/actions/scripts.js:17-19` — `isScriptAction(id)`
  returns `!CORE_NODE_VERBS.has(id)`. Non-core actions get grouped under the synthetic EXEC.
- **EXEC grouping:** `js/core/actions/node-actions.js:46-49` + `buildExecAction(scripts)`.
- **Dispatch path:** DOM `starnet:action {actionId, nodeId?, ...payload}` -> `js/ui/main.js:106-107`
  -> `js/core/actions/action-context.js:61-91` ->
  `getAvailableActions(node,state).find(a=>a.id===actionId).execute(node,state,ctx,{nodeId,...payload})`.
  Single `STATE_CHANGED` per cycle, version-gated.
- **ActionContext (ctx) surface:** `js/core/types.js:243-251` — `getState, selectNode,
  deselectNode, ejectIce, jackOut, cancelTrace, openDarknetsStore`. The node-graph ctx
  (`js/core/node-graph/game-ctx.js:64-65`) wires methods like `reconfigureNode`, `lieLow`,
  `scrubLogs`, `startExploit`, `abortTimedAction` — `effects:[{effect:"ctx-call",method,args}]`
  is how an ActionDef invokes them.

### Example — an `exec` script action end-to-end (SCRUB_LOGS / LIE_LOW)
- **ActionDef:** `action-templates.js:258-285` (`SCRUB_LOGS_ACTION`, `LIE_LOW_ACTION`).
  `requires` = `Condition[]` (e.g. accessLevel open|owned); `effects` set attrs and/or
  `ctx-call`. LIE_LOW is timed: it sets `lyingLow:true` + the progress attr.
- **Operator (timed):** `action-templates.js:298-305` `LIE_LOW_OPERATOR` —
  `{ name:"timed-action", action:"lie-low", activeAttr:"lyingLow", durationTable:{...ticks},
  onComplete:[{effect:"ctx-call",method:"lieLow",args:["$nodeId"]}] }`.
- **Trait pairing:** the operator + action live on a trait (`darknet`/`security`) in
  `js/core/node-graph/traits.js`; factories select traits.
- **Template registry:** `action-templates.js:309-324` `ACTION_TEMPLATES` — new templates register here.

## 3. Trait system + attribute gating + timed actions

- **Registry:** `js/core/node-graph/traits.js:38-51` — `registerTrait`, `getTrait`,
  `resolveTraits(nodeDef)` (merge attributes/operators/actions left->right).
- **Availability gating:** each ActionDef has `requires: Condition[]`; `getAvailableActions(nodeId)`
  filters via `requiresPass` (`js/core/node-graph/actions.js:45-46`). Conditions: `node-attr`
  (`attr`,`eq`), `not`, `any-of`. `enabledAttr` pattern names an attr that turns an
  operator/trigger on/off.
- **NOT_BUSY:** `action-templates.js:38-41` — spread into every startable action; requires
  all timed-action flags + `rebooting` be falsy (one timed action per node).
- **Timed-action attr naming:** `js/core/node-graph/timed-actions.js:46-53` — standard
  `_ta_<action>_progress` / `_ta_<action>_duration`; active flags are explicit
  (`probing`,`exploiting`,`reading`,`looting`,`mining`,`lyingLow`,`rebooting`). New timed
  actions register in the TIMED_ACTIONS registry, not ad hoc.

## 4. XPLOIT followup picker (pattern for the flow picker)

- **Followup field:** `action-templates.js:101-105` (`EXPLOIT_ACTION.followup`) —
  `{ title:(node)=>..., choices:getExploitChoices, empty:getExploitEmptyReason }`.
- **Choices source:** `getExploitChoices`/`getExploitEmptyReason` from `js/core/exploits.js`.
- **UI:** `js/ui/components/starnet-context-menu.js:52-66` — an action with `hasFollowup`
  dispatches `starnet:open-choices` instead of `starnet:action`; picking a choice re-dispatches
  `starnet:action` with the choice payload (e.g. `{exploitId}`), routed by the dispatcher.
  Hand/console supply the payload directly and skip the picker.

## 5. HUD alert/trace display

- **`starnet-hud.js:76-127`** — alert lamp `#alert-dot` = `alertLampDataUri(this.alert)`
  (lines 88-92); alert level text `#alert-level`; trace countdown `#trace-countdown`
  `TRACE: ${traceSeconds}s` shown only when `traceSeconds!==null && phase==="playing"`
  (lines 97-99). Props fed by `visual-renderer.js`. A numeric NOISE readout sits in this
  header region beside the alert.

## 6. balance.js thresholds

`js/core/balance.js:62-71`:
    export const DETECTION_TRACE_THRESHOLD = { S:1, A:1, B:2, C:2, D:3, F:3 };
    export const MONITOR_TRACE_THRESHOLD  = { S:4, A:5, B:7, C:9, D:12, F:15 };
    export const TRACE_SECONDS            = { S:30, A:40, B:45, C:60, D:75, F:90 };
New program-noise thresholds live here too.

## 7. playtest.js + bot

- **playtest dispatch:** `scripts/playtest.js` — inline command parsing (~lines 110-300),
  monolithic switch; new commands are added inline (no external registry). Shares
  `buildActionContext` + `initActionDispatcher` with `main.js`.
- **bot strategies:** `scripts/bot/run.js:20-30` registers `DEFAULT_STRATEGIES`
  (explore/loot/security/traps/evasion/cards/mine/puzzle). Heuristics read state directly
  (`node.type`, `accessLevel`, `world.availableActions.get(nodeId)`) and emit scored
  `{action, nodeId, score, reason, strategy}` — e.g. `scripts/bot/heuristics/security.js:19-96`.
  No hardcoded KNOWN_ACTIONS set found; the bot ignores actions no strategy proposes.

## 8. Player state shape

- **Typedef:** `js/core/types.js:145-152` — `PlayerState { cash, hand, health, deckIntegrity }`.
- **Init:** `js/core/state/index.js:168-178`.
- **Mutations:** `js/core/state/player.js` — `addCash`, `addCardToHand`, `damagePlayerHealth`, ...
  all via `mutate()`. New serializable field: add to typedef, init in `initGame`, add a
  `mutate()`-wrapped setter, re-export through `js/core/state.js`. Deserialize reconstructs
  from JSON; add a heal line if older saves must round-trip.

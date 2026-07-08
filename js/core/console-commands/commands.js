// @ts-check
// All core CommandDef objects. Imported by index.js for registration.

import { getState } from "../state.js";
import { addLogEntry, getRecentLog } from "../log.js";
import { getPackCatalog } from "../packs.js";
import { getAvailableActions, getScriptActions } from "../actions/node-actions.js";
import { buyFromStore } from "../store-logic.js";
import {
  fromList, fromNodes, completeNodeArg, getObscuredAliases,
} from "./completions.js";
import {
  resolveNode, resolveImplicitNode, dispatch, resolveWanAccess,
} from "./resolvers.js";
import { isObscured } from "../state/node.js";
import { visibleIncidentFlows, flowId } from "../programs.js";
import { A } from "../action-ids.js";
import {
  cmdStatusSummary, cmdStatusFull, cmdStatusIce, cmdStatusHand,
  cmdStatusNode, cmdStatusAlert, cmdStatusMission,
} from "./cmd-status.js";

// ── Shared constants for completion ──────────────────────────────────────────

const STATUS_NOUNS     = ["summary", "ice", "hoard", "hand", "node", "alert", "mission"];
const SWEEP_DEPTHS     = ["1", "2", "3", "max"];
const CHEAT_SUBS       = ["give", "alert", "hurt", "heal", "own", "own-all", "trace", "summon-ice", "teleport-ice", "ice-state", "snapshot", "relayout", "restore", "fps", "help"];
const CHEAT_GIVE_SUBS  = ["matching", "card", "cash"];
const CHEAT_ALERT_VERBS = ["set", "raise", "lower"];
const CHEAT_POOLS      = ["health", "deck"];
const CHEAT_RARITIES   = ["common", "uncommon", "rare"];
const CHEAT_ALERTS     = ["green", "yellow", "red", "trace"];
const CHEAT_TRACE_SUBS = ["start", "end"];

// ── Flow-program command helpers ──────────────────────────────────────────────

/** One-line description of a flow relative to a node (for the `sniff` listing). */
function flowDesc(f, nodeId) {
  const other = f.from === nodeId ? f.to : f.from;
  const dir = f.from === nodeId ? "→" : "←";
  const conceal = f.encrypted && !f.revealed ? " [encrypted]" : "";
  const type = f.encrypted && !f.revealed ? "?????" : f.type;
  return `${type} ${dir} ${other}${conceal}`;
}

/** Resolve a flow reference (1-based index, type name, or full flow id) against a node's flows. */
function resolveFlow(flows, ref) {
  const n = Number(ref);
  if (Number.isInteger(n) && n >= 1 && n <= flows.length) return flows[n - 1];
  const lc = String(ref).toLowerCase();
  return flows.find((f) => f.type === lc) || flows.find((f) => flowId(f).toLowerCase() === lc) || null;
}

// ── Command definitions ───────────────────────────────────────────────────────

/** @type {import('./registry.js').CommandDef[]} */
export const COMMANDS = [

  // ── Node-arg commands ──────────────────────────────────────────────────────

  { verb: "target",
    complete: completeNodeArg,
    execute(args) {
      if (args.length < 1) { addLogEntry("Usage: target <node>", "error"); return; }
      const node = resolveNode(args[0]);
      if (!node) return;
      dispatch(A.TARGET, { nodeId: node.id });
    },
  },

  { verb: "untarget",
    execute() { dispatch(A.UNTARGET); },
  },

  // Core node verbs (probe, dump, fetch, mine, kick, reboot, abort) are
  // dynamically discovered from graph available actions. Non-core node actions
  // (corrupt, cancel-trace, access-darknet, etc.) are scripts grouped under the
  // static `exec` command, not registered as top-level verbs. See dynamic-actions.js.

  // ── exploit ────────────────────────────────────────────────────────────────
  // Phase 3 (E1 combat rework): xploit is now arg-less — launches auto-burn
  // from player.hoard. No card selection needed.

  { verb: "xploit",
    complete() { return null; },
    execute(args) {
      if (args.length > 0) { addLogEntry("xploit takes no arguments — it acts on the targeted node.", "error"); return; }
      const node = resolveImplicitNode();
      if (!node) return;
      dispatch(A.XPLOIT, { nodeId: node.id });
    },
  },

  // kick — dynamically discovered from graph available actions

  // ── flow programs (SNIFF / REPLAY) ───────────────────────────────────────────
  // Not dynamically discovered: they're actions-layer injections, not graph actions,
  // and SNIFF takes a flow argument (like xploit takes a card).
  { verb: "sniff",
    complete() { return null; },                          // no node candidates; flows aren't node-completed
    execute(args) {
      const s = getState();
      const node = resolveImplicitNode();
      if (!node) return;
      const ref = args.length >= 1 ? args.join(" ") : null;
      const flows = visibleIncidentFlows(s, node.id);
      if (flows.length === 0) { addLogEntry(`no flows on ${node.id}.`, "meta"); return; }
      if (!ref) {
        addLogEntry(`flows on ${node.id}:`, "meta");
        flows.forEach((f, i) => addLogEntry(`  ${i + 1}. ${flowDesc(f, node.id)}`, "meta"));
        return;
      }
      const flow = resolveFlow(flows, ref);
      if (!flow) { addLogEntry(`sniff: no flow "${ref}" on ${node.id}.`, "error"); return; }
      dispatch(A.SNIFF, { nodeId: node.id, flowId: flowId(flow) });
    },
  },

  { verb: "replay",
    execute(args) {
      if (args.length) { addLogEntry("replay takes no arguments — it acts on the targeted node.", "error"); return; }
      const node = resolveImplicitNode();
      if (!node) return;
      dispatch(A.REPLAY, { nodeId: node.id });
    },
  },

  { verb: "sweep",
    // SWEEP always acts on the currently TARGETED node (GUI/console symmetry: it's the node
    // inspector's SWEEP). Only the depth is an argument.
    complete(args, partial) {
      if (args.length === 0) return fromList(SWEEP_DEPTHS, partial);
      return null;
    },
    execute(args) {
      const node = resolveImplicitNode(); // targeted node (logs its own error if none)
      if (!node) return;
      dispatch(A.SWEEP, { nodeId: node.id, depth: args[0] || "max" });
    },
  },

  // ── exec — run a node script (grouped non-core node actions) ─────────────────
  { verb: "exec",
    complete(args, partial, state) {
      if (args.length > 0) return null;
      const sel = state.selectedNodeId ? state.nodes[state.selectedNodeId] : null;
      if (!sel) return null;
      return fromList(getScriptActions(sel, state).map((a) => a.id), partial);
    },
    execute(args) {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      if (!sel) { addLogEntry("exec: no node selected.", "error"); return; }
      const scripts = getScriptActions(sel, s);
      if (args.length === 0) {
        if (scripts.length === 0) { addLogEntry(`no scripts on ${sel.id}.`, "meta"); return; }
        addLogEntry(`scripts on ${sel.id}: ${scripts.map((a) => a.id).join("  ")}`, "meta");
        return;
      }
      const id = args[0].toLowerCase();
      if (!scripts.some((a) => a.id === id)) {
        addLogEntry(`exec: no script "${id}" on ${sel.id}.`, "error");
        return;
      }
      dispatch(id, { nodeId: sel.id });
    },
  },

  // ── jackout ────────────────────────────────────────────────────────────────

  { verb: "jackout",
    execute() { dispatch(A.JACKOUT); },
  },

  // ── actions ────────────────────────────────────────────────────────────────

  { verb: "actions",
    execute() {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      const actions = getAvailableActions(sel, s);
      const has = new Set(actions.map((a) => a.id));
      const lines = ["AVAILABLE ACTIONS", "─────────────────"];

      if (has.has(A.JACKOUT)) {
        lines.push("  jackout                  — disconnect and end run");
      }

      if (has.has(A.TARGET)) {
        // Known (identified) accessible nodes list by id; obscured nodes (revealed or
        // accessible-but-unprobed) list by their sig-N alias — real ids stay hidden.
        const known = Object.values(s.nodes)
          .filter((n) => n.visibility === "accessible" && !isObscured(n) && !n.rebooting && n.id !== s.selectedNodeId);
        const obscured = Object.values(s.nodes)
          .filter((n) => isObscured(n) && n.id !== s.selectedNodeId);
        const aliases = getObscuredAliases(s.nodes);
        const parts = [];
        if (known.length > 0) parts.push(`accessible: ${known.map((n) => n.id).join(", ")}`);
        if (obscured.length > 0) parts.push(`traverse: ${obscured.map((n) => aliases.get(n.id) ?? n.id).join(", ")}`);
        lines.push(`  target <node|sig-N>      — ${parts.join("  |  ")}`);
      }

      if (sel) {
        if (has.has(A.UNTARGET)) lines.push("  untarget                 — clear selection");

        if (has.has(A.ABORT)) {
          lines.push(`  abort                    — cancel current action`);
        }
        if (has.has(A.PROBE)) {
          lines.push(`  probe                    — scan ${sel.id} for vulnerabilities`);
        }

        if (has.has(A.XPLOIT)) {
          // Phase 3 (E1): xploit is now arg-less — auto-burn draws from hoard.
          const hoardCount = s.player.hoard?.length ?? 0;
          lines.push(`  xploit                   — burn coherence on ${sel.id} (${sel.accessLevel}) [${hoardCount} rounds in hoard]`);
        }

        if (has.has(A.DUMP)) {
          lines.push(`  dump                     — scan ${sel.id} contents`);
        }
        if (has.has(A.FETCH)) {
          lines.push(`  fetch                    — extract items from ${sel.id}`);
        }
        if (has.has(A.KICK))   lines.push(`  kick                     — push ICE to adjacent node`);
        if (has.has(A.REBOOT)) lines.push(`  reboot                   — send ICE home, take ${sel.id} offline briefly`);

        // Non-core node actions are grouped under `exec` (see scripts.js).
        const scripts = getScriptActions(sel, s);
        if (scripts.length > 0) {
          lines.push(`  exec <script>            — run a script on ${sel.id}:`);
          scripts.forEach((a) => {
            const desc = typeof a.desc === "function" ? a.desc(sel, s) : (a.desc || a.label);
            lines.push(`    ${a.id.padEnd(22)} — ${desc}`);
          });
        }

        if (sel.type === "wan") {
          lines.push(`  darknet                  — list darknet broker pack catalog`);
          lines.push(`  buy <index>              — purchase research pack from broker`);
        }

        if (sel.probed) {
          lines.push(`  cheat give matching      — add matching rounds to hoard [balance rescue — sets cheat flag]`);
        }
      }

      const traceActive = s.traceSecondsRemaining !== null;
      lines.push(traceActive
        ? `  cheat trace end          — cancel active trace countdown [${s.traceSecondsRemaining}s remaining]`
        : `  cheat trace start        — start 60s trace countdown`
      );

      lines.forEach((line) => addLogEntry(line, "meta"));
    },
  },

  // ── status ─────────────────────────────────────────────────────────────────

  { verb: "status",
    complete(args, partial, state) {
      if (args.length === 0) return fromList(STATUS_NOUNS, partial);
      if (args[0] === "node" && args.length === 1) return fromNodes(state.nodes, partial);
      return null;
    },
    execute(args) {
      const noun = args[0]?.toLowerCase();
      if (!noun) return cmdStatusFull();
      switch (noun) {
        case "full":    return cmdStatusFull();
        case "summary": return cmdStatusSummary();
        case "ice":     return cmdStatusIce();
        case "hoard":   return cmdStatusHand();  // primary noun for the new mechanic
        case "hand":    return cmdStatusHand();  // alias — old muscle memory
        case "node":    return cmdStatusNode(args.slice(1));
        case "alert":   return cmdStatusAlert();
        case "mission": return cmdStatusMission();
        default:
          addLogEntry(`Unknown status noun: ${noun}. Try: full summary ice hoard hand node alert mission`, "error");
      }
    },
  },

  // ── store / buy ────────────────────────────────────────────────────────────

  { verb: "darknet",
    execute() {
      if (!resolveWanAccess()) return;
      const s = getState();
      const catalog = getPackCatalog();
      const lines = ["DARKNET BROKER", "──────────────────────────────────────────", `Wallet: ¥${s.player.cash.toLocaleString()}`];
      catalog.forEach((item, i) => {
        const canAfford = s.player.cash >= item.price ? "" : "  [INSUFFICIENT FUNDS]";
        lines.push(`  [${i + 1}] ${item.name}  [${item.size} rounds]  ¥${item.price}${canAfford}`);
      });
      lines.push("Use: buy <index>  to purchase a pack");
      lines.forEach((l) => addLogEntry(l, "meta"));
    },
  },

  { verb: "buy",
    complete(args, partial) {
      return args.length === 0 ? fromList(getPackCatalog().map((p) => p.id), partial) : null;
    },
    execute(args) {
      if (!resolveWanAccess()) return;
      if (!args[0]) { addLogEntry("Usage: buy <index>", "error"); return; }
      const num = parseInt(args[0], 10);
      const key = !isNaN(num) ? num : args[0];
      const result = buyFromStore(key);
      if (!result) {
        const s = getState();
        const catalog = getPackCatalog();
        const item = !isNaN(num)
          ? catalog[num - 1]
          : catalog.find((c) => c.id.toLowerCase().startsWith(args[0].toLowerCase()));
        if (item && s.player.cash < item.price) {
          addLogEntry(`Insufficient funds. Need ¥${item.price}, have ¥${s.player.cash.toLocaleString()}.`, "error");
        } else {
          addLogEntry(`Unknown pack: ${args[0]}`, "error");
        }
        return;
      }
      addLogEntry(`Purchased: ${result.pack.name}  [${result.rounds.length} rounds]  cost:¥${result.price}`, "success");
    },
  },

  // ── log / help ─────────────────────────────────────────────────────────────

  { verb: "log",
    execute(args) {
      const n = Math.min(Math.max(parseInt(args[0], 10) || 20, 1), 200);
      const entries = getRecentLog(n);
      addLogEntry(`-- LOG REPLAY (last ${entries.length}) --`, "meta");
      entries.forEach(({ text, type }) => addLogEntry(text, type));
    },
  },

  { verb: "help",
    execute() {
      const lines = [
        "[SYS] Available commands:",
        "  target <node>             Set active node (by id or label prefix)",
        "  untarget                  Clear node selection",
        "  probe                     Reveal vulnerabilities. Raises local alert.",
        "  xploit                    Launch coherence burn on targeted node (auto-burn from hoard).",
        "  dump                      Scan node contents.",
        "  fetch                     Collect macguffins from owned node.",
        "  exec [<script>]           Run a node script (corrupt, cancel-trace, unlock-vault, …). No arg lists scripts.",
        "  abort                     Cancel the current timed action on the targeted node.",
        "  kick                      Push ICE attention to adjacent node.",
        "  reboot                    Send ICE home. Node offline briefly.",
        "  jackout                   Disconnect and end run.",
        "  actions                   List all currently valid actions with context.",
        "  status [noun]             Game state. Nouns: summary ice hoard hand node alert mission",
        "  darknet                   List darknet broker pack catalog (requires WAN selected).",
        "  buy <index>               Purchase research pack from broker (requires WAN selected).",
        "  log [n]                   Replay last n log entries (default: 20).",
        "  help                      Show this listing.",
        "  // CHEAT — playtesting only. Cheaters never win.",
        "  cheat give matching [node]  Add rounds matching node's vulns to the hoard (balance rescue).",
        "  cheat give card [rarity]    Add a round to the hoard.",
        "  cheat give cash <amount>    Add credits to wallet.",
        "  cheat alert set <level>     Force alert level: green yellow red trace",
        "  cheat alert raise|lower     Step the global alert up/down one level",
        "  cheat hurt <pool> <amount>  Damage health|deck (ends run if depleted).",
        "  cheat heal <pool> [amount]  Restore health|deck by amount, or to full.",
        "  cheat own <node>            Set node to owned + reveal neighbors.",
        "  cheat trace start           Start 60s trace countdown immediately.",
        "  cheat trace end             Cancel active trace countdown.",
      ];
      lines.forEach((line) => addLogEntry(line, "meta"));
    },
  },

  // ── cheat (headless) ───────────────────────────────────────────────────────
  // Handles all sub-commands that don't require browser APIs.
  // console.js overrides this entry to add relayout and restore, then delegates
  // here for everything else.

  { verb: "cheat",
    complete(args, partial, state) {
      if (args.length === 0) return fromList(CHEAT_SUBS, partial);

      const [sub, ...subArgs] = args;

      if (sub === "give") {
        if (subArgs.length === 0) return fromList(CHEAT_GIVE_SUBS, partial);
        if (subArgs[0] === "matching" && subArgs.length === 1) return fromNodes(state.nodes, partial);
        if (subArgs[0] === "card"     && subArgs.length === 1) return fromList(CHEAT_RARITIES, partial);
        return null;
      }

      if (sub === "alert") {
        if (subArgs.length === 0) return fromList(CHEAT_ALERT_VERBS, partial);
        if (subArgs[0] === "set" && subArgs.length === 1) return fromList(CHEAT_ALERTS, partial);
        return null;
      }

      if ((sub === "hurt" || sub === "heal") && subArgs.length === 0) return fromList(CHEAT_POOLS, partial);
      if (sub === "own"         && subArgs.length === 0) return fromNodes(state.nodes, partial, { includeAll: true });
      if (sub === "trace"       && subArgs.length === 0) return fromList(CHEAT_TRACE_SUBS, partial);
      if ((sub === "summon-ice" || sub === "teleport-ice") && subArgs.length === 0) {
        return fromNodes(state.nodes, partial, { includeAll: true });
      }

      return null;
    },
    execute(args) {
      // relayout and restore are browser-only — handled by the override in console.js.
      // If somehow reached in a headless context they fall through to cheats.js which
      // will log "Unknown cheat: ..." — acceptable.
      import("../cheats.js").then(({ handleCheatCommand }) => {
        const sub = args[0]?.toLowerCase();
        if (sub === "snapshot") {
          // snapshot requires a saveGame callback; not available in headless
          handleCheatCommand(args, { saveGame: null });
        } else {
          handleCheatCommand(args);
        }
      });
    },
  },

];

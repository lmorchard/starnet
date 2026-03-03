// @ts-check
// All core CommandDef objects. Imported by index.js for registration.

import { getState } from "../state.js";
import { addLogEntry, getRecentLog } from "../log.js";
import { exploitSortKey, getStoreCatalog } from "../exploits.js";
import { getActions } from "../actions/node-types.js";
import { getAvailableActions } from "../actions/node-actions.js";
import { buyFromStore } from "../store-logic.js";
import {
  fromList, fromNodes, fromCards, fromVulnIds, completeNodeArg, getRevealedAliases,
} from "./completions.js";
import {
  resolveNode, resolveImplicitNode, resolveCard, dispatch, resolveWanAccess,
} from "./resolvers.js";
import {
  cmdStatusSummary, cmdStatusFull, cmdStatusIce, cmdStatusHand,
  cmdStatusNode, cmdStatusAlert, cmdStatusMission,
} from "./cmd-status.js";

// ── Shared constants for completion ──────────────────────────────────────────

const STATUS_NOUNS     = ["summary", "ice", "hand", "node", "alert", "mission"];
const CHEAT_SUBS       = ["give", "set", "own", "own-all", "trace", "summon-ice", "teleport-ice", "ice-state", "snapshot", "relayout", "restore", "help"];
const CHEAT_GIVE_SUBS  = ["matching", "card", "cash"];
const CHEAT_RARITIES   = ["common", "uncommon", "rare"];
const CHEAT_ALERTS     = ["green", "yellow", "red", "trace"];
const CHEAT_TRACE_SUBS = ["start", "end"];

// ── Command definitions ───────────────────────────────────────────────────────

/** @type {import('./registry.js').CommandDef[]} */
export const COMMANDS = [

  // ── Node-arg commands ──────────────────────────────────────────────────────

  { verb: "select",
    complete: completeNodeArg,
    execute(args) {
      if (args.length < 1) { addLogEntry("Usage: select <node>", "error"); return; }
      const node = resolveNode(args[0]);
      if (!node) return;
      dispatch("select", { nodeId: node.id });
    },
  },

  { verb: "deselect",
    execute() { dispatch("deselect"); },
  },

  { verb: "probe",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("probe", { nodeId: node.id });
    },
  },

  { verb: "read",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("read", { nodeId: node.id });
    },
  },

  { verb: "loot",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("loot", { nodeId: node.id });
    },
  },

  { verb: "reconfigure",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("reconfigure", { nodeId: node.id });
    },
  },

  { verb: "reboot",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      if (node.accessLevel !== "owned") {
        addLogEntry(`${node.label}: must be owned to reboot.`, "error");
        return;
      }
      dispatch("reboot", { nodeId: node.id });
    },
  },

  { verb: "pkill",
    complete: completeNodeArg,
    execute(args) {
      const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
      if (!node) return;
      dispatch("pkill", { nodeId: node.id });
    },
  },

  // ── Cancel commands ────────────────────────────────────────────────────────

  { verb: "cancel-probe",
    execute() {
      if (!getState().activeProbe) { addLogEntry("No probe scan in progress.", "error"); return; }
      dispatch("cancel-probe");
    },
  },

  { verb: "cancel-exploit",
    execute() {
      if (!getState().executingExploit) { addLogEntry("No exploit execution in progress.", "error"); return; }
      dispatch("cancel-exploit");
    },
  },

  { verb: "cancel-read",
    execute() {
      if (!getState().activeRead) { addLogEntry("No read scan in progress.", "error"); return; }
      dispatch("cancel-read");
    },
  },

  { verb: "cancel-loot",
    execute() {
      if (!getState().activeLoot) { addLogEntry("No loot extraction in progress.", "error"); return; }
      dispatch("cancel-loot");
    },
  },

  { verb: "cancel-trace",
    execute() {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      if (!sel) { addLogEntry("No node selected.", "error"); return; }
      const available = getActions(sel, s).find((a) => a.id === "cancel-trace");
      if (!available) { addLogEntry(`${sel.label}: cancel-trace not available.`, "error"); return; }
      dispatch("cancel-trace", { nodeId: sel.id });
    },
  },

  // ── exploit ────────────────────────────────────────────────────────────────

  { verb: "exploit",
    complete(args, partial, state) {
      if (args.length === 0 && state.selectedNodeId) return fromCards(state.player.hand, partial);
      if (args.length === 0) return fromNodes(state.nodes, partial);
      if (args.length === 1) return fromCards(state.player.hand, partial);
      return null;
    },
    execute(args) {
      const s = getState();
      if (args.length >= 2) {
        const node = resolveNode(args[0]);
        if (!node) return;
        const card = resolveCard(args.slice(1).join(" "));
        if (!card) return;
        dispatch("exploit", { nodeId: node.id, exploitId: card.id });
      } else if (args.length === 1 && s.selectedNodeId) {
        const node = resolveImplicitNode();
        if (!node) return;
        const card = resolveCard(args[0]);
        if (!card) return;
        dispatch("exploit", { nodeId: node.id, exploitId: card.id });
      } else {
        addLogEntry("Usage: exploit <node> <card>  (or select a node first: exploit <card>)", "error");
      }
    },
  },

  // ── eject ──────────────────────────────────────────────────────────────────

  { verb: "eject",
    execute() {
      const s = getState();
      if (!s.ice?.active || s.ice.attentionNodeId !== s.selectedNodeId) {
        addLogEntry("No ICE present at selected node.", "error");
        return;
      }
      dispatch("eject", { nodeId: s.selectedNodeId });
    },
  },

  // ── jackout ────────────────────────────────────────────────────────────────

  { verb: "jackout",
    execute() { dispatch("jackout"); },
  },

  // ── actions ────────────────────────────────────────────────────────────────

  { verb: "actions",
    execute() {
      const s = getState();
      const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
      const actions = getAvailableActions(sel, s);
      const has = new Set(actions.map((a) => a.id));
      const lines = ["AVAILABLE ACTIONS", "─────────────────"];

      if (has.has("jackout")) {
        lines.push("  jackout                  — disconnect and end run");
      }

      if (has.has("select")) {
        const accessible = Object.values(s.nodes)
          .filter((n) => n.visibility === "accessible" && !n.rebooting && n.id !== s.selectedNodeId);
        const revealed = Object.values(s.nodes)
          .filter((n) => n.visibility === "revealed" && n.id !== s.selectedNodeId);
        const revAliases = getRevealedAliases(s.nodes);
        const parts = [];
        if (accessible.length > 0) parts.push(`accessible: ${accessible.map((n) => n.id).join(", ")}`);
        if (revealed.length > 0) parts.push(`traverse: ${revealed.map((n) => revAliases.get(n.id) ?? n.id).join(", ")}`);
        lines.push(`  select <nodeId>          — ${parts.join("  |  ")}`);
      }

      if (sel) {
        if (has.has("deselect")) lines.push("  deselect                 — clear selection");

        if (has.has("cancel-probe")) {
          lines.push(`  cancel-probe             — abort vulnerability scan`);
        } else if (has.has("probe")) {
          lines.push(`  probe                    — scan ${sel.id} for vulnerabilities`);
        }

        if (has.has("cancel-exploit")) {
          const execCard = s.player.hand.find((c) => c.id === s.executingExploit?.exploitId);
          lines.push(`  cancel-exploit           — abort ${execCard?.name ?? "exploit"} execution`);
        } else if (has.has("exploit")) {
          const sorted = [...s.player.hand].sort(
            (a, b) => exploitSortKey(a, sel) - exploitSortKey(b, sel)
          );
          if (sorted.length > 0) {
            lines.push(`  exploit <n>              — attack ${sel.id} (${sel.accessLevel}):`);
            sorted.forEach((card, i) => {
              const knownVulnIds = sel.probed
                ? sel.vulnerabilities.filter((v) => !v.patched && !v.hidden).map((v) => v.id)
                : [];
              const matches = card.targetVulnTypes.some((t) => knownVulnIds.includes(t));
              const worn = card.usesRemaining <= 0 ? "  [WORN]" : "";
              const disclosed = card.decayState === "disclosed" ? "  [DISCLOSED]" : "";
              const matchStr = sel.probed ? (matches ? "  ✓ match" : "  no match") : "";
              lines.push(`    ${i + 1}. ${card.name} [${card.rarity}]  targets: ${card.targetVulnTypes.join(", ")}${matchStr}${worn}${disclosed}`);
            });
          }
        }

        if (has.has("cancel-read")) {
          lines.push(`  cancel-read              — abort data extraction`);
        } else if (has.has("read")) {
          lines.push(`  read                     — scan ${sel.id} contents`);
        }
        if (has.has("cancel-loot")) {
          lines.push(`  cancel-loot              — abort extraction`);
        } else if (has.has("loot")) {
          lines.push(`  loot                     — extract items from ${sel.id}`);
        }
        if (has.has("eject"))  lines.push(`  eject                    — push ICE to adjacent node`);
        if (has.has("reboot")) lines.push(`  reboot                   — send ICE home, take ${sel.id} offline briefly`);

        getActions(sel, s).forEach((a) => {
          lines.push(`  ${a.id.padEnd(24)} — ${a.desc(sel, s)}`);
        });

        if (sel.type === "wan") {
          lines.push(`  store                    — list darknet broker catalog`);
          lines.push(`  buy <index>              — purchase exploit card from broker`);
        }

        if (sel.probed) {
          lines.push(`  cheat give matching      — add matching exploits [balance rescue — sets cheat flag]`);
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
        case "hand":    return cmdStatusHand();
        case "node":    return cmdStatusNode(args.slice(1));
        case "alert":   return cmdStatusAlert();
        case "mission": return cmdStatusMission();
        default:
          addLogEntry(`Unknown status noun: ${noun}. Try: full summary ice hand node alert mission`, "error");
      }
    },
  },

  // ── store / buy ────────────────────────────────────────────────────────────

  { verb: "store",
    execute() {
      if (!resolveWanAccess()) return;
      const s = getState();
      const catalog = getStoreCatalog();
      const lines = ["DARKNET BROKER", "──────────────────────────────────────────", `Wallet: ¥${s.player.cash.toLocaleString()}`];
      catalog.forEach((item, i) => {
        const canAfford = s.player.cash >= item.price ? "" : "  [INSUFFICIENT FUNDS]";
        lines.push(`  [${i + 1}] ${item.name}  [${item.rarity}]  ${item.vulnId}  ¥${item.price}${canAfford}`);
      });
      lines.push("Use: buy <index>  to purchase");
      lines.forEach((l) => addLogEntry(l, "meta"));
    },
  },

  { verb: "buy",
    complete(args, partial) {
      return args.length === 0 ? fromVulnIds(partial) : null;
    },
    execute(args) {
      if (!resolveWanAccess()) return;
      if (!args[0]) { addLogEntry("Usage: buy <index>", "error"); return; }
      const num = parseInt(args[0], 10);
      const key = !isNaN(num) ? num : args[0];
      const result = buyFromStore(key);
      if (!result) {
        const s = getState();
        const catalog = getStoreCatalog();
        const item = !isNaN(num)
          ? catalog[num - 1]
          : catalog.find((c) => c.vulnId.toLowerCase().startsWith(args[0].toLowerCase()));
        if (item && s.player.cash < item.price) {
          addLogEntry(`Insufficient funds. Need ¥${item.price}, have ¥${s.player.cash.toLocaleString()}.`, "error");
        } else {
          addLogEntry(`Unknown item: ${args[0]}`, "error");
        }
        return;
      }
      addLogEntry(`Purchased: ${result.card.name}  [${result.card.rarity}]  targets:${result.vulnId}  cost:¥${result.price}`, "success");
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
        "  select <node>             Set active node (by id or label prefix)",
        "  deselect                  Clear node selection",
        "  probe [node]              Reveal vulnerabilities. Raises local alert.",
        "  exploit [node] <card>     Launch exploit. Card by index, id, or name prefix.",
        "  read [node]               Scan node contents.",
        "  loot [node]               Collect macguffins from owned node.",
        "  reconfigure [node]        Disable IDS event forwarding.",
        "  cancel-probe              Abort an in-progress probe scan.",
        "  cancel-read               Abort an in-progress data extraction.",
        "  cancel-loot               Abort an in-progress loot extraction.",
        "  cancel-exploit            Abort an in-progress exploit execution (no card decay).",
        "  cancel-trace              Abort trace countdown (requires owned security-monitor selected).",
        "  eject                     Push ICE attention to adjacent node.",
        "  reboot [node]             Send ICE home. Node offline briefly.",
        "  pkill [node]              Terminate ICE process (requires owned ice-host).",
        "  jackout                   Disconnect and end run.",
        "  actions                   List all currently valid actions with context.",
        "  status [noun]             Game state. Nouns: summary ice hand node alert mission",
        "  store                     List darknet broker catalog (requires WAN selected).",
        "  buy <index>               Purchase exploit card from broker (requires WAN selected).",
        "  log [n]                   Replay last n log entries (default: 20).",
        "  help                      Show this listing.",
        "  // CHEAT — playtesting only. Cheaters never win.",
        "  cheat give matching [node]  Add exploits matching node's vulns (balance rescue).",
        "  cheat give card [rarity]    Add random exploit card.",
        "  cheat give cash <amount>    Add credits to wallet.",
        "  cheat set alert <level>     Force alert level: green yellow red trace",
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

      if (sub === "set") {
        if (subArgs.length === 0) return fromList(["alert"], partial);
        if (subArgs[0] === "alert" && subArgs.length === 1) return fromList(CHEAT_ALERTS, partial);
        return null;
      }

      if (sub === "own"         && subArgs.length === 0) return fromNodes(state.nodes, partial);
      if (sub === "trace"       && subArgs.length === 0) return fromList(CHEAT_TRACE_SUBS, partial);
      if ((sub === "summon-ice" || sub === "teleport-ice") && subArgs.length === 0) {
        return fromNodes(state.nodes, partial);
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

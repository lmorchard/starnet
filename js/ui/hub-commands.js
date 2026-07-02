// @ts-check
// Console commands for the overworld hub. Registered from the UI layer (the
// profile is a browser/localStorage concern). Each command routes through the
// shared hub.js operations, so typing a command and clicking the GUI produce
// identical state changes and log output (the GUI/console symmetry principle).

import { registerCommand, getCommand } from "../core/console-commands/index.js";
import { emitEvent, E } from "../core/events.js";
import {
  openHub, equipCard, unequipCard, setWithdraw, launchTarget, getHub,
  discardDisclosed, isHubContext, hubBuy, listHubCatalog,
} from "./hub.js";

function log(text, type = "meta") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

/**
 * Resolve an inventory reference (1-based index from `inventory` listing, or a
 * literal instanceId) to an instanceId. Logs and returns null if unresolved.
 */
function resolveInstanceId(arg) {
  if (!arg) { log("Usage: equip <#|instanceId>", "error"); return null; }
  const { inventory } = getHub();
  const n = parseInt(arg, 10);
  if (!isNaN(n) && String(n) === arg) {
    const card = inventory[n - 1];
    if (!card) { log(`No inventory card #${arg}.`, "error"); return null; }
    return card.instanceId;
  }
  const match = inventory.find((c) => c.instanceId === arg);
  if (!match) { log(`No exploit with id ${arg}.`, "error"); return null; }
  return match.instanceId;
}

registerCommand({ verb: "hub", execute() { openHub(); } });

registerCommand({
  verb: "inventory",
  execute() {
    const { bank, inventory, selection } = getHub();
    log(`BANK: ¥${bank.toLocaleString()}  (loadout ${selection.loadoutIds.length}/5)`);
    if (!inventory.length) { log("Inventory empty — mine or buy exploits."); return; }
    inventory.forEach((c, i) => {
      const eq = selection.loadoutIds.includes(c.instanceId) ? "  [EQUIPPED]" : "";
      log(`  [${i + 1}] ${c.instanceId}  ${c.name} [${c.rarity}] ${c.decayState} ×${c.usesRemaining}${eq}`);
    });
  },
});

registerCommand({ verb: "equip", execute(args) { const id = resolveInstanceId(args[0]); if (id) equipCard(id); } });
registerCommand({ verb: "unequip", execute(args) { const id = resolveInstanceId(args[0]); if (id) unequipCard(id); } });
registerCommand({ verb: "carry", execute(args) { setWithdraw(parseInt(args[0], 10) || 0); } });

registerCommand({
  verb: "targets",
  execute() {
    const { targets } = getHub();
    log("AVAILABLE TARGETS:");
    targets.forEach((t) => {
      const detail = t.spec ? `threat ${t.spec.threat} / wealth ${t.spec.wealth}` : "authored network";
      log(`  ${t.id}  —  ${t.label}  (${detail})`);
    });
    log("Use: launch <id>");
  },
});

registerCommand({
  verb: "launch",
  execute(args) {
    if (!args[0]) { log("Usage: launch <targetId>  (see: targets)", "error"); return; }
    launchTarget(args[0]);
  },
});

registerCommand({ verb: "discard-disclosed", execute() { discardDisclosed(); } });

// Make darknet/buy context-aware: at the hub they spend bank into inventory; in a
// run they keep their original WAN-gated behavior. Capture the core commands and
// delegate to them when not at the hub (the documented registry-override hook).
const coreDarknet = getCommand("darknet");
const coreBuy = getCommand("buy");

registerCommand({
  verb: "darknet",
  complete: coreDarknet?.complete ?? null,
  execute(args) {
    if (isHubContext()) { listHubCatalog(); return; }
    coreDarknet?.execute?.(args);
  },
});

registerCommand({
  verb: "buy",
  complete: coreBuy?.complete ?? null,
  execute(args) {
    if (isHubContext()) {
      if (!args[0]) { log("Usage: buy <index>", "error"); return; }
      const n = parseInt(args[0], 10);
      const key = !isNaN(n) && String(n) === args[0] ? n : args[0];
      hubBuy(key);
      return;
    }
    coreBuy?.execute?.(args);
  },
});

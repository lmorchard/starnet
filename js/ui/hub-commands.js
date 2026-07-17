// @ts-check
// Console commands for the overworld hub. Registered from the UI layer (the
// profile is a browser/localStorage concern). Each command routes through the
// shared hub.js operations, so typing a command and clicking the GUI produce
// identical state changes and log output (the GUI/console symmetry principle).

import { registerCommand, getCommand } from "../core/console-commands/index.js";
import { emitEvent, E } from "../core/events.js";
import { ALL_GEAR_IDS, GEAR, gearById } from "../core/gear.js";
import { GEAR_SLOTS } from "../core/balance.js";
import {
  openHub, setWithdraw, launchTarget, getHub,
  discardDisclosed, isHubContext, hubBuy, hubBuyGear, listHubCatalog,
  equipGear, unequipGear,
} from "./hub.js";

function log(text, type = "meta") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

registerCommand({ verb: "hub", execute() { openHub(); } });

// `inventory` summarizes the carry-all hoard plus owned gear and the current loadout.
registerCommand({
  verb: "inventory",
  execute() {
    const { bank, hoard, gear, loadout } = getHub();
    let common = 0, uncommon = 0, rare = 0, disclosed = 0;
    for (const r of hoard) {
      if (r.rarity === "common") common++;
      else if (r.rarity === "uncommon") uncommon++;
      else if (r.rarity === "rare") rare++;
      if (r.disclosed) disclosed++;
    }
    log(`BANK: ¥${bank.toLocaleString()}`);
    log(`HOARD — ${hoard.length} round${hoard.length === 1 ? "" : "s"} · ${common} common · ${uncommon} uncommon · ${rare} rare`);
    if (disclosed) log(`  (${disclosed} disclosed — use discard-disclosed to clear)`);
    if (gear && gear.length > 0) {
      log(`GEAR — ${gear.length} owned:`);
      gear.forEach((gearId) => {
        const g = GEAR[gearId];
        const slot = loadout && loadout.includes(gearId) ? " [EQUIPPED]" : "";
        log(`  ${gearId}  ${g ? g.name : gearId}  (${g ? g.kind : "?"})${slot}`);
      });
      log(`LOADOUT — ${loadout ? loadout.length : 0}/${GEAR_SLOTS} slots equipped. Use: equip <gearId> / unequip <gearId>`);
    } else {
      log("GEAR — none owned. Visit the darknet broker to acquire gear.");
    }
  },
});

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
      if (!args[0]) { log("Usage: buy <index|packId|gearId>", "error"); return; }
      const arg = args[0];
      // Route gear ids directly to the gear path (avoids a spurious "unknown pack" log).
      if (typeof arg === "string" && ALL_GEAR_IDS.includes(arg)) {
        hubBuyGear(arg);
        return;
      }
      const n = parseInt(arg, 10);
      const key = !isNaN(n) && String(n) === arg ? n : arg;
      hubBuy(key);
      return;
    }
    coreBuy?.execute?.(args);
  },
});

/** Resolve a gear id or name prefix to a gear id, for console fuzzy matching. */
function resolveGearArg(arg) {
  if (!arg) return null;
  const lower = arg.toLowerCase();
  // Exact id match first
  if (ALL_GEAR_IDS.includes(arg)) return arg;
  // Name prefix match
  const match = ALL_GEAR_IDS.find((id) => {
    const g = gearById(id);
    return g && g.name.toLowerCase().startsWith(lower);
  });
  return match ?? null;
}

registerCommand({
  verb: "equip",
  execute(args) {
    if (!isHubContext()) { log("equip is only available at the hub.", "error"); return; }
    if (!args[0]) { log("Usage: equip <gearId|name>  (see: inventory)", "error"); return; }
    const gearId = resolveGearArg(args[0]);
    if (!gearId) { log(`[HUB] Unknown gear: ${args[0]}`, "error"); return; }
    equipGear(gearId);
  },
});

registerCommand({
  verb: "unequip",
  execute(args) {
    if (!isHubContext()) { log("unequip is only available at the hub.", "error"); return; }
    if (!args[0]) { log("Usage: unequip <gearId|name>  (see: inventory)", "error"); return; }
    const gearId = resolveGearArg(args[0]);
    if (!gearId) { log(`[HUB] Unknown gear: ${args[0]}`, "error"); return; }
    unequipGear(gearId);
  },
});

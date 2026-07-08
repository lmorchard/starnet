// @ts-check
// Console commands for the overworld hub. Registered from the UI layer (the
// profile is a browser/localStorage concern). Each command routes through the
// shared hub.js operations, so typing a command and clicking the GUI produce
// identical state changes and log output (the GUI/console symmetry principle).

import { registerCommand, getCommand } from "../core/console-commands/index.js";
import { emitEvent, E } from "../core/events.js";
import {
  openHub, setWithdraw, launchTarget, getHub,
  discardDisclosed, isHubContext, hubBuy, listHubCatalog,
} from "./hub.js";

function log(text, type = "meta") {
  emitEvent(E.LOG_ENTRY, { text, type });
}

registerCommand({ verb: "hub", execute() { openHub(); } });

// `inventory` now summarizes the carry-all hoard (the whole hoard is carried into
// every run — there is no loadout to equip). The rich grouped listing is Phase 7.
registerCommand({
  verb: "inventory",
  execute() {
    const { bank, hoard } = getHub();
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
      if (!args[0]) { log("Usage: buy <index>", "error"); return; }
      const n = parseInt(args[0], 10);
      const key = !isNaN(n) && String(n) === args[0] ? n : args[0];
      hubBuy(key);
      return;
    }
    coreBuy?.execute?.(args);
  },
});

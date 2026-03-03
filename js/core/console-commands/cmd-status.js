// @ts-check
// Implementations for all `status` sub-commands.

import { getState, isIceVisible } from "../state.js";
import { addLogEntry } from "../log.js";
import { getVisibleTimers } from "../timers.js";
import { exploitSortKey } from "../exploits.js";
import { getRevealedAliases } from "./completions.js";
import { resolveNode, resolveImplicitNode } from "./resolvers.js";

export function cmdStatusSummary() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["SUMMARY", "───────"];

  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "—";
  lines.push(`  Seed: "${s.seed}"  |  Alert: ${s.globalAlert.toUpperCase()}  |  Cash: ¥${s.player.cash.toLocaleString()}  |  Trace: ${traceStr}`);

  let iceStr;
  if (!s.ice) iceStr = "NONE";
  else if (!s.ice.active) iceStr = "INACTIVE";
  else if (isIceVisible(s.ice, s.nodes, s.selectedNodeId))
    iceStr = `ACTIVE @ ${s.nodes[s.ice.residentNodeId]?.label ?? s.ice.residentNodeId} → ${s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId}`;
  else iceStr = "ACTIVE (location unknown)";
  const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
  const detectStr = detectTimer ? `${detectTimer.remaining}s remaining` : "—";
  lines.push(`  ICE: ${iceStr}  |  Detection: ${detectStr}`);

  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`  Selected: ${s.selectedNodeId} [${sel.type}] ${sel.accessLevel}  |  Node alert: ${sel.alertState.toUpperCase()}`);
  } else {
    lines.push(`  Selected: none`);
  }

  if (s.activeProbe) {
    const scanTimer = timers.find((t) => t.label === "SCANNING");
    const scanStr = scanTimer ? `${scanTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Scanning: ${s.nodes[s.activeProbe.nodeId]?.label ?? s.activeProbe.nodeId}  |  ${scanStr}`);
  }

  if (s.activeLoot) {
    const lootTimer = timers.find((t) => t.label === "EXTRACTING");
    const lootStr = lootTimer ? `${lootTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Extracting: ${s.nodes[s.activeLoot.nodeId]?.label ?? s.activeLoot.nodeId}  |  ${lootStr}`);
  }

  if (s.activeRead) {
    const readTimer = timers.find((t) => t.label === "READING");
    const readStr = readTimer ? `${readTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Reading: ${s.nodes[s.activeRead.nodeId]?.label ?? s.activeRead.nodeId}  |  ${readStr}`);
  }

  if (s.executingExploit) {
    const execCard = s.player.hand.find((c) => c.id === s.executingExploit.exploitId);
    const execTimer = timers.find((t) => t.label === "EXECUTING");
    const execStr = execTimer ? `${execTimer.remaining}s remaining` : "resolving...";
    lines.push(`  Executing: ${execCard?.name ?? s.executingExploit.exploitId} @ ${s.executingExploit.nodeId}  |  ${execStr}`);
  }

  const sel = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  const matchCount = sel
    ? s.player.hand.filter((c) => exploitSortKey(c, sel) === 0).length
    : 0;
  const handStr = sel
    ? `${s.player.hand.length} cards  (${matchCount} match selected node)`
    : `${s.player.hand.length} cards`;
  lines.push(`  Hand: ${handStr}`);

  const nodes = Object.values(s.nodes);
  const accessibleCount = nodes.filter((n) => n.visibility === "accessible").length;
  const ownedCount = nodes.filter((n) => n.accessLevel === "owned").length;
  const lootableCount = nodes.filter(
    (n) => n.accessLevel === "owned" && n.read && n.macguffins.some((m) => !m.collected)
  ).length;
  lines.push(`  Network: ${accessibleCount} accessible  |  ${ownedCount} owned  |  ${lootableCount} lootable`);

  if (s.mission) {
    const collectedStr = s.mission.complete ? "COLLECTED" : "not yet collected";
    lines.push(`  Mission: retrieve ${s.mission.targetName}  — ${collectedStr}`);
  } else {
    lines.push(`  Mission: none`);
  }

  lines.forEach((line) => addLogEntry(line, "meta"));
}

export function cmdStatusFull() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = [];

  const worn = s.player.hand.filter((c) => c.decayState === "worn").length;
  const disclosed = s.player.hand.filter((c) => c.decayState === "disclosed").length;
  const handDesc = `hand: ${s.player.hand.length} exploits`
    + (worn      ? `, ${worn} worn`      : "")
    + (disclosed ? `, ${disclosed} disclosed` : "");
  lines.push(`## STATUS`);
  lines.push(`### PLAYER`);
  lines.push(`- seed: "${s.seed}"`);
  lines.push(`- cash: ¥${s.player.cash.toLocaleString()}`);
  lines.push(`- ${handDesc}`);

  lines.push(`### ALERT`);
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  lines.push(`- global: ${s.globalAlert.toUpperCase()}  trace: ${traceStr}`);
  if (timers.length > 0) {
    timers.forEach((t) => lines.push(`- ⚠ ${t.label}: ${t.remaining}s`));
  }

  lines.push(`### ICE`);
  if (s.ice?.active) {
    lines.push(`- status: ACTIVE  grade: ${s.ice.grade}`);
    if (isIceVisible(s.ice, s.nodes, s.selectedNodeId)) {
      const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
      const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
      lines.push(`- attention: ${pos}  resident: ${resident}`);
    } else {
      lines.push(`- attention: unknown`);
    }
  } else {
    lines.push(`- status: ${s.ice ? "INACTIVE" : "NONE"}`);
  }

  lines.push(`### SELECTED`);
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`- ${s.selectedNodeId}  [${sel.type}]  access: ${sel.accessLevel}  alert: ${sel.alertState}`);
  } else {
    lines.push(`- none`);
  }

  lines.push(`### NETWORK`);
  const accessible = Object.values(s.nodes).filter((n) => n.visibility === "accessible");
  const revealed = Object.values(s.nodes).filter((n) => n.visibility === "revealed");

  accessible.forEach((node) => {
    const selected = node.id === s.selectedNodeId ? "  [SELECTED]" : "";
    const probed   = node.probed ? "  probed" : "";
    lines.push(`- ${node.id}  [${node.type}]  ${node.accessLevel}  alert:${node.alertState}${probed}${selected}`);
    if (node.probed && node.vulnerabilities.length > 0) {
      const vulns = node.vulnerabilities
        .filter((v) => !v.hidden)
        .map((v) => `${v.id}${v.patched ? "(patched)" : ""}`)
        .join(", ");
      if (vulns) lines.push(`  vulns: ${vulns}`);
    }
  });

  const revAliases = getRevealedAliases(s.nodes);
  revealed.forEach((node) => {
    lines.push(`- ${revAliases.get(node.id) ?? node.id}  [???]  revealed`);
  });

  lines.push(`### HAND`);
  if (s.player.hand.length === 0) {
    lines.push(`- (empty)`);
  } else {
    s.player.hand.forEach((card, i) => {
      const decay   = card.decayState !== "fresh" ? `  [${card.decayState.toUpperCase()}]` : "";
      const targets = card.targetVulnTypes.join(", ");
      lines.push(`- [${i + 1}] ${card.name}  ${card.rarity}  uses:${card.usesRemaining}  targets:${targets}${decay}`);
    });
  }

  lines.forEach((line) => addLogEntry(line, "meta"));
}

export function cmdStatusIce() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["## STATUS: ICE"];
  if (s.ice?.active) {
    lines.push(`- status: ACTIVE  grade: ${s.ice.grade}`);
    if (isIceVisible(s.ice, s.nodes, s.selectedNodeId)) {
      const pos      = s.nodes[s.ice.attentionNodeId]?.label ?? s.ice.attentionNodeId;
      const resident = s.nodes[s.ice.residentNodeId]?.label  ?? s.ice.residentNodeId;
      lines.push(`- attention: ${pos}  resident: ${resident}`);
    } else {
      lines.push(`- attention: unknown`);
    }
    const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
    if (detectTimer) lines.push(`- ⚠ detection in: ${detectTimer.remaining}s`);
  } else {
    lines.push(`- status: ${s.ice ? "INACTIVE" : "NONE"}`);
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

export function cmdStatusHand() {
  const s = getState();
  const selectedNode = s.selectedNodeId ? s.nodes[s.selectedNodeId] : null;
  const hand = selectedNode
    ? [...s.player.hand].sort((a, b) => exploitSortKey(a, selectedNode) - exploitSortKey(b, selectedNode))
    : s.player.hand;
  const lines = ["## STATUS: HAND"];
  if (hand.length === 0) {
    lines.push("- (empty)");
  } else {
    hand.forEach((card, i) => {
      const decay   = card.decayState !== "fresh" ? `  [${card.decayState.toUpperCase()}]` : "";
      const targets = card.targetVulnTypes.join(", ");
      lines.push(`- [${i + 1}] ${card.name}  ${card.rarity}  uses:${card.usesRemaining}  targets:${targets}${decay}`);
    });
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

export function cmdStatusNode(args) {
  const s = getState();
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;
  const lines = [`## STATUS: NODE ${node.id}`];
  lines.push(`- label: ${node.label}  type: ${node.type}  grade: ${node.grade ?? "N/A"}`);
  lines.push(`- access: ${node.accessLevel}  alert: ${node.alertState}`);
  lines.push(`- visibility: ${node.visibility}  probed: ${node.probed}  read: ${node.read}  looted: ${node.looted}`);
  if (node.rebooting) lines.push(`- REBOOTING`);
  if (node.eventForwardingDisabled !== undefined) {
    lines.push(`- event forwarding: ${node.eventForwardingDisabled ? "disabled" : "enabled"}`);
  }
  if (node.probed && node.vulnerabilities.length > 0) {
    const vulns = node.vulnerabilities
      .filter((v) => !v.hidden)
      .map((v) => `${v.id}${v.patched ? "(patched)" : ""}`)
      .join(", ");
    if (vulns) lines.push(`- vulns: ${vulns}`);
  }
  if (node.read && node.macguffins.length > 0) {
    node.macguffins.forEach((m) => {
      const isMission = s.mission?.targetMacguffinId === m.id ? " [MISSION]" : "";
      lines.push(`- item: ${m.name}  ¥${m.cashValue.toLocaleString()}${isMission}  collected:${m.collected}`);
    });
  }
  if (s.ice?.active && s.ice.attentionNodeId === node.id && isIceVisible(s.ice, s.nodes, s.selectedNodeId)) {
    lines.push(`- ⚠ ICE present (grade: ${s.ice.grade})`);
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

export function cmdStatusAlert() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["## STATUS: ALERT"];
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  lines.push(`- global: ${s.globalAlert.toUpperCase()}  trace: ${traceStr}`);
  timers.forEach((t) => lines.push(`- ⚠ ${t.label}: ${t.remaining}s`));
  const secNodes = Object.values(s.nodes).filter(
    (n) => n.visibility !== "hidden" && (n.type === "ids" || n.type === "security-monitor")
  );
  if (secNodes.length > 0) {
    lines.push("- security nodes:");
    secNodes.forEach((n) => {
      const fwd = n.type === "ids"
        ? (n.eventForwardingDisabled ? "  [fwd:OFF]" : "  [fwd:ON]")
        : "";
      lines.push(`  ${n.id}  [${n.type}]  alert:${n.alertState}${fwd}`);
    });
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

export function cmdStatusMission() {
  const s = getState();
  const lines = ["## STATUS: MISSION"];
  if (!s.mission) {
    lines.push("- no active mission");
  } else {
    lines.push(`- target: ${s.mission.targetName}`);
    lines.push(`- complete: ${s.mission.complete ? "YES" : "NO"}`);
    let found = null;
    for (const node of Object.values(s.nodes)) {
      const m = node.macguffins?.find((m) => m.id === s.mission.targetMacguffinId);
      if (m) { found = { ...m, nodeId: node.id, nodeLabel: node.label }; break; }
    }
    if (found) {
      lines.push(`- value: ¥${found.cashValue.toLocaleString()}`);
      lines.push(`- location: ${found.nodeLabel} (${found.nodeId})`);
      lines.push(`- collected: ${found.collected ? "YES" : "NO"}`);
    }
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

// @ts-check
// Implementations for all `status` sub-commands.

/** @typedef {import('../types.js').GameState} GameState */

import { getState, isIceVisible } from "../state.js";
import { activeIceInstances } from "../state/ice.js";
import { addLogEntry } from "../log.js";
import { getVisibleTimers } from "../timers.js";
import { resolveNode, resolveImplicitNode } from "./resolvers.js";
import { isObscured } from "../state/node.js";
import { mineYieldChance } from "../mining.js";

/**
 * Renders per-instance ICE status lines for both cmdStatusFull and cmdStatusIce.
 * @param {GameState} s
 * @returns {string[]} array of log lines
 */
function iceInstanceLines(s) {
  const active = activeIceInstances(s);
  if (active.length === 0) {
    return [`- status: ${Object.keys(s.ice?.instances ?? {}).length > 0 ? "INACTIVE" : "NONE"}`];
  }
  return active.flatMap((ice) => {
    const head = `- status: ACTIVE  grade: ${ice.grade}`;
    if (!isIceVisible(ice, s.nodes, s.selectedNodeId)) {
      return [head, `- attention: unknown`];
    }
    const pos = s.nodes[ice.attentionNodeId]?.label ?? ice.attentionNodeId;
    const resident = s.nodes[ice.hostNodeId]?.label ?? ice.hostNodeId;
    return [head, `- attention: ${pos}  resident: ${resident}`];
  });
}

export function cmdStatusSummary() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["SUMMARY", "───────"];

  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "—";
  lines.push(`  Seed: "${s.seed}"  |  Alert: ${s.globalAlert.toUpperCase()}  |  Cash: ¥${s.player.cash.toLocaleString()}  |  Trace: ${traceStr}`);

  const h = s.player.health, d = s.player.deckIntegrity;
  lines.push(`  HEALTH: ${h.current}/${h.max}  |  DECK: ${d.current}/${d.max}`);

  let iceStr;
  const active = activeIceInstances(s);
  const iceDescriptor = (ice) =>
    isIceVisible(ice, s.nodes, s.selectedNodeId)
      ? `ACTIVE @ ${s.nodes[ice.hostNodeId]?.label ?? ice.hostNodeId} → ${s.nodes[ice.attentionNodeId]?.label ?? ice.attentionNodeId}`
      : "ACTIVE (location unknown)";
  if (active.length === 0) {
    // No active instances: distinguish "no ICE on this LAN" from "present but inactive".
    iceStr = Object.keys(s.ice?.instances ?? {}).length === 0 ? "NONE" : "INACTIVE";
  } else if (active.length === 1) {
    iceStr = iceDescriptor(active[0]);
  } else {
    iceStr = `${active.length} ACTIVE — ${active.map(iceDescriptor).join("; ")}`;
  }
  const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
  const detectStr = detectTimer ? `${detectTimer.remaining}s remaining` : "—";
  lines.push(`  ICE: ${iceStr}  |  Detection: ${detectStr}`);

  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    lines.push(`  Selected: ${s.selectedNodeId} [${sel.type}] ${sel.accessLevel}  |  Node alert: ${sel.alertState.toUpperCase()}`);
  } else {
    lines.push(`  Selected: none`);
  }

  // Show active timed actions from graph node attributes
  if (s.nodeGraph) {
    for (const nodeId of s.nodeGraph.getNodeIds()) {
      const attrs = s.nodeGraph.getNodeState(nodeId);
      const label = attrs.label ?? nodeId;
      if (attrs.probing) lines.push(`  Scanning: ${label}`);
      if (attrs.exploiting) lines.push(`  Executing: auto-burn @ ${label}`);
      if (attrs.reading) lines.push(`  Reading: ${label}`);
      if (attrs.looting) lines.push(`  Extracting: ${label}`);
    }
  }

  const hoard = s.player.hoard ?? [];
  const hoardStr = hoard.length === 1 ? "1 round" : `${hoard.length} rounds`;
  lines.push(`  Hoard: ${hoardStr}`);

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

  const hoard = s.player.hoard ?? [];
  const hoardCommon   = hoard.filter((r) => r.rarity === "common").length;
  const hoardUncommon = hoard.filter((r) => r.rarity === "uncommon").length;
  const hoardRare     = hoard.filter((r) => r.rarity === "rare").length;
  const hoardDisclosed = hoard.filter((r) => r.disclosed).length;
  const hoardDesc = `hoard: ${hoard.length} rounds`
    + (hoardCommon   ? ` (${hoardCommon} common` : " (")
    + (hoardUncommon ? ` · ${hoardUncommon} uncommon` : "")
    + (hoardRare     ? ` · ${hoardRare} rare` : "")
    + ")"
    + (hoardDisclosed ? `  disclosed: ${hoardDisclosed}` : "");

  lines.push(`## STATUS`);
  lines.push(`### PLAYER`);
  lines.push(`- seed: "${s.seed}"`);
  lines.push(`- cash: ¥${s.player.cash.toLocaleString()}`);
  lines.push(`- health: ${s.player.health.current}/${s.player.health.max}`);
  lines.push(`- deck integrity: ${s.player.deckIntegrity.current}/${s.player.deckIntegrity.max}`);
  lines.push(`- ${hoardDesc}`);

  lines.push(`### ALERT`);
  const traceStr = s.traceSecondsRemaining !== null ? `${s.traceSecondsRemaining}s` : "--";
  lines.push(`- global: ${s.globalAlert.toUpperCase()}  trace: ${traceStr}`);
  if (timers.length > 0) {
    timers.forEach((t) => lines.push(`- ⚠ ${t.label}: ${t.remaining}s`));
  }

  lines.push(`### ICE`);
  lines.push(...iceInstanceLines(s));

  lines.push(`### SELECTED`);
  if (s.selectedNodeId) {
    const sel = s.nodes[s.selectedNodeId];
    if (isObscured(sel)) {
      lines.push(`- ${sel.sigAlias}  [???]  access: ${sel.accessLevel}  alert: ${sel.alertState}`);
    } else {
      lines.push(`- ${s.selectedNodeId}  [${sel.type}]  access: ${sel.accessLevel}  alert: ${sel.alertState}`);
    }
  } else {
    lines.push(`- none`);
  }

  lines.push(`### NETWORK`);
  const totalNodes = Object.keys(s.nodes).length;
  const specStr = s.spec ? `T:${s.spec.threat} W:${s.spec.wealth} C:${s.spec.complexity} D:${s.spec.depth}` : "—";
  const recipeStr = s.spec?.recipeId ?? "flat";
  const lanGradeStr = s.spec?.lanGrade ?? "—";
  lines.push(`- spec: ${specStr}  recipe: ${recipeStr}  LAN: ${lanGradeStr}  nodes: ${totalNodes}`);
  // Known = visible nodes whose identity is no longer hidden (probed or never aliased).
  // Obscured = visible nodes still behind a sig-N alias (revealed, or accessible-but-unprobed).
  const known    = Object.values(s.nodes).filter((n) => n.visibility !== "hidden" && !isObscured(n));
  const obscured = Object.values(s.nodes).filter((n) => isObscured(n));

  known.forEach((node) => {
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

  obscured.forEach((node) => {
    const selected = node.id === s.selectedNodeId ? "  [SELECTED]" : "";
    lines.push(`- ${node.sigAlias}  [???]  ${node.visibility}${selected}`);
  });

  lines.push(`### HOARD`);
  const hoardFull = s.player.hoard ?? [];
  if (hoardFull.length === 0) {
    lines.push(`- (empty)`);
  } else {
    const byRarity = { common: 0, uncommon: 0, rare: 0 };
    for (const r of hoardFull) { byRarity[r.rarity] = (byRarity[r.rarity] ?? 0) + 1; }
    const disclosedFull = hoardFull.filter((r) => r.disclosed).length;
    if (byRarity.common)   lines.push(`- common:   ${byRarity.common} rounds`);
    if (byRarity.uncommon) lines.push(`- uncommon: ${byRarity.uncommon} rounds`);
    if (byRarity.rare)     lines.push(`- rare:     ${byRarity.rare} rounds`);
    if (disclosedFull > 0) lines.push(`- disclosed: ${disclosedFull}`);
  }

  lines.forEach((line) => addLogEntry(line, "meta"));
}

export function cmdStatusIce() {
  const s = getState();
  const timers = getVisibleTimers();
  const lines = ["## STATUS: ICE"];
  lines.push(...iceInstanceLines(s));
  const activeI = activeIceInstances(s);
  if (activeI.length > 0) {
    const detectTimer = timers.find((t) => t.label === "ICE DETECTION");
    if (detectTimer) lines.push(`- ⚠ detection in: ${detectTimer.remaining}s`);
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

export function cmdStatusHand() {
  const s = getState();
  const hoard = s.player.hoard ?? [];
  const lines = ["## STATUS: HOARD"];
  if (hoard.length === 0) {
    lines.push("- (empty — 0 rounds)");
  } else {
    const byRarity = { common: 0, uncommon: 0, rare: 0 };
    for (const r of hoard) { byRarity[r.rarity] = (byRarity[r.rarity] ?? 0) + 1; }
    const disclosed = hoard.filter((r) => r.disclosed).length;
    lines.push(`- total: ${hoard.length} rounds`);
    if (byRarity.common)   lines.push(`  common:   ${byRarity.common}`);
    if (byRarity.uncommon) lines.push(`  uncommon: ${byRarity.uncommon}`);
    if (byRarity.rare)     lines.push(`  rare:     ${byRarity.rare}`);
    if (disclosed > 0) lines.push(`  disclosed: ${disclosed} (will be culled after barrage)`);
  }
  lines.forEach((l) => addLogEntry(l, "meta"));
}

export function cmdStatusNode(args) {
  const s = getState();
  const node = args.length >= 1 ? resolveNode(args[0]) : resolveImplicitNode();
  if (!node) return;

  // Obscured nodes hide their identity (id/label/type/grade) until probed.
  if (isObscured(node)) {
    const lines = [
      `## STATUS: NODE ${node.sigAlias}`,
      `- label: [???]  type: [???]  grade: [???]`,
      `- access: ${node.accessLevel}  alert: ${node.alertState}`,
      `- visibility: ${node.visibility}  probed: ${node.probed}`,
      `- Run PROBE to reveal this node's identity.`,
    ];
    lines.forEach((l) => addLogEntry(l, "meta"));
    return;
  }

  const lines = [`## STATUS: NODE ${node.id}`];
  lines.push(`- label: ${node.label}  type: ${node.type}  grade: ${node.grade ?? "N/A"}`);
  lines.push(`- access: ${node.accessLevel}  alert: ${node.alertState}`);
  lines.push(`- visibility: ${node.visibility}  probed: ${node.probed}  read: ${node.read}  looted: ${node.looted}`);
  if (node.coherence != null) {
    const maxStr = node.coherenceMax != null ? `/${node.coherenceMax}` : "";
    lines.push(`- coherence: ${node.coherence}${maxStr}`);
  }
  if (node.accessLevel === "owned") {
    const grade = node.grade ?? "D";
    const attempts = node.mineAttempts ?? 0;
    const yieldPct = Math.round(mineYieldChance(grade, attempts) * 100);
    lines.push(`- mine: attempts:${attempts}  exhausted:${node.mineExhausted ?? false}  next-yield:${yieldPct}%`);
  }
  if (node.rebooting) lines.push(`- REBOOTING`);
  if (node.forwardingEnabled !== undefined) {
    lines.push(`- event forwarding: ${node.forwardingEnabled === false ? "disabled" : "enabled"}`);
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
  for (const iceN of activeIceInstances(s)) {
    if (iceN.attentionNodeId === node.id && isIceVisible(iceN, s.nodes, s.selectedNodeId)) {
      lines.push(`- ⚠ ICE present (grade: ${iceN.grade})`);
    }
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
        ? (n.forwardingEnabled === false ? "  [fwd:OFF]" : "  [fwd:ON]")
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

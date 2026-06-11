#!/usr/bin/env node
/**
 * Generate a LAN network and output its JSON definition.
 *
 * Usage:
 *   node scripts/generate-network.js [options]
 *
 * Options:
 *   --seed <string>       RNG seed (default: random)
 *   --threat <grade>      Threat grade: F/D/C/B/A/S (default: C)
 *   --wealth <grade>      Wealth grade (default: B)
 *   --complexity <grade>  Complexity grade (default: C)
 *   --depth <grade>       Depth grade (default: C)
 *   --pretty              Pretty-print JSON output
 *   --meta-only           Output only the meta object (no graphDef)
 *   --summary             Output a human-readable summary instead of JSON
 *   --verbose             Show generation progress on stderr
 */

import { generateNetwork } from "../js/core/network/generate.js";
import { CORPORATE_BIOME } from "../data/biomes/corporate.js";

// ── Parse args ──────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = {
    seed: null,
    threat: "C",
    wealth: "B",
    complexity: "C",
    depth: "C",
    pretty: false,
    metaOnly: false,
    summary: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--seed":       opts.seed = args[++i]; break;
      case "--threat":     opts.threat = args[++i]?.toUpperCase(); break;
      case "--wealth":     opts.wealth = args[++i]?.toUpperCase(); break;
      case "--complexity": opts.complexity = args[++i]?.toUpperCase(); break;
      case "--depth":      opts.depth = args[++i]?.toUpperCase(); break;
      case "--pretty":     opts.pretty = true; break;
      case "--meta-only":  opts.metaOnly = true; break;
      case "--summary":    opts.summary = true; break;
      case "--verbose":    opts.verbose = true; break;
      case "--help": case "-h":
        console.error(`Usage: node scripts/generate-network.js [options]

Options:
  --seed <string>       RNG seed (default: random)
  --threat <grade>      Threat grade: F/D/C/B/A/S (default: C)
  --wealth <grade>      Wealth grade (default: B)
  --complexity <grade>  Complexity grade (default: C)
  --depth <grade>       Depth grade (default: C)
  --pretty              Pretty-print JSON output
  --meta-only           Output only the meta object (no graphDef)
  --summary             Output a human-readable summary instead of JSON
  --verbose             Show generation progress on stderr`);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!opts.seed) {
    opts.seed = "run-" + Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, "0");
  }

  return opts;
}

// ── Main ────────────────────────────────────────────────────

const opts = parseArgs(process.argv);
const spec = {
  threat: opts.threat,
  wealth: opts.wealth,
  complexity: opts.complexity,
  depth: opts.depth,
};

try {
  const result = generateNetwork(opts.seed, spec, CORPORATE_BIOME, {
    verbose: opts.verbose,
  });

  if (opts.summary) {
    const { graphDef, meta } = result;
    const nodeTypes = {};
    for (const n of graphDef.nodes) {
      nodeTypes[n.type] = (nodeTypes[n.type] || 0) + 1;
    }
    console.log(`Network: ${meta.name}`);
    console.log(`Seed: ${meta.seed}`);
    console.log(`Spec: threat=${spec.threat} wealth=${spec.wealth} complexity=${spec.complexity} depth=${spec.depth}`);
    console.log(`Nodes: ${graphDef.nodes.length}  Edges: ${graphDef.edges.length}  Triggers: ${graphDef.triggers.length}`);
    console.log(`Start cash: ¥${meta.startCash.toLocaleString()}`);
    console.log(`ICE: ${meta.ice?.instances?.length ? meta.ice.instances.map(c => `${c.grade}@${c.startNode}`).join(", ") : "none"}`);
    console.log(`Node types:`);
    for (const [type, count] of Object.entries(nodeTypes).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${type}: ${count}`);
    }
    console.log(`Nodes:`);
    for (const n of graphDef.nodes) {
      const traits = n.traits?.length ? n.traits.join(",") : "none";
      console.log(`  ${n.id.padEnd(35)} ${(n.type || "?").padEnd(20)} ${traits}`);
    }
  } else {
    const output = opts.metaOnly ? result.meta : result;
    const json = opts.pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
    console.log(json);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

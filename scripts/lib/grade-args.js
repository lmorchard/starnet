// @ts-check
// Shared CLI parsing for the four network grade flags. Used by playtest.js,
// bot/cli.js, and bot/census.js so the flag names and defaults stay in sync.

/**
 * Scan argv for --threat/--wealth/--complexity/--depth and return a spec object.
 * Unrecognized args are ignored, so callers can keep their own loops for other
 * flags. Defaults match the documented census defaults.
 * @param {string[]} argv
 * @returns {{ threat: string, wealth: string, complexity: string, depth: string }}
 */
export function parseGradeArgs(argv) {
  const spec = { threat: "C", wealth: "B", complexity: "C", depth: "C" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--threat" && argv[i + 1]) spec.threat = argv[++i];
    else if (argv[i] === "--wealth" && argv[i + 1]) spec.wealth = argv[++i];
    else if (argv[i] === "--complexity" && argv[i + 1]) spec.complexity = argv[++i];
    else if (argv[i] === "--depth" && argv[i + 1]) spec.depth = argv[++i];
  }
  return spec;
}

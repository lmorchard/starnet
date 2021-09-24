import seedrandom from "../../vendor/pkg/seedrandom.js";
import { ExploitSet, VulnerabilitySet, VULNERABILITY_GRADES } from "./combat.js";
import { useRng } from "../../lib/utils.js";

export async function run() {
  useRng(seedrandom);

  const exploits = new ExploitSet({ seed: "8675309", count: 100 });

  for (const grade of Object.keys(VULNERABILITY_GRADES)) {
    const vulns = new VulnerabilitySet({
      seed: `1234-S`,
      grade,
      exploits
    }).listVulnerabilities();
    console.log(grade, vulns.length, countRarities(vulns));
  }

  /*
  const counts = {};
  for (let idx = 0; idx < 200; idx++) {
    for (const grade of Object.keys(VULNERABILITY_GRADES)) {
      const vulns = new VulnerabilitySet({
        seed: `1234-${grade}`,
        grade,
        exploits
      });
      const list = vulns.listVulnerabilities();
      counts[grade] = (counts[grade] || []).concat([list.length]).slice(-50);
      const toDisclose = list.find(e => !e.disclosure);
      if (toDisclose) {
        toDisclose.disclose();
      }
    }
  }
  console.log(counts);

  const vulns = new VulnerabilitySet({ seed: `1234-S`, grade: "S", exploits });
  console.log(vulns.listVulnerabilities().map(e => e.toString()));
  */
}

function countRarities(exploits) {
  const rarities = {};
  for (const e of exploits) {
    if (!e.disclosure) {
      rarities[e.rarity] = (rarities[e.rarity] || 0) + 1;
    }
  }
  return rarities;
}

run().catch(console.error);

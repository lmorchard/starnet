import { mkrng, genName } from "../../lib/utils.ghOH_F0dc1Cy.js";

export const EXPLOIT_RARITIES = {
  common: 11 / 15,
  uncommon: 3 / 15,
  rare: 1 / 15
};

export const VULNERABILITY_GRADES = {
  S: {
    patchLag: 1,
    disclosureChance: 0.99,
    exploitChances: { common: 0.0, uncommon: 0.1, rare: 0.4 }
  },
  A: {
    patchLag: 2,
    disclosureChance: 0.9,
    exploitChances: { common: 0.0, uncommon: 0.2, rare: 0.5 }
  },
  B: {
    patchLag: 3,
    disclosureChance: 0.8,
    exploitChances: { common: 0.0, uncommon: 0.3, rare: 0.9 }
  },
  C: {
    patchLag: 4,
    disclosureChance: 0.3,
    exploitChances: { common: 0.1, uncommon: 0.3, rare: 1.0 }
  },
  D: {
    patchLag: 5,
    disclosureChance: 0.1,
    exploitChances: { common: 0.2, uncommon: 0.4, rare: 1.0 }
  },
  E: {
    patchLag: 6,
    disclosureChance: 0.1,
    exploitChances: { common: 0.3, uncommon: 0.6, rare: 1.0 }
  },
  F: {
    patchLag: 7,
    disclosureChance: 0.0,
    exploitChances: { common: 0.6, uncommon: 1.0, rare: 1.0 }
  }
};

export class VulnerabilitySet {
  constructor({ name, seed, exploits, grade = "F" } = {}) {
    this.name = name;
    this.seed = seed;
    this.rng = mkrng(seed);
    this.grade = grade;
    this.exploits = exploits;

    const grades = this.grades();
    const { patchLag, disclosureChance, exploitChances } = grades[grade] || grades.F;

    this.patchLag = patchLag;
    this.disclosureChance = disclosureChance;
    this.exploitChances = exploitChances;
  }

  grades() {
    return VULNERABILITY_GRADES;
  }

  isVulnerableTo(exploit) {
    const vulns = this.listVulnerabilities();
    return vulns.includes(exploit);
  }

  listVulnerabilities() {
    const rng = mkrng(`${this.seed}-exploits`);
    const exploits = this.exploits
      .listExploits()
      .sort(({ name: a }, { name: b }) => a.localeCompare(b))
      .filter(exploit => {
        const chance = this.exploitChances[exploit.rarity];
        return chance && rng() < chance;
      });
    const patches = this.exploits.disclosures
      .slice(0, this.exploits.disclosures.length - this.patchLag)
      .map(d => d.name);
    return exploits.filter(
      e => !e.disclosure || !patches.includes(e.disclosure.name)
    );
  }
}

export class ExploitSet {
  constructor({ seed, count = 100, exploitClass = Exploit } = {}) {
    this.rng = mkrng(seed);
    this.exploitSeq = 0;
    this.exploitClass = exploitClass;
    this.disclosures = [];
    this.exploits = {};

    for (let idx = 0; idx < count; idx++) {
      this.create();
    }
  }

  rarities() {
    return EXPLOIT_RARITIES;
  }

  listExploits() {
    return Object.values(this.exploits);
  }

  create({ rarity } = {}) {
    const exploit = new this.exploitClass({
      rarity,
      seq: this.exploitSeq++,
      rng: this.rng,
      parent: this,
      rarities: this.rarities()
    });
    this.exploits[exploit.name] = exploit;
    return exploit;
  }

  disclose(exploit) {
    const disclosure = new Disclosure({ rng: this.rng, exploit });
    this.disclosures.push(disclosure);
    exploit.disclosure = disclosure;
    this.create();
    // this.create({ rarity: exploit.rarity });
    return disclosure;
  }
}

export class Disclosure {
  constructor({ rng, name, exploit } = {}) {
    this.rng = rng;
    this.exploit = exploit;
    this.name = name || this.genName();
  }

  genName(rng, level) {
    const id = Math.floor(0xffffffff * this.rng())
      .toString(16)
      .padStart(8, "0");
    return `cve-${id}`;
  }
}

export class Exploit {
  constructor({ seq, rng, parent, name, rarity, rarities, disclosure } = {}) {
    this.seq = seq;
    this.rng = rng;
    this.parent = parent;
    this.name = name || this.genName();
    this.rarity = rarity || this.genRarity(rarities);
    this.disclosure = disclosure;
  }

  disclose() {
    return this.parent.disclose(this);
  }

  toString() {
    const seq = this.seq.toString(16).padStart(4, "0");
    const disclosure = this.disclosure ? ` - ${this.disclosure.name}` : "";
    return `${seq}-${this.name} (${this.rarity})${disclosure}`;
  }

  genName(rng, level) {
    const id = Math.floor(0xffffffff * this.rng())
      .toString(16)
      .padStart(8, "0");
    return `${id}`; // -${genName(this.rng)}`;
  }

  genRarity(rarities) {
    let roll = this.rng();
    let rarity;
    for (const [choice, chance] of Object.entries(rarities)) {
      rarity = choice;
      roll -= chance;
      if (roll < 0) {
        break;
      }
    }
    return rarity;
  }
}

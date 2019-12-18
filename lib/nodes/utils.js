export const mkrng = (seed) =>
  new Math.seedrandom(seed);

export const rngIntRange = (rng, min, max) =>
  Math.floor(rng() * ((max + 1) - min) + min);

export const genHex = (rng) =>
  Math.floor(rng() * 0xffff)
    .toString(16)
    .padStart(4, '0');

// Stolen from / inspired by Text Elite from Ian Bell
// www.iancgbell.clara.net/elite/text/
const pairs = '..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';
const pairsCount = Math.floor(pairs.length / 2);
export function genName(rng) {
  let name = '';
  const rounds = 2 + Math.floor(rng() * 3);
  for (let round = 0; round < rounds; round++) {
    const idx = Math.floor(rng() * pairsCount) * 2;
    name += pairs.substring(idx, idx + 2);
  }
  name = name.replace(/\./g, '');
  return name.substring(0, 1) + name.substring(1).toLowerCase();
}

const normalizeCount = count => 
  count < 0 ? 0 : count === true ? 1 : count === false ? 0 : count;

export class BaseNode {
  constructor({
    addr,
    childAddrs = [],
    ...props
  } = {}) {
    this.assign({
      addr,
      type: this.constructor.name,
      rng: mkrng(addr),
      childAddrs,
      ...props,
    });
    this.init();
  }

  init({ name = undefined, ...props } = {}) {
    return this.assign({
      name: name || genName(this.rng),
      ...this.defaults(),
      ...props
    });
  }

  defaults() {
    return {};
  }

  assign(props) {
    Object.assign(this, props);
    return this;
  }

  format(indent = ' ') {
    const { type, name, addr, flags } = this;
    return `${indent}${addr} ${type}: ${name} ${flags ? flags : ''}`;
  }

  child() {
    return undefined;
  }

  childAt(idx) {
    return this.child(this.childAddrs[idx]);
  }
}

export class NodeWithChildVariants extends BaseNode {
  init(props) {
    const childVariants = this.childVariants();
    const addrToClass = {};
    for (let [min, max, childClass] of childVariants) {
      const count = normalizeCount(rngIntRange(this.rng, min, max));
      for (let idx = 0; idx < count; idx++) {
        let childAddr;
        do {
          childAddr = `${this.addr}:${genHex(this.rng)}`
        } while (childAddr in addrToClass);
        addrToClass[childAddr] = childClass;
      }
    }
    super.init({
      addrToClass,
      childAddrs: Object.keys(addrToClass),
      ...props
    });
  }

  childVariants() {
    return [];
  }

  child(addr) {
    const childClass = this.addrToClass[addr];
    if (childClass) {
      return new (childClass)({ addr });
    }
  }
}

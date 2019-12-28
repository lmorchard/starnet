export { useRng } from "../utils.js";
import { ContainerNode } from "./base.js";
import { Galaxy } from "./galaxy.js";

export function initUniverse() {
  console.log("initUniverse");
  let child = new Universe({ addr: "0000" });
  for (let idx = 0; idx < 5; idx++) {
    console.log(child.format());
    child = child.childAt(0);
  }
  console.log("------");
  Universe.dump(child.addr, 3);
}

export class Universe extends ContainerNode {
  constructor({ name = "Known universe", ...props } = {}) {
    super({ name, ...props });
  }

  childMap() {
    return [{ class: Galaxy, min: 2, max: 5 }];
  }

  static lookup(addr) {
    const parts = addr.split(":");
    let child = new Universe({ addr: parts[0] });
    for (let idx = 1; idx < parts.length; idx++) {
      const childAddr = parts.slice(0, idx + 1).join(":");
      child = child.child(childAddr);
      if (!child) {
        return undefined;
      }
    }
    return child;
  }
}

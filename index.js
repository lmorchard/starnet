import seedrandom from "seedrandom";

import { useRng } from "./lib/nodes/index.js";
import { ContainerNode, RootNode } from "./lib/nodes/base.js";
import { ApartmentBuilding } from "./lib/nodes/building.js";
import { Universe } from "./lib/nodes/index.js";
import { Galaxy, Constellation, Star } from "./lib/nodes/galaxy.js";
import { Planet, Region } from "./lib/nodes/planet.js";
import { HackerApartment } from "./lib/nodes/building.js";
import * as Devices from "./lib/nodes/devices.js";

async function init() {
  useRng(seedrandom);

  const universe = new Universe({ addr: "0000" });

  let result = universe;
  result = result.find({ type: Planet });
  result = result.find({ type: Devices.Deck });
  for (let idx = 0; idx < 1; idx++) {
    result = result.parent();
  }

  const nodes = result.walk({
    skipChildren: ({ node, level }) => level > 0 && node instanceof RootNode
  });
  for (let { node, level } of nodes) {
    const indent = "          ".substring(0, level);
    console.log(node.format(indent));
  }
}

init()
  .then()
  .catch(console.log);

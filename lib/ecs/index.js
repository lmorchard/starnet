import { World } from "https://ecsy.io/build/ecsy.module.js";

import * as PositionMotion from "./positionMotion.js";
import * as ViewportCanvas from "./viewportCanvas.js";
import * as Graph from "./graph.js";
import * as Player from "./player.js";

const modules = [
  Player,
  PositionMotion,
  ViewportCanvas,
  Graph,
];

export function init() {
  const world = new World();
  for (const module of modules) {
    if (module.init) {
      module.init(world);
    }
  }
  return world;
}

export function initState(world, props) {
  const worldState = world.createEntity();
  for (const module of modules) {
    if (module.initState) {
      module.initState(worldState, props);
    }
  }
  return worldState;
}

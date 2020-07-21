import { World } from "https://unpkg.com/ecsy@0.2.1/build/ecsy.module.js";

import * as PositionMotion from "./positionMotion.js";
import * as Viewport from "./viewport/index.js";
import * as Graph from "./graph.js";
import * as Player from "./player.js";
import * as Hud from "./hud.js";

const modules = [PositionMotion, Viewport, Graph, Player, Hud];

export class GameState {
  constructor() {
    this.paused = false;
    this.debug = false;
    this.fps = 0;
  }
}

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
  const { debug = false, paused = false } = props;
  const worldState = world
    .createEntity()
    .addComponent(GameState, { debug, paused });
  for (const module of modules) {
    if (module.initState) {
      module.initState(worldState, props);
    }
  }
  return worldState;
}

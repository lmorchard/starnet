import {
  World,
  System,
  Component,
  TagComponent,
  Types,
} from "../../node_modules/ecsy/build/ecsy.module.min.js";

import * as PositionMotion from "./positionMotion.js";
import * as Viewport from "./viewport/index.js";
import * as Graph from "./graph.js";
import * as Lerper from "./lerper.js";
import * as Hud from "./hud.js";
import * as Player from "./player.js";

const modules = [PositionMotion, Viewport, Graph, Player, Hud, Lerper];

export class ResourcesState extends Component {}
ResourcesState.schema = {
  fonts: { type: Types.Ref, default: {} },
};

export class GameState extends Component {}
GameState.schema = {
  paused: { type: Types.Boolean, default: false },
  debug: { type: Types.Boolean, default: false },
  fps: { type: Types.Number, default: 0 },
};

export async function init() {
  const world = new World();
  world.registerComponent(GameState);
  world.registerComponent(ResourcesState);

  for (const module of modules) {
    if (module.init) {
      await module.init(world);
    }
  }
  return world;
}

export async function initState(world, props) {
  const { debug = false, paused = false, resources = {} } = props;
  const worldState = world
    .createEntity()
    .addComponent(GameState, { debug, paused })
    .addComponent(ResourcesState, resources);
  for (const module of modules) {
    if (module.initState) {
      await module.initState(worldState, props);
    }
  }
  return worldState;
}

export { World, System, Component, TagComponent, Types };

/* global dat */
import { useRng } from "./lib/utils.js";
import { initGame, startMainLoop } from "./lib/index.js";
import { Universe } from "./lib/nodes/index.js";
import { PlayerState } from "./lib/ecs/player.js";
import * as Devices from "./lib/nodes/devices.js";
import { RootNode } from "./lib/nodes/base.js";
import { initCanvas } from "./lib/ecs/viewport/canvas/index.js";
import { guiWorldState } from "./lib/debugGui.js";
import { GraphLayoutState } from "./lib/ecs/graph.js";

useRng(Math.seedrandom);

const seed = "0000";

const universe = new Universe({ addr: seed });

const { container, canvas, ctx } = initCanvas("#game");

// HACK: defining this here, because importing RootNode in lib/index.js
// seems to cause a lexical reference error that I haven't figured out yet
const walkContextNode = contextNode =>
  contextNode.walk({
    skipChildren: ({ node, level }) => level > 0 && node instanceof RootNode
  });

const { world, worldState, drawStats, gui } = initGame({
  debug: true,
  walkContextNode,
  container,
  canvas,
  ctx
});

const playerState = worldState.getMutableComponent(PlayerState);
playerState.originNode = universe.find({ type: Devices.Deck });
playerState.pendingCurrentNode = playerState.originNode;

startMainLoop(world, worldState, drawStats);

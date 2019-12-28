/* global MainLoop, CryptoJS, alea */
import {
  init as initWorld,
  initState as initWorldState
} from "./lib/ecs/index.js";
import { PlayerState } from "./lib/ecs/player.js";
import { Motion, Position } from "./lib/ecs/positionMotion.js";
import {
  Renderable,
  CanvasContext,
  RendererState,
  ViewportFocus,
  Shape,
  drawFrameBuffer
} from "./lib/ecs/viewportCanvas.js";
import { GraphGroup } from "./lib/ecs/graph.js";
import { Node } from "./lib/ecs/node.js";

import { Universe } from "./lib/nodes/index.js";
import { useRng, mkrng } from "./lib/utils.js";
import { Planet, Region } from "./lib/nodes/planet.js";
import * as Devices from "./lib/nodes/devices.js";
import { RootNode } from "./lib/nodes/base.js";

const seed = "0000";

let world;
let worldState;
let universe;
let currentScene = [];

async function init() {
  useRng(Math.seedrandom);

  initGraphics();
  initGame();

  MainLoop.setUpdate(update)
    .setDraw(draw)
    .setEnd(end)
    .start();
}

let container, canvas, ctx;

function initGraphics() {
  container = document.querySelector("#game");
  canvas = document.createElement("canvas");
  container.appendChild(canvas);
  ctx = canvas.getContext("2d");

  /*
  window.addEventListener( 'resize', () => {
    canvasComponent.width = canvas.width = window.innerWidth
    canvasComponent.height = canvas.height = window.innerHeight;
  }, false );
  */
}

function initGame() {
  world = initWorld();
  worldState = initWorldState(world, { container, canvas, ctx });

  universe = new Universe({ addr: seed });

  const playerState = worldState.getMutableComponent(PlayerState);
  playerState.originNode = playerState.currentNode = universe.find({
    type: Devices.Deck
  });

  changeSceneForNode(playerState.currentNode);
}

function update(delta) {
  world.execute(delta, performance.now());
}

function draw(interpolationPercentage) {
  drawFrameBuffer(worldState, interpolationPercentage);
}

function end(fps, panic) {
  if (panic) {
    var discardedTime = Math.round(MainLoop.resetFrameDelta());
  }
}

function changeSceneForNode(sceneNode) {
  for (let entity of currentScene) {
    entity.remove();
  }
  currentScene = [];

  const rng = mkrng(sceneNode.addr);
  const contextNode = sceneNode.parent();

  const sceneNodes = contextNode.walk({
    map: ({ node, level }) => ({ node, level }),
    skipChildren: ({ node, level }) => level > 0 && node instanceof RootNode
  });

  for (let { node } of sceneNodes) {
    const entity = world
      .createEntity()
      .addComponent(Node, { node })
      .addComponent(GraphGroup, { id: contextNode.addr })
      .addComponent(Renderable)
      .addComponent(Shape, { primitive: "node" })
      .addComponent(Motion, { dx: 0, dy: 0 })
      .addComponent(Position, {
        x: rng() * canvas.width,
        y: rng() * canvas.height
      });
    if (true && node.addr === sceneNode.addr) {
      entity.addComponent(ViewportFocus);
    }
    currentScene.push(entity);
  }
}

init()
  .then()
  .catch(console.error);

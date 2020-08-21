import { initStats } from "./drawStats.js";
import { initGui } from "./debugGui.js";
import {
  init as initWorld,
  initState as initWorldState,
  GameState,
} from "./ecs/index.js";
import { draw as drawCanvasViewport } from "./ecs/viewport/canvas/index.js";

export function initGame(props) {
  const world = initWorld();
  const worldState = initWorldState(world, props);
  const drawStats = initStats();
  const gui = initGui(worldState);
  return { world, worldState, drawStats, gui };
}

export function startMainLoop(world, worldState, drawStats) {
  MainLoop.setUpdate((delta) => update(delta, world, drawStats))
    .setDraw((interpolationPercentage) =>
      draw(interpolationPercentage, worldState, drawStats)
    )
    .setEnd((fps, panic) => end(fps, panic, world, worldState))
    .start();
}

export function update(delta, world, drawStats) {
  drawStats.updateStart();
  world.execute(delta, performance.now());
  drawStats.updateEnd();
}

export function draw(interpolationPercentage, worldState, drawStats) {
  drawStats.drawStart();
  drawCanvasViewport(worldState, interpolationPercentage);
  drawStats.drawEnd();
}

export function end(fps, panic, world, worldState) {
  const gameState = worldState.getMutableComponent(GameState);
  gameState.fps = fps;
  if (gameState.paused && world.enabled) {
    world.stop();
  } else if (!gameState.paused && !world.enabled) {
    world.play();
  }
  if (panic) {
    var discardedTime = Math.round(MainLoop.resetFrameDelta());
  }
}

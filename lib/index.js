/* global svlib */
import { initStats } from "./drawStats.js";
import { initGui } from "./debugGui.js";
import {
  init as initWorld,
  initState as initWorldState,
  GameState,
} from "./ecs/index.js";
import { resolveProperties } from "./async.js";
import Font from "./fonts.js";
import { draw as drawViewport } from "./ecs/viewport/index.js";

export async function initGame(props) {
  const { debug = false } = props;
  const world = await initWorld();
  const resources = await loadResources();
  const worldState = await initWorldState(world, { ...props, resources });
  const drawStats = debug && (await initStats());
  const gui = debug && (await initGui(worldState));

  return { world, worldState, drawStats, gui };
}

export async function loadResources() {
  // TODO: Maybe drive a loading bar from here?
  const fonts = await resolveProperties(
    ["futural", "futuram", "rowmant", "scripts", "scriptc"].reduce(
      (acc, name) => ({ ...acc, [name]: Font.fetch(name) }),
      {}
    )
  );

  const music = await loadMusic();

  return { fonts, music };
}

export async function loadMusic() {
  await loadSunvoxLib();

  const musicResp = await fetch(
    "sunvox/js/music/NightRadio - machine 0002.sunvox"
  );
  const musicArrayBuffer = await musicResp.arrayBuffer();
  const musicData = new Uint8Array(musicArrayBuffer);

  const ver = sv_init(0, 44100, 2, 0);
  if (ver < 0) {
    throw new Error('SunVox music init failure ' + ver);
  }
  sv_open_slot(0);
  if (sv_load_from_memory(0, musicData) == 0) {
    sv_play_from_beginning(0);
  } else {
    console.log("song load error");
  }

  return {};
}

export const loadSunvoxLib = () =>
  // HACK: `await svlib` appears to hang the browser for reasons I do not yet
  // understand, so I'm quarantining the black magic over here.
  new Promise((resolve, reject) => svlib.then(() => resolve()));

export function startMainLoop(world, worldState, drawStats) {
  MainLoop.setUpdate((delta) => update(delta, world, drawStats))
    .setDraw((interpolationPercentage) =>
      draw(interpolationPercentage, worldState, drawStats)
    )
    .setEnd((fps, panic) => end(fps, panic, world, worldState))
    .start();
}

export function update(delta, world, drawStats) {
  if (drawStats) drawStats.updateStart();
  world.execute(delta, performance.now());
  if (drawStats) drawStats.updateEnd();
}

export function draw(interpolationPercentage, worldState, drawStats) {
  if (drawStats) drawStats.drawStart();
  drawViewport(worldState, interpolationPercentage);
  if (drawStats) drawStats.drawEnd();
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

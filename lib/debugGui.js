/* global dat */
import { GameState } from "./ecs/index.js";
import {
  MouseInputState,
  Camera,
  RendererState,
} from "./ecs/viewport/components.js";
import { WebGLContext } from "./ecs/viewport/webgl/index.js";

export function initGui(worldState) {
  const gui = new dat.GUI();

  guiWorldState(worldState, gui, "Game", GameState, [], true);

  const [fRenderer, rendererState] = guiWorldState(
    worldState,
    gui,
    "RendererState",
    RendererState,
    ["renderableEntities", "gridColor"]
  );
  fRenderer.addColor(rendererState, "gridColor");

  const [fCamera, camera] = guiWorldState(
    worldState,
    gui,
    "Camera",
    Camera,
    []
  );

  guiWorldState(
    worldState,
    gui,
    "WebGLContext",
    WebGLContext,
    [
      "container",
      "canvas",
      "gl",
      "scene",
      "programs",
      "buffers",
      "textures",
      "framebuffers",
    ],
    true
  );

  guiWorldState(worldState, gui, "MouseInput", MouseInputState);

  return gui;
}

export function guiWorldState(
  worldState,
  gui,
  name,
  componentType,
  skipKeys,
  open = false
) {
  const component = worldState.getComponent(componentType);
  return guiObjectFolder(gui, name, component, skipKeys, open);
}

export function guiObjectFolder(
  gui,
  name,
  component,
  skipKeys = [],
  open = false
) {
  const folder = gui.addFolder(name);
  guiObject(folder, component, skipKeys);
  if (open) {
    folder.open();
  }
  return [folder, component];
}

export function guiObject(folder, component, skipKeys = []) {
  Object.keys(component)
    .filter(
      (key) =>
        component[key] !== null &&
        !skipKeys.includes(key) &&
        !key.startsWith("_")
    )
    .forEach((key) => folder.add(component, key).listen());
}

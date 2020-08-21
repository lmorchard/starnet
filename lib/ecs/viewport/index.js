import { System, Component, Types } from "../index.js";
import { Position } from "../positionMotion.js";
import Easings from "../../easings.js";
import { Lerper, LerpItem } from "../lerper.js";
import {
  RendererState,
  Shape,
  CursorTarget,
  Renderable,
  ViewportFocus,
  MouseInputState,
  Camera,
} from "./components.js";
import * as CanvasViewport from "./canvas/index.js";

const cameraEase = Easings.easeOutBack;
const cameraEaseDuration = 400;

export function init(world) {
  [
    RendererState,
    Shape,
    CursorTarget,
    Renderable,
    ViewportFocus,
    MouseInputState,
    Camera,
  ].forEach((component) => world.registerComponent(component));

  world.registerSystem(ViewportCameraSystem);

  CanvasViewport.init(world);
}

export function initState(worldState, props) {
  worldState
    .addComponent(Camera)
    .addComponent(Lerper)
    .addComponent(MouseInputState)
    .addComponent(RendererState);

  initMouseInput(worldState);

  CanvasViewport.initState(worldState, props);
}

const SINGLE_CLICK_PERIOD = 250;

function initMouseInput(worldState) {
  const rendererState = worldState.getMutableComponent(RendererState);
  const mouseInputState = worldState.getMutableComponent(MouseInputState);
  const camera = worldState.getMutableComponent(Camera);

  window.addEventListener("mousemove", (ev) => {
    const { viewportWidth: width, viewportHeight: height } = rendererState;
    mouseInputState.clientX = ev.clientX - width / 2;
    mouseInputState.clientY = ev.clientY - height / 2;
  });

  window.addEventListener("mousedown", (ev) => {
    mouseInputState.buttonDown = true;
    mouseInputState.buttonDownLastAt = Date.now();
  });

  window.addEventListener("mouseup", (ev) => {
    mouseInputState.buttonDown = false;
  });

  const onMouseWheel = (ev) => {
    camera.zoom = Math.min(
      camera.zoomMax,
      Math.max(
        camera.zoomMin,
        camera.zoom + wheelDistance(ev) * camera.zoomWheelFactor
      )
    );
  };

  if (window.addEventListener) {
    window.addEventListener("mousewheel", onMouseWheel, false); // Chrome/Safari/Opera
    window.addEventListener("DOMMouseScroll", onMouseWheel, false); // Firefox
  } else if (window.attachEvent) {
    window.attachEvent("onmousewheel", onMouseWheel); // IE
  }
}

// See also: http://phrogz.net/JS/wheeldelta.html
const wheelDistance = function (evt) {
  if (!evt) evt = event;
  const w = evt.wheelDelta,
    d = evt.detail;
  if (d) {
    if (w) return (w / d / 40) * d > 0 ? 1 : -1;
    // Opera
    else return -d / 3; // Firefox;         TODO: do not /3 for OS X
  } else return w / 120; // IE/Safari/Chrome TODO: /3 for Chrome OS X
};

export class ViewportCameraSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const rendererState = worldState.getMutableComponent(RendererState);
    const mouseInput = worldState.getMutableComponent(MouseInputState);
    const camera = worldState.getMutableComponent(Camera);
    const lerper = worldState.getMutableComponent(Lerper);

    this.updateViewportMetrics(delta, rendererState, camera);
    this.updateCamera(delta, rendererState, camera, lerper);
    this.updateCursor(delta, rendererState, camera, mouseInput);
    this.updateFrameData(delta, rendererState);
  }

  updateViewportMetrics(delta, rendererState, camera) {
    const { viewportWidth: width, viewportHeight: height } = rendererState;
    const { zoom, cameraX, cameraY } = camera;

    rendererState.visibleWidth = width / zoom;
    rendererState.visibleHeight = height / zoom;

    rendererState.visibleLeft = 0 - rendererState.visibleWidth / 2 + cameraX;
    rendererState.visibleTop = 0 - rendererState.visibleHeight / 2 + cameraY;
    rendererState.visibleRight =
      rendererState.visibleLeft + rendererState.visibleWidth;
    rendererState.visibleBottom =
      rendererState.visibleTop + rendererState.visibleHeight;
  }

  updateCamera(delta, rendererState, camera, lerper) {
    const toFollow = this.queries.cameraFocus.results[0];
    if (!toFollow) {
      return;
    }
    const position = toFollow.getComponent(Position);

    if (toFollow.id !== camera.followedEntityId) {
      this.transitionToNewFollow(toFollow, camera, lerper);
    }

    const { cameraSlideX, cameraSlideY } = lerper.items;
    if (cameraSlideX && cameraSlideY) {
      cameraSlideX.end = position.x;
      cameraSlideY.end = position.y;
      camera.cameraX = cameraSlideX.value;
      camera.cameraY = cameraSlideY.value;
    } else {
      camera.cameraX = position.x;
      camera.cameraY = position.y;
    }
  }

  transitionToNewFollow(toFollow, camera, lerper) {
    camera.followedEntityId = toFollow.id;
    const commonSlide = {
      duration: cameraEaseDuration,
      ease: cameraEase,
    };
    lerper.items.cameraSlideX = new LerpItem({
      ...commonSlide,
      start: camera.cameraX,
    });
    lerper.items.cameraSlideY = new LerpItem({
      ...commonSlide,
      start: camera.cameraY,
    });
  }

  updateCursor(delta, rendererState, camera, mouseInput) {
    const { clientX, clientY } = mouseInput;
    const zoom = camera.zoom;
    const { cameraX, cameraY } = camera;

    const cursorX = (mouseInput.cursorX = clientX / zoom + cameraX);
    const cursorY = (mouseInput.cursorY = clientY / zoom + cameraY);

    mouseInput.overEntity = null;

    for (let entity of this.queries.cursorTargets.results) {
      const shape = entity.getComponent(Shape);
      const position = entity.getComponent(Position);

      // TODO: use a quadtree for this?
      const hw = shape.width / 2;
      const hh = shape.height / 2;
      const xLeft = position.x - hw;
      const xRight = position.x + hw;
      const yTop = position.y - hh;
      const yBottom = position.y + hh;

      const isOver =
        cursorX >= xLeft &&
        cursorX <= xRight &&
        cursorY >= yTop &&
        cursorY <= yBottom;

      if (isOver) {
        mouseInput.overEntity = entity;
      }
    }

    mouseInput.buttonClicked = false;
    if (!mouseInput.buttonDown && mouseInput.buttonDownLastAt) {
      const now = Date.now();
      // TODO: long-press for menu
      // TODO: double click timing
      if (now - mouseInput.buttonDownLastAt < SINGLE_CLICK_PERIOD) {
        mouseInput.buttonClicked = true;
      }
      mouseInput.buttonDownLastAt = null;
    }

    mouseInput.clickedEntity = null;
    if (mouseInput.buttonClicked && mouseInput.overEntity) {
      mouseInput.clickedEntity = mouseInput.overEntity;
    }
  }

  updateFrameData(delta, rendererState) {
    let entity;
    const renderablesQuery = this.queries.renderables;
    for (entity of renderablesQuery.added) {
      rendererState.renderableEntities[entity.id] = entity;
    }
    for (entity of renderablesQuery.changed) {
      rendererState.renderableEntities[entity.id] = entity;
    }
    for (entity of renderablesQuery.removed) {
      delete rendererState.renderableEntities[entity.id];
    }
  }
}

ViewportCameraSystem.queries = {
  worldState: {
    components: [MouseInputState, RendererState, Camera],
  },
  cameraFocus: {
    components: [ViewportFocus, Position],
  },
  cursorTargets: {
    components: [CursorTarget, Shape, Position],
  },
  renderables: {
    components: [Renderable, Shape, Position],
    listen: {
      added: true,
      removed: true,
      changed: true,
    },
  },
};

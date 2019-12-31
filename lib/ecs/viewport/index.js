import { System, TagComponent } from "https://ecsy.io/build/ecsy.module.js";
import { Position } from "../positionMotion.js";
import Easings from "../../easings.js";
import { drawShape } from "./canvas/shapes.js";
import { Lerp } from "../../lerp.js";

import {
  Shape,
  CursorTarget,
  Renderable,
  ViewportFocus,
  MouseInputState,
  RendererState,
  Camera
} from "./components.js";

const cameraEase = Easings.easeOutBack;

export function init(world) {
  world.registerSystem(CanvasRendererSystem);
}

export function initState(worldState, { container, canvas, ctx }) {
  worldState
    .addComponent(CanvasContext, { container, canvas, ctx })
    .addComponent(Camera)
    .addComponent(MouseInputState)
    .addComponent(RendererState);

  initMouseInput(worldState);
}

export class CanvasContext {
  constructor() {
    this.container = null;
    this.canvas = null;
    this.ctx = null;
  }
}

const SINGLE_CLICK_PERIOD = 250;

function initMouseInput(worldState) {
  const mIS = worldState.getMutableComponent(MouseInputState);
  const rS = worldState.getMutableComponent(RendererState);

  /*
  window.addEventListener( 'resize', () => {
    canvasComponent.width = canvas.width = window.innerWidth
    canvasComponent.height = canvas.height = window.innerHeight;
  }, false );
  */

  window.addEventListener("mousemove", ev => {
    mIS.clientX = ev.clientX;
    mIS.clientY = ev.clientY;
  });

  window.addEventListener("mousedown", ev => {
    mIS.buttonDown = true;
    mIS.buttonDownLastAt = Date.now();
  });

  window.addEventListener("mouseup", ev => {
    mIS.buttonDown = false;
  });

  // See also: http://phrogz.net/JS/wheeldelta.html
  const wheelDistance = function(evt) {
    if (!evt) evt = event;
    const w = evt.wheelDelta,
      d = evt.detail;
    if (d) {
      if (w) return (w / d / 40) * d > 0 ? 1 : -1;
      // Opera
      else return -d / 3; // Firefox;         TODO: do not /3 for OS X
    } else return w / 120; // IE/Safari/Chrome TODO: /3 for Chrome OS X
  };

  // See also: http://phrogz.net/JS/wheeldelta.html
  const onMouseWheel = ev => {
    rS.zoom += wheelDistance(ev) * rS.zoomWheelFactor;
    if (rS.zoom < rS.zoomMin) {
      rS.zoom = rS.zoomMin;
    }
    if (rS.zoom > rS.zoomMax) {
      rS.zoom = rS.zoomMax;
    }
  };

  if (window.addEventListener) {
    window.addEventListener("mousewheel", onMouseWheel, false); // Chrome/Safari/Opera
    window.addEventListener("DOMMouseScroll", onMouseWheel, false); // Firefox
  } else if (window.attachEvent) {
    window.attachEvent("onmousewheel", onMouseWheel); // IE
  }
}

export class CanvasRendererSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const rendererState = worldState.getMutableComponent(RendererState);
    const mouseInput = worldState.getMutableComponent(MouseInputState);
    const canvasContext = worldState.getMutableComponent(CanvasContext);
    const camera = worldState.getMutableComponent(Camera);

    this.updateCanvasMetrics(delta, rendererState, camera, canvasContext);
    this.updateCamera(delta, rendererState, camera);
    this.updateCursor(delta, rendererState, camera, canvasContext, mouseInput);
    this.updateFrameData(delta, rendererState);
  }

  updateCanvasMetrics(delta, rendererState, camera, canvasContext) {
    const { container } = canvasContext;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const {
      items: {
        x: { current: cameraX },
        y: { current: cameraY }
      }
    } = camera.position;

    rendererState.visibleWidth = width / rendererState.zoom;
    rendererState.visibleHeight = height / rendererState.zoom;

    rendererState.visibleLeft = 0 - rendererState.visibleWidth / 2 + cameraX;
    rendererState.visibleTop = 0 - rendererState.visibleHeight / 2 + cameraY;
    rendererState.visibleRight =
      rendererState.visibleLeft + rendererState.visibleWidth;
    rendererState.visibleBottom =
      rendererState.visibleTop + rendererState.visibleHeight;
  }

  updateCamera(delta, rendererState, camera) {
    const toFollow = this.queries.cameraFocus.results[0];
    if (toFollow) {
      const position = toFollow.getComponent(Position);
      if (toFollow.id !== camera.followedEntityId) {
        camera.followedEntityId = toFollow.id;
        Lerp.reset(camera.position);
      }
      Lerp.setEnd(camera.position, position);
    }
    Lerp.update(camera.position, delta, cameraEase);
  }

  updateCursor(delta, rendererState, camera, canvasContext, mouseInput) {
    const { clientX, clientY } = mouseInput;
    const { container } = canvasContext;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const {
      items: {
        x: { current: cameraX },
        y: { current: cameraY }
      }
    } = camera.position;

    const cursorX = (mouseInput.cursorX =
      (clientX - width / 2) / rendererState.zoom + cameraX);
    const cursorY = (mouseInput.cursorY =
      (clientY - height / 2) / rendererState.zoom + cameraY);

    mouseInput.overEntity = null;
    document.body.style.cursor = "auto";

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
        document.body.style.cursor = "pointer";
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
    const renderablesQuery = this.queries.renderables;
    let entity;
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

CanvasRendererSystem.queries = {
  worldState: {
    components: [MouseInputState, RendererState, CanvasContext, Camera]
  },
  cameraFocus: {
    components: [ViewportFocus, Position]
  },
  cursorTargets: {
    components: [CursorTarget, Shape, Position]
  },
  renderables: {
    components: [Renderable, Shape, Position],
    listen: {
      added: true,
      removed: true,
      changed: true
    }
  }
};

export function draw(worldState, interpolationPercentage) {
  const { container, canvas, ctx } = worldState.getMutableComponent(
    CanvasContext
  );
  const { renderableEntities, zoom } = worldState.getMutableComponent(
    RendererState
  );
  const camera = worldState.getMutableComponent(Camera);

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = container.offsetWidth;
  const height = container.offsetHeight;

  canvas.width = width;
  canvas.height = height;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);

  const {
    items: {
      x: { current: cameraX },
      y: { current: cameraY }
    }
  } = camera.position;

  ctx.translate(0 - cameraX, 0 - cameraY);

  drawBackdrop(worldState);

  for (let id in renderableEntities) {
    const entity = renderableEntities[id];
    if (entity.alive) {
      drawShape(ctx, entity, worldState, interpolationPercentage);
    }
  }

  ctx.restore();
}

function drawBackdrop(worldState) {
  const { ctx } = worldState.getMutableComponent(CanvasContext);
  const {
    zoom,
    visibleLeft,
    visibleTop,
    visibleRight,
    visibleBottom,
    gridSize,
    gridColor,
    gridLineWidth
  } = worldState.getMutableComponent(RendererState);

  const gridOffsetX = visibleLeft % gridSize;
  const gridOffsetY = visibleTop % gridSize;

  ctx.save();
  ctx.beginPath();

  ctx.strokeStyle = gridColor;
  ctx.lineWidth = gridLineWidth / zoom;

  for (let x = visibleLeft - gridOffsetX; x < visibleRight; x += gridSize) {
    ctx.moveTo(x, visibleTop);
    ctx.lineTo(x, visibleBottom);
  }

  for (let y = visibleTop - gridOffsetY; y < visibleBottom; y += gridSize) {
    ctx.moveTo(visibleLeft, y);
    ctx.lineTo(visibleRight, y);
  }

  ctx.stroke();
  ctx.restore();
}

import { System } from "https://unpkg.com/ecsy@0.2.1/build/ecsy.module.js";
import { Position } from "../positionMotion.js";
import Easings from "../../easings.js";
import { drawShape, drawEdge, drawBackdrop, drawHud } from "./canvas/draw.js";
import { Lerp } from "../../lerp.js";

import {
  RendererState,
  Shape,
  CursorTarget,
  Renderable,
  ViewportFocus,
  MouseInputState,
  Camera
} from "./components.js";

import { GraphLayoutState } from "../graph.js";

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
  const canvasContext = worldState.getMutableComponent(CanvasContext);
  const mouseInputState = worldState.getMutableComponent(MouseInputState);
  const camera = worldState.getMutableComponent(Camera);

  /*
  window.addEventListener( 'resize', () => {
    canvasComponent.width = canvas.width = window.innerWidth
    canvasComponent.height = canvas.height = window.innerHeight;
  }, false );
  */

  window.addEventListener("mousemove", ev => {
    const { width, height } = canvasContext.canvas;
    mouseInputState.clientX = ev.clientX - width / 2;
    mouseInputState.clientY = ev.clientY - height / 2;
  });

  window.addEventListener("mousedown", ev => {
    mouseInputState.buttonDown = true;
    mouseInputState.buttonDownLastAt = Date.now();
  });

  window.addEventListener("mouseup", ev => {
    mouseInputState.buttonDown = false;
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

  const onMouseWheel = ev => {
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
    const {
      container: { offsetWidth: width, offsetHeight: height }
    } = canvasContext;
    const {
      zoom,
      position: {
        items: {
          x: { current: cameraX },
          y: { current: cameraY }
        }
      }
    } = camera;

    rendererState.visibleWidth = width / zoom;
    rendererState.visibleHeight = height / zoom;

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
    const zoom = camera.zoom;
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const {
      items: {
        x: { current: cameraX },
        y: { current: cameraY }
      }
    } = camera.position;

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
  const { renderableEntities } = worldState.getMutableComponent(RendererState);
  const { edges } = worldState.getComponent(GraphLayoutState);
  const {
    zoom,
    position: {
      items: {
        x: { current: cameraX },
        y: { current: cameraY }
      }
    }
  } = worldState.getMutableComponent(Camera);
  
  document.body.style.cursor = "auto";

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = container.offsetWidth;
  const height = container.offsetHeight;

  canvas.width = width;
  canvas.height = height;

  ctx.translate(width / 2, height / 2);

  ctx.save();

  ctx.scale(zoom, zoom);
  ctx.translate(0 - cameraX, 0 - cameraY);

  drawBackdrop(worldState);

  for (let [x1, y1, x2, y2] of edges) {
    drawEdge(ctx, x1, y1, x2, y2, interpolationPercentage);
  }

  for (let id in renderableEntities) {
    const entity = renderableEntities[id];
    if (entity.alive) {
      drawShape(ctx, entity, worldState, interpolationPercentage);
    }
  }

  ctx.restore();

  drawHud(ctx, worldState, interpolationPercentage);

  ctx.restore();
}

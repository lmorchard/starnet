import { System, TagComponent } from "https://ecsy.io/build/ecsy.module.js";
import { Position } from "./positionMotion.js";
import { GraphEdge } from "./graph.js";
import { Node } from "./node.js";
import { PlayerState } from "./player.js";
import { lerp } from "../utils.js";

export function init(world) {
  world.registerSystem(RendererSystem);
}

export function initState(worldState, { container, canvas, ctx }) {
  worldState
    .addComponent(CanvasContext, { container, canvas, ctx })
    .addComponent(RendererState);

  initMouseMove(worldState);
  initMouseButton(worldState);
  initMouseWheel(worldState);
}

export class Shape {
  constructor() {
    this.primitive = "box";
  }
}

export class Renderable extends TagComponent {}

export class ViewportFocus extends TagComponent {}

function initMouseMove(worldState) {
  const rendererState = worldState.getMutableComponent(RendererState);
  window.addEventListener("mousemove", ev => {
    rendererState.clientX = ev.clientX;
    rendererState.clientY = ev.clientY;
  });
}

function initMouseButton(worldState) {
  const rendererState = worldState.getMutableComponent(RendererState);
  window.addEventListener("mouseup", ev => {
    rendererState.mouseDown = false;
  });
  window.addEventListener("mousedown", ev => {
    rendererState.mouseDown = true;
  });
}

function initMouseWheel(worldState) {
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
    const rendererState = worldState.getMutableComponent(RendererState);
    rendererState.zoom += wheelDistance(ev) * rendererState.zoomWheelFactor;
    if (rendererState.zoom < rendererState.zoomMin) {
      rendererState.zoom = rendererState.zoomMin;
    }
    if (rendererState.zoom > rendererState.zoomMax) {
      rendererState.zoom = rendererState.zoomMax;
    }
  };

  if (window.addEventListener) {
    window.addEventListener("mousewheel", onMouseWheel, false); // Chrome/Safari/Opera
    window.addEventListener("DOMMouseScroll", onMouseWheel, false); // Firefox
  } else if (window.attachEvent) {
    window.attachEvent("onmousewheel", onMouseWheel); // IE
  }
}

export class RendererState {
  constructor() {
    Object.assign(this, {
      renderableEntities: {},
      cameraX: 0,
      cameraY: 0,
      clientX: 0,
      clientY: 0,
      cursorX: 0,
      cursorY: 0,
      mouseDown: false,
      zoom: 1.0,
      zoomMin: 0.1,
      zoomMax: 10.0,
      zoomWheelFactor: 0.1
    });
  }
}

export class CanvasContext {
  constructor() {
    Object.assign(this, {
      container: null,
      canvas: null,
      ctx: null
    });
  }
}

export class RendererSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const rendererState = worldState.getMutableComponent(RendererState);
    const canvasContext = worldState.getComponent(CanvasContext);
    this.updateCamera(delta, rendererState);
    this.updateCursor(delta, rendererState, canvasContext);
    this.updateFrameData(delta, rendererState);
  }

  updateCamera(delta, rendererState) {
    for (let entity of this.queries.cameraFocus.results) {
      const position = entity.getComponent(Position);
      rendererState.cameraX = position.x;
      rendererState.cameraY = position.y;
    }
  }

  updateCursor(delta, rendererState, canvasContext) {
    const { container } = canvasContext;
    const { clientX, clientY } = rendererState;

    const width = container.offsetWidth;
    const height = container.offsetHeight;

    rendererState.cursorX =
      (clientX - width / 2) / rendererState.zoom + rendererState.cameraX;
    rendererState.cursorY =
      (clientY - height / 2) / rendererState.zoom + rendererState.cameraY;
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

RendererSystem.queries = {
  worldState: {
    components: [RendererState, CanvasContext]
  },
  cameraFocus: {
    components: [ViewportFocus, Position]
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

export function drawFrameBuffer(worldState, interpolationPercentage) {
  const { container, canvas, ctx } = worldState.getMutableComponent(
    CanvasContext
  );
  const {
    renderableEntities,
    cameraX,
    cameraY,
    cursorX,
    cursorY,
    zoom
  } = worldState.getMutableComponent(RendererState);

  ctx.save();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const width = container.offsetWidth;
  const height = container.offsetHeight;

  canvas.width = width;
  canvas.height = height;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(0 - cameraX, 0 - cameraY);

  // TODO: remove drawing cursor
  ctx.beginPath();
  ctx.rect(cursorX - 5, cursorY - 5, 10, 10);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#fff";
  ctx.stroke();

  for (let id in renderableEntities) {
    const entity = renderableEntities[id];
    const { primitive } = entity.getComponent(Shape);

    let drawFn;
    switch (primitive) {
      case "box":
        drawFn = drawBox;
        break;
      case "edge":
        drawFn = drawEdge;
        break;
      case "node":
        drawFn = drawNode;
        break;
      default:
        drawFn = drawCircle;
        break;
    }
    if (drawFn) {
      drawFn(ctx, entity, worldState, interpolationPercentage);
    }
  }

  ctx.restore();
}

const SHAPE_SIZE = 50;
const SHAPE_HALF_SIZE = SHAPE_SIZE / 2;

function drawEdge(ctx, entity, worldState, ip) {
  const { x: x1, y: y1 } = entity.getComponent(Position);
  const {
    endPosition: { x: x2, y: y2 }
  } = entity.getComponent(GraphEdge);

  ctx.beginPath();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawNode(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);
  const { node } = entity.getComponent(Node);
  const { currentNode } = worldState.getComponent(PlayerState);

  ctx.beginPath();
  ctx.arc(x, y, SHAPE_HALF_SIZE, 0, 2 * Math.PI, false);
  ctx.fillStyle =
    node.addr === currentNode.addr
      ? "rgba(0, 255, 0, 0.5)"
      : "rgba(255, 0, 0, 0.5)";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#0b845b";

  ctx.font = "16px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${node.type}`, x, y - SHAPE_HALF_SIZE * 1.33);

  ctx.stroke();
}

function drawCircle(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);

  /*
  const x = item.last.x + (item.x - item.last.x) * interpolationPercentage;
  const y = 0 - item.last.y + (item.y - item.last.y) * interpolationPercentage;
  */

  ctx.beginPath();
  ctx.arc(x, y, SHAPE_HALF_SIZE, 0, 2 * Math.PI, false);
  ctx.fillStyle = "#39c495";
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = "#0b845b";
  ctx.stroke();
}

function drawBox(ctx, entity, worldState, interpolationPercentage) {
  const { x, y } = entity.getComponent(Position);

  ctx.beginPath();
  ctx.rect(x - SHAPE_HALF_SIZE, y - SHAPE_HALF_SIZE, SHAPE_SIZE, SHAPE_SIZE);
  ctx.fillStyle = "#e2736e";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#b74843";
  ctx.stroke();
}

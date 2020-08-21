import { System, Component, Types } from "../../index.js";
import { GraphLayoutState } from "../../graph.js";
import { RendererState, Camera } from "../components.js";
import { drawShape, drawEdge, drawBackdrop, drawHud } from "./draw.js";

export class CanvasContext extends Component {}
CanvasContext.schema = {
  container: { type: Types.Ref, default: null },
  canvas: { type: Types.Ref, default: null },
  ctx: { type: Types.Ref, default: null },
};

export function init(world) {
  world.registerComponent(CanvasContext);
  world.registerSystem(CanvasMetricsSystem);
}

export function initState(worldState, { containerSelector }) {
  const { container, canvas, ctx } = initCanvas(containerSelector);
  worldState.addComponent(CanvasContext, { container, canvas, ctx });
}

export function initCanvas(containerSelector) {
  const container = document.querySelector(containerSelector);
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  return { container, canvas, ctx };
}

export class CanvasMetricsSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const rendererState = worldState.getMutableComponent(RendererState);
    const canvasContext = worldState.getMutableComponent(CanvasContext);

    const {
      // container: { offsetWidth: width, offsetHeight: height },
      canvas: { width, height },
    } = canvasContext;

    rendererState.viewportWidth = width;
    rendererState.viewportHeight = height;
  }
}

CanvasMetricsSystem.queries = {
  worldState: {
    components: [CanvasContext, RendererState],
  },
};

export function draw(worldState, interpolationPercentage) {
  const { container, canvas, ctx } = worldState.getMutableComponent(
    CanvasContext
  );
  const { renderableEntities } = worldState.getMutableComponent(RendererState);
  const { edges } = worldState.getComponent(GraphLayoutState);
  const { zoom, cameraX, cameraY } = worldState.getMutableComponent(Camera);

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

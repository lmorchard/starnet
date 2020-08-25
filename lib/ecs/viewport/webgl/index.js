import { System, Component, Types } from "../../index.js";
import { GraphLayoutState } from "../../graph.js";
import { RendererState, Camera, Renderable, Shape } from "../components.js";
import { Position } from "../../positionMotion.js";

import * as WebGLDraw from "./draw.js";
import { heroShapes } from "./shapes.js";

const BACKDROP_SCENE_ID = "000000_backdrop";
const GRAPH_EDGES_SCENE_ID = "000001_graph_edges";

export class WebGLContext extends Component {}
WebGLContext.schema = {
  container: { type: Types.Ref, default: null },
  canvas: { type: Types.Ref, default: null },
  lineWidth: { type: Types.Number, default: 2.0 },
  gl: { type: Types.Ref, default: null },
  scene: { type: Types.Ref, default: {} },
  programs: { type: Types.Ref, default: {} },
  buffers: { type: Types.Ref, default: {} },
  textures: { type: Types.Ref, default: [] },
  framebuffers: { type: Types.Ref, default: [] },

  bloomStrength: { type: Types.Number, default: 1.0 },
  bloomRadius: { type: Types.Number, default: 0.5 },
};

export async function init(world) {
  world.registerComponent(WebGLContext);
  world.registerSystem(WebGLCanvasSystem);
}

export async function initState(worldState, { containerSelector }) {
  const contextProps = await WebGLDraw.init(containerSelector);
  worldState.addComponent(WebGLContext, contextProps);
}

export function draw(worldState, interpolationPercentage) {
  WebGLDraw.draw({
    interpolationPercentage,
    ...worldState.getMutableComponent(WebGLContext),
    ...worldState.getMutableComponent(Camera),
  });
}

export class WebGLCanvasSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const camera = worldState.getMutableComponent(Camera);
    const rendererState = worldState.getMutableComponent(RendererState);
    const canvasContext = worldState.getMutableComponent(WebGLContext);

    const {
      canvas: { width, height },
    } = canvasContext;
    rendererState.viewportWidth = width;
    rendererState.viewportHeight = height;

    this.updateBackdrop(delta, worldState, canvasContext, camera);
    this.updateGraphEdges(delta, worldState, canvasContext);
    this.updateSceneData(delta, worldState, canvasContext);
  }

  updateSceneData(delta, worldState, canvasContext) {
    const { scene } = worldState.getMutableComponent(WebGLContext);

    let entity;
    const renderablesQuery = this.queries.renderables;
    for (entity of renderablesQuery.added) {
      scene[entity.id] = this.getRenderableDataForEntity(entity);
    }
    for (entity of renderablesQuery.changed) {
      Object.assign(scene[entity.id], this.getRenderableDataForEntity(entity));
    }
    for (entity of renderablesQuery.removed) {
      delete scene[entity.id];
    }
  }

  getRenderableDataForEntity(entity) {
    const { x, y } = entity.getComponent(Position);
    // const { primitive } = entity.getComponent(Shape);
    // const { node } = entity.getComponent(Node);

    return {
      position: [x, y],
      shapes: heroShapes,
      visible: entity.alive,
      rotation: 0.0,
      scale: 100.0,
      color: [0.4, 0.8, 0.4, 1.0],
      //color: [Math.random(), Math.random(), Math.random(), 1.0],
    };
  }

  updateGraphEdges(delta, worldState, canvasContext) {
    const { scene } = worldState.getMutableComponent(WebGLContext);
    const { edges } = worldState.getComponent(GraphLayoutState);

    if (!scene[GRAPH_EDGES_SCENE_ID]) {
      scene[GRAPH_EDGES_SCENE_ID] = {
        visible: true,
        position: [0.0, 0.0],
        color: [0.3, 0.3, 0.6, 1.0],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }
    const sceneSprite = scene[GRAPH_EDGES_SCENE_ID];
    sceneSprite.shapes.length = 0;

    for (let [x1, y1, x2, y2] of edges) {
      sceneSprite.shapes.push([
        [x1, y1],
        [x2, y2],
      ]);
    }
  }

  updateBackdrop(delta, worldState, canvasContext, camera) {
    const { scene } = canvasContext;
    const {
      visibleLeft,
      visibleTop,
      visibleWidth,
      visibleHeight,
      gridSize,
      gridColor,
    } = worldState.getMutableComponent(RendererState);

    if (!scene[BACKDROP_SCENE_ID]) {
      scene[BACKDROP_SCENE_ID] = {
        visible: true,
        position: [0.0, 0.0],
        color: [0.1, 0.1, 0.1, 0.1],
        scale: 1,
        rotation: Math.PI / 2,
        shapes: [],
      };
    }
    const sceneSprite = scene[BACKDROP_SCENE_ID];

    const gridOffsetX = visibleLeft % gridSize;
    const gridOffsetY = visibleTop % gridSize;

    sceneSprite.position[0] = visibleLeft;
    sceneSprite.position[1] = visibleTop;
    sceneSprite.shapes.length = 0;

    for (let x = -gridOffsetX; x < visibleWidth; x += gridSize) {
      sceneSprite.shapes.push([
        [x, 0],
        [x, visibleHeight + gridSize],
      ]);
    }
    for (let y = -gridOffsetY; y < visibleHeight; y += gridSize) {
      sceneSprite.shapes.push([
        [0, y],
        [visibleWidth + gridSize, y],
      ]);
    }
  }
}

WebGLCanvasSystem.queries = {
  worldState: {
    components: [WebGLContext, RendererState],
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

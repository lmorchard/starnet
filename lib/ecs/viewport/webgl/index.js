import { System, Component, Types } from "../../index.js";
import { GraphLayoutState } from "../../graph.js";
import { RendererState, Camera, Renderable, Shape } from "../components.js";
import { Position } from "../../positionMotion.js";
import { createGLProgram } from "./GLProgram.js";
import GLBuffer from "./GLBuffer.js";

export class WebGLContext extends Component {}
WebGLContext.schema = {
  container: { type: Types.Ref, default: null },
  canvas: { type: Types.Ref, default: null },
  gl: { type: Types.Ref, default: null },
  scene: { type: Types.Ref, default: {} },
  programs: { type: Types.Ref, default: {} },
  buffers: { type: Types.Ref, default: {} },
  lineWidth: { type: Types.Number, default: 2.0 },
};

export async function init(world) {
  world.registerComponent(WebGLContext);
  world.registerSystem(WebGLCanvasSystem);
}

export async function initState(worldState, { containerSelector }) {
  const contextProps = await initCanvas(containerSelector);
  worldState.addComponent(WebGLContext, contextProps);
}

const PI2 = Math.PI * 2;

const heroShapes = [
  [
    [0.0, 0.5],
    [0.125, 0.4167],
    [0.25, 0.0],
    [0.375, -0.1667],
    [0.25, -0.5],
    [0.125, -0.5],
    [0.0625, -0.25],
    [-0.0625, -0.25],
    [-0.125, -0.5],
    [-0.25, -0.5],
    [-0.375, -0.1667],
    [-0.25, 0.0],
    [-0.125, 0.4167],
    [0.0, 0.5],
  ],
];

export class WebGLCanvasSystem extends System {
  execute(delta, time) {
    const worldState = this.queries.worldState.results[0];
    const rendererState = worldState.getMutableComponent(RendererState);
    const canvasContext = worldState.getMutableComponent(WebGLContext);

    const {
      canvas: { width, height },
    } = canvasContext;
    rendererState.viewportWidth = width;
    rendererState.viewportHeight = height;

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
      color: [1.0, 1.0, 1.0, 1.0],
    };
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

export async function initCanvas(containerSelector) {
  const container = document.querySelector(containerSelector);

  const canvas = document.createElement("canvas");
  container.appendChild(canvas);

  const gl = canvas.getContext("webgl", {
    antialias: true,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.disable(gl.DEPTH_TEST);

  const scene = {};

  const programs = {
    lineDraw: await createGLProgram({
      gl,
      vertexShaderName: "line-draw-vertex",
      fragmentShaderName: "line-draw-fragment",
    }),
  };

  const buffers = {
    lineDraw: new GLBuffer({ gl }),
  };

  return { container, canvas, gl, scene, programs, buffers };
}

export function draw(worldState, interpolationPercentage) {
  const {
    container,
    canvas,
    gl,
    scene,
    programs,
    buffers,
    lineWidth,
  } = worldState.getMutableComponent(WebGLContext);
  const { edges } = worldState.getComponent(GraphLayoutState);
  const { zoom, rotation, cameraX, cameraY } = worldState.getMutableComponent(
    Camera
  );

  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;

  /*
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
  */

  programs.lineDraw.use({
    uLineWidth: 0.001 * lineWidth,
    uCameraZoom: zoom,
    uCameraOrigin: [cameraX, cameraY],
    uCameraRotation: rotation,
    uViewportSize: [canvas.width, canvas.height],
  });

  buffers.lineDraw.use();

  const vertexCount = fillLineDrawBufferFromScene(
    buffers.lineDraw,
    scene,
    programs.lineDraw.vertexSize
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
}

function clearCanvas(gl) {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function fillLineDrawBufferFromScene(buffer, scene, vertexSize) {
  let vertexCount = 0;
  let visible,
    shape,
    position,
    scale,
    rotation,
    color,
    lineIdx,
    shapesIdx,
    shapes;

  const objects = Object.values(scene);

  buffer.reset(
    objects.reduce(
      (acc, item) =>
        acc +
        item.shapes.reduce(
          (acc, shape) => acc + (shape.length - 0.5) * vertexSize * 4,
          0
        ),
      0
    )
  );

  const bufferVertex = (shapeIdx, lineIdx) => {
    vertexCount++;
    buffer.push(
      lineIdx,
      shape[shapeIdx - 1][0],
      shape[shapeIdx - 1][1],
      shape[shapeIdx][0],
      shape[shapeIdx][1],
      position[0],
      position[1],
      scale,
      rotation,
      color[0],
      color[1],
      color[2],
      color[3]
    );
  };

  const sceneKeys = Object.keys(scene).sort();
  for (let sceneKeysIdx = 0; sceneKeysIdx < sceneKeys.length; sceneKeysIdx++) {
    ({
      visible,
      shapes,
      position = [0.0, 0.0],
      scale = 0,
      rotation = 0,
      color = [1, 1, 1, 1],
    } = scene[sceneKeys[sceneKeysIdx]]);
    if (!visible) {
      continue;
    }
    for (shapesIdx = 0; shapesIdx < shapes.length; shapesIdx++) {
      shape = shapes[shapesIdx];
      bufferVertex(1, 0);
      for (lineIdx = 1; lineIdx < shape.length; lineIdx += 1) {
        bufferVertex(lineIdx, 0);
        bufferVertex(lineIdx, 1);
        bufferVertex(lineIdx, 2);
        bufferVertex(lineIdx, 3);
      }
      bufferVertex(shape.length - 1, 3);
    }
  }

  return vertexCount;
}

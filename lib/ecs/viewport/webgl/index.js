import { System, Component, Types } from "../../index.js";
import { GraphLayoutState } from "../../graph.js";
import { RendererState, Camera, Renderable, Shape } from "../components.js";
import { Position } from "../../positionMotion.js";
import { createGLProgram } from "./GLProgram.js";
import GLBuffer from "./GLBuffer.js";

const BACKDROP_SCENE_ID = "000000_backdrop";
const PI2 = Math.PI * 2;
const NUM_TEXTURES = 10;
const NUM_FRAMEBUFFERS = 1;

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
};

export async function init(world) {
  world.registerComponent(WebGLContext);
  world.registerSystem(WebGLCanvasSystem);
}

export async function initState(worldState, { containerSelector }) {
  const contextProps = await initCanvas(containerSelector);
  worldState.addComponent(WebGLContext, contextProps);
}

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
    const camera = worldState.getMutableComponent(Camera);
    const rendererState = worldState.getMutableComponent(RendererState);
    const canvasContext = worldState.getMutableComponent(WebGLContext);

    const {
      canvas: { width, height },
    } = canvasContext;
    rendererState.viewportWidth = width;
    rendererState.viewportHeight = height;

    this.updateBackdrop(delta, worldState, canvasContext, camera);
    // this.updateGraphEdges()?
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
      color: [1.0, 0.2, 1.0, 1.0],
    };
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
        visible: false, //true,
        position: [0.0, 0.0],
        color: [0.5, 0.5, 0.5, 0.1],
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
    separableBlur: await createGLProgram({
      gl,
      vertexShaderName: "separable-blur-vertex",
      fragmentShaderName: "separable-blur-fragment",
    }),
    copy: await createGLProgram({
      gl,
      vertexShaderName: "copy-vertex",
      fragmentShaderName: "copy-fragment",
    }),
    combine: await createGLProgram({
      gl,
      vertexShaderName: "combine-vertex",
      fragmentShaderName: "combine-fragment",
    }),
    composite: await createGLProgram({
      gl,
      vertexShaderName: "composite-vertex",
      fragmentShaderName: "composite-fragment",
    }),
  };

  const buffers = {
    lineDraw: new GLBuffer({ gl }),
    filter: new GLBuffer({
      gl,
      data: new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]),
    }),
  };

  const textures = [];
  for (let idx = 0; idx < NUM_TEXTURES; idx++) {
    textures.push(gl.createTexture());
  }

  const framebuffers = [];
  for (let idx = 0; idx < NUM_FRAMEBUFFERS; idx++) {
    framebuffers.push(gl.createFramebuffer());
  }

  return {
    container,
    canvas,
    gl,
    scene,
    programs,
    buffers,
    textures,
    framebuffers,
  };
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
    textures,
    framebuffers,
  } = worldState.getMutableComponent(WebGLContext);
  const { edges } = worldState.getComponent(GraphLayoutState);
  const { zoom, rotation, cameraX, cameraY } = worldState.getMutableComponent(
    Camera
  );

  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;

  /*
  for (let [x1, y1, x2, y2] of edges) {
    drawEdge(ctx, x1, y1, x2, y2, interpolationPercentage);
  }
  */

  const uViewportSize = [canvas.width, canvas.height];

  buffers.lineDraw.use();
  programs.lineDraw.use({
    uLineWidth: 0.001 * lineWidth,
    uCameraZoom: zoom,
    uCameraOrigin: [cameraX, cameraY],
    uCameraRotation: rotation,
    uViewportSize,
  });

  let vertexSize = 0;
  for (const key in scene) {
    for (const shape of scene[key].shapes) {
      vertexSize += (shape.length - 0.5) * programs.lineDraw.vertexSize * 4;
    }
  }
  buffers.lineDraw.reset(vertexSize);
  const vertexCount = fillLineDrawBufferFromScene(buffers.lineDraw, scene);
  renderTo(gl, framebuffers[0], textures[0]);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

  const commonArgs = [gl, buffers.filter, framebuffers[0]];

  filterTextureWithProgram(programs.copy, ...commonArgs, textures[1], {
    uViewportSize,
    opacity: 1.0,
    texture: textures[0],
  });

  const kernelSizeArray = [3, 5, 7, 9, 11];
  const blurTextureBase = 3;
  for (let idx = 0; idx < 5; idx++) {
    const blurcommon = {
      uViewportSize,
      kernelRadius: kernelSizeArray[idx],
      sigma: kernelSizeArray[idx],
    };
    filterTextureWithProgram(programs.separableBlur, ...commonArgs, textures[1], {
      ...blurcommon,
      texture: textures[0],
      direction: [1.0, 0.0],
    });
    filterTextureWithProgram(programs.separableBlur, ...commonArgs, textures[2], {
      ...blurcommon,
      texture: textures[1],
      direction: [0.0, 1.0],
    });
    filterTextureWithProgram(programs.copy, ...commonArgs, textures[blurTextureBase + idx], {
      uViewportSize,
      opacity: 1.0,
      texture: textures[2],
    });
  }

  buffers.filter.use();
  programs.composite.use({
    uViewportSize,
    blurTexture1: textures[blurTextureBase],
    blurTexture2: textures[blurTextureBase + 1],
    blurTexture3: textures[blurTextureBase + 2],
    blurTexture4: textures[blurTextureBase + 3],
    blurTexture5: textures[blurTextureBase + 4],
    bloomStrength: 1.0,
    bloomRadius: 0,
  });
  gl.uniform1fv(programs.composite.uniforms["bloomFactors[0]"].location, [
    1.0,
    0.8,
    0.6,
    0.4,
    0.2,
  ]);
  gl.uniform3fv(
    programs.composite.uniforms["bloomTintColors[0]"].location,
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  );
  renderTo(gl, framebuffers[0], textures[1]);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  buffers.filter.use();
  programs.combine.use({
    uViewportSize,
    srcData: textures[0],
    blurData: textures[1],
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function filterTextureWithProgram(
  program,
  gl,
  buffer,
  framebuffer,
  texture,
  uniforms
) {
  buffer.use();
  program.use(uniforms);
  renderTo(gl, framebuffer, texture);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function clearCanvas(gl) {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

function renderTo(gl, framebuffer, texture) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  framebuffer.width = gl.canvas.width;
  framebuffer.height = gl.canvas.height;

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    framebuffer.width,
    framebuffer.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  );
}

function fillLineDrawBufferFromScene(buffer, scene) {
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
  for (const sceneKey of sceneKeys) {
    ({
      visible,
      shapes,
      position = [0.0, 0.0],
      scale = 0,
      rotation = 0,
      color = [1, 1, 1, 1],
    } = scene[sceneKey]);
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

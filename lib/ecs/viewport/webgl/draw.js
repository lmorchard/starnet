import { createGLProgram } from "./GLProgram.js";
import GLBuffer from "./GLBuffer.js";

const NUM_TEXTURES = 10;
const NUM_FRAMEBUFFERS = 1;
const BLUR_TEXTURE_BASE = 3;
const KERNEL_SIZE_ARRAY = [3, 5, 7, 9, 11];
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2];
const BLOOM_TINT_COLORS = [
  1, 1, 1,
  1, 1, 1,
  1, 1, 1,
  1, 1, 1,
  1, 1, 1
];

export async function init(containerSelector) {
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

export function draw({
  container,
  canvas,
  gl,
  scene,
  programs,
  buffers,
  lineWidth,
  textures,
  framebuffers,
  bloomStrength = 1.0,
  bloomRadius = 0.5,
  zoom = 1.0,
  rotation = 0.0,
  cameraX = 0.0,
  cameraY = 0.0,
  jitter = 0.0,
}) {
  canvas.width = container.offsetWidth;
  canvas.height = container.offsetHeight;
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
  const vertexCount = fillLineDrawBufferFromScene(buffers.lineDraw, scene, jitter);
  renderTo(gl, framebuffers[0], textures[0]);
  clearCanvas(gl);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

  const filter = (program, uniforms, destTexture) =>
    filterTextureWithProgram(
      gl,
      buffers.filter,
      framebuffers[0],
      program,
      uniforms,
      destTexture
    );

  filter(
    programs.copy,
    {
      uViewportSize,
      opacity: 1.0,
      texture: textures[0],
    },
    textures[1]
  );

  for (let idx = 0; idx < 5; idx++) {
    const blurcommon = {
      uViewportSize,
      kernelRadius: KERNEL_SIZE_ARRAY[idx],
      sigma: KERNEL_SIZE_ARRAY[idx],
    };
    filter(
      programs.separableBlur,
      {
        ...blurcommon,
        texture: textures[0],
        direction: [1.0, 0.0],
      },
      textures[1]
    );
    filter(
      programs.separableBlur,
      {
        ...blurcommon,
        texture: textures[1],
        direction: [0.0, 1.0],
      },
      textures[2]
    );
    filter(
      programs.copy,
      {
        uViewportSize,
        opacity: 1.0,
        texture: textures[2],
      },
      textures[BLUR_TEXTURE_BASE + idx]
    );
  }

  buffers.filter.use();
  programs.composite.use({
    uViewportSize,
    bloomStrength,
    bloomRadius,
    blurTexture1: textures[BLUR_TEXTURE_BASE],
    blurTexture2: textures[BLUR_TEXTURE_BASE + 1],
    blurTexture3: textures[BLUR_TEXTURE_BASE + 2],
    blurTexture4: textures[BLUR_TEXTURE_BASE + 3],
    blurTexture5: textures[BLUR_TEXTURE_BASE + 4],
  });
  gl.uniform1fv(
    programs.composite.uniforms["bloomFactors[0]"].location,
    BLOOM_FACTORS
  );
  gl.uniform3fv(
    programs.composite.uniforms["bloomTintColors[0]"].location,
    BLOOM_TINT_COLORS
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
  gl,
  buffer,
  destFramebuffer,
  program,
  uniforms,
  destTexture
) {
  buffer.use();
  program.use(uniforms);
  renderTo(gl, destFramebuffer, destTexture);
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

function fillLineDrawBufferFromScene(buffer, scene, jitter = 0.0) {
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

  const calcJitter = () => Math.random() * jitter - jitter / 2;

  const bufferVertex = (shapeIdx, lineIdx) => {
    vertexCount++;
    buffer.push(
      lineIdx,
      shape[shapeIdx - 1][0] + calcJitter(),
      shape[shapeIdx - 1][1] + calcJitter(),
      shape[shapeIdx][0] + calcJitter(),
      shape[shapeIdx][1] + calcJitter(),
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
        bufferVertex(lineIdx, 0, 0.05);
        bufferVertex(lineIdx, 1, 0.05);
        bufferVertex(lineIdx, 2, 0.05);
        bufferVertex(lineIdx, 3, 0.05);
      }
      bufferVertex(shape.length - 1, 3);
    }
  }

  return vertexCount;
}

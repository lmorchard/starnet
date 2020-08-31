import { resolveProperties } from "../../../async.js";
import { createGLProgram } from "./GLProgram.js";
import GLBuffer from "./GLBuffer.js";

const NUM_TEXTURES = 10;
const BLUR_TEXTURE_BASE = 3;
const KERNEL_SIZE_ARRAY = [3, 5, 7, 9, 11];
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2];
const BLOOM_TINT_COLORS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

export default class WebGLDraw {
  constructor(options = {}) {
    Object.assign(
      this,
      {
        zoom: 1.0,
        rotation: 0.0,
        cameraX: 0.0,
        cameraY: 0.0,
        lineWidth: 2.0,
        bloomStrength: 1.0,
        bloomRadius: 0.5,
        jitter: 0.0,
      },
      options
    );
  }

  async init() {
    const container = document.querySelector(this.containerSelector);
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

    const programs = await resolveProperties({
      lineDraw: createGLProgram({ gl, name: "lineDraw" }),
      separableBlur: createGLProgram({ gl, name: "separableBlur" }),
      copy: createGLProgram({ gl, name: "copy" }),
      combine: createGLProgram({ gl, name: "combine" }),
      composite: createGLProgram({ gl, name: "composite" }),
    });

    const buffers = {
      lineDraw: new GLBuffer({ gl }),
      filter: new GLBuffer({
        gl,
        data: new Float32Array([-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0]),
      }),
    };

    const framebuffer = gl.createFramebuffer();

    const textures = [];
    for (let idx = 0; idx < NUM_TEXTURES; idx++) {
      textures.push(gl.createTexture());
    }

    Object.assign(this, {
      container,
      canvas,
      gl,
      scene,
      programs,
      buffers,
      textures,
      framebuffer,
    });
  }

  draw() {
    const {
      container,
      canvas,
      gl,
      scene,
      programs,
      buffers,
      textures,
      framebuffer,
      zoom = 1.0,
      rotation = 0.0,
      cameraX = 0.0,
      cameraY = 0.0,
      lineWidth = 1.0,
      bloomStrength = 1.0,
      bloomRadius = 0.5,
      jitter = 0.0,
    } = this;

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

    let bufferSize = 0;
    for (const key in scene) {
      for (const shape of scene[key].shapes) {
        bufferSize += (shape.length - 0.5) * programs.lineDraw.vertexSize * 4;
      }
    }
    buffers.lineDraw.reset(bufferSize);

    const vertexCount = this.fillLineDrawBufferFromScene(
      buffers.lineDraw,
      scene,
      jitter
    );
    this.renderTo(framebuffer, textures[0]);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

    this.filter(
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
      this.filter(
        programs.separableBlur,
        {
          ...blurcommon,
          texture: textures[0],
          direction: [1.0, 0.0],
        },
        textures[1]
      );
      this.filter(
        programs.separableBlur,
        {
          ...blurcommon,
          texture: textures[1],
          direction: [0.0, 1.0],
        },
        textures[2]
      );
      this.filter(
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
    this.renderTo(framebuffer, textures[1]);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    buffers.filter.use();
    programs.combine.use({
      uViewportSize,
      srcData: textures[0],
      blurData: textures[1],
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  filter(program, uniforms, destTexture) {
    const gl = this.gl;
    this.buffers.filter.use();
    program.use(uniforms);
    this.renderTo(this.framebuffer, destTexture);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  clearCanvas() {
    const gl = this.gl;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  renderTo(framebuffer, texture) {
    const gl = this.gl;

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

  fillLineDrawBufferFromScene(buffer, scene, jitter = 0.0) {
    let visible,
      shape,
      position,
      scale,
      rotation,
      color,
      shapeIdx,
      shapesIdx,
      sceneKeyIdx,
      shapes;

    let pos = 0;
    let vertexCount = 0;
    const bufferData = buffer.data;
    const bufferVertex = (shapeIdx, lineIdx) => {
      bufferData[pos + 0] = lineIdx;
      bufferData[pos + 1] = shape[shapeIdx - 1][0];
      bufferData[pos + 2] = shape[shapeIdx - 1][1];
      bufferData[pos + 3] = shape[shapeIdx][0];
      bufferData[pos + 4] = shape[shapeIdx][1];
      bufferData[pos + 5] = position[0];
      bufferData[pos + 6] = position[1];
      bufferData[pos + 7] = scale;
      bufferData[pos + 8] = rotation;
      bufferData[pos + 9] = color[0];
      bufferData[pos + 10] = color[1];
      bufferData[pos + 11] = color[2];
      bufferData[pos + 12] = color[3];
      pos = pos + 13;
      vertexCount++;
    };

    const sceneKeys = Object.keys(scene).sort();
    for (sceneKeyIdx = 0; sceneKeyIdx < sceneKeys.length; sceneKeyIdx++) {
      ({
        visible,
        shapes,
        position = [0.0, 0.0],
        scale = 0,
        rotation = 0,
        color = [1, 1, 1, 1],
      } = scene[sceneKeys[sceneKeyIdx]]);
      if (!visible) {
        continue;
      }
      for (shapesIdx = 0; shapesIdx < shapes.length; shapesIdx++) {
        shape = shapes[shapesIdx];
        bufferVertex(1, 0);
        for (shapeIdx = 1; shapeIdx < shape.length; shapeIdx += 1) {
          bufferVertex(shapeIdx, 0);
          bufferVertex(shapeIdx, 1);
          bufferVertex(shapeIdx, 2);
          bufferVertex(shapeIdx, 3);
        }
        bufferVertex(shape.length - 1, 3);
      }
    }

    return vertexCount;
  }
}

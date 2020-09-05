import { resolveProperties } from "../../../async.js";
import { mapToObject } from "../../../utils.js";
import { createGLProgram } from "./GLProgram.js";
import GLBuffer from "./GLBuffer.js";

const NUM_WORKING_TEXTURES = 10;
const BLUR_TEXTURE_BASE = 3;
const KERNEL_SIZE_ARRAY = [3, 5, 7, 9, 11];
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2];
const BLOOM_TINT_COLORS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const FILTER_BUFFER_RECT = [-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0];
const FILTER_BUFFER_DATA = new Float32Array(FILTER_BUFFER_RECT);

const hudDrawProps = {
  zoom: 1.0,
  rotation: 0.0,
  cameraX: 0.0,
  cameraY: 0.0,
  lineWidth: 2.0,
  bloomStrength: 2.0,
  bloomRadius: 0.5,
  jitter: 0.0,
};

export default class WebGLDraw {
  constructor(options = {}) {
    Object.assign(this, {}, options);
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

    const hudScene = {};
    const scene = {};

    const programs = await resolveProperties(
      mapToObject(
        [
          "mergeLayers",
          "lineDraw",
          "separableBlur",
          "copy",
          "combine",
          "composite",
        ],
        (name) => createGLProgram({ gl, name })
      )
    );

    const buffers = mapToObject(
      ["hudLineDraw", "worldLineDraw"],
      (name) => new GLBuffer({ gl })
    );
    buffers.filter = new GLBuffer({
      gl,
      data: FILTER_BUFFER_DATA,
      usage: gl.STATIC_DRAW,
    });

    const framebuffer = gl.createFramebuffer();

    const workingTextures = [];
    for (let idx = 0; idx < NUM_WORKING_TEXTURES; idx++) {
      workingTextures.push(gl.createTexture());
    }

    const layerTextures = mapToObject(["hud", "world"], (name) =>
      gl.createTexture()
    );

    Object.assign(this, {
      container,
      canvas,
      gl,
      hudScene,
      scene,
      programs,
      buffers,
      workingTextures,
      layerTextures,
      framebuffer,
    });
  }

  draw(drawProps) {
    const {
      container,
      canvas,
      gl,
      hudScene,
      scene,
      programs,
      buffers,
      layerTextures,
    } = this;

    // Keep the canvas size in sync with the container element
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    const uViewportSize = [canvas.width, canvas.height];

    this.drawScene(
      hudScene,
      uViewportSize,
      layerTextures.hud,
      buffers.hudLineDraw,
      hudDrawProps
    );

    this.drawScene(
      scene,
      uViewportSize,
      layerTextures.world,
      buffers.worldLineDraw,
      drawProps
    );

    buffers.filter.use();
    programs.mergeLayers.use({
      uViewportSize,
      layer1: layerTextures.hud,
      layer2: layerTextures.world,
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawScene(
    scene,
    uViewportSize,
    layerTexture,
    lineDrawBuffer,
    {
      zoom = 1.0,
      rotation = 0.0,
      cameraX = 0.0,
      cameraY = 0.0,
      lineWidth = 1.0,
      bloomStrength = 1.0,
      bloomRadius = 0.5,
      jitter = 0.0,
    }
  ) {
    const { gl, programs, buffers, workingTextures, framebuffer } = this;
    const { lineDraw } = this.programs;

    // Render the scene layer using the lineDraw program into texture[0]
    lineDrawBuffer.use();
    lineDraw.use();
    /* TODO: re-enable this? seemed to be causing a bug earlier
    lineDraw.use({
      uLineWidth: 0.001 * lineWidth,
      uCameraZoom: zoom,
      uCameraOrigin: [cameraX, cameraY],
      uCameraRotation: rotation,
      uViewportSize,
    });
    */
    gl.uniform1f(lineDraw.uniforms.uLineWidth.location, 0.001 * lineWidth);
    gl.uniform1f(lineDraw.uniforms.uCameraZoom.location, zoom);
    gl.uniform2f(lineDraw.uniforms.uCameraOrigin.location, cameraX, cameraY);
    gl.uniform1f(lineDraw.uniforms.uCameraRotation.location, rotation);
    gl.uniform2f(
      lineDraw.uniforms.uViewportSize.location,
      uViewportSize[0],
      uViewportSize[1]
    );

    const vertexCount = this.fillLineDrawBufferFromScene(lineDrawBuffer, scene);
    this.renderTo(framebuffer, workingTextures[0]);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);

    // Render several blurred iterations of the line drawing into textures.
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
          texture: workingTextures[0],
          direction: [1.0, 0.0],
        },
        workingTextures[1]
      );
      this.filter(
        programs.separableBlur,
        {
          ...blurcommon,
          texture: workingTextures[1],
          direction: [0.0, 1.0],
        },
        workingTextures[2]
      );
      this.filter(
        programs.copy,
        {
          uViewportSize,
          opacity: 1.0,
          texture: workingTextures[2],
        },
        workingTextures[BLUR_TEXTURE_BASE + idx]
      );
    }

    // Composite the blur iterations into the parameterized bloom effect.
    buffers.filter.use();
    programs.composite.use({
      uViewportSize,
      bloomStrength,
      bloomRadius,
      blurTexture1: workingTextures[BLUR_TEXTURE_BASE],
      blurTexture2: workingTextures[BLUR_TEXTURE_BASE + 1],
      blurTexture3: workingTextures[BLUR_TEXTURE_BASE + 2],
      blurTexture4: workingTextures[BLUR_TEXTURE_BASE + 3],
      blurTexture5: workingTextures[BLUR_TEXTURE_BASE + 4],
    });
    gl.uniform1fv(
      programs.composite.uniforms["bloomFactors[0]"].location,
      BLOOM_FACTORS
    );
    gl.uniform3fv(
      programs.composite.uniforms["bloomTintColors[0]"].location,
      BLOOM_TINT_COLORS
    );
    this.renderTo(framebuffer, workingTextures[1]);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Copy original clean line drawing atop blur / bloom effect.
    buffers.filter.use();
    programs.combine.use({
      uViewportSize,
      srcData: workingTextures[0],
      blurData: workingTextures[1],
    });
    this.renderTo(framebuffer, layerTexture);
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

  fillLineDrawBufferFromScene(buffer, scene) {
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

    const vertexSizeFloat = this.programs.lineDraw.vertexSize * 4;
    let bufferSize = 0;
    for (const key in scene) {
      for (const shape of scene[key].shapes) {
        bufferSize += (2 + shape.length) * vertexSizeFloat;
      }
    }
    buffer.reset(bufferSize);

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

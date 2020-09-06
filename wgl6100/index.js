import { resolveProperties, mapToObject } from "./utils.js";
import { createGLProgram } from "./GLProgram.js";
import GLBuffer from "./GLBuffer.js";

const KERNEL_SIZE_ARRAY = [3, 5, 7, 9, 11];
const BLUR_DIRECTION_HORIZONTAL = [1.0, 0.0];
const BLUR_DIRECTION_VERTICAL = [0.0, 1.0];
const BLOOM_FACTORS = [1.0, 0.8, 0.6, 0.4, 0.2];
const BLOOM_TINT_COLORS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
const FILTER_BUFFER_RECT = [-1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, -1.0];
const FILTER_BUFFER_DATA = new Float32Array(FILTER_BUFFER_RECT);

export default class WebGLDraw {
  constructor({ containerSelector, layers }) {
    Object.assign(this, { containerSelector, layers });
  }

  async init() {
    const container = document.querySelector(this.containerSelector);
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const gl = canvas.getContext("webgl", {
      antialias: false,
      preserveDrawingBuffer: false,
      premultipliedAlpha: false,
    });

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);

    const sprites = mapToObject(this.layers, (name) => ({}));

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

    const layerBuffers = mapToObject(
      this.layers,
      (name) => new GLBuffer({ gl })
    );

    const buffers = {};
    buffers.filter = new GLBuffer({
      gl,
      data: FILTER_BUFFER_DATA,
      usage: gl.STATIC_DRAW,
    });

    const layerTextures = {
      clean: mapToObject(this.layers, (name) => gl.createTexture()),
      glow: mapToObject(this.layers, (name) => gl.createTexture()),
    };

    const textures = mapToObject(
      [
        "lineDraw",
        "blurPassHorizontal",
        "blurPassVertical",
        "blurLevel0",
        "blurLevel1",
        "blurLevel2",
        "blurLevel3",
        "blurLevel4",
        "blurResult",
      ],
      (name) => gl.createTexture()
    );

    const framebuffer = gl.createFramebuffer();

    Object.assign(this, {
      container,
      canvas,
      gl,
      sprites,
      programs,
      buffers,
      textures,
      layerBuffers,
      layerTextures,
      framebuffer,
    });
  }

  draw(layerDrawProps) {
    const {
      container,
      canvas,
      gl,
      sprites,
      layerBuffers,
      layerTextures,
      programs,
      buffers,
    } = this;

    // Keep the canvas size in sync with the container element
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    const uViewportSize = [canvas.width, canvas.height];

    for (const layerName of this.layers) {
      // TODO: Tried using the same buffer for each draw layer. But, that caused
      // big problems in rendering. Would like to figure out why and reuse buffer
      layerBuffers[layerName].use();
      this.drawSprites(
        sprites[layerName],
        uViewportSize,
        layerTextures.clean[layerName],
        layerBuffers[layerName],
        layerDrawProps[layerName]
      );
    }

    buffers.filter.use();

    for (const layerName of this.layers) {
      this.applyGlow(
        uViewportSize,
        layerTextures.clean[layerName],
        layerTextures.glow[layerName],
        layerDrawProps[layerName]
      );
    }

    const mergeLayersUniforms = { uViewportSize };
    for (let idx = 0; idx < this.layers.length; idx++) {
      mergeLayersUniforms[`layer${idx}`] = layerTextures.glow[this.layers[idx]];
    }
    programs.mergeLayers.use(mergeLayersUniforms);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawSprites(sprites, uViewportSize, layerTexture, lineDrawBuffer, drawProps) {
    const { gl, framebuffer } = this;
    const { lineDraw } = this.programs;
    const {
      zoom = 1.0,
      rotation = 0.0,
      cameraX = 0.0,
      cameraY = 0.0,
      lineWidth = 1.0,
    } = drawProps;

    lineDraw.use({
      uLineWidth: 0.001 * lineWidth,
      uCameraZoom: zoom,
      uCameraOrigin: [cameraX, cameraY],
      uCameraRotation: rotation,
      uViewportSize,
    });

    const vertexCount = this.fillLineDrawBufferFromSprites(
      lineDrawBuffer,
      sprites
    );
    this.renderTo(framebuffer, layerTexture);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, vertexCount);
  }

  applyGlow(uViewportSize, srcTexture, destTexture, drawProps) {
    const { bloomStrength = 1.0, bloomRadius = 0.5 } = drawProps;
    const { gl, programs, buffers, textures, framebuffer } = this;
    const { separableBlur, copy } = programs;
    const {
      blurPassHorizontal,
      blurPassVertical,
      blurLevel0,
      blurLevel1,
      blurLevel2,
      blurLevel3,
      blurLevel4,
    } = textures;

    // Render several blurred iterations of the line drawing into textures.
    const blurUniforms = { uViewportSize };
    const copyUniforms = {
      uViewportSize,
      opacity: 1.0,
      texture: blurPassVertical,
    };

    for (let idx = 0; idx < 5; idx++) {
      blurUniforms.kernelRadius = KERNEL_SIZE_ARRAY[idx];
      blurUniforms.sigma = KERNEL_SIZE_ARRAY[idx];

      blurUniforms.texture = srcTexture;
      blurUniforms.direction = BLUR_DIRECTION_HORIZONTAL;
      this.filter(separableBlur, blurUniforms, blurPassHorizontal);

      blurUniforms.texture = blurPassHorizontal;
      blurUniforms.direction = BLUR_DIRECTION_VERTICAL;
      this.filter(separableBlur, blurUniforms, blurPassVertical);

      this.filter(copy, copyUniforms, textures[`blurLevel${idx}`]);
    }

    // Composite the blur iterations into the parameterized bloom effect.
    programs.composite.use({
      uViewportSize,
      bloomStrength,
      bloomRadius,
      blurLevel0,
      blurLevel1,
      blurLevel2,
      blurLevel3,
      blurLevel4,
    });
    gl.uniform1fv(
      programs.composite.uniforms["bloomFactors[0]"].location,
      BLOOM_FACTORS
    );
    gl.uniform3fv(
      programs.composite.uniforms["bloomTintColors[0]"].location,
      BLOOM_TINT_COLORS
    );
    this.renderTo(framebuffer, textures.blurResult);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Copy original clean line drawing atop blur / bloom effect.
    programs.combine.use({
      uViewportSize,
      srcData: srcTexture,
      blurData: textures.blurResult,
    });
    this.renderTo(framebuffer, destTexture);
    this.clearCanvas();
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  filter(program, uniforms, destTexture) {
    const gl = this.gl;
    //this.buffers.filter.use();
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

  fillLineDrawBufferFromSprites(buffer, sprites) {
    let visible,
      shape,
      position,
      scale,
      rotation,
      color,
      shapeIdx,
      shapesIdx,
      lineIdx,
      spritesKeyIdx,
      shapes;

    const vertexSizeFloat = this.programs.lineDraw.vertexSize * 4;
    let bufferSize = 0;
    for (const key in sprites) {
      for (const shape of sprites[key].shapes) {
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

    const spritesKeys = Object.keys(sprites).sort();
    for (
      spritesKeyIdx = 0;
      spritesKeyIdx < spritesKeys.length;
      spritesKeyIdx++
    ) {
      ({
        visible,
        shapes,
        position = [0.0, 0.0],
        scale = 0,
        rotation = 0,
        color = [1, 1, 1, 1],
      } = sprites[spritesKeys[spritesKeyIdx]]);
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

const INITIAL_BUFFER_SIZE = 50000;

export default class GLBuffer {
  constructor({
    gl,
    target,
    data,
    usage,
    initialBufferSize = INITIAL_BUFFER_SIZE,
  } = {}) {
    this.gl = gl;
    this.target = target || gl.ARRAY_BUFFER;
    this.usage = usage || gl.DYNAMIC_DRAW;
    this.data = data || new Float32Array(initialBufferSize);
    this.glBuffer = gl.createBuffer();
    this.bufferPos = 0;

    if (typeof data !== "undefined") {
      this.set(data);
    }
  }

  reset(bufferSize) {
    if (bufferSize > this.data.length) {
      // Re-allocate larger buffer if current is too small for the scene.
      this.data = new Float32Array(Math.max(bufferSize * 1.5, buffer.length * 2));
    }
   this.bufferPos = 0;
  }

  push(...items) {
    for (const item of items) {
      this.data[this.bufferPos++] = item;
    }
  }

  set(data) {
    this.data = data;
  }

  use() {
    this.gl.bindBuffer(this.target, this.glBuffer);
    this.gl.bufferData(this.target, this.data, this.usage);
  }
}

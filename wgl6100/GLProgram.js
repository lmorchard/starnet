export async function createGLProgram(options, extra = {}) {
  const program = new GLProgram(options);
  Object.assign(program, extra);
  return program.initialize();
}

const SHADER_BASE_URL = 'wgl6100/shaders';

export default class GLProgram {
  defaultOptions() {
    return {
    };
  }

  constructor(optionsIn = {}) {
    this.options = { ...this.defaultOptions(), ...optionsIn };
    const gl = this.gl = this.options.gl;
    this.debug = this.options.debug || false;

    // https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants#Uniform_types
    this.UNIFORM_INT_TYPES = [gl.INT, gl.INT_VEC2, gl.INT_VEC3, gl.INT_VEC4];
    this.UNIFORM_FLOAT_TYPES = [
      gl.FLOAT,
      gl.FLOAT_VEC2,
      gl.FLOAT_VEC3,
      gl.FLOAT_VEC4,
    ];
    this.ATTRIB_TYPE_SIZES = {
      [gl.FLOAT]: 1,
      [gl.FLOAT_VEC2]: 2,
      [gl.FLOAT_VEC3]: 3,
      [gl.FLOAT_VEC4]: 4,
      [gl.INT]: 1,
      [gl.INT_VEC2]: 2,
      [gl.INT_VEC3]: 3,
      [gl.INT_VEC4]: 4,
      // TODO: bool_*, float_mat*
    };  
  }

  async initialize() {
    const gl = this.gl;

    const [vertexShaderSrc, fragmentShaderSrc] = await Promise.all(
      [
        `${this.options.name}-vertex`,
        `${this.options.name}-fragment`,
      ].map((name) => this.fetchShader(name))
    );

    const program = this.createProgram(
      this.createShader(gl.VERTEX_SHADER, vertexShaderSrc),
      this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSrc)
    );

    // Index uniform locations by name
    const uniforms = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      uniforms[info.name] = {
        info,
        location: gl.getUniformLocation(program, info.name),
      };
    }

    // Count total vertex size and index by name
    const numAttribs = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    const attribs = {};
    let vertexSize = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(program, i);
      const size = this.ATTRIB_TYPE_SIZES[info.type];
      vertexSize += size;
      attribs[info.name] = {
        info,
        size,
        index: i,
      };
    }

    Object.assign(this, { program, uniforms, attribs, vertexSize });
    
    return this;
  }

  use(uniforms) {
    const gl = this.gl;

    gl.useProgram(this.program);
    if (uniforms) {
      this.setUniforms(uniforms);
    }

    // Set up attribute pointers into the buffer
    const numAttribs = gl.getProgramParameter(
      this.program,
      gl.ACTIVE_ATTRIBUTES
    );
    let pos = 0;
    for (let i = 0; i < numAttribs; i++) {
      const info = gl.getActiveAttrib(this.program, i);
      const size = this.ATTRIB_TYPE_SIZES[info.type];
      gl.vertexAttribPointer(
        i,
        size,
        gl.FLOAT,
        false,
        this.vertexSize * 4,
        pos * 4
      );
      gl.enableVertexAttribArray(i);
      pos += size;
    }
  }

  setUniforms(data) {
    const gl = this.gl;
    let textureIndex = 1;
    for (const key in data) {
      const value = data[key];
      const uniform = this.uniforms[key];
      if (!uniform) {
        console.error(`Unknown uniform ${key}`);
      }
      const { info, location } = uniform;
      const arrayValue = Array.isArray(value) ? value : [value];
      if (info.type === gl.SAMPLER_2D) {
        gl.activeTexture(gl.TEXTURE0 + textureIndex);
        gl.bindTexture(gl.TEXTURE_2D, value);
        gl.uniform1i(location, textureIndex);
        textureIndex++;
      } else if (this.UNIFORM_INT_TYPES.includes(info.type)) {
        gl[`uniform${arrayValue.length}iv`].call(gl, location, arrayValue);
      } else if (this.UNIFORM_FLOAT_TYPES.includes(info.type)) {
        gl[`uniform${arrayValue.length}fv`].call(gl, location, arrayValue);
      } else {
        console.error(`Unhandled uniformype ${key} ${info.type}`);
      }
    }
  }

  async fetchShader(name) {
    const resp = await fetch(`${SHADER_BASE_URL}/${name}.glsl`);
    return resp.text();
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(shader);
      throw "Could not compile WebGL program. \n\n" + info;
    }
    return shader;
  }

  createProgram(vertexShader, fragmentShader) {
    const gl = this.gl;
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      var info = gl.getProgramInfoLog(program);
      throw "Could not compile WebGL program. \n\n" + info;
    }
    return program;
  }
}

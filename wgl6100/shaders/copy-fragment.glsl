precision mediump float;

uniform vec2 uViewportSize;
uniform sampler2D texture;
uniform float opacity;

void main() {
  vec4 texel = texture2D(texture, gl_FragCoord.xy / uViewportSize);
  gl_FragColor = opacity * texel;
  gl_FragColor = texel;
}

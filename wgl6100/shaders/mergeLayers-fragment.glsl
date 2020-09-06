precision highp float;

uniform vec2 uViewportSize;
uniform sampler2D layer1;
uniform sampler2D layer2;

void main() {
  vec2 texCoord = gl_FragCoord.xy / uViewportSize;
  vec4 layer1Colour = texture2D(layer1, texCoord);
  vec4 layer2Colour = texture2D(layer2, texCoord);
  gl_FragColor = layer1Colour + layer2Colour;
}

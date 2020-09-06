precision highp float;

uniform vec2 uViewportSize;
// TODO: generate this shader dynamically depending on number of layers?
uniform sampler2D layer0;
uniform sampler2D layer1;
uniform sampler2D layer2;
//uniform sampler2D layer3;
//uniform sampler2D layer4;

void main() {
  vec2 texCoord = gl_FragCoord.xy / uViewportSize;
  vec4 layer0Colour = texture2D(layer0, texCoord);
  vec4 layer1Colour = texture2D(layer1, texCoord);
  vec4 layer2Colour = texture2D(layer2, texCoord);
  // vec4 layer3Colour = texture2D(layer3, texCoord);
  // vec4 layer4Colour = texture2D(layer4, texCoord);
  gl_FragColor =
    layer0Colour
    + layer1Colour 
    + layer2Colour 
    // + layer3Colour
    // + layer4Colour;
    ;
}

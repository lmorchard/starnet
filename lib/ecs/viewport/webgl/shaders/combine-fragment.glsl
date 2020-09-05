precision highp float;

uniform vec2 uViewportSize;
uniform sampler2D srcData;
uniform sampler2D blurData;

void main() {
  vec2 texCoord = gl_FragCoord.xy / uViewportSize;
  vec4 srcColour = texture2D(srcData, texCoord);
  vec4 blurColour = texture2D(blurData, texCoord);
  gl_FragColor = srcColour + blurColour;
}

precision highp float;

uniform vec2 uViewportSize;
uniform sampler2D srcData;
uniform sampler2D blurData;

void main() {
  //vec4 srcColour = texture2D(srcData, texCoord);
  //vec4 blurColour = texture2D(blurData, texCoord);
  vec4 srcColour = texture2D(srcData, gl_FragCoord.xy / uViewportSize);
  vec4 blurColour = texture2D(blurData, gl_FragCoord.xy / uViewportSize);
  gl_FragColor = srcColour + blurColour;
}

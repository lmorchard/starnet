precision mediump float;

uniform vec2 uViewportSize;
uniform sampler2D texture;
uniform vec2 direction;
uniform int kernelRadius;
uniform int sigma;

const int MAX_KERNEL_ITERATIONS = 13;

float gaussianPdf(in float x, in float sigma) {
  return 0.39894 * exp( -0.5 * x * x/( sigma * sigma))/sigma;
}

void main() {
  vec2 vUv = gl_FragCoord.xy / uViewportSize;
  vec2 invSize = 1.0 / uViewportSize;
  float fSigma = float(sigma);
  float weightSum = gaussianPdf(0.0, fSigma);
  vec3 diffuseSum = texture2D( texture, vUv).rgb * weightSum;
  for( int i = 1; i < MAX_KERNEL_ITERATIONS; i ++ ) {
    if (i >= kernelRadius) { break; }
    float x = float(i);
    float w = gaussianPdf(x, fSigma);
    vec2 uvOffset = direction * invSize * x;
    vec3 sample1 = texture2D( texture, vUv + uvOffset).rgb;
    vec3 sample2 = texture2D( texture, vUv - uvOffset).rgb;
    diffuseSum += (sample1 + sample2) * w;
    weightSum += 2.0 * w;
  }
  gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
}

import { wrapEffect } from '@react-three/postprocessing'
import { Effect } from 'postprocessing'

/**
 * KuwaharaEffect — a painterly post-processing pass.
 *
 * The Kuwahara filter: for each pixel, sample four overlapping quadrants,
 * and output the mean colour of the lowest-variance quadrant. Flat regions
 * smooth into painterly blobs while edges stay crisp — the base of the
 * watercolour look. Combined with a paper-grain overlay it reads as
 * watercolour rather than generic painterly.
 *
 * See docs/desktop-journal-design.md and the watercolour research notes.
 */

const fragmentShader = /* glsl */ `
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texel = 1.0 / resolution.xy;

    vec3 m0 = vec3(0.0), m1 = vec3(0.0), m2 = vec3(0.0), m3 = vec3(0.0);
    vec3 s0 = vec3(0.0), s1 = vec3(0.0), s2 = vec3(0.0), s3 = vec3(0.0);

    const int R = 4;
    for (int x = -R; x <= R; x++) {
      for (int y = -R; y <= R; y++) {
        vec3 c = texture2D(inputBuffer, uv + vec2(float(x), float(y)) * texel).rgb;
        vec3 cc = c * c;
        if (x <= 0 && y <= 0) { m0 += c; s0 += cc; }
        if (x >= 0 && y <= 0) { m1 += c; s1 += cc; }
        if (x <= 0 && y >= 0) { m2 += c; s2 += cc; }
        if (x >= 0 && y >= 0) { m3 += c; s3 += cc; }
      }
    }

    float n = float((R + 1) * (R + 1));
    m0 /= n; m1 /= n; m2 /= n; m3 /= n;
    s0 = abs(s0 / n - m0 * m0);
    s1 = abs(s1 / n - m1 * m1);
    s2 = abs(s2 / n - m2 * m2);
    s3 = abs(s3 / n - m3 * m3);

    float v0 = s0.r + s0.g + s0.b;
    float v1 = s1.r + s1.g + s1.b;
    float v2 = s2.r + s2.g + s2.b;
    float v3 = s3.r + s3.g + s3.b;

    vec3 res = m0;
    float mv = v0;
    if (v1 < mv) { mv = v1; res = m1; }
    if (v2 < mv) { mv = v2; res = m2; }
    if (v3 < mv) { mv = v3; res = m3; }

    outputColor = vec4(res, inputColor.a);
  }
`

class KuwaharaImpl extends Effect {
  constructor() {
    super('KuwaharaEffect', fragmentShader)
  }
}

export const Kuwahara = wrapEffect(KuwaharaImpl)

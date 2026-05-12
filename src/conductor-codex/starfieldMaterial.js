/* Custom shader material — the figure's body parts render as a window
 * into a procedural starfield + nebula in screen space. Sampling by
 * gl_FragCoord (not by UV) means the cosmos stays anchored to the page;
 * as the figure moves, it reveals different stars rather than dragging
 * them along.
 *
 * Used by ConductorScene.jsx for the torso, coat, head, arms, hands.
 * Headphones, hair tuft, and baton intentionally stay solid ink so they
 * read as distinct shapes against the starry body silhouette.
 */
import { ShaderMaterial } from 'three'

const vertexShader = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  // Hash + value-noise helpers — standard procedural building blocks.
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 234.34));
    p += dot(p, p + 34.45);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p) {
    float n = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      n += noise(p) * amp;
      p *= 2.0;
      amp *= 0.5;
    }
    return n;
  }

  // Grid-cell starfield: each cell of size 'cellSize' may contain one
  // star with a probability set by 'threshold'. Brightness varies per
  // cell so larger / brighter stars and smaller / dimmer stars mix.
  float stars(vec2 p, float cellSize, float threshold) {
    vec2 cell = floor(p / cellSize);
    vec2 frac = fract(p / cellSize);
    float h = hash(cell);
    if (h < threshold) return 0.0;
    vec2 starPos = vec2(hash(cell + 1.5), hash(cell + 2.7));
    float d = distance(frac, starPos);
    float intensity = (h - threshold) / (1.0 - threshold);
    float size = 0.05 + intensity * 0.10;
    return intensity * smoothstep(size, 0.0, d);
  }

  void main() {
    vec2 pixel = gl_FragCoord.xy;

    // Nebula clouds — large-scale FBM, soft edges. Sampled in
    // approximately-normalized coordinates so the cloud pattern is
    // a coherent shape across the viewport rather than per-pixel.
    vec2 uv = pixel / 1080.0;
    float n = fbm(uv * 2.6);
    float nebulaMask = smoothstep(0.32, 0.78, n);

    // A second, smaller-scale dusty layer for inner-cloud variation.
    float dust = fbm(uv * 6.0) * 0.45;

    // Two layers of stars: small dense + larger sparse.
    float smallStars = stars(pixel, 18.0, 0.86);
    float largeStars = stars(pixel, 62.0, 0.93);

    // Compose: very dark base + warm nebula + cream stars.
    vec3 base = vec3(0.03, 0.025, 0.018);                  // near-black ink
    base += vec3(0.32, 0.20, 0.08) * nebulaMask * 0.55;    // warm dust/nebula
    base += vec3(0.18, 0.12, 0.05) * dust * 0.55;          // grain on grain
    base += vec3(1.0, 0.96, 0.84) * smallStars * 0.95;     // cream small stars
    base += vec3(1.0, 0.97, 0.86) * largeStars * 0.85;     // slightly larger

    gl_FragColor = vec4(base, 1.0);
  }
`

export function createStarfieldMaterial() {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {},
  })
}

/**
 * applyCoverWash — gives the book cover a watercolour-wash look by injecting
 * a position-based noise into its material (via onBeforeCompile).
 *
 * UV-independent: it mottles the diffuse colour from the mesh's local
 * position, so it works regardless of the model's imported UV layout (a
 * straight CanvasTexture map fails when the cover's UVs pack the visible
 * face into a tiny/uniform region). The painterly post-processing then
 * abstracts this variation into watercolour pigment.
 */
export function applyCoverWash(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWashPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWashPos = position;')

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWashPos;
        float wHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float wNoise(vec3 x){
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(wHash(i+vec3(0,0,0)),wHash(i+vec3(1,0,0)),f.x),
                         mix(wHash(i+vec3(0,1,0)),wHash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(wHash(i+vec3(0,0,1)),wHash(i+vec3(1,0,1)),f.x),
                         mix(wHash(i+vec3(0,1,1)),wHash(i+vec3(1,1,1)),f.x),f.y), f.z);
        }
        float wFbm(vec3 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { v += a * wNoise(p); p *= 2.04; a *= 0.5; }
          return v;
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wash = wFbm(vWashPos * 2.2);
        float wash2 = wFbm(vWashPos * 5.5 + 9.3);
        float m = clamp(wash * 0.85 + wash2 * 0.3, 0.0, 1.0);
        // warm pigment mottling — light/dark blooms, warmer in the lit pools
        diffuseColor.rgb *= mix(0.55, 1.5, m);
        diffuseColor.r *= mix(0.96, 1.14, m);
        diffuseColor.b *= mix(1.1, 0.88, m);`,
      )
  }
  material.needsUpdate = true
}

import * as THREE from 'three'

// Minimal NPR ink: deep ink base + Fresnel rim highlight.
// Surface-bound (rotates with the geometry). No screen-space patterns.

export const ENGRAVING_DEFAULTS = {
  inkColor: new THREE.Color(0x080706),    // deep near-black ink
  rimColor: new THREE.Color(0x6b5740),    // warm sepia rim highlight
  rimPower: 2.6,                          // higher = thinner rim band
  rimStrength: 0.85,                      // how strongly rim color shows at edges
}

const PARS_INJECTION = /* glsl */`
uniform vec3 uInkColor;
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimStrength;
`

const FRAGMENT_INJECTION = /* glsl */`
{
  // Fresnel rim: 1 at silhouette edges, 0 facing camera
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewPosition);
  float fresnel = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
  fresnel = clamp(fresnel * uRimStrength, 0.0, 1.0);

  vec3 ink = uInkColor;
  vec3 rim = uRimColor;

  vec3 result = mix(ink, rim, fresnel);
  gl_FragColor.rgb = result;
}
`

export function applyEngravingShader(material, options = {}) {
  const opts = { ...ENGRAVING_DEFAULTS, ...options }

  const sharedUniforms = {
    uInkColor: { value: opts.inkColor.clone() },
    uRimColor: { value: opts.rimColor.clone() },
    uRimPower: { value: opts.rimPower },
    uRimStrength: { value: opts.rimStrength },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sharedUniforms)

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>\n${PARS_INJECTION}`
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `${FRAGMENT_INJECTION}\n#include <dithering_fragment>`
    )

    material.userData.shader = shader
    material.userData.uniforms = sharedUniforms
  }

  return material
}

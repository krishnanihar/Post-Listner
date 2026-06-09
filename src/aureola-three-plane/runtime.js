// Shared runtime for the three-plane test: module-scope TSL uniforms driven
// from the route container (single-instance assumed), plus the depth-
// displacement material builder reused by both BackPlane and FrontFigurePlane.
//
// react-refresh wants non-component exports in their own file — same reason
// as aureola-integration/runtime.js.

import { MeshBasicNodeMaterial } from 'three/webgpu'
import { positionLocal, texture, uniform, vec3 } from 'three/tsl'

// ---- Back plane base sizing ----
const BACK_IMAGE_ASPECT = 1672 / 941
export const BACK_CONSTANTS = {
  IMAGE_ASPECT: BACK_IMAGE_ASPECT,
  BASE_PLANE_W: 1.6,
  BASE_PLANE_H: 1.6 / BACK_IMAGE_ASPECT,
  COVER_HEADROOM: 1.45,
}

// Front figure is a 3:2 portrait of the figure with transparency. Scaled to
// match the back plane's HEIGHT so the figure stands centered inside the cosmic
// periphery; its width comes from its own aspect (so it doesn't stretch).
const FRONT_IMAGE_ASPECT = 1536 / 1024
export const FRONT_CONSTANTS = {
  IMAGE_ASPECT: FRONT_IMAGE_ASPECT,
}

// ---- Plane Z positions (world units) ----
export const PLANE_Z = {
  BACK: -0.5,
  MIDDLE_DEFAULT: 0.0,
  FRONT: +0.5,
}

// ---- AtmosphericGrain uniforms ----
// Tuned at 0.10 (10%) — stronger than the original 3-5% film-grain norm so
// the overlay reads as a unifying layer rather than a subliminal one.
export const GRAIN_OPACITY = 0.10
export const grainEnabledU = uniform(1)

export function setGrainEnabled(on) {
  grainEnabledU.value = on ? 1 : 0
}

// ---- Tilt → shader bridges ----
// Live tilt magnitude in degrees (sqrt(gamma² + beta²)). Drives middle-plane
// rotation acceleration, ring fade-in thresholds, and color shift.
export const tiltMagU = uniform(0)
// Accumulated rotation angle for the middle plane — updated each frame by
// MiddleShaderPlane's useFrame from base rate × tilt multiplier.
export const middleRotationU = uniform(0)
// Aspect of the middle plane for circle-shape correction in the shader.
export const middlePlaneAspectU = uniform(BACK_IMAGE_ASPECT)

export function setTiltMag(deg) {
  tiltMagU.value = deg
}
export function setMiddlePlaneAspect(a) {
  middlePlaneAspectU.value = a
}

// ---- AVD → shader bridges ----
// Eased continuous AVD vector (each component in [-1, 1]), written every frame
// by AvdShaderDriver from the spring-smoothed avdStore value. The middle-plane
// shader reads these for rotation speed (A), color bias + saturation (V), and
// outer-ring reveal (D). See Ship-Blockers §2 and the Admirer §5 modulation
// table.
export const arousalU = uniform(0)
export const valenceU = uniform(0)
export const depthU = uniform(0)

export function setAvdUniforms(a, v, d) {
  arousalU.value = a
  valenceU.value = v
  depthU.value = d
}

// ---- Depth-displacement material helper ----
// Mirrors the TSL shader pattern from aureola-integration/IntegrationBase
// (and ultimately bestiary/Workbench). Both back + front planes use this;
// only the displacementScale varies, the front overrides opacityNode for
// the figure's alpha channel, and consumers can pass `opacityU` (a TSL
// `uniform()`) to multiply a live fade value into the final opacity.
//
//   opts:
//     displacementScale  (required, e.g. 0.35 back, 0.22 front)
//     useTextureAlpha    (front-figure plane sets true → opacityNode = texture.a)
//     opacityMultiplier  (multiplies the texture alpha when useTextureAlpha; e.g.
//                         0.85 to make the figure slightly translucent)
//     alphaTest          (discard fragments below this alpha threshold)
//     opacityU           (TSL uniform node — folded as multiplicative fade)
export function buildDisplacementMaterial(colorTex, depthTex, opts = {}) {
  const displacementScale = opts.displacementScale ?? 0.15
  const opacityMultiplier = opts.opacityMultiplier ?? 1.0
  const m = new MeshBasicNodeMaterial()
  const sampled = texture(colorTex)
  m.colorNode = sampled
  if (opts.useTextureAlpha) {
    m.transparent = true
    m.opacityNode = opacityMultiplier === 1.0
      ? sampled.a
      : sampled.a.mul(opacityMultiplier)
    if (opts.alphaTest !== undefined) m.alphaTest = opts.alphaTest
  }
  if (opts.opacityU) {
    m.transparent = true
    m.opacityNode = m.opacityNode ? m.opacityNode.mul(opts.opacityU) : opts.opacityU
  }
  const depthValue = texture(depthTex).r
  m.positionNode = positionLocal.add(
    vec3(0, 0, depthValue.mul(displacementScale)),
  )
  return m
}

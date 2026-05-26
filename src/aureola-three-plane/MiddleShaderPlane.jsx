import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicNodeMaterial } from 'three/webgpu'
import {
  cos,
  float,
  max,
  mix,
  saturate,
  sin,
  smoothstep,
  uv,
  vec2,
  vec3,
} from 'three/tsl'
import {
  BACK_CONSTANTS,
  middlePlaneAspectU,
  middleRotationU,
  setMiddlePlaneAspect,
  tiltMagU,
} from './runtime'

const SEGMENTS_W = 256
const SEGMENTS_H = 144

// Flower-of-life dimensions in aspect-corrected UV units. LATTICE_R is the
// circle radius AND the inter-center distance (so adjacent circles touch).
// Total lattice width = 4R ≈ 0.44, which fits the brief's "25% of frame width"
// when aspect-corrected to ~16:9.
const LATTICE_R = 0.111
const LINE_WIDTH = 0.005

// Hex-arranged circle centers around (0,0). sin(60°) ≈ 0.866025.
const FLOWER_CENTERS = [
  [0, 0],
  [LATTICE_R, 0],
  [LATTICE_R * 0.5, LATTICE_R * 0.866025],
  [-LATTICE_R * 0.5, LATTICE_R * 0.866025],
  [-LATTICE_R, 0],
  [-LATTICE_R * 0.5, -LATTICE_R * 0.866025],
  [LATTICE_R * 0.5, -LATTICE_R * 0.866025],
]

function buildMiddleMaterial(opacityU = null) {
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  m.blending = AdditiveBlending

  // Aspect-corrected centered coords so circles render visually round on a
  // non-square plane. y is unchanged; x scaled by plane aspect (16:9 here).
  const uvCentered = uv().sub(0.5)
  const uvc = vec2(uvCentered.x.mul(middlePlaneAspectU), uvCentered.y)

  // Rotate by accumulated rotation angle. cos/sin both read the same uniform
  // so the rotation is consistent each frame.
  const cosA = cos(middleRotationU)
  const sinA = sin(middleRotationU)
  const ur = vec2(
    uvc.x.mul(cosA).sub(uvc.y.mul(sinA)),
    uvc.x.mul(sinA).add(uvc.y.mul(cosA)),
  )

  // --- Flower of life (always visible) ---
  // Union of 7 thin rings via max(). Each ring = smoothstep falloff in a
  // narrow band around |d - R|.
  let lineAlpha = float(0)
  for (const [cx, cy] of FLOWER_CENTERS) {
    const d = ur.sub(vec2(cx, cy)).length()
    const onRing = smoothstep(LINE_WIDTH, 0, d.sub(LATTICE_R).abs())
    lineAlpha = max(lineAlpha, onRing)
  }

  // --- Alchemical ring (fades in at tilt > 10°) ---
  const distFromOrigin = ur.length()
  const alchemicalR = LATTICE_R * 2.5
  const alchemicalRing = smoothstep(LINE_WIDTH, 0, distFromOrigin.sub(alchemicalR).abs())
  const alchemicalFade = smoothstep(8, 12, tiltMagU)
  const alchemicalContribution = alchemicalRing.mul(alchemicalFade)

  // --- Zodiacal ring (fades in at tilt > 20°) ---
  const zodiacalR = LATTICE_R * 3.5
  const zodiacalRing = smoothstep(LINE_WIDTH, 0, distFromOrigin.sub(zodiacalR).abs())
  const zodiacalFade = smoothstep(18, 22, tiltMagU)
  const zodiacalContribution = zodiacalRing.mul(zodiacalFade)

  const totalAlpha = max(lineAlpha, max(alchemicalContribution, zodiacalContribution))

  // --- Color: warm gold #F5E6C8 → electric cyan #3FD5F0 with tilt ---
  const goldColor = vec3(0.961, 0.902, 0.784)
  const cyanColor = vec3(0.247, 0.835, 0.941)
  const colorMix = saturate(tiltMagU.div(30))
  const lineColor = mix(goldColor, cyanColor, colorMix)

  // 40% opacity baseline, pre-multiplied into colorNode for additive blend.
  // When `opacityU` is provided, multiply it in so the whole flower fades
  // in/out with the stage-driven uniform. opacityNode is ignored under
  // additive blending — fades must travel through colorNode.
  let contribution = lineColor.mul(0.40).mul(totalAlpha)
  if (opacityU) contribution = contribution.mul(opacityU)
  m.colorNode = contribution
  m.opacityNode = float(1)

  return m
}

// MiddleShaderPlane — procedural flower-of-life that rotates + blooms outer
// rings + shifts color in response to phone tilt. Per-frame:
//   tilt magnitude (deg) → tiltMagU uniform (drives ring fade + color mix)
//   rotation += dt × baseRate × (1 + tiltMag/15) → middleRotationU
//
// `baseRate` is the slider-driven base rotation rate (rad/s, default 0.05).
// `z` is the slider-driven world Z position (default 0; range -1 to +1).
export default function MiddleShaderPlane({ getTilt, baseRate, z, opacityU = null }) {
  const material = useMemo(() => buildMiddleMaterial(opacityU), [opacityU])
  useEffect(() => () => material.dispose(), [material])

  const { viewport } = useThree()
  const viewportAspect = viewport.width / viewport.height
  const baseScale = viewportAspect > BACK_CONSTANTS.IMAGE_ASPECT
    ? viewport.width / BACK_CONSTANTS.BASE_PLANE_W
    : viewport.height / BACK_CONSTANTS.BASE_PLANE_H
  const scale = baseScale * BACK_CONSTANTS.COVER_HEADROOM

  // The aspect uniform stays constant for this route (middle matches back).
  useEffect(() => {
    setMiddlePlaneAspect(BACK_CONSTANTS.IMAGE_ASPECT)
  }, [])

  useFrame((_, dt) => {
    const { gamma, beta } = getTilt()
    const tiltMag = Math.sqrt(gamma * gamma + beta * beta)
    tiltMagU.value = tiltMag
    // Brief: 1× base at 0 tilt, 3× base at ±30°. Linear → boost = 1 + clamped(tilt)/15.
    const boost = 1 + Math.min(tiltMag, 30) / 15
    middleRotationU.value += dt * baseRate * boost
  })

  return (
    <mesh scale={[scale, scale, 1]} position={[0, 0, z]}>
      <planeGeometry
        args={[BACK_CONSTANTS.BASE_PLANE_W, BACK_CONSTANTS.BASE_PLANE_H, SEGMENTS_W, SEGMENTS_H]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

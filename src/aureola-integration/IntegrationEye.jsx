import { useEffect, useMemo } from 'react'
import { AdditiveBlending, MeshBasicNodeMaterial } from 'three/webgpu'
import {
  texture,
  uv,
  vec2,
  vec3,
  mix,
  positionWorld,
  float,
} from 'three/tsl'
import {
  basePlaneHU,
  basePlaneWU,
  desatU,
  haloEnabledU,
  setBasePlaneSize,
} from './runtime'

// House 2 inner ring placement, hardcoded per the integration test brief.
const HOUSE_THETA_DEG = 60
const RING_R = 0.25
const RING_SCALE = 0.6
const RING_DEPTH = 0.15
const RING_OPACITY = 0.96
const Z_BASE_OFFSET = 0.50

// Eye's natural world size as fraction of half-diagonal. Multiplied by RING_SCALE
// for the actual rendered size at inner ring.
const EYE_NATURAL_SIZE_FRAC = 0.30

// Halo plane is slightly larger than the Eye so the soft glow spills past the
// silhouette. Sits behind in z so the Eye renders on top.
const HALO_PLANE_RATIO = 1.20
const HALO_Z_OFFSET_BEHIND = -0.02
const HALO_BASE_OPACITY = 0.40

function buildEyeMaterial(eyeTex) {
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false

  const sample = texture(eyeTex)
  // Luminance + desaturation. mix(a, b, t): t=0 → a; t=1 → b.
  // desatU=0 leaves rgb untouched; desatU=0.3 mixes 30% toward gray.
  const lum = sample.r.mul(0.299).add(sample.g.mul(0.587)).add(sample.b.mul(0.114))
  const grayed = vec3(lum, lum, lum)
  const rgb = mix(sample.rgb, grayed, desatU)

  m.colorNode = rgb
  m.opacityNode = sample.a.mul(RING_OPACITY)
  return m
}

function buildHaloMaterial(eyeTex, baseColorTex) {
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  m.blending = AdditiveBlending

  // Halo plane is HALO_PLANE_RATIO larger than the Eye plane. Remap halo UV
  // [0,1] → eye UV that shrinks toward 0.5; outside the central region we sample
  // past the Eye texture's edge → ClampToEdge gives transparent border alpha.
  const haloUv = uv()
  const eyeUv = haloUv.sub(0.5).div(HALO_PLANE_RATIO).add(0.5)

  // 5×5 Gaussian kernel on the Eye's alpha channel. The combination of wide
  // sampling extent + Gaussian falloff approximates the brief's "12 px dilate +
  // 24 px blur" in a single pass. STEP is in eye-UV units; sigma is in
  // step-units. Loop is unrolled at TSL build time — 25 multiplied-add nodes.
  const KERNEL_HALF = 2 // 5×5
  const STEP = 0.012
  const SIGMA = 2.4
  let totalAlpha = float(0)
  let totalWeight = 0
  for (let j = -KERNEL_HALF; j <= KERNEL_HALF; j += 1) {
    for (let i = -KERNEL_HALF; i <= KERNEL_HALF; i += 1) {
      const d2 = i * i + j * j
      const w = Math.exp(-d2 / (2 * SIGMA * SIGMA))
      const offset = vec2(i * STEP, j * STEP)
      const a = texture(eyeTex, eyeUv.add(offset)).a
      totalAlpha = totalAlpha.add(a.mul(w))
      totalWeight += w
    }
  }
  const blurredAlpha = totalAlpha.div(totalWeight)

  // Sample the base scene at the halo fragment's world XY position, projected
  // into the base plane's UV space. Base plane is centered at world origin; its
  // current scaled dimensions are passed in via the size uniforms.
  const baseUv = vec2(
    positionWorld.x.div(basePlaneWU).add(0.5),
    positionWorld.y.div(basePlaneHU).add(0.5),
  )
  const baseColor = texture(baseColorTex, baseUv).rgb

  // Pre-multiplied additive contribution: blend equation is dst + src.rgb, so
  // we encode (color × intensity × blurredAlpha × toggleA) directly into the
  // color node. opacityNode is held at 1 — additive mode ignores src.a for the
  // blend itself but `transparent: true` still requires a sensible alpha.
  const contribution = baseColor
    .mul(HALO_BASE_OPACITY)
    .mul(blurredAlpha)
    .mul(haloEnabledU)
  m.colorNode = contribution
  m.opacityNode = float(1)

  return m
}

// IntegrationEye — Eye plane (House 2 inner ring) + procedural light-wrap halo.
export default function IntegrationEye({
  eyeTex,
  baseColorTex,
  binduWorld,
  halfDiag,
  basePlaneW,
  basePlaneH,
}) {
  // Keep the basePlane-size uniforms in sync with current viewport-derived dims.
  useEffect(() => {
    setBasePlaneSize(basePlaneW, basePlaneH)
  }, [basePlaneW, basePlaneH])

  const eyeMat = useMemo(() => buildEyeMaterial(eyeTex), [eyeTex])
  const haloMat = useMemo(
    () => buildHaloMaterial(eyeTex, baseColorTex),
    [eyeTex, baseColorTex],
  )

  useEffect(() => () => {
    eyeMat.dispose()
    haloMat.dispose()
  }, [eyeMat, haloMat])

  // Polar → world. R3F Y+ is up, so the spec's image-coord cos negation flips.
  const thetaRad = (HOUSE_THETA_DEG * Math.PI) / 180
  const rUnits = RING_R * halfDiag
  const eyeX = binduWorld.x + rUnits * Math.sin(thetaRad)
  const eyeY = binduWorld.y + rUnits * Math.cos(thetaRad)
  const eyeZ = Z_BASE_OFFSET + RING_DEPTH
  const haloZ = eyeZ + HALO_Z_OFFSET_BEHIND

  // Rotation: spec's θ + 180° is clockwise; three.js +Z rotation is CCW, so negate.
  const rotZ = -((HOUSE_THETA_DEG + 180) * Math.PI) / 180

  const eyeSize = EYE_NATURAL_SIZE_FRAC * halfDiag * RING_SCALE
  const haloSize = eyeSize * HALO_PLANE_RATIO

  return (
    <>
      <mesh position={[eyeX, eyeY, haloZ]} rotation={[0, 0, rotZ]}>
        <planeGeometry args={[haloSize, haloSize]} />
        <primitive object={haloMat} attach="material" />
      </mesh>
      <mesh position={[eyeX, eyeY, eyeZ]} rotation={[0, 0, rotZ]}>
        <planeGeometry args={[eyeSize, eyeSize]} />
        <primitive object={eyeMat} attach="material" />
      </mesh>
    </>
  )
}

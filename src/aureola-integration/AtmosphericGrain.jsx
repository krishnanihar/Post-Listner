import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { AdditiveBlending, MeshBasicNodeMaterial } from 'three/webgpu'
import { float, rand, screenUV, time, vec2, vec3 } from 'three/tsl'
import { GRAIN_OPACITY, grainEnabledU } from './runtime'

// Position in front of all base/eye content, slightly back from the near plane
// to avoid clipping when the camera translates with tilt. Plane is sized to the
// viewport at this distance so it always covers the frame.
const PLANE_Z = 1.5
const CAM_Z = 2.2 // must match IntegrationScene's camera.position.z

function buildGrainMaterial() {
  const m = new MeshBasicNodeMaterial()
  m.transparent = true
  m.depthWrite = false
  m.depthTest = false
  m.blending = AdditiveBlending

  // High-frequency animated grain. screenUV gives [0,1] in screen space;
  // scaling by a non-period multiplier breaks any visible repetition,
  // and time animates it for the film-like crawl.
  const noiseInput = vec2(
    screenUV.x.mul(1920),
    screenUV.y.mul(1080).add(time.mul(60)),
  )
  const noise = rand(noiseInput)
  const centered = noise.sub(0.5).mul(2.0) // [-1, 1]
  const grain = centered.mul(GRAIN_OPACITY).mul(grainEnabledU)

  m.colorNode = vec3(grain, grain, grain)
  m.opacityNode = float(1)
  return m
}

// AtmosphericGrain — full-canvas film-grain overlay. Approximates screen blend
// with AdditiveBlending at this low opacity (3-5%) — visual difference vs true
// screen is sub-perceptible. Renders last (depthTest off, renderOrder high) so
// it sits on top of the base + Eye composite.
export default function AtmosphericGrain() {
  const { viewport } = useThree()
  const material = useMemo(() => buildGrainMaterial(), [])
  useEffect(() => () => material.dispose(), [material])

  // Size the plane to cover the viewport at PLANE_Z. viewport.width/height are
  // world units at the camera focal distance (default = z=0 plane); scale
  // linearly by the distance ratio to PLANE_Z, plus a small headroom.
  const sizeFactor = ((CAM_Z - PLANE_Z) / CAM_Z) * 1.1
  const planeW = viewport.width * sizeFactor
  const planeH = viewport.height * sizeFactor

  return (
    <mesh position={[0, 0, PLANE_Z]} renderOrder={1000}>
      <planeGeometry args={[planeW, planeH]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

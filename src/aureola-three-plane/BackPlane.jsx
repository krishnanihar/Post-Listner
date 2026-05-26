import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { BACK_CONSTANTS, PLANE_Z, buildDisplacementMaterial } from './runtime'

const SEGMENTS_W = 256
const SEGMENTS_H = 144
// 0.15 → 0.35 read too dramatic (visible mesh distortion at depth edges).
// Settled on 0.22 — clearly more dimensional than 0.15 but without the
// distortion artifacts. Back foreground peaks at z=-0.28, plenty of
// clearance from the middle plane at z=0.
const DISPLACEMENT_SCALE = 0.22

// BackPlane — cosmic periphery at z = -0.5, depth-displaced.
// `depthOn` is a debug toggle: when false, displacementScale collapses to 0 so
// the back reads as a flat sheet (useful for isolating what depth contributes).
// `opacityU` — optional TSL `uniform()` node. When provided, the plane fades
// in/out with `opacityU.value` 0..1 (used by AdmirerScene3D for stage gating).
export default function BackPlane({ colorTex, depthTex, depthOn = true, opacityU = null }) {
  const material = useMemo(
    () => buildDisplacementMaterial(colorTex, depthTex, {
      displacementScale: depthOn ? DISPLACEMENT_SCALE : 0,
      opacityU,
    }),
    [colorTex, depthTex, depthOn, opacityU],
  )

  useEffect(() => () => material.dispose(), [material])

  const { viewport } = useThree()
  const viewportAspect = viewport.width / viewport.height
  const baseScale = viewportAspect > BACK_CONSTANTS.IMAGE_ASPECT
    ? viewport.width / BACK_CONSTANTS.BASE_PLANE_W
    : viewport.height / BACK_CONSTANTS.BASE_PLANE_H
  const scale = baseScale * BACK_CONSTANTS.COVER_HEADROOM

  return (
    <mesh scale={[scale, scale, 1]} position={[0, 0, PLANE_Z.BACK]}>
      <planeGeometry
        args={[BACK_CONSTANTS.BASE_PLANE_W, BACK_CONSTANTS.BASE_PLANE_H, SEGMENTS_W, SEGMENTS_H]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

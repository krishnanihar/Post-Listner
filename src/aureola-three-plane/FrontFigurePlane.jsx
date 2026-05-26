import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import {
  BACK_CONSTANTS,
  FRONT_CONSTANTS,
  PLANE_Z,
  buildDisplacementMaterial,
} from './runtime'

const SEGMENTS_W = 256
const SEGMENTS_H = 144
// 0.08 → 0.22 read distorted on the figure silhouette (the depth-edge stretch
// was visible). Settled on 0.14 — figure has clear internal volume without
// the silhouette artifact.
const DISPLACEMENT_SCALE = 0.14
const ALPHA_TEST = 0.1
// Slight translucency so the figure feels integrated with the field behind
// it rather than stamped on top.
const FIGURE_OPACITY = 0.85

// Front plane scaled DOWN to 75% of back's height — figure feels smaller and
// less dominating, with more cosmic periphery breathing around it. Width still
// derives from front's own 3:2 aspect.
const FRONT_HEIGHT_OF_BACK = 0.75
const FRONT_BASE_PLANE_H = BACK_CONSTANTS.BASE_PLANE_H * FRONT_HEIGHT_OF_BACK
const FRONT_BASE_PLANE_W = FRONT_BASE_PLANE_H * FRONT_CONSTANTS.IMAGE_ASPECT

// `opacityU` — optional TSL `uniform()` node. When provided, the figure
// fades in/out with `opacityU.value` 0..1, ON TOP of the per-fragment
// alpha (so the silhouette is preserved while the whole figure fades).
export default function FrontFigurePlane({ colorTex, depthTex, opacityU = null }) {
  const material = useMemo(
    () => buildDisplacementMaterial(colorTex, depthTex, {
      displacementScale: DISPLACEMENT_SCALE,
      useTextureAlpha: true,
      alphaTest: ALPHA_TEST,
      opacityMultiplier: FIGURE_OPACITY,
      opacityU,
    }),
    [colorTex, depthTex, opacityU],
  )

  useEffect(() => () => material.dispose(), [material])

  const { viewport } = useThree()
  const viewportAspect = viewport.width / viewport.height
  const baseScale = viewportAspect > BACK_CONSTANTS.IMAGE_ASPECT
    ? viewport.width / BACK_CONSTANTS.BASE_PLANE_W
    : viewport.height / BACK_CONSTANTS.BASE_PLANE_H
  const scale = baseScale * BACK_CONSTANTS.COVER_HEADROOM

  return (
    <mesh scale={[scale, scale, 1]} position={[0, 0, PLANE_Z.FRONT]}>
      <planeGeometry
        args={[FRONT_BASE_PLANE_W, FRONT_BASE_PLANE_H, SEGMENTS_W, SEGMENTS_H]}
      />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

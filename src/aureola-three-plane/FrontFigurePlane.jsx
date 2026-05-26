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
const DISPLACEMENT_SCALE = 0.08
const ALPHA_TEST = 0.1

// Front plane uses the back plane's HEIGHT for scaling — figure stands at the
// back's vertical extent. Front width comes from its own aspect (3:2 instead
// of 16:9), so the figure is narrower than the back and the cosmic periphery
// shows past it on left/right.
const FRONT_BASE_PLANE_H = BACK_CONSTANTS.BASE_PLANE_H
const FRONT_BASE_PLANE_W = FRONT_BASE_PLANE_H * FRONT_CONSTANTS.IMAGE_ASPECT

export default function FrontFigurePlane({ colorTex, depthTex }) {
  const material = useMemo(
    () => buildDisplacementMaterial(colorTex, depthTex, {
      displacementScale: DISPLACEMENT_SCALE,
      useTextureAlpha: true,
      alphaTest: ALPHA_TEST,
    }),
    [colorTex, depthTex],
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

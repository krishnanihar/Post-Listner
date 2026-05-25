import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { texture, vec3, positionLocal } from 'three/tsl'
import { INTEGRATION_BASE_CONSTANTS } from './runtime'

const PLANE_SEGMENTS = 256
const TILT_RANGE = 0.3

const {
  IMAGE_ASPECT,
  BASE_PLANE_W,
  BASE_PLANE_H,
  COVER_HEADROOM,
  DEPTH_STRENGTH,
} = INTEGRATION_BASE_CONSTANTS

// IntegrationBase — base scene plane with TSL depth-displacement, parameterized
// to receive textures from the parent. Duplicates the shader pattern from
// bestiary/Workbench so /aureola-test and /bestiary-test stay 100% untouched;
// this is the integration-test's own copy. No screen-space vignette — the test
// isolates whether halo + grain + saturation alone solves the sticker problem.
export default function IntegrationBase({ colorTex, depthTex, getTilt }) {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    const depthValue = texture(depthTex).r
    m.colorNode = texture(colorTex)
    m.positionNode = positionLocal.add(vec3(0, 0, depthValue.mul(DEPTH_STRENGTH)))
    return m
  }, [colorTex, depthTex])

  useEffect(() => () => material.dispose(), [material])

  const { viewport } = useThree()
  const viewportAspect = viewport.width / viewport.height
  const baseScale = viewportAspect > IMAGE_ASPECT
    ? viewport.width / BASE_PLANE_W
    : viewport.height / BASE_PLANE_H
  const scale = baseScale * COVER_HEADROOM

  useFrame(({ camera }, dt) => {
    const { x, y } = getTilt()
    const targetX = x * TILT_RANGE
    const targetY = y * TILT_RANGE
    const k = Math.min(1, dt * 6)
    camera.position.x += (targetX - camera.position.x) * k
    camera.position.y += (targetY - camera.position.y) * k
    camera.lookAt(0, 0, 0)
  })

  return (
    <mesh scale={[scale, scale, 1]}>
      <planeGeometry args={[BASE_PLANE_W, BASE_PLANE_H, PLANE_SEGMENTS, PLANE_SEGMENTS]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

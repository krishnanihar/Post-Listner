import { useEffect, useMemo } from 'react'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import {
  AUREOLA_V3,
  ARCHETYPE_COLORS,
  ARCHETYPE_DEPTH,
  WORLD_RENDER,
} from './config'
import { polarToWorld } from './engine'

// AureolaObject — a placeholder colored circle for one placed archetype.
// Sprint 1: no PNG asset, no halo, no entry animation. The whole point is to
// see whether the placement engine puts the right colors in the right houses.
//
// Position derives from the spec's polar formula (§5.1) anchored at the bindu.
// z is offset forward of the base scene's deepest displacement (DEPTH_STRENGTH
// = 0.4 in bestiary/Workbench) so the circle always floats in front of the
// figure, never behind.
export default function AureolaObject({ placement, binduWorld, halfDiag }) {
  const arch = AUREOLA_V3.archetypes[placement.archetype]
  const ring = AUREOLA_V3.rings[placement.ring]

  const { x, y } = polarToWorld(placement.theta, placement.r, binduWorld, halfDiag)
  const z = WORLD_RENDER.zBaseOffset
    + ring.depth
    + (ARCHETYPE_DEPTH[placement.archetype] ?? 0)

  const radius = WORLD_RENDER.objectRadiusFraction * halfDiag * ring.scale

  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.color.set(ARCHETYPE_COLORS[arch.color] ?? '#888888')
    m.transparent = true
    m.opacity = ring.opacity
    m.depthWrite = false
    return m
  }, [arch.color, ring.opacity])

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh position={[x, y, z]}>
      <circleGeometry args={[radius, 48]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

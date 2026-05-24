import { useEffect, useMemo } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicNodeMaterial,
  LineSegments,
  QuadraticBezierCurve3,
  Vector3,
} from 'three/webgpu'
import {
  AUREOLA_V3,
  ARCHETYPE_COLORS,
  ARCHETYPE_DEPTH,
  WORLD_RENDER,
} from './config'
import { polarToWorld } from './engine'

// Constellation — Bezier threading between consecutive summons per §10.3.
// One QuadraticBezierCurve3 per pair (P_i, P_{i+1}); control point is the
// midpoint pulled toward the bindu by `bezierControlPullToBindu`. All curves
// are concatenated into a single LineSegments object for fewer draw calls.

function placementWorldPos(placement, binduWorld, halfDiag) {
  const { x, y } = polarToWorld(placement.theta, placement.r, binduWorld, halfDiag)
  const ring = AUREOLA_V3.rings[placement.ring]
  const z = WORLD_RENDER.zBaseOffset
    + ring.depth
    + (ARCHETYPE_DEPTH[placement.archetype] ?? 0)
  return { x, y, z }
}

export default function Constellation({ placements, binduWorld, halfDiag }) {
  const lineObject = useMemo(() => {
    if (placements.length < 2) return null

    const positions = []
    for (let i = 0; i < placements.length - 1; i += 1) {
      const a = placementWorldPos(placements[i], binduWorld, halfDiag)
      const b = placementWorldPos(placements[i + 1], binduWorld, halfDiag)
      const mid = {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: (a.z + b.z) / 2,
      }
      const pull = AUREOLA_V3.constellation.bezierControlPullToBindu
      const control = {
        x: mid.x + (binduWorld.x - mid.x) * pull,
        y: mid.y + (binduWorld.y - mid.y) * pull,
        z: mid.z + (binduWorld.z - mid.z) * pull,
      }
      const curve = new QuadraticBezierCurve3(
        new Vector3(a.x, a.y, a.z),
        new Vector3(control.x, control.y, control.z),
        new Vector3(b.x, b.y, b.z),
      )
      const pts = curve.getPoints(WORLD_RENDER.bezierSegments)
      // Emit each adjacent pair as a separate LineSegments segment so curves
      // don't get connected end-to-end (which a single THREE.Line would do).
      for (let j = 0; j < pts.length - 1; j += 1) {
        positions.push(pts[j].x, pts[j].y, pts[j].z)
        positions.push(pts[j + 1].x, pts[j + 1].y, pts[j + 1].z)
      }
    }

    const geom = new BufferGeometry()
    geom.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(positions), 3),
    )

    const mat = new LineBasicNodeMaterial()
    mat.color.set(ARCHETYPE_COLORS.gold)
    mat.transparent = true
    mat.opacity = AUREOLA_V3.constellation.opacity
    mat.depthWrite = false

    return new LineSegments(geom, mat)
  }, [placements, binduWorld, halfDiag])

  useEffect(() => () => {
    if (lineObject) {
      lineObject.geometry.dispose()
      lineObject.material.dispose()
    }
  }, [lineObject])

  if (!lineObject) return null
  return <primitive object={lineObject} />
}

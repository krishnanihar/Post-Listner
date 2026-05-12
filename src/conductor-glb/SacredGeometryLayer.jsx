/* Sacred geometry background layer for /conduct-glb.
 *
 * Renders Metatron's Cube from /public/conductor/sacred-metatron.glb in a
 * transparent R3F canvas behind the celestial field. The cube slowly
 * auto-rotates so the structure feels alive without the user doing
 * anything. Edges + nodes are styled in soft amber so they sit gently
 * against the parchment without competing with the ink trail.
 *
 * Task 2: Trail-passage edge lighting.
 *   - All edges extracted from the GLB (LineSegments + EdgesGeometry from
 *     meshes) are merged into a single <lineSegments> with vertexColors.
 *   - Each frame, every edge is projected to screen-pixel space and tested
 *     for proximity to the ink trail tip (written by ConductorCelestialField
 *     into trailTipRef). Edges within 18 px get activation bumped to 1.0
 *     and decay linearly back to the soft-amber rest color.
 *
 * Later tasks add:
 *   - Stem-reactive node pulses (Task 5)
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { pointToSegmentDistance } from './edgeMath.js'
import { usePhone } from './ConductGlb'

const GEOMETRY_URL = '/conductor/sacred-metatron.glb'
useGLTF.preload(GEOMETRY_URL)

const EDGE_HIT_PX = 18         // proximity in screen pixels to count as a "cross"
const EDGE_DECAY_PER_S = 1.5   // activation decays at this rate per second
// Rest color sits very close to the parchment tone so the geometry
// reads as a faint structural watermark, not a foreground element.
// Active color stays bright gold so trail-passage lighting reads
// against the quiet rest state.
const COLOR_REST = new THREE.Color('#4a3a20')
const COLOR_ACTIVE = new THREE.Color('#FFD888')

function StemNode({ position, pulseRef, stemIndex }) {
  const meshRef = useRef()
  const matRef = useRef()
  useFrame(() => {
    const p = pulseRef.current[stemIndex] || 0
    if (meshRef.current) {
      const s = 0.04 + p * 0.10
      meshRef.current.scale.set(s, s, s)
    }
    if (matRef.current) {
      // At rest the node is nearly invisible — only the stem pulse
      // brings it forward. Keeps the background quiet by default.
      matRef.current.opacity = 0.10 + p * 0.65
    }
  })
  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[1, 12, 8]} />
      <meshBasicMaterial ref={matRef} color="#FFD888" transparent opacity={0.10} />
    </mesh>
  )
}

function MetatronCube({ trailTipRef }) {
  const groupRef = useRef()
  const linesRef = useRef()
  const colorAttrRef = useRef()
  const activationsRef = useRef([])
  const segmentsRef = useRef([])
  const stemNodesRef = useRef([])
  const [stemNodes, setStemNodes] = useState([])

  const { stateRef } = usePhone()
  const stemPulseRef = useRef([0, 0, 0, 0])
  const lastDownbeatSeenRef = useRef(0)

  const { scene } = useGLTF(GEOMETRY_URL)
  const { camera, size } = useThree()

  // Build a single LineSegments out of all edges in the GLB.
  const lineGeometry = useMemo(() => {
    const positions = []
    scene.traverse((obj) => {
      if (obj.isLineSegments) {
        const arr = obj.geometry.attributes.position.array
        for (let i = 0; i < arr.length; i++) positions.push(arr[i])
      } else if (obj.isMesh && obj.geometry) {
        // Threshold 45° keeps only sharp/outer edges; 15° included every
        // internal face of the Metatron's Cube model and made the
        // background read as a chaotic wireframe cage.
        const eg = new THREE.EdgesGeometry(obj.geometry, 45)
        const arr = eg.attributes.position.array
        for (let i = 0; i < arr.length; i++) positions.push(arr[i])
      }
    })
    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    const colors = new Float32Array((positions.length / 3) * 3)
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return geom
  }, [scene])

  // Cache segment endpoints + initialize per-edge activation array.
  useEffect(() => {
    const pos = lineGeometry.attributes.position.array
    const segments = []
    for (let i = 0; i < pos.length; i += 6) {
      segments.push([
        new THREE.Vector3(pos[i], pos[i + 1], pos[i + 2]),
        new THREE.Vector3(pos[i + 3], pos[i + 4], pos[i + 5]),
      ])
    }
    segmentsRef.current = segments
    activationsRef.current = new Array(segments.length).fill(0)
    const colorAttr = lineGeometry.attributes.color
    for (let i = 0; i < colorAttr.count; i++) {
      colorAttr.setXYZ(i, COLOR_REST.r, COLOR_REST.g, COLOR_REST.b)
    }
    colorAttr.needsUpdate = true
    colorAttrRef.current = colorAttr
  }, [lineGeometry])

  // Pick 4 prominent vertices — farthest from origin in XY — for stem nodes.
  useEffect(() => {
    const segs = segmentsRef.current
    if (!segs.length) return
    const uniq = new Map()
    const key = (v) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`
    for (const [a, b] of segs) {
      uniq.set(key(a), a)
      uniq.set(key(b), b)
    }
    const verts = [...uniq.values()]
    verts.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))
    const picked = verts.slice(0, 4).map((v) => v.clone())
    stemNodesRef.current = picked
    setStemNodes(picked)
  }, [lineGeometry])

  const tmpA = useMemo(() => new THREE.Vector3(), [])
  const tmpB = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    // Geometry is intentionally STATIC — it lives as a quiet structural
    // backdrop in the parchment, like the dust particles. Per-edge
    // trail-passage lighting + stem-node pulses still animate; only the
    // overall rotation is removed.

    const segs = segmentsRef.current
    const acts = activationsRef.current
    const colorAttr = colorAttrRef.current
    if (!segs.length || !colorAttr) return

    const tip = trailTipRef?.current
    const hasTip = !!tip && tip.active

    const w = size.width
    const h = size.height
    groupRef.current.updateMatrixWorld()
    const groupMatrix = groupRef.current.matrixWorld

    for (let i = 0; i < segs.length; i++) {
      tmpA.copy(segs[i][0]).applyMatrix4(groupMatrix).project(camera)
      tmpB.copy(segs[i][1]).applyMatrix4(groupMatrix).project(camera)
      const ax = (tmpA.x + 1) / 2 * w
      const ay = (1 - tmpA.y) / 2 * h
      const bx = (tmpB.x + 1) / 2 * w
      const by = (1 - tmpB.y) / 2 * h

      if (hasTip) {
        const d = pointToSegmentDistance(tip.x, tip.y, ax, ay, bx, by)
        if (d < EDGE_HIT_PX) {
          acts[i] = 1
        }
      }
      acts[i] = Math.max(0, acts[i] - delta * EDGE_DECAY_PER_S)

      const c = acts[i]
      const r = COLOR_REST.r + (COLOR_ACTIVE.r - COLOR_REST.r) * c
      const g = COLOR_REST.g + (COLOR_ACTIVE.g - COLOR_REST.g) * c
      const b = COLOR_REST.b + (COLOR_ACTIVE.b - COLOR_REST.b) * c
      const vi = i * 2
      colorAttr.setXYZ(vi, r, g, b)
      colorAttr.setXYZ(vi + 1, r, g, b)
    }
    colorAttr.needsUpdate = true

    // Stem pulse update — simulate the 4 stems from phone signals until
    // the Orchestra phase wires real AnalyserNode reads. Each pulse value
    // is a smoothed 0..1; the nodes render as small spheres scaled by pulse.
    const state = stateRef.current
    const ctrl = state.controls
    const calibrated = state.calibrated
    const pulses = stemPulseRef.current

    // vocals ← articulation
    const tgtVocals = calibrated ? (ctrl.articulation || 0) : 0
    pulses[0] += (tgtVocals - pulses[0]) * 0.20
    // drums ← downbeat one-shot decay
    const beatAt = ctrl.lastDownbeatAt || 0
    if (beatAt && beatAt !== lastDownbeatSeenRef.current) {
      lastDownbeatSeenRef.current = beatAt
      pulses[1] = Math.min(1, pulses[1] + (ctrl.downbeatIntensity || 0.8))
    }
    pulses[1] = Math.max(0, pulses[1] - delta * 2.5)
    // bass ← energy
    const tgtBass = calibrated ? (ctrl.energy || 0) : 0
    pulses[2] += (tgtBass - pulses[2]) * 0.15
    // other ← angularSpeed
    const tgtOther = calibrated ? (ctrl.angularSpeed || 0) : 0
    pulses[3] += (tgtOther - pulses[3]) * 0.20
  })

  return (
    <group ref={groupRef}>
      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial vertexColors transparent opacity={0.28} />
      </lineSegments>
      {stemNodes.map((v, i) => (
        <StemNode key={i} position={v} pulseRef={stemPulseRef} stemIndex={i} />
      ))}
    </group>
  )
}

export default function SacredGeometryLayer({ trailTipRef }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 38, near: 0.1, far: 20 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.6} color="#FFE2B0" />
        <directionalLight position={[2, 3, 2]} intensity={0.4} color="#FFD494" />
        <Suspense fallback={null}>
          <MetatronCube trailTipRef={trailTipRef} />
        </Suspense>
      </Canvas>
    </div>
  )
}

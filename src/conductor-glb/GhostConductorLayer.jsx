/* Ghost conductor figure for /conduct-glb.
 *
 * Loads the existing conductor.glb and renders it at very low opacity
 * (~12%) so the parchment cosmos shows through. Subtle ambient motion
 * only — a 4 s breath cycle and a slow head-yaw response to the phone's
 * compass signal. No baton, no gesture mirroring; the figure is a
 * "frame" around the conducting experience, not the protagonist.
 *
 * Camera framing matches the original GLB scene (back view, above-waist
 * portrait) so the figure registers immediately as the conductor.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePhone } from './ConductGlb'

const FIGURE_URL = '/conductor/conductor.glb'
useGLTF.preload(FIGURE_URL)

const GHOST_OPACITY = 0.06             // per-mesh; composites higher due to layered meshes
const BREATH_PERIOD_S = 4.0
const BREATH_AMPLITUDE = 0.015         // ±1.5 % of group Y scale
const HEAD_YAW_MAX_DEG = 5             // ±5° of head yaw with phone yaw

function bakeClipToScene(scene, clip) {
  if (!clip) return false
  const mixer = new THREE.AnimationMixer(scene)
  const action = mixer.clipAction(clip)
  action.play()
  mixer.update(0)
  mixer.update(clip.duration)
  return true
}

function GhostFigure() {
  const groupRef = useRef()
  const headBoneRef = useRef(null)
  const baseHeadQuat = useRef(null)
  const { scene, animations } = useGLTF(FIGURE_URL)
  const { stateRef } = usePhone()
  const elapsedRef = useRef(0)

  useEffect(() => {
    // Replace every mesh material with a transparent dark material at the
    // ghost opacity. Skinning still works because we're using a built-in
    // material; three.js generates the standard skinning vertex chain.
    scene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const mat = new THREE.MeshBasicMaterial({
          color: 0x1c1814,
          transparent: true,
          opacity: GHOST_OPACITY,
          depthWrite: false,
        })
        obj.material = mat
        obj.frustumCulled = false
      }
    })

    bakeClipToScene(scene, animations?.[0])

    // Find the head bone for yaw tilt. Sanitized GLTF names strip dots.
    const headName = THREE.PropertyBinding.sanitizeNodeName('DEF-spine.006')
    scene.traverse((o) => {
      if (!headBoneRef.current && o.isBone &&
          (o.name === headName || o.name === 'DEF-spine.006')) {
        headBoneRef.current = o
        baseHeadQuat.current = o.quaternion.clone()
      }
    })
  }, [scene, animations])

  const dq = useMemo(() => new THREE.Quaternion(), [])
  const axisY = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = elapsedRef.current

    // Breath: scale group Y by a small sinusoidal modulation.
    // The 180° Y rotation keeps the back of the head facing the camera —
    // otherwise the GLB's default pose faces +Z and the camera at +Z
    // would render the face, which reads as a horror-movie ghost.
    if (groupRef.current) {
      const breath = 1 + Math.sin(t * (2 * Math.PI / BREATH_PERIOD_S)) * BREATH_AMPLITUDE
      groupRef.current.scale.set(1, breath, 1)
      groupRef.current.rotation.y = Math.PI
    }

    // Head yaw: subtle response to phone yaw (compass alpha delta).
    const head = headBoneRef.current
    const baseQ = baseHeadQuat.current
    if (head && baseQ) {
      const state = stateRef.current
      const calibrated = state.calibrated
      const yaw = calibrated ? (state.controls.yaw || 0) : 0
      const angle = yaw * HEAD_YAW_MAX_DEG * Math.PI / 180
      dq.setFromAxisAngle(axisY, angle)
      head.quaternion.copy(baseQ).multiply(dq)
    }
  })

  return <primitive ref={groupRef} object={scene} />
}

export default function GhostConductorLayer() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      <Canvas
        camera={{ position: [0, 1.55, 1.5], fov: 38, near: 0.1, far: 32 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ camera }) => { camera.lookAt(0, 1.55, 0) }}
      >
        <ambientLight intensity={0.9} color="#FFF5E0" />
        <directionalLight position={[2.4, 5.5, 3.8]} intensity={0.55} color="#FFF0D2" />
        <Suspense fallback={null}>
          <GhostFigure />
        </Suspense>
      </Canvas>
    </div>
  )
}

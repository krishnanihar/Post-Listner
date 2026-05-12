/* The R3F scene for /conduct-glb. Loads conductor.glb, applies the
 * starfield shader to its skinned mesh, drives the bones via the same
 * pipeline that powers /conduct (resetToBase → idle → gesture → IK →
 * impulse), rotates the model 180° so we see the figure from behind,
 * and parents headphone + hair-tuft accessory meshes to the head bone
 * so they track head yaw / pitch automatically.
 */
import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePhone } from './ConductGlb'
import {
  applyGesturePose,
  applyImpulsePose,
  captureBaseRotations,
  findDrivenBones,
  resetToBase,
} from '../conductor/gesturePose'
import { applyIdlePose } from '../conductor/idlePose'
import { setupArmIK, driveArmIK } from '../conductor/armIK'
import { ANATOMICAL } from '../conductor/conductorAnatomy'
import {
  applyStarfieldShader,
  createStarfieldMaterial,
} from '../conductor-codex/starfieldMaterial'

const PAPER = '#F2EBD8'
const INK = '#1C1814'

// One-shot bake of the GLB's first animation (the conducting pose) into
// the bone rest state, then drop the mixer. Same trick /conduct uses.
function bakeClipToScene(scene, clip) {
  if (!clip) return false
  const mixer = new THREE.AnimationMixer(scene)
  const action = mixer.clipAction(clip)
  action.play()
  mixer.update(0)
  mixer.update(clip.duration)
  return true
}

useGLTF.preload('/conductor/conductor.glb')

function HeadAccessories({ headBoneRef, material }) {
  // Sync this group's world transform from the head bone each frame.
  // Rendered as a sibling of the GLB scene (not a child of the rotated
  // outer group), so setting position+quaternion from headBone.matrixWorld
  // places it directly in scene world coords — no double-transform.
  const groupRef = useRef()

  useFrame(() => {
    const head = headBoneRef.current
    if (!groupRef.current || !head) return
    head.updateMatrixWorld()
    head.matrixWorld.decompose(
      groupRef.current.position,
      groupRef.current.quaternion,
      groupRef.current.scale,
    )
  })

  // The DEF-spine.006 head bone in Rigify has its own local axes after
  // the baked conducting pose — we'll iterate if accessories look mis-
  // placed. Initial guesses assume Y is roughly up along the skull and
  // the back of the head is on +Z (away from the figure's facing dir).
  return (
    <group ref={groupRef}>
      {/* Hair tuft on the back/top of the skull. */}
      <mesh castShadow material={material} position={[0, 0.10, -0.04]} scale={[1.0, 0.6, 1.1]}>
        <sphereGeometry args={[0.075, 18, 10]} />
      </mesh>
      {/* Headphone band — half-torus arcing from one ear over the crown. */}
      <mesh castShadow position={[0, 0.05, 0]}>
        <torusGeometry args={[0.10, 0.008, 8, 24, Math.PI]} />
        <meshStandardMaterial color={INK} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* Earpieces — short cylinders flanking the head. */}
      <mesh castShadow position={[0.10, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.032, 0.035, 18]} />
        <meshStandardMaterial color={INK} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[-0.10, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.032, 0.035, 0.035, 18]} />
        <meshStandardMaterial color={INK} roughness={0.7} />
      </mesh>
    </group>
  )
}

function Conductor({ accessoryMat }) {
  const groupRef = useRef()
  const { scene, animations } = useGLTF('/conductor/conductor.glb')
  const phone = usePhone()

  const drivenBones = useRef({})
  const baseRotations = useRef({})
  const elapsedRef = useRef(0)
  const impulseRef = useRef(null)
  const lastImpulseAt = useRef(0)
  const armIKRef = useRef(null)
  const headBoneRef = useRef(null)

  useEffect(() => {
    // Replace every mesh's material with a fresh MeshBasicMaterial
    // patched with the starfield fragment via onBeforeCompile. Using a
    // built-in material as the base means three.js generates the
    // standard skinning-aware vertex shader chain — bone rotations
    // actually deform the mesh. (A plain ShaderMaterial wouldn't,
    // which is why the previous attempt rendered T-pose regardless of
    // gestures.)
    scene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const mat = new THREE.MeshBasicMaterial()
        applyStarfieldShader(mat)
        obj.material = mat
        obj.frustumCulled = false
      }
    })

    const baked = bakeClipToScene(scene, animations?.[0])
    const bones = findDrivenBones(scene)
    drivenBones.current = bones
    baseRotations.current = captureBaseRotations(bones)
    headBoneRef.current = bones.head ?? null
    armIKRef.current = setupArmIK(scene)

    if (typeof window !== 'undefined') {
      // eslint-disable-next-line no-console
      console.log(`[conduct-glb] baked=${baked}; driven bones:`,
        Object.fromEntries(Object.entries(bones).map(([k, b]) => [k, b.name])))
      // eslint-disable-next-line no-console
      console.log(`[conduct-glb] arm IK ready: ${!!armIKRef.current}`)
    }
  }, [scene, animations])

  useFrame((_, delta) => {
    phone.advance(delta)
    elapsedRef.current += delta
    const t = elapsedRef.current

    const bones = drivenBones.current
    const base = baseRotations.current

    resetToBase(bones, base)
    applyIdlePose(bones, t)

    if (phone.calibrated) {
      applyGesturePose(bones, base, phone.currentQuat.current)
    }

    scene.updateMatrixWorld(true)
    const armPhoneQuat = phone.calibrated
      ? phone.currentQuat.current
      : new THREE.Quaternion()
    driveArmIK(armIKRef.current, armPhoneQuat)

    const beat = phone.lastDownbeat?.current
    if (beat && beat.firedAt && beat.firedAt !== lastImpulseAt.current) {
      lastImpulseAt.current = beat.firedAt
      impulseRef.current = { startedAt: t, intensity: beat.intensity || 1 }
    }
    if (impulseRef.current) {
      const stillActive = applyImpulsePose(bones, impulseRef.current, t)
      const elapsedMs = (t - impulseRef.current.startedAt) * 1000
      if (!stillActive || elapsedMs > ANATOMICAL.IMPULSE_ATTACK_MS + ANATOMICAL.IMPULSE_DECAY_MS) {
        impulseRef.current = null
      }
    }
  })

  // The /conduct route already shows the figure from behind (we verified
  // this earlier: rightShoulder at scene +X, camera at +Z → back view).
  // So no extra Y rotation needed here. HeadAccessories is rendered as
  // a sibling (not nested inside the figure) so its useFrame can set
  // world transform from the head bone directly, without inheriting
  // any outer-group transforms.
  return (
    <>
      <primitive ref={groupRef} object={scene} />
      <HeadAccessories headBoneRef={headBoneRef} material={accessoryMat} />
    </>
  )
}

export default function ConductorGlbScene() {
  // Shared starfield material for the accessory meshes (hair tuft etc.)
  // The GLB's own meshes get fresh skinning-aware materials patched via
  // applyStarfieldShader inside Conductor's useEffect — those have to be
  // per-mesh because each gets onBeforeCompile'd separately.
  const accessoryMat = useMemo(() => createStarfieldMaterial(), [])
  useEffect(() => () => accessoryMat.dispose(), [accessoryMat])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      // Close-in framing: figure fills most of the frame, lookAt sits at
      // chest height so the legs naturally crop off the bottom edge —
      // "above the waist" composition like a portrait. Tight enough that
      // the figure occupies most of the screen height.
      camera={{ position: [0, 1.55, 1.5], fov: 38, near: 0.1, far: 32 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ camera }) => {
        camera.lookAt(0, 1.55, 0)
      }}
    >
      <fog attach="fog" args={[PAPER, 5.5, 11]} />
      <ambientLight intensity={0.9} color="#FFF5E0" />
      <directionalLight position={[2.4, 5.5, 3.8]} intensity={0.55} color="#FFF0D2" />
      <Conductor accessoryMat={accessoryMat} />
    </Canvas>
  )
}

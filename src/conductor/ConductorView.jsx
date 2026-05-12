import { Suspense, createContext, useContext, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { applyEngravingShader } from './engravingShader'
import { usePhoneOrientation } from './usePhoneOrientation'
import {
  applyGesturePose,
  applyImpulsePose,
  captureBaseRotations,
  findDrivenBones,
  resetToBase,
} from './gesturePose'
import { applyIdlePose } from './idlePose'
import { setupArmIK, driveArmIK } from './armIK'
import { ANATOMICAL } from './conductorAnatomy'

const PAPER_CREAM = '#F2EBD8'

const PhoneContext = createContext(null)

function PhoneProvider({ children }) {
  const phone = usePhoneOrientation()
  return <PhoneContext.Provider value={phone}>{children}</PhoneContext.Provider>
}

function usePhone() {
  const ctx = useContext(PhoneContext)
  if (!ctx) throw new Error('usePhone must be used inside PhoneProvider')
  return ctx
}

// Bake the conducting pose into bones via a one-shot AnimationMixer, then
// never tick the mixer again. This frees us to drive the bones from
// useFrame without the mixer overwriting our changes every frame.
function bakeClipToScene(scene, clip) {
  if (!clip) return false
  const mixer = new THREE.AnimationMixer(scene)
  const action = mixer.clipAction(clip)
  action.play()
  mixer.update(0)
  mixer.update(clip.duration)
  return true
}

function Conductor() {
  const groupRef = useRef()
  const { scene, animations } = useGLTF('/conductor/conductor.glb')
  const phone = usePhone()

  const drivenBones = useRef({})
  const baseRotations = useRef({})
  const elapsedRef = useRef(0)
  const impulseRef = useRef(null)
  const lastImpulseAt = useRef(0)
  const armIKRef = useRef(null)

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const mat = new THREE.MeshToonMaterial({ color: 0x080706 })
        applyEngravingShader(mat)
        obj.material = mat
        obj.frustumCulled = false
      }
    })

    const baked = bakeClipToScene(scene, animations?.[0])
    const bones = findDrivenBones(scene)
    drivenBones.current = bones
    baseRotations.current = captureBaseRotations(bones)

    // Set up the right-arm IK chain. Must run AFTER bake so the rest
    // position used as the target anchor matches the conducting pose.
    armIKRef.current = setupArmIK(scene)

    if (typeof window !== 'undefined' && !window.__conductorBonesLogged) {
      console.log(`[Conductor] baked=${baked}; driven bones:`,
        Object.fromEntries(Object.entries(bones).map(([k, b]) => [k, b.name])))
      console.log(`[Conductor] arm IK ready: ${!!armIKRef.current}`)
      window.__conductorBonesLogged = true
    }
    // Expose to debug scripts. Lets scripts/debug-ik.mjs read bone state
    // without walking the R3F scene graph.
    if (typeof window !== 'undefined') {
      window.__conductorDebug = {
        bones,
        base: baseRotations.current,
        scene,
        getIKState: () => armIKRef.current,
      }
    }
  }, [scene, animations])

  useFrame((_, delta) => {
    phone.advance(delta)
    elapsedRef.current += delta
    const t = elapsedRef.current

    const bones = drivenBones.current
    const base = baseRotations.current

    // Composition: reset every bone to base, then layer life-signs idle,
    // then gesture (if calibrated), then beat impulse. Each layer
    // multiplies on top so contributions compose rather than overwrite.
    // The reset prevents the forearm-accumulation bug Codex flagged.

    resetToBase(bones, base)
    applyIdlePose(bones, t)

    // Head and chest still use Euler-decomposed gesture math (works fine
    // for upright bones). The upper arm + forearm are now driven by IK.
    if (phone.calibrated) {
      applyGesturePose(bones, base, phone.currentQuat.current)
    }

    // Drive the right-arm IK from the phone quaternion. Pre-calibration we
    // pass identity so the arm holds the rest target position. Update the
    // scene matrix first so getWorldPosition() inside the IK reads the
    // post-reset, post-chest-rotation bone positions, not stale values.
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

  return <primitive ref={groupRef} object={scene} />
}

useGLTF.preload('/conductor/conductor.glb')

// Live debug HUD. Reads phone refs every 250ms and shows raw + decomposed
// values. If the figure isn't moving, this tells us WHY: data not arriving,
// signals zero, signals non-zero but bones not responding.
function DebugHUD() {
  const phone = usePhone()
  const [snap, setSnap] = useState({
    q: [0, 0, 0, 1], pitch: 0, roll: 0, yaw: 0,
    gain: 0, artic: 0, lastBeat: 0,
  })

  useEffect(() => {
    const handle = setInterval(() => {
      const q = phone.currentQuat.current
      const euler = new THREE.Euler().setFromQuaternion(q, 'ZXY')
      setSnap({
        q: [q.x, q.y, q.z, q.w],
        pitch: euler.x * 180 / Math.PI,
        roll:  euler.y * 180 / Math.PI,
        yaw:   euler.z * 180 / Math.PI,
        gain:  phone.gestureGain?.current ?? 0,
        artic: phone.articulation?.current ?? 0,
        lastBeat: phone.lastDownbeat?.current?.firedAt ?? 0,
      })
    }, 250)
    return () => clearInterval(handle)
  }, [phone])

  const fmt = (n, d = 2) => (n ?? 0).toFixed(d).padStart(7)
  return (
    <div
      style={{
        position: 'absolute', bottom: 14, left: 14,
        padding: '8px 12px',
        background: 'rgba(28, 24, 20, 0.85)',
        color: '#d4c8a8',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.5,
        borderRadius: 4,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
{`connected: ${phone.connected}  calibrated: ${phone.calibrated}
quat:  [${fmt(snap.q[0], 3)} ${fmt(snap.q[1], 3)} ${fmt(snap.q[2], 3)} ${fmt(snap.q[3], 3)}]
euler:  pitch ${fmt(snap.pitch, 1)}°  roll ${fmt(snap.roll, 1)}°  yaw ${fmt(snap.yaw, 1)}°
motion: gain ${fmt(snap.gain, 2)}  artic ${fmt(snap.artic, 2)}
beat:   lastFired ${snap.lastBeat ? Math.round(snap.lastBeat) : 'never'}`}
    </div>
  )
}

function StatusOverlay() {
  const phone = usePhone()
  let label, color
  if (!phone.connected) { label = 'relay offline · npm run relay'; color = '#a23a2a' }
  else if (!phone.calibrated) { label = 'phone connected · waiting for calibration'; color = '#806020' }
  else { label = 'conducting · live'; color = '#205028' }

  return (
    <div
      style={{
        position: 'absolute', top: 14, right: 14,
        padding: '6px 12px',
        background: 'rgba(28, 24, 20, 0.06)',
        color,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 12,
        letterSpacing: 0.3,
        borderRadius: 4,
        pointerEvents: 'none',
      }}
    >
      {label}
    </div>
  )
}

export default function ConductorView() {
  return (
    <PhoneProvider>
      <div className="h-full w-full relative" style={{ background: PAPER_CREAM }}>
        <Canvas
          camera={{ position: [1.5, 1.55, 2.2], fov: 35 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 4]} intensity={1.4} />
          <Suspense fallback={null}>
            <Conductor />
          </Suspense>
          <OrbitControls
            target={[0, 1.45, 0]}
            enablePan={false}
            minDistance={1.5}
            maxDistance={5}
          />
        </Canvas>
        <StatusOverlay />
        <DebugHUD />
      </div>
    </PhoneProvider>
  )
}

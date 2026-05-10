import { Suspense, createContext, useContext, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { applyEngravingShader } from './engravingShader'
import { usePhoneOrientation } from './usePhoneOrientation'
import { applyGesturePose, captureBaseRotations, findDrivenBones } from './gesturePose'

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

  useEffect(() => {
    // Materials
    scene.traverse((obj) => {
      if (obj.isMesh || obj.isSkinnedMesh) {
        const mat = new THREE.MeshToonMaterial({ color: 0x080706 })
        applyEngravingShader(mat)
        obj.material = mat
        obj.frustumCulled = false
      }
    })

    // Apply the conducting pose, then capture the resulting bone state as base.
    const baked = bakeClipToScene(scene, animations?.[0])
    const bones = findDrivenBones(scene)
    drivenBones.current = bones
    baseRotations.current = captureBaseRotations(bones)

    if (typeof window !== 'undefined' && !window.__conductorBonesLogged) {
      console.log(`[Conductor] baked=${baked}; driven bones:`,
        Object.fromEntries(Object.entries(bones).map(([k, b]) => [k, b.name])))
      window.__conductorBonesLogged = true
    }
  }, [scene, animations])

  useFrame((_, delta) => {
    phone.advance(delta)
    if (!phone.calibrated) return
    applyGesturePose(drivenBones.current, baseRotations.current, phone.currentQuat.current)
  })

  return <primitive ref={groupRef} object={scene} />
}

useGLTF.preload('/conductor/conductor.glb')

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
          camera={{ position: [0, 1.55, 2.6], fov: 35 }}
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
      </div>
    </PhoneProvider>
  )
}

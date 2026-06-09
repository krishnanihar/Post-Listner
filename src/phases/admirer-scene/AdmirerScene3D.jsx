import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import { uniform } from 'three/tsl'
import { usePhoneMotion } from '../../hooks/usePhoneMotion.js'
import { subscribeMoments } from '../../lib/momentBus.js'
import { subscribeFormationStage } from '../../lib/formationStage.js'
import ThreePlaneScene from '../../aureola-three-plane/ThreePlaneScene'
import AvdShaderDriver from '../../aureola-three-plane/AvdShaderDriver'
import { resetAvd } from '../../lib/avdStore.js'
import { prefersReducedMotion } from '../../lib/reducedMotion.js'
import ParticleFormation from './ParticleFormation'
import BackgroundGlyph from '../BackgroundGlyph'

// AdmirerScene3D — the Admirer phase's background visual. Three stacked
// planes (back/middle/front) plus a 2D HTML particle overlay layered on
// top. Particles form into the middle-plane flower-of-life paced by the
// momentBus release ratio; the back plane fades in at formation stage 1
// (first fragment rated); the front figure fades in at stage 2
// (startGeneration).
//
// Mounts inside Admirer's <Paper variant="cream"> so the cream paper is
// visible until the back plane fades in. WebGPU is required; if the
// device doesn't support it, we render the existing BackgroundGlyph
// instead so the phase still works.

const TILT_CLAMP_DEG = 30
// Exponential ease rate per second for the opacity uniforms — opacity
// converges to target in roughly ~2s.
const OPACITY_EASE_RATE = 2.0

function StageOpacityDriver({ middleOpacityU, backOpacityU, frontOpacityU }) {
  const stageRef = useRef(0)
  const releaseRef = useRef(0)

  useEffect(() => subscribeFormationStage((s) => { stageRef.current = s }), [])
  useEffect(() => subscribeMoments((r) => { releaseRef.current = r }), [])

  useFrame((_, dt) => {
    const stage = stageRef.current
    const release = releaseRef.current

    // Middle plane: opacity = release ratio. By release=1 (startGeneration
    // snaps it there) the shader-rendered flower-of-life is fully visible.
    // No easing — we follow momentBus exactly so the particle fadeout and
    // shader fadein land at the same frame.
    //
    // TSL uniforms are signal containers — `.value` is the documented
    // mutable API (see three.js webgpu_hdr.html and webgpu_materials.html
    // examples). The react-hooks/immutability rule has a false positive
    // here; disabled per write so each line is auditable.
    // eslint-disable-next-line react-hooks/immutability
    middleOpacityU.value = release

    // Back + front: stage-gated, eased exponentially.
    const backTarget = stage >= 1 ? 1 : 0
    const frontTarget = stage >= 2 ? 1 : 0
    const k = 1 - Math.exp(-OPACITY_EASE_RATE * dt)
    // eslint-disable-next-line react-hooks/immutability
    backOpacityU.value += (backTarget - backOpacityU.value) * k
    // eslint-disable-next-line react-hooks/immutability
    frontOpacityU.value += (frontTarget - frontOpacityU.value) * k
  })

  return null
}

function hasWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export default function AdmirerScene3D() {
  const tiltRef = useRef({ x: 0, y: 0, gamma: 0, beta: 0 })
  const readMotion = usePhoneMotion()

  // Synchronously decide WebGPU vs fallback so we don't mount + tear down
  // the Canvas if support is missing.
  const [supported] = useState(() => hasWebGPU())
  const [reducedMotion] = useState(() => prefersReducedMotion())
  const [webgpuFailed, setWebgpuFailed] = useState(false)

  const middleOpacityU = useMemo(() => uniform(0), [])
  const backOpacityU = useMemo(() => uniform(0), [])
  const frontOpacityU = useMemo(() => uniform(0), [])

  // Start the AVD store neutral when the Admirer scene mounts so any leftover
  // state (e.g. slider values from the /aureola-three-plane-test route in the
  // same session) doesn't bleed in. The Admirer doesn't write AVD yet — Slice
  // 2 wires commitTurn here.
  useEffect(() => { resetAvd(); return () => resetAvd() }, [])

  useEffect(() => {
    if (!supported || reducedMotion) return undefined
    let raf
    const tick = () => {
      const m = readMotion()
      const gamma = Math.max(-TILT_CLAMP_DEG, Math.min(TILT_CLAMP_DEG, m.gamma ?? 0))
      const beta = Math.max(-TILT_CLAMP_DEG, Math.min(TILT_CLAMP_DEG, m.beta ?? 0))
      tiltRef.current = {
        x: gamma / TILT_CLAMP_DEG,
        y: beta / TILT_CLAMP_DEG,
        gamma,
        beta,
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [readMotion, supported, reducedMotion])

  const getTilt = useCallback(() => tiltRef.current, [])

  const makeRenderer = useCallback(async (props) => {
    try {
      const renderer = new WebGPURenderer({ ...props, antialias: true, alpha: true })
      await renderer.init()
      renderer.setClearColor(0x000000, 0)
      return renderer
    } catch (err) {
      console.error('[AdmirerScene3D] WebGPU init failed', err)
      setWebgpuFailed(true)
      throw err
    }
  }, [])

  if (!supported || webgpuFailed) {
    return (
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
        <BackgroundGlyph />
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
      <Canvas
        camera={{ position: [0, 0, 2.0], fov: 35 }}
        gl={makeRenderer}
        dpr={[1, 2]}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Suspense fallback={null}>
          <AvdShaderDriver />
          <ThreePlaneScene
            getTilt={getTilt}
            middleVisible
            backDepthOn
            frontVisible
            middleZ={0}
            middleBaseRate={0.05}
            backOpacityU={backOpacityU}
            middleOpacityU={middleOpacityU}
            frontOpacityU={frontOpacityU}
          />
          <StageOpacityDriver
            middleOpacityU={middleOpacityU}
            backOpacityU={backOpacityU}
            frontOpacityU={frontOpacityU}
          />
        </Suspense>
      </Canvas>
      <ParticleFormation />
    </div>
  )
}

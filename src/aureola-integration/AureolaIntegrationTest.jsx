import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Canvas } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import { usePhoneMotion } from '../hooks/usePhoneMotion'
import IntegrationScene from './IntegrationScene'
import IntegrationDebugPanel from './IntegrationDebugPanel'
import {
  setDesaturationEnabled,
  setGrainEnabled,
  setHaloEnabled,
} from './runtime'

const STYLES = {
  root: {
    position: 'fixed',
    inset: 0,
    background: '#000',
    overflow: 'hidden',
    fontFamily: 'Iowan Old Style, Palatino, "EB Garamond", serif',
    color: '#F2EBD8',
  },
  canvasWrap: {
    position: 'absolute',
    inset: 0,
  },
  prompt: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.55)',
    fontStyle: 'italic',
    fontSize: 18,
    letterSpacing: 0.2,
    zIndex: 10,
    cursor: 'pointer',
    userSelect: 'none',
  },
  hint: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    fontSize: 11,
    opacity: 0.4,
    letterSpacing: 0.4,
    pointerEvents: 'none',
    zIndex: 2,
  },
  unsupported: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 32,
    fontStyle: 'italic',
    fontSize: 16,
    background: '#1a1814',
    zIndex: 20,
  },
}

function isIosPermissionGated() {
  return (
    typeof window !== 'undefined'
    && typeof window.DeviceOrientationEvent !== 'undefined'
    && typeof window.DeviceOrientationEvent.requestPermission === 'function'
  )
}

function isCoarsePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export default function AureolaIntegrationTest() {
  const tiltRef = useRef({ x: 0, y: 0 })
  const readMotion = usePhoneMotion()
  const [needsIosTap, setNeedsIosTap] = useState(isIosPermissionGated())
  const [inputMode] = useState(isCoarsePointer() ? 'phone' : 'mouse')
  const [webgpuFailed, setWebgpuFailed] = useState(false)

  // 4 toggles — default state: all layers on, no desat, Eye visible
  const [haloOn, setHaloOn] = useState(true)
  const [grainOn, setGrainOn] = useState(true)
  const [desatOn, setDesatOn] = useState(false)
  const [hideEye, setHideEye] = useState(false)

  // Live-sync uniform-based toggles. Grain is also conditionally rendered
  // (so the mesh unmounts when off); the uniform stays in sync as a belt-and-
  // braces guard in case the conditional rendering changes later. hideEye is
  // pure conditional render — no uniform involved.
  useEffect(() => { setHaloEnabled(haloOn) }, [haloOn])
  useEffect(() => { setDesaturationEnabled(desatOn) }, [desatOn])
  useEffect(() => { setGrainEnabled(grainOn) }, [grainOn])

  // Desktop mouse tilt
  useEffect(() => {
    if (inputMode !== 'mouse') return undefined
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = -((e.clientY / window.innerHeight) * 2 - 1)
      tiltRef.current = { x: nx, y: ny }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [inputMode])

  // Phone tilt — gamma/beta clamped ±20° → normalized -1..1
  useEffect(() => {
    if (inputMode !== 'phone') return undefined
    const TILT_CLAMP_DEG = 20
    let raf
    const tick = () => {
      const m = readMotion()
      const gamma = Math.max(-TILT_CLAMP_DEG, Math.min(TILT_CLAMP_DEG, m.gamma ?? 0))
      const beta = Math.max(-TILT_CLAMP_DEG, Math.min(TILT_CLAMP_DEG, m.beta ?? 0))
      tiltRef.current = { x: gamma / TILT_CLAMP_DEG, y: beta / TILT_CLAMP_DEG }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inputMode, readMotion])

  const enableIosMotion = useCallback(async (e) => {
    if (e) e.stopPropagation()
    try {
      if (typeof window.DeviceOrientationEvent?.requestPermission === 'function') {
        await window.DeviceOrientationEvent.requestPermission()
      }
      if (typeof window.DeviceMotionEvent?.requestPermission === 'function') {
        await window.DeviceMotionEvent.requestPermission()
      }
    } catch { /* denied — fine, tilt stays at 0 */ }
    setNeedsIosTap(false)
  }, [])

  const getTilt = useCallback(() => tiltRef.current, [])

  const makeRenderer = useCallback(async (props) => {
    try {
      const renderer = new WebGPURenderer({ ...props, antialias: true })
      await renderer.init()
      return renderer
    } catch (err) {
      console.error('WebGPU init failed:', err)
      setWebgpuFailed(true)
      throw err
    }
  }, [])

  return (
    <div style={STYLES.root}>
      <div style={STYLES.canvasWrap}>
        {!webgpuFailed && (
          <Canvas
            camera={{ position: [0, 0, 2.2], fov: 35 }}
            gl={makeRenderer}
            dpr={[1, 2]}
          >
            <Suspense fallback={null}>
              <IntegrationScene
                getTilt={getTilt}
                hideEye={hideEye}
                grainOn={grainOn}
              />
            </Suspense>
          </Canvas>
        )}
      </div>

      {webgpuFailed && (
        <div style={STYLES.unsupported}>
          This prototype needs WebGPU. Try Chrome or Safari 18.2+.
        </div>
      )}

      <IntegrationDebugPanel
        haloOn={haloOn}
        grainOn={grainOn}
        desatOn={desatOn}
        hideEye={hideEye}
        setHaloOn={setHaloOn}
        setGrainOn={setGrainOn}
        setDesatOn={setDesatOn}
        setHideEye={setHideEye}
      />

      {needsIosTap && !webgpuFailed && (
        <div style={STYLES.prompt} onClick={enableIosMotion}>
          tap to look into the scene
        </div>
      )}

      <div style={STYLES.hint}>
        {inputMode === 'mouse'
          ? 'move mouse to look · toggle layers on the panel'
          : 'tilt to look · toggle layers on the panel'}
      </div>
    </div>
  )
}

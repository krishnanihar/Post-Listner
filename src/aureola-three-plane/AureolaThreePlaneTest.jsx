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
import ThreePlaneScene from './ThreePlaneScene'
import ThreePlaneDebugPanel from './ThreePlaneDebugPanel'
import AvdShaderDriver from './AvdShaderDriver'
import { setAvd, resetAvd } from '../lib/avdStore'

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

const TILT_CLAMP_DEG = 30

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

export default function AureolaThreePlaneTest() {
  // Tilt — { x, y } in -1..1 (for camera translation), gamma/beta in raw
  // clamped degrees (for the middle-plane shader's tilt magnitude).
  const tiltRef = useRef({ x: 0, y: 0, gamma: 0, beta: 0 })
  const { read: readMotion } = usePhoneMotion()

  const [needsIosTap, setNeedsIosTap] = useState(isIosPermissionGated())
  const [inputMode] = useState(isCoarsePointer() ? 'phone' : 'mouse')
  const [webgpuFailed, setWebgpuFailed] = useState(false)

  // Debug panel state
  const [middleVisible, setMiddleVisible] = useState(true)
  const [backDepthOn, setBackDepthOn] = useState(true)
  const [frontVisible, setFrontVisible] = useState(true)
  const [middleZ, setMiddleZ] = useState(0)
  const [middleBaseRate, setMiddleBaseRate] = useState(0.05)

  // AVD slider state
  const [avdA, setAvdAState] = useState(0)
  const [avdV, setAvdVState] = useState(0)
  const [avdD, setAvdDState] = useState(0)

  // Reset the store when this route mounts/unmounts so it starts neutral.
  useEffect(() => { resetAvd(); return () => resetAvd() }, [])

  const setAvdA = useCallback((x) => { setAvdAState(x); setAvd({ a: x }) }, [])
  const setAvdV = useCallback((x) => { setAvdVState(x); setAvd({ v: x }) }, [])
  const setAvdD = useCallback((x) => { setAvdDState(x); setAvd({ d: x }) }, [])

  // Throttled display of gamma/beta for the readout — avoids re-rendering
  // the panel every frame.
  const [tiltDisplay, setTiltDisplay] = useState({ gamma: 0, beta: 0 })
  useEffect(() => {
    const id = setInterval(() => {
      setTiltDisplay({
        gamma: tiltRef.current.gamma,
        beta: tiltRef.current.beta,
      })
    }, 100)
    return () => clearInterval(id)
  }, [])

  // Desktop mouse → simulated tilt across ±TILT_CLAMP_DEG so the shader's
  // tilt-driven effects are visible on desktop.
  useEffect(() => {
    if (inputMode !== 'mouse') return undefined
    const onMove = (e) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = -((e.clientY / window.innerHeight) * 2 - 1)
      tiltRef.current = {
        x: nx,
        y: ny,
        gamma: nx * TILT_CLAMP_DEG,
        beta: ny * TILT_CLAMP_DEG,
      }
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [inputMode])

  // Phone tilt — read gamma/beta in degrees, clamp ±30°, expose both raw and
  // normalized forms.
  useEffect(() => {
    if (inputMode !== 'phone') return undefined
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
            camera={{ position: [0, 0, 2.0], fov: 35 }}
            gl={makeRenderer}
            dpr={[1, 2]}
          >
            <Suspense fallback={null}>
              <AvdShaderDriver />
              <ThreePlaneScene
                getTilt={getTilt}
                middleVisible={middleVisible}
                backDepthOn={backDepthOn}
                frontVisible={frontVisible}
                middleZ={middleZ}
                middleBaseRate={middleBaseRate}
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

      <ThreePlaneDebugPanel
        middleVisible={middleVisible}
        setMiddleVisible={setMiddleVisible}
        backDepthOn={backDepthOn}
        setBackDepthOn={setBackDepthOn}
        frontVisible={frontVisible}
        setFrontVisible={setFrontVisible}
        middleZ={middleZ}
        setMiddleZ={setMiddleZ}
        middleBaseRate={middleBaseRate}
        setMiddleBaseRate={setMiddleBaseRate}
        gamma={tiltDisplay.gamma}
        beta={tiltDisplay.beta}
        avdA={avdA}
        avdV={avdV}
        avdD={avdD}
        setAvdA={setAvdA}
        setAvdV={setAvdV}
        setAvdD={setAvdD}
      />

      {needsIosTap && !webgpuFailed && (
        <div style={STYLES.prompt} onClick={enableIosMotion}>
          tap to look into the scene
        </div>
      )}

      <div style={STYLES.hint}>
        {inputMode === 'mouse'
          ? 'move mouse to conduct · toggle layers on the panel'
          : 'tilt to conduct · toggle layers on the panel'}
      </div>
    </div>
  )
}

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { WebGPURenderer } from 'three/webgpu'
import Workbench from '../bestiary/Workbench'
import { usePhoneMotion } from '../hooks/usePhoneMotion'
import { AUREOLA_V3 } from './config'
import {
  summon as engineSummon,
  computeFigureWeight,
  computeNetForces,
} from './engine'
import AureolaObject from './AureolaObject'
import Constellation from './Constellation'
import DebugPanel from './DebugPanel'

// Must match the bestiary Workbench's plane sizing so we can locate the bindu
// in the same world-space the base scene renders in.
const BASE_PLANE_W = 1.6
const IMAGE_ASPECT = 1672 / 941
const BASE_PLANE_H = BASE_PLANE_W / IMAGE_ASPECT
const COVER_HEADROOM = 1.45

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

// AureolaScene — runs inside the Canvas. Reads viewport to derive the bindu's
// current world position (the base plane scales to cover the viewport, so the
// bindu's world coords change with window size).
function AureolaScene({ activeObjects, getTilt }) {
  const { viewport } = useThree()

  const { binduWorld, halfDiag } = useMemo(() => {
    const viewportAspect = viewport.width / viewport.height
    const baseScale = viewportAspect > IMAGE_ASPECT
      ? viewport.width / BASE_PLANE_W
      : viewport.height / BASE_PLANE_H
    const scale = baseScale * COVER_HEADROOM
    const planeW = BASE_PLANE_W * scale
    const planeH = BASE_PLANE_H * scale
    return {
      binduWorld: {
        // bindu.cx is normalized [0,1] image-from-left, bindu.cy is image-from-top.
        // R3F world: y+ up, so we flip cy.
        x: (AUREOLA_V3.bindu.cx - 0.5) * planeW,
        y: (0.5 - AUREOLA_V3.bindu.cy) * planeH,
        z: 0,
      },
      halfDiag: Math.sqrt(planeW * planeW + planeH * planeH) / 2,
    }
  }, [viewport.width, viewport.height])

  return (
    <>
      <Workbench getTilt={getTilt} />
      {activeObjects.map((p) => (
        <AureolaObject
          key={p.id}
          placement={p}
          binduWorld={binduWorld}
          halfDiag={halfDiag}
        />
      ))}
      <Constellation
        placements={activeObjects}
        binduWorld={binduWorld}
        halfDiag={halfDiag}
      />
    </>
  )
}

export default function AureolaTest() {
  const tiltRef = useRef({ x: 0, y: 0 })
  const readMotion = usePhoneMotion()
  const [needsIosTap, setNeedsIosTap] = useState(isIosPermissionGated())
  const [inputMode] = useState(isCoarsePointer() ? 'phone' : 'mouse')
  const [webgpuFailed, setWebgpuFailed] = useState(false)
  const [activeObjects, setActiveObjects] = useState([])

  // Desktop mouse → normalized -1..1 tilt
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

  // Phone tilt: read gamma/beta, clamp ±20°, normalize to -1..1
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

  const handleSummon = useCallback((archetype) => {
    setActiveObjects((prev) => engineSummon(archetype, prev, AUREOLA_V3).active)
  }, [])

  const handleClear = useCallback(() => setActiveObjects([]), [])

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

  // Diagnostic readout for the debug panel
  const figureWeight = computeFigureWeight(AUREOLA_V3)
  const totalWeight = activeObjects.reduce((s, o) => s + o.weight, 0)
  const { F_x, F_y } = computeNetForces(activeObjects)

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
              <AureolaScene activeObjects={activeObjects} getTilt={getTilt} />
            </Suspense>
          </Canvas>
        )}
      </div>

      {webgpuFailed && (
        <div style={STYLES.unsupported}>
          This prototype needs WebGPU. Try Chrome or Safari 18.2+.
        </div>
      )}

      <DebugPanel
        onSummon={handleSummon}
        onClear={handleClear}
        readout={{
          count: activeObjects.length,
          totalWeight,
          figureWeight,
          F_x,
          F_y,
        }}
      />

      {needsIosTap && !webgpuFailed && (
        <div style={STYLES.prompt} onClick={enableIosMotion}>
          tap to look into the scene
        </div>
      )}

      <div style={STYLES.hint}>
        {inputMode === 'mouse'
          ? 'move mouse to look · use the panel to summon'
          : 'tilt to look · use the panel to summon'}
      </div>
    </div>
  )
}

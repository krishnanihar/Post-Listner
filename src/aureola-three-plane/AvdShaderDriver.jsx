import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { subscribeAvd } from '../lib/avdStore.js'
import { stepSpring } from '../lib/avdSpring.js'
import { setAvdUniforms } from './runtime.js'

// AvdShaderDriver — runs inside the Canvas. Subscribes to the avdStore's
// continuous vector (the EWMA-smoothed semantic value), applies a per-frame
// critically-damped spring per axis (visual smoothing so manual/discrete
// changes glide), and writes the eased values into the shader uniforms each
// frame. Renders nothing. Sibling of StageOpacityDriver.
export default function AvdShaderDriver() {
  const aRef = useRef({ value: 0, velocity: 0 })
  const vRef = useRef({ value: 0, velocity: 0 })
  const dRef = useRef({ value: 0, velocity: 0 })
  const targetRef = useRef({ a: 0, v: 0, d: 0 })

  useEffect(() => subscribeAvd((avd) => { targetRef.current = avd }), [])

  useFrame((_, dt) => {
    const t = targetRef.current
    stepSpring(aRef.current.value, aRef.current.velocity, t.a, dt, undefined, aRef.current)
    stepSpring(vRef.current.value, vRef.current.velocity, t.v, dt, undefined, vRef.current)
    stepSpring(dRef.current.value, dRef.current.velocity, t.d, dt, undefined, dRef.current)
    setAvdUniforms(aRef.current.value, vRef.current.value, dRef.current.value)
  })

  return null
}

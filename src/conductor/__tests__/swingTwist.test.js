import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { swingTwistDecompose } from '../swingTwist'

const Y_AXIS = new THREE.Vector3(0, 1, 0)

function quatFromAxisAngle(axis, angle) {
  return new THREE.Quaternion().setFromAxisAngle(axis, angle)
}

function quatsClose(a, b, eps = 1e-5) {
  // Quaternions q and -q represent the same rotation; compare via abs(dot).
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  return Math.abs(dot - 1) < eps
}

describe('swingTwistDecompose around Y axis', () => {
  it('pure rotation around Y → twist=q, swing=identity', () => {
    const q = quatFromAxisAngle(Y_AXIS, Math.PI / 3)
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(twist, q)).toBe(true)
    expect(quatsClose(swing, new THREE.Quaternion())).toBe(true)
  })

  it('pure rotation around X → swing=q, twist=identity', () => {
    const q = quatFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 4)
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(twist, new THREE.Quaternion())).toBe(true)
    expect(quatsClose(swing, q)).toBe(true)
  })

  it('pure rotation around Z → swing=q, twist=identity', () => {
    const q = quatFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 5)
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(twist, new THREE.Quaternion())).toBe(true)
    expect(quatsClose(swing, q)).toBe(true)
  })

  it('combined rotation → swing.multiply(twist) reconstructs q', () => {
    const yaw = quatFromAxisAngle(Y_AXIS, Math.PI / 6)
    const pitch = quatFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 8)
    const combined = pitch.clone().multiply(yaw)  // first yaw, then pitch
    const { swing, twist } = swingTwistDecompose(combined, Y_AXIS)
    const reconstructed = swing.clone().multiply(twist)
    expect(quatsClose(reconstructed, combined)).toBe(true)
  })

  it('zero rotation → both swing and twist are identity', () => {
    const q = new THREE.Quaternion()
    const { swing, twist } = swingTwistDecompose(q, Y_AXIS)
    expect(quatsClose(swing, new THREE.Quaternion())).toBe(true)
    expect(quatsClose(twist, new THREE.Quaternion())).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { applyGesturePose, captureBaseRotations, findDrivenBones } from '../gesturePose'
import { ANATOMICAL } from '../conductorAnatomy'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const GLB_PATH = path.resolve(__dirname, '../../../public/conductor/conductor.glb')

function loadGLB() {
  return new Promise((resolve, reject) => {
    const buf = readFileSync(GLB_PATH)
    // Copy bytes into a fresh ArrayBuffer in the test realm. jsdom's
    // ArrayBuffer global is distinct from Node's Buffer.buffer realm, and
    // GLTFLoader's `data instanceof ArrayBuffer` check fails when the two
    // don't match — falling through to a JSON path that misreports the
    // version. Allocating in-realm sidesteps that.
    const ab = new ArrayBuffer(buf.byteLength)
    new Uint8Array(ab).set(buf)
    new GLTFLoader().parse(ab, '', resolve, reject)
  })
}

describe('applyGesturePose', () => {
  it('zero phone rotation produces no bone change beyond rest', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    const phone = new THREE.Quaternion()  // identity
    applyGesturePose(bones, base, phone)
    for (const key of Object.keys(bones)) {
      expect(
        bones[key].quaternion.angleTo(base[key]),
        `bone ${key} drifted from rest with identity input`
      ).toBeLessThan(0.01)  // ~0.6°
    }
  })

  it('pure pitch input produces head pitch within anatomical limit', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    // 30° pitch around world X.
    const phone = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), 30 * Math.PI / 180
    )
    applyGesturePose(bones, base, phone)
    const headDelta = base.head.clone().invert().multiply(bones.head.quaternion)
    const headAngle = 2 * Math.acos(Math.min(1, Math.abs(headDelta.w)))
    // Expect roughly pitch_signal × HEAD_PITCH_GAIN, clamped to HEAD_PITCH_MAX.
    expect(headAngle).toBeGreaterThan(0.05)            // moved
    expect(headAngle).toBeLessThanOrEqual(ANATOMICAL.HEAD_PITCH_MAX + 0.01)
  })

  it('pure roll input produces chest lean, not head pitch', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    // 30° roll around world Z (tilt sideways).
    const phone = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 0, 1), 30 * Math.PI / 180
    )
    applyGesturePose(bones, base, phone)
    const chestDelta = base.chest.clone().invert().multiply(bones.chest.quaternion)
    const chestAngle = 2 * Math.acos(Math.min(1, Math.abs(chestDelta.w)))
    expect(chestAngle).toBeGreaterThan(0.03)
    expect(chestAngle).toBeLessThanOrEqual(ANATOMICAL.CHEST_ROLL_MAX + 0.01)
    // Head should NOT have leaned sideways from a pure-roll input
    const headDelta = base.head.clone().invert().multiply(bones.head.quaternion)
    const headAngle = 2 * Math.acos(Math.min(1, Math.abs(headDelta.w)))
    expect(headAngle).toBeLessThan(0.02)
  })

  it('extreme phone rotation never drives bones past anatomical max', async () => {
    const gltf = await loadGLB()
    const bones = findDrivenBones(gltf.scene)
    const base = captureBaseRotations(bones)
    // 180° around an arbitrary axis — far beyond comfortable conducting motion
    const phone = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 1, 0).normalize(), Math.PI
    )
    applyGesturePose(bones, base, phone)
    const headDelta = base.head.clone().invert().multiply(bones.head.quaternion)
    const headAngle = 2 * Math.acos(Math.min(1, Math.abs(headDelta.w)))
    const chestDelta = base.chest.clone().invert().multiply(bones.chest.quaternion)
    const chestAngle = 2 * Math.acos(Math.min(1, Math.abs(chestDelta.w)))
    // Allow 1° tolerance on the clamp boundary
    expect(headAngle).toBeLessThanOrEqual(
      Math.max(ANATOMICAL.HEAD_PITCH_MAX, ANATOMICAL.HEAD_YAW_MAX) + 0.02
    )
    expect(chestAngle).toBeLessThanOrEqual(ANATOMICAL.CHEST_ROLL_MAX + 0.02)
  })
})

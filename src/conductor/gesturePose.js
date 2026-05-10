import * as THREE from 'three'
import { swingTwistDecompose } from './swingTwist'
import { ANATOMICAL } from './conductorAnatomy'

// World-space axes used for swing-twist decomposition.
const Y_AXIS = new THREE.Vector3(0, 1, 0)

// Bone names verified by src/conductor/__tests__/conductor-glb.test.js.
// Same keys are used by the integration test in conductorMotion.test.js.
const DRIVEN_BONE_NAMES = {
  head:      'DEF-spine.006',
  chest:     'DEF-spine.004',
  upperArmR: 'DEF-upper_arm.R',
}

/**
 * Walk the loaded scene and return a map of the driven bones we care about.
 * Uses SkinnedMesh.skeleton.bones[] (the only bones that deform the mesh on
 * the GPU) and applies the same name sanitization three.js's GLTFLoader uses.
 */
export function findDrivenBones(scene) {
  const skinBones = new Map()
  scene.traverse((o) => {
    if (o.isSkinnedMesh && o.skeleton && o.skeleton.bones) {
      for (const b of o.skeleton.bones) {
        if (b && b.name) skinBones.set(b.name, b)
      }
    }
  })

  const out = {}
  for (const [key, name] of Object.entries(DRIVEN_BONE_NAMES)) {
    const sanitized = THREE.PropertyBinding.sanitizeNodeName(name)
    const bone = skinBones.get(sanitized) || skinBones.get(name)
    if (bone) out[key] = bone
  }
  return out
}

/**
 * Snapshot each driven bone's current local quaternion as the rest pose
 * deltas will be applied on top of.
 */
export function captureBaseRotations(bones) {
  const base = {}
  for (const [key, bone] of Object.entries(bones)) {
    base[key] = bone.quaternion.clone()
  }
  return base
}

// Pre-allocated workspace to keep useFrame allocation-free.
const _swing = new THREE.Quaternion()
const _twist = new THREE.Quaternion()
const _delta = new THREE.Quaternion()
const _axisX = new THREE.Vector3(1, 0, 0)
const _axisY = new THREE.Vector3(0, 1, 0)
const _axisZ = new THREE.Vector3(0, 0, 1)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Build a clamped delta quaternion: rotate around `axis` by
 * `clamp(signal × gain, -max, +max)`.
 */
function clampedAxisDelta(signal, gain, max, axis, out = new THREE.Quaternion()) {
  const angle = clamp(signal * gain, -max, max)
  return out.setFromAxisAngle(axis, angle)
}

/**
 * Apply a smoothed, calibrated phone quaternion to the driven bones.
 *
 * Pipeline:
 *   1. Decompose the phone quaternion around world Y → swing + twist.
 *      twist  = pure rotation around vertical (yaw)
 *      swing  = pure rotation around the horizontal plane (pitch + roll)
 *   2. From swing, extract pitch (around X) and roll (around Z) using ZXY
 *      Euler order (which is how phone.js originally constructed the quat
 *      from alpha/beta/gamma — round-trips cleanly).
 *   3. Drive each bone independently. No bone receives the same axis as
 *      another, so rotations cannot compound through the parent chain.
 *
 * This function is pure — it mutates `bones[*].quaternion` only. Safe to
 * call every frame and from outside React.
 *
 * @param {Record<string, THREE.Bone>} bones        from findDrivenBones
 * @param {Record<string, THREE.Quaternion>} base   from captureBaseRotations
 * @param {THREE.Quaternion} phoneQuat              calibrated, smoothed
 */
export function applyGesturePose(bones, base, phoneQuat) {
  // 1. Swing-twist around vertical.
  const { swing, twist } = swingTwistDecompose(phoneQuat, _axisY)
  _swing.copy(swing)
  _twist.copy(twist)

  // 2. Extract scalar pitch + roll from swing using ZXY order.
  //    With swing-twist around Y, swing only contains rotation in the
  //    X-Z plane, so an XZY (or ZXY) decomposition cleanly separates pitch
  //    (around X) from roll (around Z).
  const swingEuler = new THREE.Euler().setFromQuaternion(_swing, 'ZXY')
  const pitchSignal = swingEuler.x
  const rollSignal  = swingEuler.z

  // Yaw scalar from twist: twist is a rotation around Y, so its angle is
  // the yaw signal we want.
  const yawSignal = 2 * Math.atan2(_twist.y, _twist.w)

  // 3. Per-bone application.

  // 3a. Head: pitch (around X) + yaw (around Y), each clamped, applied as a
  //     local-space delta on top of the rest pose.
  if (bones.head && base.head) {
    const pitchDelta = clampedAxisDelta(
      pitchSignal, ANATOMICAL.HEAD_PITCH_GAIN, ANATOMICAL.HEAD_PITCH_MAX,
      _axisX, new THREE.Quaternion(),
    )
    const yawDelta = clampedAxisDelta(
      yawSignal, ANATOMICAL.HEAD_YAW_GAIN, ANATOMICAL.HEAD_YAW_MAX,
      _axisY, new THREE.Quaternion(),
    )
    _delta.copy(yawDelta).multiply(pitchDelta)  // yaw first, then pitch
    bones.head.quaternion.copy(base.head).multiply(_delta)
  }

  // 3b. Chest: roll only (around Z), clamped.
  if (bones.chest && base.chest) {
    const rollDelta = clampedAxisDelta(
      rollSignal, ANATOMICAL.CHEST_ROLL_GAIN, ANATOMICAL.CHEST_ROLL_MAX,
      _axisZ, _delta,
    )
    bones.chest.quaternion.copy(base.chest).multiply(rollDelta)
  }

  // 3c. Right upper arm: full phone quaternion as a local-space delta on
  //     top of the rest pose, slerped from identity by ARM_DAMPING. Identity
  //     input → identity delta → bone stays at rest. The delta is clamped to
  //     ARM_MAX angular distance so extreme phone rotations never fold the
  //     arm past the anatomical ceiling.
  if (bones.upperArmR && base.upperArmR) {
    const armDelta = new THREE.Quaternion().slerp(phoneQuat, ANATOMICAL.ARM_DAMPING)

    // Clamp angular distance from rest to ARM_MAX.
    const angle = 2 * Math.acos(clamp(Math.abs(armDelta.w), 0, 1))
    if (angle > ANATOMICAL.ARM_MAX) {
      armDelta.slerp(new THREE.Quaternion(), 1 - ANATOMICAL.ARM_MAX / angle)
    }

    bones.upperArmR.quaternion.copy(base.upperArmR).multiply(armDelta)
  }
}

import * as THREE from 'three'
import { ANATOMICAL } from './conductorAnatomy'

// Decomposition order. Phone.js constructs the quaternion via ZXY composition
// from (alpha, beta, gamma); decomposing the same way recovers those signals
// independently, regardless of how the phone is held at calibration.
//
// Earlier we tried swing-twist around scene-Y to extract yaw vs pitch+roll,
// but in portrait phone holds gamma (sideways tilt) rotates around the same
// world axis as alpha (compass yaw) — both are world-Y. Swing-twist conflated
// them and chest roll was unreachable. ZXY Euler keeps them separate.
const PHONE_DECOMP_ORDER = 'ZXY'

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
const _euler = new THREE.Euler()
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
 *   1. Decompose the phone quaternion using ZXY Euler order (matching how
 *      phone.js constructs it from {alpha, beta, gamma}). This recovers the
 *      three signals independently and is robust to phone orientation:
 *        euler.z = dAlpha (compass heading delta) → conductor head YAW
 *        euler.x = dBeta  (forward/back tilt)     → conductor head PITCH
 *        euler.y = dGamma (sideways tilt)         → conductor chest ROLL
 *   2. Drive each bone with its own dedicated signal axis. No two bones
 *      share an axis, so rotations don't compound through the parent chain.
 *   3. Right upper arm = baton arm: phone quaternion as a damped local-space
 *      delta on top of rest, clamped to ARM_MAX angular distance.
 *
 * This function is pure — it mutates `bones[*].quaternion` only. Safe to
 * call every frame and from outside React.
 *
 * @param {Record<string, THREE.Bone>} bones        from findDrivenBones
 * @param {Record<string, THREE.Quaternion>} base   from captureBaseRotations
 * @param {THREE.Quaternion} phoneQuat              calibrated, smoothed
 */
export function applyGesturePose(bones, base, phoneQuat) {
  // 1. ZXY Euler decomposition recovers the original alpha/beta/gamma deltas.
  _euler.setFromQuaternion(phoneQuat, PHONE_DECOMP_ORDER)
  const yawSignal   = _euler.z   // dAlpha (compass heading)
  const pitchSignal = _euler.x   // dBeta  (forward/back tilt)
  const rollSignal  = _euler.y   // dGamma (sideways tilt)

  // 2. Per-bone application.

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

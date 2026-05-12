import * as THREE from 'three'
import { ANATOMICAL } from './conductorAnatomy'

// Decomposition order. Phone.js constructs the quaternion via ZXY composition
// from (alpha, beta, gamma); decomposing the same way recovers those signals
// independently, regardless of how the phone is held at calibration.
const PHONE_DECOMP_ORDER = 'ZXY'

// Bone names verified by src/conductor/__tests__/conductor-glb.test.js.
// forearmR is added for ictus impulse on downbeats; if missing in the rig,
// findDrivenBones silently skips it and the impulse falls back to upper arm.
const DRIVEN_BONE_NAMES = {
  head:      'DEF-spine.006',
  chest:     'DEF-spine.004',
  upperArmR: 'DEF-upper_arm.R',
  forearmR:  'DEF-forearm.R',
}

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

export function captureBaseRotations(bones) {
  const base = {}
  for (const [key, bone] of Object.entries(bones)) {
    base[key] = bone.quaternion.clone()
  }
  return base
}

const _euler = new THREE.Euler()
const _delta = new THREE.Quaternion()
const _scratch = new THREE.Quaternion()
const _axisX = new THREE.Vector3(1, 0, 0)
const _axisY = new THREE.Vector3(0, 1, 0)
const _axisZ = new THREE.Vector3(0, 0, 1)

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function clampedAxisDelta(signal, gain, max, axis, out = new THREE.Quaternion()) {
  const angle = clamp(signal * gain, -max, max)
  return out.setFromAxisAngle(axis, angle)
}

/**
 * Reset every driven bone to its captured base rotation. Call this at the
 * start of every useFrame, before composing idle/gesture/impulse on top.
 * Without this, idle/impulse multiplications accumulate frame-over-frame
 * and the figure drifts (Codex flagged the forearm version of this bug).
 */
export function resetToBase(bones, base) {
  for (const key of Object.keys(bones)) {
    if (base[key]) bones[key].quaternion.copy(base[key])
  }
}

/**
 * Apply a smoothed, calibrated phone quaternion to the driven bones.
 *
 * Multiplies a gesture delta ON TOP of whatever pose each bone currently
 * holds. Callers are expected to have called resetToBase() (or equivalent)
 * earlier in the frame; the runtime pipeline does this so idle + gesture
 * can compose cleanly. The existing tests call applyGesturePose against a
 * fresh scene where bones are already at base, so the test contract
 * (final pose = base × gesture delta) still holds.
 */
export function applyGesturePose(bones, base, phoneQuat) {
  _euler.setFromQuaternion(phoneQuat, PHONE_DECOMP_ORDER)
  const yawSignal   = _euler.z
  const pitchSignal = _euler.x
  const rollSignal  = _euler.y

  if (bones.head && base.head) {
    const pitchDelta = clampedAxisDelta(
      pitchSignal, ANATOMICAL.HEAD_PITCH_GAIN, ANATOMICAL.HEAD_PITCH_MAX,
      _axisX, new THREE.Quaternion(),
    )
    const yawDelta = clampedAxisDelta(
      yawSignal, ANATOMICAL.HEAD_YAW_GAIN, ANATOMICAL.HEAD_YAW_MAX,
      _axisY, new THREE.Quaternion(),
    )
    _delta.copy(yawDelta).multiply(pitchDelta)
    bones.head.quaternion.multiply(_delta)
  }

  if (bones.chest && base.chest) {
    const rollDelta = clampedAxisDelta(
      rollSignal, ANATOMICAL.CHEST_ROLL_GAIN, ANATOMICAL.CHEST_ROLL_MAX,
      _axisZ, new THREE.Quaternion(),
    )
    const pitchDelta = clampedAxisDelta(
      pitchSignal,
      ANATOMICAL.CHEST_PITCH_FROM_PITCH_GAIN,
      ANATOMICAL.CHEST_PITCH_FROM_PITCH_MAX,
      _axisX, new THREE.Quaternion(),
    )
    _delta.copy(rollDelta).multiply(pitchDelta)
    bones.chest.quaternion.multiply(_delta)
  }

  // Upper arm and forearm are no longer driven here — they're solved by
  // CCDIKSolver in armIK.js, which reaches the hand to a target point
  // derived from the phone quaternion. Manual axis mapping was the wrong
  // abstraction for the arm.
}

/**
 * Apply a beat-driven ictus impulse, layered on top of whatever pose the
 * bones currently hold (gesture + idle). Call AFTER applyGesturePose and
 * applyIdlePose so the impulse reads as the discrete event on top of
 * continuous motion.
 *
 * impulseState shape:
 *   { startedAt: number, intensity: 0..1 } or null
 *
 * Returns true while the impulse is still ramping/decaying; the caller can
 * use this to decide when to clear the state.
 */
export function applyImpulsePose(bones, impulseState, time) {
  if (!impulseState || !bones) return false
  const elapsed = (time - impulseState.startedAt) * 1000   // ms
  const attack = ANATOMICAL.IMPULSE_ATTACK_MS
  const decay = ANATOMICAL.IMPULSE_DECAY_MS
  if (elapsed < 0 || elapsed > attack + decay) return false

  // Envelope: linear ramp 0→1 during attack, exponential-ish decay 1→0.
  let env
  if (elapsed < attack) {
    env = elapsed / attack
  } else {
    const decayElapsed = elapsed - attack
    env = 1 - decayElapsed / decay
  }
  env = Math.max(0, Math.min(1, env))
  const k = env * (impulseState.intensity || 1)

  // Forearm: the primary ictus motion. Forward snap around X.
  if (bones.forearmR) {
    _delta.setFromAxisAngle(_axisX, ANATOMICAL.IMPULSE_ARM_PEAK * k)
    bones.forearmR.quaternion.multiply(_delta)
  }

  // Upper arm: small forward assist so the whole arm participates.
  if (bones.upperArmR) {
    _delta.setFromAxisAngle(_axisX, ANATOMICAL.IMPULSE_UPPER_PEAK * k)
    bones.upperArmR.quaternion.multiply(_delta)
  }

  // Head: tiny dip — the conductor "lands" the beat with the body.
  if (bones.head) {
    _delta.setFromAxisAngle(_axisX, ANATOMICAL.IMPULSE_HEAD_PEAK * k)
    bones.head.quaternion.multiply(_delta)
  }

  return true
}

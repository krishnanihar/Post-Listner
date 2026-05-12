import * as THREE from 'three'
import { ANATOMICAL } from './conductorAnatomy'

const _delta = new THREE.Quaternion()
const _axisX = new THREE.Vector3(1, 0, 0)
const _axisY = new THREE.Vector3(0, 1, 0)
const _axisZ = new THREE.Vector3(0, 0, 1)

const TWO_PI = Math.PI * 2

// Idle conducting baseline: a 4-second loop. The figure is alive at rest so
// gesture reads as *delta on top* of motion rather than as the only thing
// moving. Personal Orchestra and UBS Virtual Maestro both run continuous
// baseline motion; the research base names this as the architecture that
// makes felt agency legible (gesture-felt-agency-phone-as-baton.md §2).
//
// Mutates each bone's existing quaternion (multiplies an idle delta onto
// whatever pose is already there). Call AFTER gesture has been applied —
// the order makes idle feel like a layered breath/sway, not a fight with
// the conductor's response.
export function applyIdlePose(bones, time) {
  if (!bones) return
  const t = time || 0

  // Phase: 0..1 over IDLE_PERIOD_S, the period of the baton arc.
  const beatPhase = (t / ANATOMICAL.IDLE_PERIOD_S) % 1
  const beatAngle = beatPhase * TWO_PI

  // Breath: a slower 5-second cycle, decoupled from the beat so the figure
  // never lands on a fully predictable rest pose.
  const breathPhase = ((t / ANATOMICAL.IDLE_BREATH_PERIOD_S) % 1) * TWO_PI

  // Head: small lateral sway that tracks the (imaginary) baton tip. The head
  // turns slightly on each beat — half-amplitude of the arm.
  if (bones.head) {
    const headYaw = Math.sin(beatAngle) * ANATOMICAL.IDLE_HEAD_YAW
    const headPitch = Math.sin(breathPhase * 0.5) * ANATOMICAL.IDLE_HEAD_PITCH
    _delta.setFromAxisAngle(_axisY, headYaw)
    bones.head.quaternion.multiply(_delta)
    _delta.setFromAxisAngle(_axisX, headPitch)
    bones.head.quaternion.multiply(_delta)
  }

  // Chest: breath — gentle pitch oscillation around the breath cycle. Small
  // weight shift on the beat, rolling toward the baton arc.
  if (bones.chest) {
    const chestBreath = Math.sin(breathPhase) * ANATOMICAL.IDLE_BREATH_PITCH
    const chestRoll = Math.sin(beatAngle) * ANATOMICAL.IDLE_CHEST_ROLL
    _delta.setFromAxisAngle(_axisX, chestBreath)
    bones.chest.quaternion.multiply(_delta)
    _delta.setFromAxisAngle(_axisZ, chestRoll)
    bones.chest.quaternion.multiply(_delta)
  }

  // Right upper arm: gentle 4-beat-style arc in two axes. The arm sweeps
  // sideways (around Z) and up/down (around X) in quadrature so the baton
  // tip traces a small ellipse rather than a flat bob. Amplitude is tiny —
  // this is presence, not a full conducting pattern. The pattern's down-
  // stroke aligns with phase 0 so a phone downbeat registered there would
  // feel synchronous with the visible motion.
  if (bones.upperArmR) {
    // Ellipse: x oscillates with cos(beat), z oscillates with sin(beat).
    // Phase 0 (beat start) → max-down → matches the conductor's ictus.
    const armSweep = Math.sin(beatAngle) * ANATOMICAL.IDLE_ARM_SWEEP
    const armLift = -Math.cos(beatAngle) * ANATOMICAL.IDLE_ARM_LIFT
    _delta.setFromAxisAngle(_axisZ, armSweep)
    bones.upperArmR.quaternion.multiply(_delta)
    _delta.setFromAxisAngle(_axisX, armLift)
    bones.upperArmR.quaternion.multiply(_delta)
  }
}

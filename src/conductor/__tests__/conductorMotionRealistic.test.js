// Diagnostic — NOT a regular test. Run with:
//   npx vitest run src/conductor/__tests__/conductorMotionRealistic.diagnostic.js --reporter=verbose
//
// Simulates the actual quaternion stream the phone produces (via DeviceOrientationEvent
// composed in ZXY order, then made relative to a calibration zeroQuat) and reports
// what each driven bone actually does — angle and axis of the world-space delta from rest.
//
// If "tilt phone forward" reliably produces a head pitch around the scene's X axis,
// regardless of which compass heading the user calibrated at, the math is right.
//
// If the same "tilt forward" gesture produces head pitch in one calibration scenario
// and chest roll in another, the swing-twist axis is wrong (we're decomposing in the
// wrong frame).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { applyGesturePose, captureBaseRotations, findDrivenBones } from '../gesturePose'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const GLB_PATH = path.resolve(__dirname, '../../../public/conductor/conductor.glb')
const DEG = Math.PI / 180

function loadGLB() {
  return new Promise((resolve, reject) => {
    const buf = readFileSync(GLB_PATH)
    const ab = new ArrayBuffer(buf.byteLength)
    new Uint8Array(ab).set(buf)
    new GLTFLoader().parse(ab, '', resolve, reject)
  })
}

// EXACT replica of phone.js:22-38 — ZXY-order quaternion from alpha/beta/gamma in degrees.
function quatFromEulerZXY(aDeg, bDeg, gDeg) {
  const a = (aDeg || 0) * DEG
  const b = (bDeg || 0) * DEG
  const g = (gDeg || 0) * DEG
  const cZ = Math.cos(a / 2), sZ = Math.sin(a / 2)
  const cX = Math.cos(b / 2), sX = Math.sin(b / 2)
  const cY = Math.cos(g / 2), sY = Math.sin(g / 2)
  return new THREE.Quaternion(
    cZ * sX * cY - sZ * cX * sY,
    sZ * sX * cY + cZ * cX * sY,
    sZ * cX * cY + cZ * sX * sY,
    cZ * cX * cY - sZ * sX * sY,
  )
}

// Replica of phone.js:40-47 — calibrated relative quaternion: conj(zeroQuat) * absQuat.
function calibratedRelative(zeroQuat, absQuat) {
  return zeroQuat.clone().conjugate().multiply(absQuat)
}

// Inspect a bone's world-space rotation delta from its base.
function reportBone(label, bone, base, scene) {
  // Need world matrices fresh
  scene.updateMatrixWorld(true)

  const worldNow = new THREE.Quaternion()
  bone.getWorldQuaternion(worldNow)

  // Base world quat is captured with same parent chain at rest pose.
  // For a fair comparison, compute the delta in WORLD space.
  // Note: "base" is local-space rest. To get base world quat, we need parent world * base.
  const parentWorld = new THREE.Quaternion()
  if (bone.parent) bone.parent.getWorldQuaternion(parentWorld)
  const baseWorld = parentWorld.clone().multiply(base)

  const delta = baseWorld.clone().conjugate().multiply(worldNow)
  const angleDeg = (2 * Math.acos(Math.min(1, Math.abs(delta.w)))) / DEG
  const axisAngleVec = new THREE.Vector3(delta.x, delta.y, delta.z)
  const axisLen = axisAngleVec.length()
  const axis = axisLen > 1e-6 ? axisAngleVec.divideScalar(axisLen) : new THREE.Vector3()

  return {
    label,
    angleDeg: Number(angleDeg.toFixed(2)),
    axis: { x: Number(axis.x.toFixed(3)), y: Number(axis.y.toFixed(3)), z: Number(axis.z.toFixed(3)) },
  }
}

function describeAxis(axis) {
  // Identify the dominant world axis for a unit vector.
  const labels = [
    ['+X', new THREE.Vector3(1, 0, 0)], ['-X', new THREE.Vector3(-1, 0, 0)],
    ['+Y', new THREE.Vector3(0, 1, 0)], ['-Y', new THREE.Vector3(0, -1, 0)],
    ['+Z', new THREE.Vector3(0, 0, 1)], ['-Z', new THREE.Vector3(0, 0, -1)],
  ]
  const v = new THREE.Vector3(axis.x, axis.y, axis.z)
  let best = '?', bestDot = -2
  for (const [name, ref] of labels) {
    const d = v.dot(ref)
    if (d > bestDot) { bestDot = d; best = name }
  }
  return `${best} (${bestDot.toFixed(2)})`
}

async function setupRig() {
  const gltf = await loadGLB()
  const bones = findDrivenBones(gltf.scene)
  const base = captureBaseRotations(bones)
  return { scene: gltf.scene, bones, base }
}

describe('conductor motion — realistic phone quaternions', () => {
  it('SCENARIO MATRIX: log bone deltas for various calibration + gesture combos', async () => {
    const calibrations = [
      { name: 'portrait-north', alpha: 0,   beta: 90, gamma: 0 },
      { name: 'portrait-east',  alpha: 90,  beta: 90, gamma: 0 },
      { name: 'portrait-south', alpha: 180, beta: 90, gamma: 0 },
      { name: 'portrait-west',  alpha: 270, beta: 90, gamma: 0 },
      { name: 'flat-screen-up', alpha: 0,   beta: 0,  gamma: 0 },
      { name: 'landscape-rt',   alpha: 0,   beta: 90, gamma: 90 },
    ]

    // Each gesture is a delta from cal: { dAlpha, dBeta, dGamma } in degrees.
    const gestures = [
      { name: 'tilt-forward-30', dAlpha: 0,   dBeta: -30, dGamma: 0 },
      { name: 'tilt-back-30',    dAlpha: 0,   dBeta: 30,  dGamma: 0 },
      { name: 'tilt-right-30',   dAlpha: 0,   dBeta: 0,   dGamma: 30 },
      { name: 'tilt-left-30',    dAlpha: 0,   dBeta: 0,   dGamma: -30 },
      { name: 'yaw-right-30',    dAlpha: 30,  dBeta: 0,   dGamma: 0 },
      { name: 'yaw-left-30',     dAlpha: -30, dBeta: 0,   dGamma: 0 },
    ]

    const { scene, bones, base } = await setupRig()

    console.log('\n' + '='.repeat(100))
    console.log('CONDUCTOR MOTION DIAGNOSTIC — realistic phone quaternion stream')
    console.log('='.repeat(100))
    console.log('Bones bound:')
    for (const k of Object.keys(bones)) console.log(`  ${k.padEnd(12)} → ${bones[k].name}`)

    for (const cal of calibrations) {
      const Q_cal = quatFromEulerZXY(cal.alpha, cal.beta, cal.gamma)
      console.log('\n' + '-'.repeat(100))
      console.log(`CALIBRATION: ${cal.name}  α=${cal.alpha}°  β=${cal.beta}°  γ=${cal.gamma}°`)
      console.log('-'.repeat(100))
      console.log(`gesture                    | head delta                | chest delta               | arm delta`)
      console.log('-'.repeat(100))

      for (const g of gestures) {
        // Reset bones to base before each gesture
        for (const k of Object.keys(bones)) bones[k].quaternion.copy(base[k])

        const Q_abs = quatFromEulerZXY(cal.alpha + g.dAlpha, cal.beta + g.dBeta, cal.gamma + g.dGamma)
        const qRel = calibratedRelative(Q_cal, Q_abs)
        applyGesturePose(bones, base, qRel)

        const head  = reportBone('head',  bones.head,      base.head,      scene)
        const chest = reportBone('chest', bones.chest,     base.chest,     scene)
        const arm   = reportBone('arm',   bones.upperArmR, base.upperArmR, scene)

        const fmt = (b) => `${b.angleDeg.toString().padStart(5)}° around ${describeAxis(b.axis)}`
        console.log(`${g.name.padEnd(26)} | ${fmt(head).padEnd(25)} | ${fmt(chest).padEnd(25)} | ${fmt(arm)}`)
      }
    }

    console.log('\n' + '='.repeat(100))
    console.log('EXPECTED behavior:')
    console.log('  tilt-forward-30  → head pitches around X (or -X for back), chest ≈ 0, arm responds')
    console.log('  tilt-right-30    → chest rolls around Z (or -Z for left), head pitch ≈ 0')
    console.log('  yaw-right-30     → head turns around Y, chest ≈ 0')
    console.log('=' .repeat(100))

    // Always pass — this is informational
    expect(true).toBe(true)
  })
})

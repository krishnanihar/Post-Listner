import * as THREE from 'three'
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver.js'

// Bones we need from the Rigify rig. Sanitized names (three.js's GLTFLoader
// strips dots/colons via PropertyBinding.sanitizeNodeName).
//
// Rigify's actual right-arm parent chain (child → root) verified at runtime:
//   DEF-handR
//     ← DEF-forearmR.001   (twist distribution bone)
//     ← DEF-forearmR
//     ← DEF-upper_armR.001 (twist distribution bone)
//     ← DEF-upper_armR
// CCDIKSolver requires every entry in `links` to actually be a parent of
// the effector. The twist bones (.001) deform skin only — we pass them
// through as disabled so the solver doesn't rotate them.
const EFFECTOR_NAME      = 'DEF-handR'
const FOREARM_TWIST_NAME = 'DEF-forearmR.001'
const FOREARM_NAME       = 'DEF-forearmR'
const UPPER_ARM_TWIST_NAME = 'DEF-upper_armR.001'
const UPPER_ARM_NAME     = 'DEF-upper_armR'
// Rigify's hand IK control bone — already in the skeleton, doesn't deform
// the mesh, parented to the root. Perfect for hijacking as a CCDIK target.
const TARGET_NAME        = 'MCH-hand_ikparentR'

function sanitize(name) {
  return THREE.PropertyBinding.sanitizeNodeName(name)
}

function findBone(skeleton, name) {
  const target = sanitize(name)
  const fallback = name
  return skeleton.bones.findIndex(b => b && (b.name === target || b.name === fallback))
}

/**
 * Build a CCDIKSolver for the right arm chain.
 *
 * Returns { solver, targetBone, effectorBone, shoulderBone, restTargetWorld }
 * or null if the rig doesn't have the bones we need.
 */
export function setupArmIK(scene) {
  let skinnedMesh = null
  scene.traverse(o => {
    if (o.isSkinnedMesh && o.skeleton && !skinnedMesh) skinnedMesh = o
  })
  if (!skinnedMesh) return null

  const skel = skinnedMesh.skeleton

  const effectorIdx        = findBone(skel, EFFECTOR_NAME)
  const forearmTwistIdx    = findBone(skel, FOREARM_TWIST_NAME)
  const forearmIdx         = findBone(skel, FOREARM_NAME)
  const upperArmTwistIdx   = findBone(skel, UPPER_ARM_TWIST_NAME)
  const upperArmIdx        = findBone(skel, UPPER_ARM_NAME)
  const targetIdx          = findBone(skel, TARGET_NAME)

  if (effectorIdx < 0 || forearmIdx < 0 || upperArmIdx < 0 || targetIdx < 0 ||
      forearmTwistIdx < 0 || upperArmTwistIdx < 0) {
    console.warn('[armIK] missing required bone(s):',
      { effectorIdx, forearmTwistIdx, forearmIdx, upperArmTwistIdx, upperArmIdx, targetIdx })
    return null
  }

  const targetBone = skel.bones[targetIdx]
  const effectorBone = skel.bones[effectorIdx]
  const upperArmBone = skel.bones[upperArmIdx]

  // Detach the target bone from its Rigify parent so we can drive its
  // world position directly without inheriting the rig's hand-control
  // motion. Reparent to the scene's root.
  if (targetBone.parent && targetBone.parent !== scene) {
    scene.attach(targetBone)
  }

  // Capture the rest world position of the effector — this is where we
  // anchor "baton tip at rest" so identity phone produces no arm motion.
  // Force matrix update so getWorldPosition reads the baked conducting pose.
  scene.updateMatrixWorld(true)
  const restTargetWorld = new THREE.Vector3()
  effectorBone.getWorldPosition(restTargetWorld)
  targetBone.position.copy(restTargetWorld)

  // Build IK config. CCD iterates from effector backward through the chain.
  // Order: closest to effector first. Crucially, three.js's CCDIKSolver
  // BREAKS OUT OF THE LOOP on the first disabled link — it doesn't skip.
  // So ALL links must be enabled or the solver becomes a no-op. The twist
  // bones (DEF-*.001) are left enabled and free; they only deform skin so
  // letting CCD rotate them does no harm.
  const iks = [{
    target:   targetIdx,
    effector: effectorIdx,
    links: [
      { index: forearmTwistIdx },
      { index: forearmIdx },
      { index: upperArmTwistIdx },
      { index: upperArmIdx },
    ],
    iteration: 10,
    minAngle: 0.0,
    maxAngle: Math.PI,
  }]

  const solver = new CCDIKSolver(skinnedMesh, iks)

  return {
    solver,
    targetBone,
    effectorBone,
    upperArmBone,
    restTargetWorld: restTargetWorld.clone(),
  }
}

const _restDir = new THREE.Vector3()
const _rotated = new THREE.Vector3()
const _scratch = new THREE.Vector3()

// How much to amplify the gesture-driven displacement of the target from
// its rest position. 1.0 = exact phone rotation; >1 makes a small phone
// gesture produce a larger arm reach. Tuned empirically: 30° phone tilt
// → noticeable visible arm motion on a typical 4-second-arc conducting
// figure at the ¾ camera distance.
const TARGET_GAIN = 2.5

/**
 * Drive the IK target each frame.
 *
 * Model: baton tip in figure-local space starts at the effector's rest
 * position. We rotate the shoulder→tip offset by the phone quaternion,
 * then amplify the DISPLACEMENT (rotated − rest) by TARGET_GAIN. Identity
 * phone quat → target stays at rest → no arm motion. Non-trivial quat →
 * target moves, IK solver bends the arm to reach.
 *
 *   shoulderWorld = upper_arm.head (world)
 *   restOffset    = restTargetWorld − shoulderWorld
 *   rotated       = phoneQuat ⨯ restOffset
 *   displacement  = rotated − restOffset
 *   targetWorld   = restTargetWorld + displacement × TARGET_GAIN
 */
export function driveArmIK(state, phoneQuat) {
  if (!state) return
  const { solver, targetBone, upperArmBone, restTargetWorld } = state

  const shoulder = _scratch.set(0, 0, 0)
  upperArmBone.getWorldPosition(shoulder)

  _restDir.copy(restTargetWorld).sub(shoulder)
  _rotated.copy(_restDir).applyQuaternion(phoneQuat)
  // displacement = rotated − restOffset, amplified
  _rotated.sub(_restDir).multiplyScalar(TARGET_GAIN)
  // target = restTargetWorld + amplified displacement
  targetBone.position.copy(restTargetWorld).add(_rotated)
  targetBone.updateMatrixWorld(true)

  solver.update()
}

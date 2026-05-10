import * as THREE from 'three'

const _parentWorld = new THREE.Quaternion()
const _result = new THREE.Quaternion()

/**
 * Compute the bone-local quaternion that makes `bone`'s world orientation
 * equal `worldQuat`, given its parent chain.
 *
 * If the bone has no parent, the local frame == world frame, so we just
 * return a clone of `worldQuat`.
 *
 * Caller must ensure `bone.parent.updateMatrixWorld(true)` has been called
 * for the current frame before invoking this. (`useFrame` runs after R3F's
 * automatic matrix update, so this is satisfied by default.)
 *
 * @param {THREE.Bone | THREE.Object3D} bone
 * @param {THREE.Quaternion} worldQuat
 * @returns {THREE.Quaternion}  A new quaternion (the caller may mutate freely).
 */
export function worldQuatToBoneLocal(bone, worldQuat) {
  if (!bone.parent) return worldQuat.clone()
  bone.parent.getWorldQuaternion(_parentWorld)
  // localTarget = parentWorld^-1 * worldQuat
  _result.copy(_parentWorld).invert().multiply(worldQuat)
  return _result.clone()
}

import * as THREE from 'three'

/**
 * Decompose a quaternion `q` into swing and twist around `axis`.
 *
 * Returns `{ swing, twist }` such that `swing.multiply(twist) ≈ q`,
 * where:
 *   - `twist` is the rotation around `axis`
 *   - `swing` is the rotation perpendicular to `axis`
 *
 * Reference: Allen Chou, "Game Math: Swing-Twist Interpolation".
 *
 * @param {THREE.Quaternion} q
 * @param {THREE.Vector3} axis  Should be a unit vector.
 * @returns {{ swing: THREE.Quaternion, twist: THREE.Quaternion }}
 */
export function swingTwistDecompose(q, axis) {
  // Project the vector part of q onto the axis.
  const projDot = q.x * axis.x + q.y * axis.y + q.z * axis.z
  const projX = axis.x * projDot
  const projY = axis.y * projDot
  const projZ = axis.z * projDot

  // Twist = normalize(quat(projection.xyz, q.w)).
  const tx = projX, ty = projY, tz = projZ, tw = q.w
  const tlen = Math.sqrt(tx * tx + ty * ty + tz * tz + tw * tw)

  const twist = new THREE.Quaternion()
  if (tlen < 1e-9) {
    // Singular case: q is a 180° rotation perpendicular to axis. Twist is identity.
    twist.set(0, 0, 0, 1)
  } else {
    twist.set(tx / tlen, ty / tlen, tz / tlen, tw / tlen)
  }

  // swing = q * conjugate(twist).
  const twistConj = twist.clone().conjugate()
  const swing = q.clone().multiply(twistConj)

  return { swing, twist }
}

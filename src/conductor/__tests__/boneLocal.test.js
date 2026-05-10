import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { worldQuatToBoneLocal } from '../boneLocal'

function quatsClose(a, b, eps = 1e-5) {
  const dot = Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w)
  return Math.abs(dot - 1) < eps
}

describe('worldQuatToBoneLocal', () => {
  it('returns the world quat unchanged when bone has no parent', () => {
    const bone = new THREE.Bone()
    const world = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.PI / 4
    )
    const local = worldQuatToBoneLocal(bone, world)
    expect(quatsClose(local, world)).toBe(true)
  })

  it('inverts the parent rotation so the child reaches the world target', () => {
    // Build a 2-level hierarchy: parent rotated 90° around Y; child stub.
    const parent = new THREE.Bone()
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)
    const child = new THREE.Bone()
    parent.add(child)
    parent.updateMatrixWorld(true)

    // Want child to face 45° pitch up around world X.
    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.PI / 4
    )
    const local = worldQuatToBoneLocal(child, target)

    // Apply the local rotation, recompute world matrix, and check world quat.
    child.quaternion.copy(local)
    parent.updateMatrixWorld(true)
    const worldOut = new THREE.Quaternion()
    child.getWorldQuaternion(worldOut)

    expect(quatsClose(worldOut, target)).toBe(true)
  })

  it('handles a 3-level chain', () => {
    const grandparent = new THREE.Bone()
    grandparent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 6)
    const parent = new THREE.Bone()
    parent.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 4)
    const child = new THREE.Bone()
    grandparent.add(parent)
    parent.add(child)
    grandparent.updateMatrixWorld(true)

    const target = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), -Math.PI / 8
    )
    const local = worldQuatToBoneLocal(child, target)

    child.quaternion.copy(local)
    grandparent.updateMatrixWorld(true)
    const worldOut = new THREE.Quaternion()
    child.getWorldQuaternion(worldOut)

    expect(quatsClose(worldOut, target)).toBe(true)
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse a GLB binary file (12-byte header, JSON chunk, BIN chunk).
function parseGlb(buf) {
  const magic = buf.readUInt32LE(0)
  if (magic !== 0x46546c67) throw new Error('not a GLB file (bad magic)')
  const jsonLen = buf.readUInt32LE(12)
  const jsonText = buf.slice(20, 20 + jsonLen).toString('utf8')
  return JSON.parse(jsonText)
}

function getSkinBoneNames(json) {
  const skinJoints = new Set()
  for (const skin of json.skins || []) {
    for (const j of skin.joints) skinJoints.add(j)
  }
  return new Set(
    [...skinJoints].map((i) => json.nodes[i].name).filter(Boolean)
  )
}

const GLB_PATH = path.resolve(__dirname, '../../../public/conductor/conductor.glb')

describe('public/conductor/conductor.glb', () => {
  // Bones referenced by ConductorView.jsx — DRIVEN_BONE_NAMES. If this test
  // fails after a re-export, the conductor will silently stop responding to
  // gestures, so we lock the names down here.
  const REQUIRED_BONES = [
    'DEF-spine.006',   // head
    'DEF-spine.004',   // chest
    'DEF-spine.001',   // spine
    'DEF-upper_arm.R', // right upper arm (baton arm)
  ]

  it('parses as a valid GLB with skin joints and animations', () => {
    const buf = readFileSync(GLB_PATH)
    const json = parseGlb(buf)
    expect(json.nodes.length).toBeGreaterThan(700)
    expect(json.skins?.length).toBeGreaterThanOrEqual(1)
    expect(json.animations?.length).toBeGreaterThanOrEqual(1)
  })

  it('contains every bone ConductorView drives, in the skin joints list', () => {
    const buf = readFileSync(GLB_PATH)
    const json = parseGlb(buf)
    const skinNames = getSkinBoneNames(json)
    for (const name of REQUIRED_BONES) {
      expect(skinNames.has(name), `missing skin bone '${name}'`).toBe(true)
    }
  })

  it('contains an animation with keyframes for every driven bone', () => {
    const buf = readFileSync(GLB_PATH)
    const json = parseGlb(buf)
    const anim = json.animations[0]
    const animatedNodeIdxs = new Set(anim.channels.map((c) => c.target.node))
    const animatedNames = new Set(
      [...animatedNodeIdxs].map((i) => json.nodes[i].name).filter(Boolean)
    )
    for (const name of REQUIRED_BONES) {
      expect(animatedNames.has(name), `bone '${name}' has no keyframes — pose won't apply`).toBe(true)
    }
  })

  // The bug that broke gesture-driven motion: three.js sanitizes node names
  // when loading a glTF (dots, brackets, colons, slashes get stripped). The
  // GLB JSON stores names like 'DEF-spine.006', but at runtime the bone's
  // .name property is 'DEF-spine006'. Look up via the sanitized form.
  it('three.js PropertyBinding.sanitizeNodeName strips dots from bone names', () => {
    expect(THREE.PropertyBinding.sanitizeNodeName('DEF-spine.006')).toBe('DEF-spine006')
    expect(THREE.PropertyBinding.sanitizeNodeName('DEF-spine.004')).toBe('DEF-spine004')
    expect(THREE.PropertyBinding.sanitizeNodeName('DEF-spine.001')).toBe('DEF-spine001')
    expect(THREE.PropertyBinding.sanitizeNodeName('DEF-upper_arm.R')).toBe('DEF-upper_armR')
  })

  it('every driven bone resolves to a real skin joint after sanitization', () => {
    const buf = readFileSync(GLB_PATH)
    const json = parseGlb(buf)
    const skinNames = getSkinBoneNames(json)
    // Build the set three.js will see at runtime: sanitize each glTF name.
    const runtimeNames = new Set(
      [...skinNames].map((n) => THREE.PropertyBinding.sanitizeNodeName(n))
    )
    for (const name of REQUIRED_BONES) {
      const sanitized = THREE.PropertyBinding.sanitizeNodeName(name)
      expect(
        runtimeNames.has(sanitized),
        `runtime bone '${sanitized}' (from '${name}') won't be in skeleton.bones[]`
      ).toBe(true)
    }
  })
})

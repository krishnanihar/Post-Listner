import { describe, it, expect } from 'vitest'
import { computeMetatronNodes, computeMetatronEdges } from '../metatronGeometry.js'

describe('computeMetatronNodes', () => {
  it('returns 13 nodes (Fruit of Life)', () => {
    const nodes = computeMetatronNodes(1)
    expect(nodes).toHaveLength(13)
  })

  it('places the first node at origin', () => {
    const nodes = computeMetatronNodes(1)
    expect(nodes[0]).toEqual({ x: 0, y: 0 })
  })

  it('inner hexagon (nodes 1-6) sits on circle of given radius', () => {
    const r = 5
    const nodes = computeMetatronNodes(r)
    for (let i = 1; i <= 6; i++) {
      const d = Math.hypot(nodes[i].x, nodes[i].y)
      expect(d).toBeCloseTo(r, 5)
    }
  })

  it('outer hexagon (nodes 7-12) sits on circle of 2 × radius', () => {
    const r = 5
    const nodes = computeMetatronNodes(r)
    for (let i = 7; i <= 12; i++) {
      const d = Math.hypot(nodes[i].x, nodes[i].y)
      expect(d).toBeCloseTo(r * 2, 5)
    }
  })

  it('inner hexagon spans 60 degrees per step', () => {
    const nodes = computeMetatronNodes(1)
    expect(nodes[1].x).toBeCloseTo(1, 5)
    expect(nodes[1].y).toBeCloseTo(0, 5)
    expect(nodes[2].x).toBeCloseTo(Math.cos(Math.PI / 3), 5)
    expect(nodes[2].y).toBeCloseTo(Math.sin(Math.PI / 3), 5)
  })
})

describe('computeMetatronEdges', () => {
  it('returns 78 edges for 13 nodes (every unique pair)', () => {
    const edges = computeMetatronEdges(13)
    expect(edges).toHaveLength(78)
  })

  it('each edge is a [i, j] pair with i < j and both in [0, nodeCount)', () => {
    const edges = computeMetatronEdges(13)
    for (const [i, j] of edges) {
      expect(i).toBeGreaterThanOrEqual(0)
      expect(j).toBeGreaterThan(i)
      expect(j).toBeLessThan(13)
    }
  })

  it('no duplicate edges', () => {
    const edges = computeMetatronEdges(13)
    const keys = new Set(edges.map(([i, j]) => `${i},${j}`))
    expect(keys.size).toBe(edges.length)
  })
})

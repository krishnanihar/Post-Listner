import { describe, it, expect } from 'vitest'
import { detectEraCluster, buildEraLine } from '../era'

describe('detectEraCluster', () => {
  it('returns null median for empty input', () => {
    expect(detectEraCluster([])).toEqual({ median: null, span: 0, clustered: false })
  })

  it('returns single year for one input', () => {
    expect(detectEraCluster([2003])).toEqual({ median: 2003, span: 0, clustered: false })
  })

  it('flags clustered when span is ≤5 years', () => {
    const result = detectEraCluster([2001, 2003, 2005])
    expect(result.median).toBe(2003)
    expect(result.span).toBe(4)
    expect(result.clustered).toBe(true)
  })

  it('does not flag clustered when span exceeds 5 years', () => {
    const result = detectEraCluster([1995, 2005, 2018])
    expect(result.span).toBe(23)
    expect(result.clustered).toBe(false)
  })

  it('ignores null/undefined years', () => {
    const result = detectEraCluster([2003, null, 2005, undefined])
    expect(result.median).toBeTruthy()
    expect(result.span).toBe(2)
  })
})

describe('buildEraLine', () => {
  it('returns null when no median', () => {
    expect(buildEraLine({ median: null, span: 0, clustered: false })).toBeNull()
  })

  it('returns a tight-cluster line when span ≤3', () => {
    const line = buildEraLine({ median: 2003, span: 2, clustered: true })
    expect(line.toLowerCase()).toContain('2003')
    expect(line.toLowerCase()).toMatch(/bump|period/)
  })

  it('returns a moderate-cluster line when 3<span≤5', () => {
    const line = buildEraLine({ median: 2003, span: 4, clustered: true })
    expect(line.toLowerCase()).toContain('2003')
    expect(line.toLowerCase()).toContain('cluster')
  })

  it('returns a span line when not clustered', () => {
    const line = buildEraLine({ median: 2003, span: 18, clustered: false })
    expect(line).toContain('18')
    expect(line.toLowerCase()).toMatch(/span|years|moment/)
  })
})

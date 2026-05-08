import { describe, it, expect } from 'vitest'
import { detectEraCluster, buildEraLine } from '../era'

describe('detectEraCluster', () => {
  it('returns null median for empty input', () => {
    expect(detectEraCluster([])).toEqual({ median: null, span: 0, clustered: false, tightCluster: false })
  })

  it('returns single year for one input', () => {
    expect(detectEraCluster([2003])).toEqual({ median: 2003, span: 0, clustered: false, tightCluster: false })
  })

  it('flags clustered when span is ≤5 years', () => {
    const result = detectEraCluster([2001, 2003, 2005])
    expect(result.median).toBe(2003)
    expect(result.span).toBe(4)
    expect(result.clustered).toBe(true)
  })

  it('does not flag clustered when span exceeds 10 years', () => {
    const result = detectEraCluster([1995, 2005, 2018])
    expect(result.span).toBe(23)
    expect(result.clustered).toBe(false)
  })

  it('ignores null/undefined years', () => {
    const result = detectEraCluster([2003, null, 2005, undefined])
    expect(result.median).toBeTruthy()
    expect(result.span).toBe(2)
  })

  it('returns tightCluster=true when span ≤ 5', () => {
    const result = detectEraCluster([1995, 1997, 1999])
    expect(result.tightCluster).toBe(true)
    expect(result.clustered).toBe(true)
    expect(result.span).toBe(4)
  })

  it('returns clustered=true, tightCluster=false when 5 < span ≤ 10', () => {
    const result = detectEraCluster([1992, 1998, 2001])
    expect(result.tightCluster).toBe(false)
    expect(result.clustered).toBe(true)
    expect(result.span).toBe(9)
  })

  it('returns clustered=false when span > 10', () => {
    const result = detectEraCluster([1985, 2002, 2018])
    expect(result.tightCluster).toBe(false)
    expect(result.clustered).toBe(false)
    expect(result.span).toBe(33)
  })
})

describe('buildEraLine', () => {
  it('returns null when no median', () => {
    expect(buildEraLine({ median: null, span: 0, clustered: false, tightCluster: false })).toBeNull()
  })

  it('returns a tight-cluster line when span ≤3', () => {
    const line = buildEraLine({ median: 2003, span: 2, clustered: true, tightCluster: true })
    expect(line.toLowerCase()).toContain('2003')
    expect(line.toLowerCase()).toMatch(/bump|period/)
  })

  it('returns a moderate-cluster line when 3<span≤5', () => {
    const line = buildEraLine({ median: 2003, span: 4, clustered: true, tightCluster: true })
    expect(line.toLowerCase()).toContain('2003')
    expect(line.toLowerCase()).toContain('cluster')
  })

  it('returns a span line when not clustered', () => {
    const line = buildEraLine({ median: 2003, span: 18, clustered: false, tightCluster: false })
    expect(line).toContain('18')
    expect(line.toLowerCase()).toMatch(/span|years|moment/)
  })

  it('surfaces bump-period language for tightCluster', () => {
    const line = buildEraLine({ median: 1996, span: 3, clustered: true, tightCluster: true })
    expect(line).toMatch(/bump period/i)
  })

  it('surfaces decade-imprint language for clustered but not tight', () => {
    const line = buildEraLine({ median: 1996, span: 8, clustered: true, tightCluster: false })
    expect(line).toMatch(/decade|imprint|window/i)
  })

  it('surfaces span-spread language when not clustered', () => {
    const line = buildEraLine({ median: 1996, span: 25, clustered: false, tightCluster: false })
    expect(line).toMatch(/span|across|don't anchor/i)
  })
})

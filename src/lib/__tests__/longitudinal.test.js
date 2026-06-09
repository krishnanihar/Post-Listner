import { describe, it, expect } from 'vitest'
import {
  MILESTONES, MILESTONE_MEANING, daysOfPractice, isMilestone, nextMilestone,
  bilderatlasUnlocked, anniversaryYear,
} from '../longitudinal.js'

const DAY = 86400000
const rec = (startedAt) => ({ startedAt })

describe('longitudinal — constants', () => {
  it('milestones + meanings', () => {
    expect(MILESTONES).toEqual([30, 100, 365, 1000])
    expect(MILESTONE_MEANING[30]).toBeTruthy()
    expect(MILESTONE_MEANING[1000]).toBeTruthy()
  })
})

describe('daysOfPractice — additive distinct days', () => {
  it('is 0 for no records', () => {
    expect(daysOfPractice([])).toBe(0)
  })
  it('collapses multiple same-day sessions to one day', () => {
    const t = 1_000_000_000_000
    expect(daysOfPractice([rec(t), rec(t + 3600_000), rec(t + 7200_000)])).toBe(1)
  })
  it('counts distinct calendar days', () => {
    const t = 1_000_000_000_000
    expect(daysOfPractice([rec(t), rec(t + DAY), rec(t + 2 * DAY)])).toBe(3)
  })
})

describe('milestones', () => {
  it('isMilestone', () => {
    expect(isMilestone(30)).toBe(true)
    expect(isMilestone(31)).toBe(false)
    expect(isMilestone(1000)).toBe(true)
  })
  it('nextMilestone announces the upcoming milestone at the prior close', () => {
    expect(nextMilestone(29)).toBe(30)
    expect(nextMilestone(30)).toBeNull()
    expect(nextMilestone(99)).toBe(100)
    expect(nextMilestone(5)).toBeNull()
  })
  it('bilderatlasUnlocked at >=30', () => {
    expect(bilderatlasUnlocked(29)).toBe(false)
    expect(bilderatlasUnlocked(30)).toBe(true)
  })
})

describe('anniversaryYear', () => {
  const first = 1_000_000_000_000
  const YEAR = 365 * DAY
  it('null before the first year', () => {
    expect(anniversaryYear([rec(first)], first + 100 * DAY)).toBeNull()
  })
  it('returns 1 within the window of the first anniversary', () => {
    expect(anniversaryYear([rec(first)], first + YEAR)).toBe(1)
    expect(anniversaryYear([rec(first)], first + YEAR + 2 * DAY)).toBe(1)
  })
  it('null outside the window', () => {
    expect(anniversaryYear([rec(first)], first + YEAR + 10 * DAY)).toBeNull()
  })
  it('returns 2 at the second anniversary', () => {
    expect(anniversaryYear([rec(first)], first + 2 * YEAR)).toBe(2)
  })
  it('null for empty records', () => {
    expect(anniversaryYear([], 12345)).toBeNull()
  })
})

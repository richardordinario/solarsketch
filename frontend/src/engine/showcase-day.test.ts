import { describe, expect, it } from 'vitest'

import { compute } from './simulation'
import { SHOWCASE_CLEAR, showcaseDay, showcaseHour, stateAt } from './showcase-day'

describe('showcaseDay', () => {
  const day = showcaseDay()

  it('is a valid system with a full day of states', () => {
    expect(day.v.issues.filter((i) => i.sev === 'critical')).toEqual([])
    expect(day.states).toHaveLength(288)
    expect(stateAt(day, 12).t % 1440).toBe(720)
  })

  it('generates at noon and not at night', () => {
    const noon = compute(stateAt(day, 12), day.v, SHOWCASE_CLEAR)
    const night = compute(stateAt(day, 5.5), day.v, SHOWCASE_CLEAR)
    expect(noon.ac.hybPv + noon.ppv).toBeGreaterThan(500)
    expect(night.G).toBe(0)
  })

  it('maps scroll progress to 05:30–19:00', () => {
    expect(showcaseHour(0)).toBe(5.5)
    expect(showcaseHour(1)).toBe(19)
    expect(showcaseHour(2)).toBe(19)
  })
})

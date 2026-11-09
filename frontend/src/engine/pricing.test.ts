import { describe, expect, it } from 'vitest'

import { makeNode } from './catalog'
import { estimateCost, unitPrice } from './pricing'

describe('estimateCost', () => {
  it('leaves out the utility grid and the grounding rod', () => {
    const nodes = [makeNode('grid', 0, 0), makeNode('gnd', 0, 0), makeNode('pv', 0, 0), makeNode('pv', 0, 0), makeNode('fan', 0, 0)]
    const est = estimateCost(nodes)
    expect(est.excluded).toBe(2)
    expect(est.lines.map((l) => l.type).sort()).toEqual(['fan', 'pv'])
    expect(est.total).toBe(2 * unitPrice(nodes[2])! + unitPrice(nodes[4])!)
    expect(est.appliances).toBe(unitPrice(nodes[4]))
    expect(est.equipment + est.appliances).toBe(est.total)
  })

  it('scales sized items with their specs', () => {
    const a = makeNode('pv', 0, 0)
    const b = makeNode('pv', 0, 0)
    b.specs.ratedPower = a.specs.ratedPower * 2
    expect(unitPrice(b)).toBe(2 * unitPrice(a)!)
  })
})

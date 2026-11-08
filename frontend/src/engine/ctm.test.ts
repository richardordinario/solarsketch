/** Smart CT meter (`ctm`): grid import/export readings and the export limit it gives inverters. */
import { describe, expect, it } from 'vitest'

import { makeNode } from './catalog'
import { RULES } from './rules'
import { compute, freshSim, step, type SimState } from './simulation'
import type { ComponentType, LabNode, Wire } from './types'
import { validate } from './validation'

const at = (h: number): SimState => ({ ...freshSim(), t: h * 60, started: true })
const node = (type: ComponentType, id: string, specs: Record<string, number> = {}): LabNode => {
  const n = makeNode(type, 0, 0, id)
  return { ...n, specs: { ...n.specs, ...specs } }
}
const wiresOf = (links: [string, string, string, string, number?][]): Wire[] =>
  links.map(([an, at, bn, bt, g], i) => ({ id: 'w' + (i + 1), a: { n: an, t: at }, b: { n: bn, t: bt }, color: 'auto', gauge: String(g ?? 10) }))

/** Grid → net meter → CT meter → board, with a grid-tied inverter (8 modules) and a fridge on the board. */
function system(ctSpecs: Record<string, number> = {}, withCt = true) {
  const pvs = Array.from({ length: 8 }, (_, i) => node('pv', 'pv' + i))
  const nodes = [...pvs, node('gti', 'gti1'), node('acdb', 'db1'), node('fridge', 'f1'), node('nm', 'nm1'), node('grid', 'gr1'), node('gnd', 'g1')]
  if (withCt) nodes.push(node('ctm', 'ct1', ctSpecs))
  const chain: [string, string, string, string, number?][] = pvs.slice(1).map((p, i) => [pvs[i].id, 'n', p.id, 'p', 4])
  const up = withCt
    ? ([
        ['nm1', 'l', 'ct1', 'l', 16],
        ['nm1', 'n', 'ct1', 'n', 16],
        ['ct1', 'lo', 'db1', 'l', 16],
        ['ct1', 'no', 'db1', 'n', 16],
      ] as [string, string, string, string, number][])
    : ([
        ['nm1', 'l', 'db1', 'l', 16],
        ['nm1', 'n', 'db1', 'n', 16],
      ] as [string, string, string, string, number][])
  const wires = wiresOf([
    ...chain,
    ['pv0', 'p', 'gti1', 'pvp', 4],
    ['pv7', 'n', 'gti1', 'pvn', 4],
    ['gti1', 'l', 'db1', 'l1', 4],
    ['gti1', 'n', 'db1', 'n1', 4],
    ['db1', 'l2', 'f1', 'l', 2.5],
    ['db1', 'n2', 'f1', 'n', 2.5],
    ['nm1', 'gl', 'gr1', 'l', 16],
    ['nm1', 'gn', 'gr1', 'n', 16],
    ...up,
    ['gti1', 'pe', 'g1', 'pe', 6],
    ['db1', 'pe', 'g1', 'pe', 6],
  ])
  return validate(nodes, wires)
}

describe('Smart CT meter', () => {
  it('registers its rule', () => {
    expect(RULES['MTR-001']).toBeDefined()
  })

  it('without a CT meter, the grid-tied inverter exports its surplus at noon', () => {
    const m = compute(at(12), system({}, false), 85)
    expect(m.ac.pgrid).toBeLessThan(-500)
    expect(m.ac.ctmCurtailed).toBe(0)
  })

  it('zero export: the inverter only covers the house load and the meter reads ~0 W', () => {
    const v = system({ exportLimit: 0 })
    expect(v.issues.filter((i) => i.sev === 'critical')).toEqual([])
    const m = compute(at(12), v, 85)
    expect(m.ac.pgrid).toBeCloseTo(0, 6)
    expect(m.ac.gtiAc).toBeCloseTo(150, 6)
    expect(m.ac.ctmCurtailed).toBeGreaterThan(500)
    expect(Math.abs(m.meters['ct1'].w)).toBeLessThan(1)
  })

  it('a 500 W limit lets 500 W out, read as negative (export) by the meter', () => {
    const m = compute(at(12), system({ exportLimit: 500 }), 85)
    expect(m.ac.pgrid).toBeCloseTo(-500, 6)
    expect(m.meters['ct1'].w).toBeCloseTo(-500, 0)
  })

  it('reads import at night and accumulates imported and exported energy', () => {
    const v = system({ exportLimit: 500 })
    const night = compute(at(22), v, 85)
    expect(night.meters['ct1'].w).toBeCloseTo(150, 0)
    let sim = at(11)
    for (let i = 0; i < 6; i++) sim = step(sim, v, 85, 0, v.nodes ?? [], [], 10).sim
    expect(sim.meterExportWh?.['ct1']).toBeGreaterThan(0)
  })

  it('warns (MTR-001) when the meter is not on a grid connection', () => {
    const nodes = [node('ctm', 'ct1'), node('fridge', 'f1')]
    const v = validate(nodes, wiresOf([['ct1', 'lo', 'f1', 'l'], ['ct1', 'no', 'f1', 'n']]))
    expect(v.issues.some((i) => i.rule === 'MTR-001' && i.target.node === 'ct1')).toBe(true)
    expect(system({ exportLimit: 0 }).issues.some((i) => i.rule === 'MTR-001')).toBe(false)
  })
})

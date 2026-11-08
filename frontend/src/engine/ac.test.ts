import { describe, expect, it } from 'vitest'

import type { Fault } from './faults'
import { TEMPLATES, gridTiedProject, hybridGridProject, hybridProject, sampleProject } from './sample-project'
import { simulateDays } from './scenario'
import { compute, freshSim, step, type SimState } from './simulation'
import type { Wire } from './types'
import { validate } from './validation'

const at = (h: number, extra: Partial<SimState> = {}): SimState => ({ ...freshSim(), t: h * 60, started: true, ...extra })
const rules = (v: ReturnType<typeof validate>) => v.issues.map((i) => i.rule)
const outage: Fault = { id: 'o', kind: 'grid-outage', target: 'grid1' }

describe('grid-tied system', () => {
  const { nodes, wires } = gridTiedProject()
  const v = validate(nodes, wires)

  it('validates cleanly and supplies every load', () => {
    expect(v.issues.filter((i) => i.sev !== 'info')).toEqual([])
    expect(v.sys.acSupplied.map((l) => l.id).sort()).toEqual(['ld1', 'ld2', 'ld3', 'ld4'])
  })

  it('exports at noon and imports at night', () => {
    const noon = compute(at(12), v, 85)
    expect(noon.ac.gtiAc).toBeGreaterThan(1000)
    expect(noon.ac.pgrid).toBeLessThan(0)
    const night = compute(at(21), v, 85)
    expect(night.ac.gtiAc).toBe(0)
    expect(night.ac.pgrid).toBeCloseTo(night.pload)
  })

  it('shuts down in a brownout (anti-islanding) and loses the loads', () => {
    const m = compute(at(12), v, 85, [outage])
    expect(m.ac.gtiAc).toBe(0)
    expect(m.ac.gtiIslanded).toBe(true)
    expect(m.onLoads).toEqual([])
  })

  it('accumulates import and export energy over a day', () => {
    let sim = { ...freshSim() }
    for (let i = 0; i < 720; i++) sim = step(sim, v, 85, 0, nodes).sim
    expect(sim.eExport).toBeGreaterThan(3)
    expect(sim.eImport).toBeGreaterThan(0.5)
  })

  it('warns without a net meter, and without a grid at all', () => {
    const noMeter: Wire[] = wires.filter((w) => !['w11', 'w12', 'w13', 'w14'].includes(w.id)).concat([
      { id: 'x1', a: { n: 'grid1', t: 'l' }, b: { n: 'db1', t: 'l' }, color: 'auto', gauge: '16' },
      { id: 'x2', a: { n: 'grid1', t: 'n' }, b: { n: 'db1', t: 'n' }, color: 'auto', gauge: '16' },
    ])
    expect(rules(validate(nodes, noMeter))).toContain('NM-001')
    const noGrid = wires.filter((w) => !['w11', 'w12'].includes(w.id))
    expect(rules(validate(nodes, noGrid))).toContain('AC-002')
  })
})

describe('hybrid system with generator backup', () => {
  const { nodes, wires } = hybridProject()
  const v = validate(nodes, wires)

  it('validates cleanly with a 2S 51.2 V bank', () => {
    expect(v.issues.filter((i) => i.sev !== 'info')).toEqual([])
    expect(v.sys.ac.hyb?.bank?.nomV).toBe(51.2)
    expect(v.sys.hybOk).toBe(true)
  })

  it('runs loads from battery at night when the grid is out, and from the grid otherwise', () => {
    expect(compute(at(21), v, 85, [outage]).ac.hybMode).toBe('battery')
    const night = compute(at(21, { soc: 25 }), v, 85)
    expect(night.ac.hybMode).toBe('grid')
    expect(night.ac.pgrid).toBeGreaterThan(0)
  })

  it('starts the generator through the transfer switch when the grid is out and the battery is low', () => {
    let sim = at(21, { soc: 15 })
    sim = step(sim, v, 85, 0, nodes, [outage]).sim
    expect(sim.genOn).toEqual(['gen1'])
    const m = compute(sim, v, 85, [outage])
    expect(m.ac.hybMode).toBe('generator')
    expect(m.ac.pgen).toBeGreaterThan(m.pload)
    sim = step(sim, v, 85, 0, nodes, [outage]).sim
    expect(sim.fuel).toBeGreaterThan(0)
  })

  it('keeps the house powered through a three-day outage', () => {
    const r = simulateDays(nodes, wires, 3, 85, [outage])
    expect(r.lvd).toBe(false)
    expect(r.minSoc).toBeGreaterThan(10)
  })

  it('reports no generator when it fails to start', () => {
    let sim = at(21, { soc: 15 })
    sim = step(sim, v, 85, 0, nodes, [outage, { id: 'gf', kind: 'gen-fail', target: 'gen1' }]).sim
    expect(compute(sim, v, 85, [outage, { id: 'gf', kind: 'gen-fail', target: 'gen1' }]).ac.pgen).toBe(0)
  })
})

describe('AC source conflicts', () => {
  it('flags an off-grid inverter wired straight to the grid (AC-001)', () => {
    const { nodes, wires } = sampleProject()
    const g = gridTiedProject().nodes.find((n) => n.id === 'grid1')!
    const v = validate(nodes.concat([g]), wires.concat([{ id: 'x', a: { n: 'grid1', t: 'l' }, b: { n: 'inv1', t: 'l' }, color: 'auto', gauge: '16' }]))
    expect(rules(v)).toContain('AC-001')
  })
})

describe('project templates', () => {
  it.each(TEMPLATES.map((tpl) => [tpl.id, tpl] as const))('%s has no critical findings', (_id, tpl) => {
    const { nodes, wires } = tpl.build()
    expect(validate(nodes, wires).issues.filter((i) => i.sev === 'critical')).toEqual([])
  })

  it.each([20, 100])('the grid hybrid with a %i %% reserve validates without warnings', (reserve) => {
    const { nodes, wires } = hybridGridProject(reserve)
    const v = validate(nodes, wires)
    expect(v.issues.filter((i) => i.sev !== 'info')).toEqual([])
    expect(v.sys.hybOk).toBe(true)
  })
})

describe('hybrid energy-source priority', () => {
  it('solar priority: the battery runs the house at night while the grid is present', () => {
    const { nodes, wires } = hybridGridProject(20)
    const v = validate(nodes, wires)
    const charged = compute(at(21, { soc: 60 }), v, 85).ac
    expect(charged.hybBattery).toBeLessThan(0)
    expect(charged.pgrid).toBeLessThan(1)
    const low = compute(at(21, { soc: 15 }), v, 85).ac
    expect(low.hybBattery).toBe(0)
    expect(low.pgrid).toBeGreaterThan(0)
  })

  it('battery backup priority: the grid runs the house and the battery is kept for a brownout', () => {
    const { nodes, wires } = hybridGridProject(100)
    const v = validate(nodes, wires)
    const normal = compute(at(21, { soc: 95 }), v, 85)
    expect(normal.ac.hybBattery).toBe(0)
    expect(normal.ac.pgrid).toBeGreaterThan(0)
    expect(compute(at(21, { soc: 95 }), v, 85, [outage]).ac.hybMode).toBe('battery')
  })
})
